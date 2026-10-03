import test from "node:test";
import assert from "node:assert/strict";
import { bodySegments } from "../lib/paper-body.ts";
import { academicUnits, formulaDisplayText, isFormulaText, isTranslationRefusal, isVisualDataText, sentenceItemRanges, splitSentences } from "../lib/sentences.ts";
import { extractPdfPageText } from "../lib/pdf-text.ts";
import { parseAlignedTranslations } from "../lib/aligned-translation.ts";

test("PDF body excludes page furniture and ends before references", () => {
  const pages = [
    { text: "Appl. Sci. 2025, 15, 4512\nAbstract\nThe first finding is useful.\nPublished: 19 April 2025\n1 of 3" },
    { text: "Appl. Sci. 2025, 15, 4512\nIntroduction\nThe next finding matters.\n20 September 2025\n2 of 3" },
    { text: "Appl. Sci. 2025, 15, 4512\nConclusions\nThe result is clear.\nReferences\n[1] A. Author, 2025\n3 of 3" },
  ];
  const body = bodySegments(pages).join("\n");
  assert.match(body, /The first finding/);
  assert.match(body, /The result is clear/);
  for (const skipped of ["Appl. Sci.", "Published:", "20 September", "of 3", "References", "A. Author"]) assert.ok(!body.includes(skipped), skipped);
});

test("sentence matching spans multiple PDF text items", () => {
  const sentences = splitSentences("A careful result matters. Another claim follows.");
  assert.equal(sentences.length, 2);
  const ranges = sentenceItemRanges(["A careful ", "result matters. ", "Another claim", " follows."], sentences);
  assert.deepEqual(ranges, [
    { startItem: 0, startOffset: 0, endItem: 1, endOffset: 14 },
    { startItem: 2, startOffset: 0, endItem: 3, endOffset: 8 },
  ]);
});

test("aligned translations accept common model response shapes", () => {
  assert.deepEqual(parseAlignedTranslations('{"translations":["译文一","译文二"]}', 2), ["译文一", "译文二"]);
  assert.deepEqual(parseAlignedTranslations('```json\n{"results":[{"translation":"译文一"},{"translated_text":"译文二"}]}\n```', 2), ["译文一", "译文二"]);
  assert.deepEqual(parseAlignedTranslations('说明如下：\n{"0":"译文一","1":"译文二"}\n完成。', 2), ["译文一", "译文二"]);
  assert.deepEqual(parseAlignedTranslations('1. 译文一\n2）译文二', 2), ["译文一", "译文二"]);
  assert.equal(parseAlignedTranslations('{"translations":["只有一句"]}', 2), null);
});

test("academic units join wrapped prose and preserve display mathematics", () => {
  const units = academicUnits("The controller mini-\nmizes tracking error across lines.\nJ = (Y - Yr + F)ᵀ Qw (Y - Yr + F) + ΔUᵀ Rw ΔU (34)\n其中 Qw 和 Rw 是权重矩阵。\n2. Conclusions\nThe method remains stable.");
  assert.deepEqual(units, [
    { source: "The controller minimizes tracking error across lines.", translate: true },
    { source: "J = (Y - Yr + F)ᵀ Qw (Y - Yr + F) + ΔUᵀ Rw ΔU (34)", translate: false, kind: "formula" },
    { source: "其中 Qw 和 Rw 是权重矩阵。", translate: true },
    { source: "2. Conclusions", translate: true },
    { source: "The method remains stable.", translate: true },
  ]);
  assert.equal(isFormulaText("Qw = □ □ □ q w 0 · · · 0 0 q w · · · Np × Np"), true);
  assert.equal(isFormulaText("u_e(k) u_e(k + 1) u_e(k + N_c - 1)"), true);
});

test("PDF coordinates restore lines and visual data is excluded from translation", () => {
  const text = extractPdfPageText([
    { str: "A result is shown below.", transform: [1, 0, 0, 1, 50, 700], height: 10 },
    { str: "0 50 100 150 200 250", transform: [1, 0, 0, 1, 90, 500], height: 10 },
    { str: "Figure 12. Tracking error curve.", transform: [1, 0, 0, 1, 50, 300], height: 10 },
  ], 800);
  assert.equal(text, "A result is shown below.\n0 50 100 150 200 250\nFigure 12. Tracking error curve.");
  assert.equal(isVisualDataText("0 50 100 150 200 250 -0.27 0.00 0.27 PID-TED MPC-TED IMPC-TED MPC-TPD"), true);
  const units = academicUnits(text);
  assert.equal(units.find(unit => unit.kind === "visual")?.translate, false);
  assert.ok(units.some(unit => unit.source.startsWith("Figure 12") && unit.translate));
});

test("broken matrices become a concise source-reference and refusal boilerplate is detected", () => {
  assert.equal(formulaDisplayText("U = □ □ □ □ Δu(k) □ □ □ □ (37)"), "［矩阵或公式（37）请对照左侧原文］");
  assert.equal(isTranslationRefusal("请提供需要翻译的学术文本内容。"), true);
});

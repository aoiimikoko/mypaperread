import test from "node:test";
import assert from "node:assert/strict";
import { bodySegments } from "../lib/paper-body.ts";
import { academicUnits, isFormulaText, isTranslationRefusal, isVisualDataText, sentenceItemRanges, splitSentences } from "../lib/sentences.ts";
import { extractPdfPageText } from "../lib/pdf-text.ts";
import { readJsonResponse } from "../lib/http-json.ts";
import { parseFormulaLatex, isDamagedFormula } from "../lib/formula-latex.ts";
import katex from "katex";
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
  assert.equal(isFormulaText("u e ( k ) u e ( k + 1 )"), true);
  assert.equal(isFormulaText("Expanding (11) at the reference point (x r, y r, θ r) using a Taylor series and neglecting higher-order terms."), false);
});

test("matrix continuations stay in one formula block", () => {
  const units = academicUnits("The error model is:\nX e = [ x − x r , y − y r , θ − θ r ]\nT\n= A t X e + B t u e (14)\nThe controller is then updated.");
  assert.deepEqual(units, [
    { source: "The error model is:", translate: true },
    { source: "X e = [ x − x r , y − y r , θ − θ r ]\nT\n= A t X e + B t u e (14)", translate: false, kind: "formula" },
    { source: "The controller is then updated.", translate: true },
  ]);
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
  assert.equal(units.filter(unit => unit.kind === "visual").length, 1);
  assert.ok(!units.some(unit => unit.source.startsWith("Figure 12") && unit.translate));
});

test("refusal boilerplate is detected", () => {
  assert.equal(isTranslationRefusal("请提供需要翻译的学术文本内容。"), true);
});

test("plain-text worker failures become readable errors", async () => {
  await assert.rejects(() => readJsonResponse(new Response("Your worker exceeded a limit", { status: 503 })), /HTTP 503/);
});

test("chart tick rows and legends never become formula blocks", () => {
  const units = academicUnits("(a) (b)\n0.0\n0.2\n0.4\n0.6\nC\nfl\nt /s\nPID-TED\nMPC-TED\nIMPC-TED\nFigure 18. Adhesion rate curve of each wheel.\n6. Conclusions\nThe controller remains stable.");
  assert.equal(units.filter(unit => unit.kind === "formula").length, 0);
  assert.equal(units.filter(unit => unit.kind === "visual").length, 1);
  assert.ok(units.some(unit => unit.translate && unit.source === "The controller remains stable."));
});

test("matrix fragments before an equation stay inside its formula block", () => {
  const units = academicUnits("The model follows:\nx\ny\nθ\n= v cos ( β + θ )\nThe state changes over time.");
  assert.equal(units[1].kind, "formula");
  assert.match(units[1].source, /^x\ny\nθ\n=/);
});

test("short equations and LaTeX matrix environments are formulas", () => {
  assert.equal(isFormulaText("X = f ( X , u ) (11)"), true);
  assert.equal(isFormulaText(String.raw`\begin{bmatrix}`), true);
});

test("multiline captions are skipped while subsequent body text is translated", () => {
  const units = academicUnits("Figure 18. Adhesion rate curve: (a) left front wheel;\n(b) right front wheel; (c) left rear wheel; (d) right rear wheel.\nThe controller remains stable under high adhesion.");
  assert.equal(units[0].kind, "visual");
  assert.match(units[0].source, /right rear wheel/);
  assert.equal(units[1].translate, true);
});

test("LaTeX matrices preserve row structure and render as mathematical HTML", () => {
  const matrix = String.raw`\begin{bmatrix}\dot{x}\\\dot{y}\\\dot{\theta}\end{bmatrix}=\begin{bmatrix}v\cos(\beta+\theta)\\v\sin(\beta+\theta)\\v\cos\beta\frac{\tan\delta_f-\tan\delta_r}{l_f+l_r}\end{bmatrix}\tag{10}`;
  const latex = parseFormulaLatex(JSON.stringify({ latex: matrix, uncertain: false }));
  assert.equal(latex, matrix);
  const html = katex.renderToString(latex, { displayMode: true, throwOnError: true, trust: false });
  assert.match(html, /class="katex/);
  assert.match(html, /<mtable/);
  assert.equal(parseFormulaLatex(JSON.stringify({ latex: matrix, uncertain: true })), null);
  assert.equal(parseFormulaLatex("无法识别，请提供文本"), null);
  assert.equal(isDamagedFormula("X = □ □ □"), true);
});

test("numbered adjacent equations are separate formula units", () => {
  const formulas = academicUnits("X = f ( X , u ) (11)\nX r = f ( X r , u r ) (12)").filter(unit => unit.kind === "formula");
  assert.equal(formulas.length, 2);
  assert.equal(isFormulaText("(18)~(21), (25) and (26):"), false);
  assert.equal(academicUnits("(18)~(21), (25) and (26):\nX = f ( X , u ) (27)")[0].translate, true);
});

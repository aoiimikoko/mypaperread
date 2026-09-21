import test from "node:test";
import assert from "node:assert/strict";
import { bodySegments } from "../lib/paper-body.ts";
import { sentenceItemRanges, splitSentences } from "../lib/sentences.ts";
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

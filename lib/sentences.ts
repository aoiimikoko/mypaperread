export type SentencePair = { source: string; translation: string };
export type ItemRange = { startItem: number; startOffset: number; endItem: number; endOffset: number };

export function splitSentences(text: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  return Array.from(segmenter.segment(text), part => part.segment.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function searchable(value: string): string {
  return Array.from(value.normalize("NFKC").toLocaleLowerCase()).filter(char => /[\p{L}\p{N}]/u.test(char)).join("");
}

/** Match extracted source sentences to PDF.js text-layer character offsets. */
export function sentenceItemRanges(items: string[], sentences: string[]): (ItemRange | null)[] {
  const positions: { item: number; offset: number }[] = [];
  let haystack = "";
  items.forEach((value, item) => {
    for (let offset = 0; offset < value.length; offset++) {
      const normalized = searchable(value[offset]);
      for (const char of normalized) { haystack += char; positions.push({ item, offset }); }
    }
  });
  let cursor = 0;
  return sentences.map(sentence => {
    const needle = searchable(sentence);
    if (!needle) return null;
    let at = haystack.indexOf(needle, cursor);
    if (at < 0) at = haystack.indexOf(needle);
    if (at < 0) return null;
    cursor = at + needle.length;
    const first = positions[at];
    const last = positions[cursor - 1];
    return { startItem: first.item, startOffset: first.offset, endItem: last.item, endOffset: last.offset + 1 };
  });
}

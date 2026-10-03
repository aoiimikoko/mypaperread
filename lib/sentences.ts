export type SentencePair = { source: string; translation: string; kind?: "formula" };
export type ItemRange = { startItem: number; startOffset: number; endItem: number; endOffset: number };
export type AcademicUnit = { source: string; translate: boolean };

export function splitSentences(text: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  return Array.from(segmenter.segment(text), part => part.segment.replace(/\s+/g, " ").trim()).filter(Boolean);
}

const headingLine = /^\s*(?:\d+(?:\.\d+){0,4}[.)]?\s+)?(?:(?:abstract|introduction|background|methods?|results?|discussion|conclusions?)\b|摘要|引言|方法|结果|讨论|结论)/i;
const numberedHeading = /^\s*\d+(?:\.\d+){1,4}\.?\s+\D/;

export function isFormulaText(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return false;
  const replacementGlyphs = (compact.match(/[□�]/g) || []).length;
  const operators = (compact.match(/[=+−–*/×÷<>≤≥≈≠∑∏∫√∞^_()[\]{}|]/g) || []).length;
  const digits = (compact.match(/\d/g) || []).length;
  const longWords = text.match(/[A-Za-z\p{Script=Han}]{3,}/gu) || [];
  const isolatedVariables = text.match(/(?:^|\s)[A-Za-zΑ-Ωα-ωξΔ][0-9]?(?=\s|$)/g) || [];
  return replacementGlyphs >= 2
    || (/[=≈≤≥]/.test(compact) && operators + digits >= 6 && longWords.length < 5)
    || (operators + digits >= 14 && longWords.length < 7)
    || (isolatedVariables.length >= 5 && operators + digits >= 5);
}

/** Rebuild wrapped prose while keeping display equations as independent, untranslated units. */
export function academicUnits(text: string): AcademicUnit[] {
  const normalized = text.replace(/\u00ad/g, "").replace(/([A-Za-z])-\s*\n\s*([a-z])/g, "$1$2");
  const lines = normalized.split(/\n+/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const units: AcademicUnit[] = [];
  let prose = "";
  const flush = () => {
    if (!prose.trim()) return;
    units.push(...splitSentences(prose).map(source => ({ source, translate: true })));
    prose = "";
  };
  const addProse = (value: string) => { prose = prose ? `${prose} ${value}` : value; };
  for (const line of lines) {
    if (headingLine.test(line) || numberedHeading.test(line)) { flush(); units.push({ source: line, translate: true }); continue; }
    if (isFormulaText(line)) {
      const formulaStart = line.search(/(?:^|[：:，,;；]\s*)(?=[A-Za-zΑ-Ωα-ωξΔ][A-Za-z0-9_ ]{0,10}\s*[=≈])/);
      const start = formulaStart > 0 ? formulaStart + (line[formulaStart].match(/[：:，,;；]/) ? 1 : 0) : 0;
      const prefix = line.slice(0, start).trim();
      let formula = line.slice(start).trim();
      if (prefix) addProse(prefix);
      flush();
      const explanation = formula.search(/\s(?:其中|式中|where|in which)\s*/i);
      if (explanation > 12) {
        units.push({ source: formula.slice(0, explanation).trim(), translate: false });
        formula = formula.slice(explanation).trim();
        addProse(formula);
      } else units.push({ source: formula, translate: false });
      continue;
    }
    addProse(line);
  }
  flush();
  return units;
}

export function normalizeAcademicText(text: string): string {
  return academicUnits(text).map(unit => unit.source).join("\n");
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

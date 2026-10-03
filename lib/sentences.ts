export type SentencePair = { source: string; translation: string; kind?: "formula" | "visual" };
export type ItemRange = { startItem: number; startOffset: number; endItem: number; endOffset: number };
export type AcademicUnit = { source: string; translate: boolean; kind?: "formula" | "visual" };

export function splitSentences(text: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  return Array.from(segmenter.segment(text), part => part.segment.replace(/\s+/g, " ").trim()).filter(Boolean);
}

const headingLine = /^\s*(?:\d+(?:\.\d+){0,4}[.)]?\s+)?(?:(?:abstract|introduction|background|methods?|results?|discussion|conclusions?)\b|摘要|引言|方法|结果|讨论|结论)/i;
const numberedHeading = /^\s*\d+(?:\.\d+){1,4}\.?\s+\D/;
const captionStart = /\b(?:fig(?:ure)?|table)\s*\d+[.:]?|(?:图|表)\s*\d+[.:：]?/i;

export function isFormulaText(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return false;
  const replacementGlyphs = (compact.match(/[□�]/g) || []).length;
  const operators = (compact.match(/[=+−–*/×÷<>≤≥≈≠∑∏∫√∞^_()[\]{}|∂∇∈∉∪∩⊂⊆⊤±∓·⋯…]/g) || []).length;
  const digits = (compact.match(/\d/g) || []).length;
  const longWords = text.match(/[A-Za-z\p{Script=Han}]{3,}/gu) || [];
  const isolatedVariables = text.match(/(?:^|\s)[A-Za-zΑ-Ωα-ωξΔ][0-9]?(?=\s|$)/g) || [];
  const indexedTerms = text.match(/[A-Za-zΑ-Ωα-ωξΔδ][A-Za-z0-9_]*\s*\([^)]{1,24}\)/g) || [];
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const symbolicTokens = tokens.filter(token => /^(?:[A-Za-zΑ-Ωα-ωξΔδ](?:_[A-Za-z0-9]+|\d+)?|[−+]?\d+(?:\.\d+)?|[()[\]{}=+−–*/×÷<>≤≥≈≠^_|∂∇∈∉∪∩⊂⊆⊤±∓·⋯…]+)$/.test(token)).length;
  const symbolicLine = tokens.length >= 4 && symbolicTokens / tokens.length >= .55 && operators + digits >= 4 && longWords.length < 3;
  return replacementGlyphs >= 2
    || (/[=≈≤≥]/.test(compact) && operators + digits >= 6 && longWords.length < 5)
    || (operators + digits >= 14 && longWords.length < 7)
    || (isolatedVariables.length >= 5 && operators + digits >= 5)
    || (indexedTerms.length >= 2 && longWords.length < 4)
    || symbolicLine;
}

/** Detect flattened axis labels, legends and table rows that are useful in the PDF image but harmful as translation input. */
export function isVisualDataText(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized || captionStart.test(normalized.slice(0, 18))) return false;
  const numbers = normalized.match(/[−-]?\d+(?:\.\d+)?%?/g) || [];
  const tokens = normalized.match(/[A-Za-zΑ-Ωα-ω]+(?:-[A-Za-z]+)?|[\p{Script=Han}]+|[−-]?\d+(?:\.\d+)?%?/gu) || [];
  const sentenceMarks = (normalized.match(/[!?。！？；;]|[.](?=\s|$)/g) || []).length;
  const legendLabels = normalized.match(/\b(?:PID|MPC|IMPC|TED|TPD|reference|series)\b/gi) || [];
  const proseWords = normalized.match(/[A-Za-z]{4,}|[\p{Script=Han}]{2,}/gu) || [];
  const uniqueRatio = tokens.length ? new Set(tokens.map(token => token.toLocaleLowerCase())).size / tokens.length : 1;
  return !/[=≤≥≈]/.test(normalized) && ((numbers.length >= 5 && sentenceMarks === 0 && proseWords.length < 10)
    || (numbers.length >= 5 && legendLabels.length >= 4)
    || (numbers.length >= 8 && tokens.length >= 16 && uniqueRatio < .65));
}

export function formulaDisplayText(text: string): string {
  const brokenGlyphs = (text.match(/[□�]/g) || []).length;
  const looksLikeFlattenedMatrix = text.length > 220 && /[=+≤≥Δ]/.test(text) && (text.match(/\d/g) || []).length >= 8;
  if (brokenGlyphs < 2 && !looksLikeFlattenedMatrix) return text;
  const number = [...text.matchAll(/\((\d{1,4})\)/g)].at(-1)?.[1];
  return `［矩阵或公式${number ? `（${number}）` : ""}请对照左侧原文］`;
}

export function isTranslationRefusal(text: string): boolean {
  return /(?:请(?:提供|发送|输入).{0,18}(?:翻译|学术文本)|没有提供.{0,12}(?:文本|内容)|无法处理这个请求|未提供需要翻译|please (?:provide|send|enter).{0,24}(?:text|content)|no (?:text|content).{0,16}(?:provided|received))/i.test(text);
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
  const addNonProse = (source: string, kind: "formula" | "visual") => {
    flush();
    const previous = units.at(-1);
    if (previous?.kind === kind) previous.source += `\n${source}`;
    else units.push({ source, translate: false, kind });
  };
  for (const line of lines) {
    if (headingLine.test(line) || numberedHeading.test(line)) { flush(); units.push({ source: line, translate: true }); continue; }
    const captionAt = line.search(captionStart);
    if (captionAt === 0 || captionAt > 0 && isVisualDataText(line.slice(0, captionAt))) {
      addNonProse(line, "visual");
      continue;
    }
    if (isVisualDataText(line)) { addNonProse(line, "visual"); continue; }
    if (isFormulaText(line)) {
      const formulaStart = line.search(/(?:^|[：:，,;；]\s*)(?=[A-Za-zΑ-Ωα-ωξΔ][A-Za-z0-9_ ]{0,10}\s*[=≈])/);
      const start = formulaStart > 0 ? formulaStart + (line[formulaStart].match(/[：:，,;；]/) ? 1 : 0) : 0;
      const prefix = line.slice(0, start).trim();
      let formula = line.slice(start).trim();
      if (prefix) addProse(prefix);
      flush();
      const explanation = formula.search(/\s(?:其中|式中|where|in which)\s*/i);
      if (explanation > 12) {
        addNonProse(formula.slice(0, explanation).trim(), "formula");
        formula = formula.slice(explanation).trim();
        addProse(formula);
      } else addNonProse(formula, "formula");
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

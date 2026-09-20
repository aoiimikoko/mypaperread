type TextPage = { text: string };

const startHeading = /(?:^|\n)\s*(?:\d+(?:\.\d+)*[.)]?\s*)?(?:abstract|摘要|摘\s*要|summary|introduction|引言)\s*[:：.\-—]?\s*/im;
const conclusionHeading = /(?:^|\n)\s*(?:\d+(?:\.\d+)*[.)]?\s*)?(?:conclusions?|concluding remarks?|结论(?:与展望)?|总结)\s*[:：.\-—]?\s*/im;
const afterBodyHeading = /(?:^|\n)\s*(?:\d+(?:\.\d+)*[.)]?\s*)?(?:references|bibliography|acknowledg(?:e)?ments?|author contributions?|funding|conflicts? of interest|data availability|appendix|supplementary materials?|参考文献|致谢|附录|基金项目|作者贡献)\s*[:：.\-—]?\s*/im;
const boilerplate = /^(?:keywords?\s*[:：]|关键词\s*[:：]|received\s*[:：]|revised\s*[:：]|accepted\s*[:：]|published\s*[:：]|citation\s*[:：]|doi\s*[:：]|https?:\/\/\S+|©|copyright\b|check for updates\b|\d+\s*(?:of|\/)\s*\d+\s*$|[a-z.\s]+\d{4},\s*\d+[,:]\s*\d+\s*$)/i;

/** Return the text that a whole-page translation is allowed to send to a model. */
export function bodySegments(pages: TextPage[]): string[] {
  const separator = "\n\f\n";
  const offsets: number[] = [];
  let full = "";
  for (const page of pages) {
    offsets.push(full.length);
    full += page.text + separator;
  }
  const startMatch = startHeading.exec(full);
  if (!startMatch) return pages.map(() => "");
  const start = startMatch.index + (startMatch[0].startsWith("\n") ? 1 : 0);
  const conclusion = conclusionHeading.exec(full.slice(start + startMatch[0].length));
  const endSearchFrom = conclusion ? start + startMatch[0].length + conclusion.index + conclusion[0].length : start;
  const after = afterBodyHeading.exec(full.slice(endSearchFrom));
  const end = after ? endSearchFrom + after.index : full.length;
  return pages.map((page, index) => {
    const pageStart = offsets[index];
    const pageEnd = pageStart + page.text.length;
    if (pageEnd <= start || pageStart >= end) return "";
    return page.text.slice(Math.max(0, start - pageStart), Math.min(page.text.length, end - pageStart))
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !boilerplate.test(line))
      .join("\n")
      .trim();
  });
}

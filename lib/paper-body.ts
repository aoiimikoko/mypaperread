type TextPage = { text: string };

const startHeading = /(?:^|\n)\s*(?:\d+(?:\.\d+)*[.)]?\s*)?(?:abstract|摘要|摘\s*要|summary|introduction|引言)\s*[:：.\-—]?\s*/im;
const conclusionHeading = /(?:^|\n)\s*(?:\d+(?:\.\d+)*[.)]?\s*)?(?:conclusions?|concluding remarks?|结论(?:与展望)?|总结)\s*[:：.\-—]?\s*/im;
const afterBodyHeading = /(?:^|\n)\s*(?:\d+(?:\.\d+)*[.)]?\s*)?(?:references|bibliography|acknowledg(?:e)?ments?|author contributions?|funding|conflicts? of interest|data availability|appendix|supplementary materials?|参考文献|致谢|附录|基金项目|作者贡献)\s*[:：.\-—]?\s*/im;
const boilerplate = /^(?:keywords?\s*[:：]|关键词\s*[:：]|(?:received|revised|accepted|published|publication date|date|收稿日期|修回日期|录用日期|发表日期)\s*[:：]|citation\s*[:：]|doi\s*[:：]|https?:\/\/\S+|©|copyright\b|check for updates\b|\d{1,4}$|(?:page\s*)?\d+\s*(?:of|\/|／)\s*\d+\s*$|第?\s*\d+\s*页(?:\s*[\/／共]\s*\d+\s*页?)?$|[a-z.\s]+\d{4},\s*\d+[,:]\s*\d+\s*$)/i;
const dateOnly = /^(?:(?:\d{1,2}\s+)?[a-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[a-z]+\s+\d{4}|\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)$/i;

function furnitureKey(line: string): string {
  return line.toLocaleLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

/** Return the text that a whole-page translation is allowed to send to a model. */
export function bodySegments(pages: TextPage[]): string[] {
  const furnitureCounts = new Map<string, number>();
  for (const page of pages) {
    const lines = page.text.split("\n").map(line => line.trim()).filter(Boolean);
    for (const line of new Set([...lines.slice(0, 3), ...lines.slice(-3)])) {
      const key = furnitureKey(line);
      if (key.length >= 6 && key.length <= 100) furnitureCounts.set(key, (furnitureCounts.get(key) || 0) + 1);
    }
  }
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
      .filter(line => line && !boilerplate.test(line) && !dateOnly.test(line) && (furnitureCounts.get(furnitureKey(line)) || 0) < 2)
      .join("\n")
      .trim();
  });
}

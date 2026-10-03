export type PdfTextItemLike = {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

/** Restore physical PDF lines from text coordinates instead of trusting inconsistent hasEOL flags. */
export function extractPdfPageText(items: PdfTextItemLike[], pageHeight: number): string {
  let output = "";
  let previous: PdfTextItemLike | undefined;
  for (const item of items) {
    const value = item.str.trim();
    if (!value) continue;
    const x = item.transform[4] || 0;
    const y = item.transform[5] || 0;
    if (y < pageHeight * .04 || y > pageHeight * .965) continue;
    if (previous) {
      const previousY = previous.transform[5] || 0;
      const previousX = previous.transform[4] || 0;
      const tolerance = Math.max(1.5, Math.min(item.height || 10, previous.height || 10) * .32);
      const changedLine = Math.abs(y - previousY) > tolerance || x + 2 < previousX;
      if (changedLine || previous.hasEOL) output += "\n";
      else if (!output.endsWith(" ") && !output.endsWith("\n")) output += " ";
    }
    output += value;
    previous = item;
  }
  return output.replace(/[^\S\n]+/g, " ").replace(/\n[ \t]+/g, "\n").trim();
}

/** Normalize model output without guessing mathematical structure from broken glyphs. */
export function parseFormulaLatex(raw: string): string | null {
  let value = raw.trim().replace(/^```(?:json|latex|tex)?\s*/i, "").replace(/\s*```$/, "");
  if (value.startsWith("{")) {
    try {
      const result = JSON.parse(value) as { latex?: unknown; uncertain?: boolean };
      if (result.uncertain || typeof result.latex !== "string") return null;
      value = result.latex.trim();
    } catch { return null; }
  }
  value = value.replace(/^\\\[\s*/, "").replace(/\s*\\\]$/, "").replace(/^\$\$\s*/, "").replace(/\s*\$\$$/, "");
  if (!value || value.length > 14000 || /[□�]|请提供|无法识别|sorry|cannot|please provide/i.test(value)) return null;
  if (!/[=+−\-*/^_\\]/.test(value)) return null;
  return value;
}

export function isDamagedFormula(source: string): boolean {
  return /[□�]/.test(source);
}

function textFrom(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  for (const key of ["translation", "translated", "translated_text", "target", "text", "content"]) {
    if (typeof item[key] === "string" && item[key].trim()) return item[key].trim();
  }
  return null;
}

function valuesFrom(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;
  const object = value as Record<string, unknown>;
  for (const key of ["translations", "results", "items", "data", "output"]) {
    if (Array.isArray(object[key])) return object[key] as unknown[];
  }
  const numbered = Object.entries(object).filter(([key]) => /^\d+$/.test(key)).sort((a, b) => Number(a[0]) - Number(b[0]));
  return numbered.length ? numbered.map(([, item]) => item) : null;
}

/** Accept common JSON and numbered-list shapes returned by OpenAI-compatible models. */
export function parseAlignedTranslations(raw: string, expected: number): string[] | null {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const candidates = [clean];
  const objectStart = clean.indexOf("{");
  const objectEnd = clean.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(clean.slice(objectStart, objectEnd + 1));
  const arrayStart = clean.indexOf("[");
  const arrayEnd = clean.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) candidates.push(clean.slice(arrayStart, arrayEnd + 1));
  for (const candidate of candidates) {
    try {
      const values = valuesFrom(JSON.parse(candidate));
      const translations = values?.map(textFrom);
      if (translations?.length === expected && translations.every((item): item is string => !!item)) return translations;
    } catch {}
  }
  const numbered = clean.split(/\r?\n/).map(line => line.match(/^\s*(?:\d+[.):、）．]|\[\d+\]|\(\d+\))\s*(.+)$/)?.[1]?.trim()).filter((item): item is string => !!item);
  return numbered.length === expected ? numbered : null;
}

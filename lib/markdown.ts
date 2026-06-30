/**
 * Build markdown from chunk results. Untranslated chunks (`null`) are shown
 * in their original source text inside a dimmed blockquote so progress is
 * visible. Translated chunks are shown normally.
 *
 * `sourceTexts` - original chunk texts (parallel array to `results`).
 * If `sourceTexts[i]` is missing, falls back to just skipping the chunk.
 */
export function buildMarkdown(
  totalPages: number,
  chunkPages: number[],
  results: (string | null)[],
  sourceTexts?: (string | null)[],
): string {
  const byPage = new Map<number, { text: string; translated: boolean }[]>();
  for (let i = 0; i < chunkPages.length; i++) {
    const page = chunkPages[i];
    const translated = results[i];
    const arr = byPage.get(page) ?? [];
    if (translated != null) {
      arr.push({ text: translated, translated: true });
    } else {
      const src = sourceTexts?.[i];
      if (src != null && src.trim()) {
        arr.push({ text: src, translated: false });
      }
    }
    byPage.set(page, arr);
  }

  const lines: string[] = [];
  lines.push(`# Translated document (${totalPages} page${totalPages === 1 ? "" : "s"})`);
  lines.push("");
  for (let p = 1; p <= totalPages; p++) {
    lines.push("---");
    lines.push("");
    lines.push(`## Page ${p}`);
    lines.push("");
    const parts = byPage.get(p);
    if (!parts || parts.length === 0) {
      lines.push("_No extractable text on this page._");
    } else {
      for (const part of parts) {
        if (part.translated) {
          lines.push(part.text);
        } else {
          // Show original in a blockquote so it's visually distinct.
          lines.push("> ⏳ _translating..._");
          const quoted = part.text
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n");
          lines.push(quoted);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

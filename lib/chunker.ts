export interface Chunk {
  text: string;
  page: number;
  index: number;
}

export interface PageLike {
  pageNumber: number;
  text: string;
}

export function chunkPages(pages: PageLike[], maxChars = 1600): Chunk[] {
  const chunks: Chunk[] = [];
  let globalIndex = 0;
  for (const page of pages) {
    const pieces = splitIntoPieces(page.text);
    const pageChunks = packPieces(pieces, maxChars);
    for (const text of pageChunks) {
      if (!text.trim()) continue;
      chunks.push({ text, page: page.pageNumber, index: globalIndex++ });
    }
  }
  return chunks;
}

function splitIntoPieces(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n");
  return raw.split(/\n[ \t]*\n/);
}

function packPieces(pieces: string[], maxChars: number): string[] {
  const out: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = "";
  };
  for (const piece of pieces) {
    if (piece.length > maxChars) {
      flush();
      for (const s of hardSplit(piece, maxChars)) out.push(s);
      continue;
    }
    const candidate = cur ? `${cur}\n\n${piece}` : piece;
    if (candidate.length > maxChars) {
      flush();
      cur = piece;
    } else {
      cur = candidate;
    }
  }
  flush();
  return out;
}

function hardSplit(text: string, maxChars: number): string[] {
  const out: string[] = [];
  const lines = text.split("\n");
  let cur = "";
  for (const line of lines) {
    if (line.length > maxChars) {
      if (cur.trim()) {
        out.push(cur.trim());
        cur = "";
      }
      for (let i = 0; i < line.length; i += maxChars) {
        out.push(line.slice(i, i + maxChars));
      }
      continue;
    }
    const candidate = cur ? `${cur}\n${line}` : line;
    if (candidate.length > maxChars) {
      if (cur.trim()) out.push(cur.trim());
      cur = line;
    } else {
      cur = candidate;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

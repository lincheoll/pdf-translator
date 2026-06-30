import { extractText, getDocumentProxy } from "unpdf";

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractResult {
  totalPages: number;
  pages: ExtractedPage[];
}

export async function extractPdfPages(buffer: Uint8Array): Promise<ExtractResult> {
  const pdf = await getDocumentProxy(buffer);
  const { totalPages, text } = await extractText(pdf); // text: string[] per page
  const pages: ExtractedPage[] = text.map((t, i) => ({
    pageNumber: i + 1,
    text: t ?? "",
  }));
  return { totalPages, pages };
}

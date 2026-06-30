import { extractPdfPages } from "./pdf";
import { chunkPages, type Chunk, type PageLike } from "./chunker";
import { translateChunk, ocrPage, type LlmConfig, type OcrConfig } from "./llm";
import { renderPageToPngBase64 } from "./pdf-image";
import { buildMarkdown } from "./markdown";
import { saveMarkdown, readUploadedPdf, upsertRecentJob } from "./storage";
import {
  getJob,
  initJob,
  updateJob,
  setChunkLayout,
  appendChunks,
  recordChunkResult,
  setOcrLayout,
  recordOcrPage,
  Queue,
} from "./runtime";
import type { TranslationSettings } from "./types";

const CONCURRENCY = 3;
const MAX_RETRIES = 3;
const CHUNK_MAX_CHARS = 1600;
const OCR_DPI = 150;

export interface StartTranslationParams {
  jobId: string;
  fileName: string;
  settings: TranslationSettings;
}

export async function startTranslation(params: StartTranslationParams): Promise<void> {
  const { jobId, fileName, settings } = params;
  const startedAt = Date.now();
  initJob({
    jobId,
    fileName,
    status: "extracting",
    totalPages: 0,
    totalChunks: 0,
    doneChunks: 0,
    failedChunks: 0,
    currentPage: 0,
    message: "Extracting text from PDF...",
    startedAt,
    updatedAt: startedAt,
    ocrTotalPages: 0,
    ocrDonePages: 0,
  });

  let totalPages = 0;
  let allChunks: Chunk[] = [];
  try {
    const pdfBuf = await readUploadedPdf(jobId);
    const { totalPages: tp, pages: extracted } = await extractPdfPages(new Uint8Array(pdfBuf));
    totalPages = tp;
    updateJob(jobId, { totalPages, message: `Loaded ${tp} page(s).` });

    // ---- Setup translation workers ----
    // Workers start immediately and pull from a shared queue.
    // In OCR mode, chunks are pushed as each page finishes OCR.
    // In non-OCR mode, all chunks are pushed at once.
    const queue = new Queue<Chunk | null>(CONCURRENCY * 2);
    let totalDone = 0;
    let totalFailed = 0;

    async function worker(): Promise<void> {
      while (true) {
        if (getJob(jobId)?.cancel) return;
        const chunk = await queue.pop();
        if (chunk === null) return;

        let ok = false;
        let lastErr = "";
        let translated = "";
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (getJob(jobId)?.cancel) break;
          try {
            translated = await translateChunk({
              cfg: settings as LlmConfig,
              text: chunk.text,
              source: settings.source,
              target: settings.target,
            });
            ok = true;
            break;
          } catch (e) {
            lastErr = e instanceof Error ? e.message : String(e);
            await sleep(Math.min(2000 * attempt, 8000));
          }
        }

        if (!ok) {
          totalFailed += 1;
          translated = chunk.text;
        }
        recordChunkResult(jobId, chunk.index, translated);
        totalDone += 1;
        updateJob(jobId, {
          status: "pipeline",
          doneChunks: totalDone,
          failedChunks: totalFailed,
          currentPage: chunk.page,
          message: ok
            ? `Translated chunk ${totalDone}/${allChunks.length} (page ${chunk.page})`
            : `Failed chunk ${totalDone}/${allChunks.length} (page ${chunk.page}) — kept original. ${lastErr}`.slice(0, 240),
        });
      }
    }

    const workers = Array.from({ length: CONCURRENCY }, () => worker());

    if (settings.ocrMode) {
      // ---- Pipelined OCR + translation ----
      // For each page: render image → OCR → chunk → push to translation queue.
      // Translation workers run concurrently, so OCR and translation overlap.
      const ocrModel = settings.ocrModel.trim() || settings.model;
      const ocrEndpoint = settings.ocrEndpoint.trim() || settings.endpoint;
      updateJob(jobId, {
        status: "ocr",
        ocrTotalPages: totalPages,
        message: `OCR: recognizing page 1/${totalPages}...`,
      });
      setOcrLayout(jobId, totalPages);

      for (let p = 1; p <= totalPages; p++) {
        if (getJob(jobId)?.cancel) break;
        let pageText = "";
        let ok = false;
        let lastErr = "";
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (getJob(jobId)?.cancel) break;
          try {
            const img = await renderPageToPngBase64(jobId, p, OCR_DPI);
            pageText = await ocrPage(
              { endpoint: ocrEndpoint, apiKey: settings.apiKey, model: ocrModel } satisfies OcrConfig,
              img,
            );
            ok = true;
            break;
          } catch (e) {
            lastErr = e instanceof Error ? e.message : String(e);
            await sleep(Math.min(2000 * attempt, 8000));
          }
        }
        recordOcrPage(jobId, p - 1, pageText);
        updateJob(jobId, {
          currentPage: p,
          message: ok
            ? `OCR: page ${p}/${totalPages} done · translating...`
            : `OCR: page ${p}/${totalPages} failed — ${lastErr}`.slice(0, 200),
        });

        // Chunk this page and push to translation queue immediately.
        // Use appendChunks (not setChunkLayout) so existing results are preserved.
        const pageChunks = chunkPages(
          [{ pageNumber: p, text: pageText }],
          CHUNK_MAX_CHARS,
        );
        for (const c of pageChunks) {
          c.index = allChunks.length;
          allChunks.push(c);
        }
        appendChunks(
          jobId,
          pageChunks.map((c) => c.page),
          pageChunks.map((c) => c.text),
        );
        updateJob(jobId, {
          totalChunks: allChunks.length,
          status: "pipeline",
        });
        for (const c of pageChunks) {
          queue.push(c);
        }
      }

      // OCR done — push sentinel nulls so workers stop.
      updateJob(jobId, { ocrPhase: false, message: "Translating remaining chunks..." });
      for (let i = 0; i < CONCURRENCY; i++) {
        queue.push(null as Chunk | null);
      }
    } else {
      // ---- Non-OCR mode: chunk all pages, push all at once ----
      allChunks = chunkPages(extracted as PageLike[], CHUNK_MAX_CHARS);
      allChunks.forEach((c, i) => (c.index = i));
      setChunkLayout(
        jobId,
        allChunks.map((c) => c.page),
        allChunks.map((c) => c.text),
      );
      updateJob(jobId, {
        totalChunks: allChunks.length,
        status: "translating",
        message: `Translating ${allChunks.length} chunk(s)...`,
      });
      for (const c of allChunks) {
        queue.push(c);
      }
      // Push sentinel nulls so workers stop.
      for (let i = 0; i < CONCURRENCY; i++) {
        queue.push(null as Chunk | null);
      }
    }

    // Wait for all translation workers to finish.
    await Promise.all(workers);

    // ---- Merge ----
    const cancelled = !!getJob(jobId)?.cancel;
    updateJob(jobId, { status: "merging", message: "Merging into markdown..." });
    const job = getJob(jobId);
    const md = buildMarkdown(
      totalPages,
      job?.chunkPages ?? [],
      job?.chunkResults ?? [],
      job?.chunkSources ?? [],
    );
    await saveMarkdown(jobId, md);

    if (cancelled) {
      updateJob(jobId, { status: "cancelled", message: "Translation cancelled. Partial result saved." });
      await upsertRecentJob({
        jobId, fileName,
        source: settings.source, target: settings.target,
        endpoint: settings.endpoint, model: settings.model,
        status: "cancelled",
        totalChunks: allChunks.length, totalPages,
        createdAt: startedAt, completedAt: Date.now(),
      });
      return;
    }

    updateJob(jobId, {
      status: "completed",
      message: `Done · ${totalDone} chunks${totalFailed ? `, ${totalFailed} failed` : ""}.`,
    });
    await upsertRecentJob({
      jobId, fileName,
      source: settings.source, target: settings.target,
      endpoint: settings.endpoint, model: settings.model,
      status: "completed",
      totalChunks: allChunks.length, totalPages,
      createdAt: startedAt, completedAt: Date.now(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    updateJob(jobId, { status: "failed", error: msg, message: `Failed: ${msg}` });
    await upsertRecentJob({
      jobId, fileName,
      source: settings.source, target: settings.target,
      endpoint: settings.endpoint, model: settings.model,
      status: "failed",
      totalChunks: allChunks.length, totalPages,
      createdAt: startedAt, completedAt: Date.now(),
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

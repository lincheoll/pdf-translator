import type { JobProgress } from "./types";

export interface LiveJob extends JobProgress {
  cancel: boolean;
  chunkPages: number[];
  chunkResults: (string | null)[];
  /** Original (source) chunk texts — for live preview of untranslated chunks. */
  chunkSources: string[];
  ocrPageTexts: string[];
  ocrPhase: boolean;
}

/** Lightweight async queue for pipeline backpressure. */
export class Queue<T> {
  private items: T[] = [];
  private resolvers: Array<(v: T) => void> = [];
  constructor(private capacity: number) {}
  push(item: T): void {
    if (this.resolvers.length > 0) {
      this.resolvers.shift()!(item);
    } else {
      this.items.push(item);
    }
  }
  async pop(): Promise<T> {
    if (this.items.length > 0) return this.items.shift()!;
    return new Promise((r) => this.resolvers.push(r));
  }
  get size(): number {
    return this.items.length + this.resolvers.length;
  }
}

const store = new Map<string, LiveJob>();

export function initJob(progress: JobProgress): void {
  store.set(progress.jobId, {
    ...progress,
    cancel: false,
    chunkPages: [],
    chunkResults: [],
    chunkSources: [],
    ocrPageTexts: [],
    ocrPhase: true,
  });
}

export function getJob(jobId: string): LiveJob | undefined {
  return store.get(jobId);
}

export function updateJob(jobId: string, patch: Partial<LiveJob>): void {
  const j = store.get(jobId);
  if (!j) return;
  Object.assign(j, patch, { updatedAt: Date.now() });
}

export function requestCancel(jobId: string): void {
  const j = store.get(jobId);
  if (j) {
    j.cancel = true;
    j.message = "Cancellation requested...";
    j.updatedAt = Date.now();
  }
}

export function setChunkLayout(jobId: string, chunkPages: number[], chunkSources: string[]): void {
  const j = store.get(jobId);
  if (!j) return;
  j.chunkPages = chunkPages;
  j.chunkResults = new Array(chunkPages.length).fill(null);
  j.chunkSources = chunkSources;
  j.updatedAt = Date.now();
}

/** Append chunks without resetting existing results (for pipelined OCR). */
export function appendChunks(jobId: string, pages: number[], sources: string[]): void {
  const j = store.get(jobId);
  if (!j) return;
  for (let i = 0; i < pages.length; i++) {
    j.chunkPages.push(pages[i]);
    j.chunkSources.push(sources[i]);
    j.chunkResults.push(null);
  }
  j.totalChunks = j.chunkPages.length;
  j.updatedAt = Date.now();
}

export function recordChunkResult(jobId: string, index: number, text: string): void {
  const j = store.get(jobId);
  if (!j) return;
  j.chunkResults[index] = text;
  j.updatedAt = Date.now();
}

export function setOcrLayout(jobId: string, totalPages: number): void {
  const j = store.get(jobId);
  if (!j) return;
  j.ocrPageTexts = new Array(totalPages).fill("");
  j.ocrTotalPages = totalPages;
  j.updatedAt = Date.now();
}

export function recordOcrPage(jobId: string, pageIdx: number, text: string): void {
  const j = store.get(jobId);
  if (!j) return;
  j.ocrPageTexts[pageIdx] = text;
  j.ocrDonePages = pageIdx + 1;
  j.updatedAt = Date.now();
}

export function toProgress(j: LiveJob): JobProgress {
  const { cancel: _cancel, chunkPages: _cp, chunkResults: _cr, chunkSources: _cs, ocrPageTexts: _ot, ocrPhase: _op, ...rest } = j;
  return rest;
}
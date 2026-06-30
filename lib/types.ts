export type JobStatus =
  | "queued"
  | "extracting"
  | "ocr"
  | "pipeline"
  | "translating"
  | "merging"
  | "completed"
  | "failed"
  | "cancelled";

export interface TranslationSettings {
  source: string;
  target: string;
  endpoint: string;
  apiKey?: string;
  model: string;
  ocrMode: boolean;
  ocrEndpoint: string;
  ocrModel: string;
}

export interface JobProgress {
  jobId: string;
  status: JobStatus;
  fileName: string;
  totalPages: number;
  totalChunks: number;
  doneChunks: number;
  failedChunks: number;
  currentPage: number;
  message: string;
  startedAt: number;
  updatedAt: number;
  error?: string;
  ocrTotalPages: number;
  ocrDonePages: number;
  ocrPhase?: boolean;
  markdown?: string;
}

export interface RecentJob {
  jobId: string;
  fileName: string;
  source: string;
  target: string;
  endpoint: string;
  model: string;
  status: JobStatus;
  totalChunks: number;
  totalPages: number;
  createdAt: number;
  completedAt?: number;
}

export interface EndpointTestResult {
  ok: boolean;
  message: string;
  models?: string[];
}
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  Languages,
  Square,
  Download,
  History,
  FileText,
  Loader2,
  ChevronDown,
  ChevronRight,
  ScanText,
} from "lucide-react";
import Settings from "@/components/Settings";
import PdfViewer from "@/components/PdfViewer";
import MarkdownViewer from "@/components/MarkdownViewer";
import type { EndpointTestResult, JobProgress, RecentJob, TranslationSettings } from "@/lib/types";

const SETTINGS_STORAGE_KEY = "pdf-translator:settings";

const DEFAULT_SETTINGS: TranslationSettings = {
  source: "English",
  target: "Korean",
  endpoint: "http://localhost:11434/v1",
  apiKey: "",
  model: "",
  ocrMode: false,
  ocrEndpoint: "",
  ocrModel: "",
};

const RUNNING_STATES: JobProgress["status"][] = [
  "queued",
  "extracting",
  "ocr",
  "pipeline",
  "translating",
  "merging",
];

export default function Page() {
  const [settings, setSettings] = useState<TranslationSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<EndpointTestResult | null>(null);
  const [recent, setRecent] = useState<RecentJob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      const j = await res.json();
      setRecent(j.jobs ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // Restore settings from localStorage on mount (client-only, after hydration).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TranslationSettings>;
        setSettings((s) => ({ ...s, ...parsed }));
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  // Persist settings whenever they change.
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore quota errors */
    }
  }, [settings]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollProgress = useCallback(
    (id: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/progress?jobId=${id}`);
          if (!res.ok) return;
          const p: JobProgress = await res.json();
          setProgress(p);
          // Live preview: show partial markdown as chunks complete.
          if (p.markdown) setMarkdown(p.markdown);
          if (!RUNNING_STATES.includes(p.status)) {
            stopPolling();
            setBusy(false);
            if (p.status === "completed") {
              const r = await fetch(`/api/result?jobId=${id}`);
              if (r.ok) {
                const data = await r.json();
                setMarkdown(data.markdown ?? p.markdown ?? null);
              }
            }
            loadRecent();
          }
        } catch {
          /* keep polling */
        }
      }, 500);
    },
    [loadRecent, stopPolling],
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const onFile = async (file: File) => {
    setError(null);
    setMarkdown(null);
    setProgress(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setJobId(data.jobId);
      setFileName(data.fileName);
      const now = Date.now();
      setProgress({
        jobId: data.jobId,
        status: "queued",
        fileName: data.fileName,
        totalPages: 0,
        totalChunks: 0,
        doneChunks: 0,
        failedChunks: 0,
        currentPage: 0,
        message: "Uploaded.",
        startedAt: now,
        updatedAt: now,
        ocrTotalPages: 0,
        ocrDonePages: 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setJobId(null);
    } finally {
      setUploading(false);
    }
  };

  const onTranslate = async () => {
    if (!jobId) {
      setError("Upload a PDF first.");
      return;
    }
    if (!settings.endpoint.trim() || !settings.model.trim()) {
      setError("Endpoint and model are required.");
      return;
    }
    if (settings.ocrMode && !settings.ocrModel.trim()) {
      setError("OCR mode requires an OCR (vision) model.");
      return;
    }
    setError(null);
    setBusy(true);
    setMarkdown(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, settings, fileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start translation");
      pollProgress(jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const onStop = async () => {
    if (!jobId) return;
    await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop", jobId }),
    });
  };

  const onTest = async () => {
    if (!settings.endpoint.trim() || !settings.model.trim()) {
      setTestResult({ ok: false, message: "Enter endpoint and model first." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/test-endpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  };

  const onExport = () => {
    if (!markdown || !jobId) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translated-${fileName || jobId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadRecentJob = async (job: RecentJob) => {
    stopPolling();
    setBusy(false);
    setJobId(job.jobId);
    setFileName(job.fileName);
    setSettings((s) => ({
      ...s,
      source: job.source || s.source,
      target: job.target || s.target,
      endpoint: job.endpoint || s.endpoint,
      model: job.model || s.model,
    }));
    setProgress({
      jobId: job.jobId,
      status: job.status,
      fileName: job.fileName,
      totalPages: job.totalPages,
      totalChunks: job.totalChunks,
      doneChunks: job.status === "completed" ? job.totalChunks : 0,
      failedChunks: 0,
      currentPage: 0,
      message: job.status,
      startedAt: job.createdAt,
      updatedAt: job.completedAt ?? job.createdAt,
      ocrTotalPages: 0,
      ocrDonePages: 0,
    });
    setError(null);
    if (job.status === "completed") {
      const r = await fetch(`/api/result?jobId=${job.jobId}`);
      if (r.ok) {
        const d = await r.json();
        setMarkdown(d.markdown ?? null);
      } else {
        setMarkdown(null);
      }
    } else {
      setMarkdown(null);
    }
  };

  const pct =
    progress && progress.totalChunks > 0
      ? Math.round((progress.doneChunks / progress.totalChunks) * 100)
      : 0;
  const ocrPct =
    progress && progress.ocrTotalPages > 0
      ? Math.round((progress.ocrDonePages / progress.ocrTotalPages) * 100)
      : 0;
  const isRunning = busy && progress ? RUNNING_STATES.includes(progress.status) : false;

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Languages className="h-5 w-5 text-sky-400" />
          <h1 className="text-sm font-semibold">PDF Translator</h1>
          <span className="hidden text-xs text-neutral-500 sm:inline">· personal local tool</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || busy}
            className="flex items-center gap-2 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload PDF"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={onTranslate}
            disabled={!jobId || busy}
            className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Languages className="h-4 w-4" /> Translate
          </button>
        </div>
      </header>

      {/* Collapsible settings */}
      <section className="border-b border-neutral-800 bg-neutral-900/40">
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs text-neutral-300 hover:bg-neutral-900/60"
        >
          {settingsOpen ? (
            <ChevronDown className="h-4 w-4 text-neutral-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral-500" />
          )}
          <span className="font-medium uppercase tracking-wide text-neutral-400">Settings</span>
          <span className="text-neutral-600">·</span>
          <span className="truncate text-neutral-400">
            {settings.source || "?"} → {settings.target || "?"}
          </span>
          <span className="text-neutral-600">·</span>
          <span className="truncate text-neutral-400">{settings.model || "no model"}</span>
          <span className="text-neutral-600">·</span>
          <span className="truncate text-neutral-500">{settings.endpoint || "no endpoint"}</span>
          {settings.ocrMode && (
            <span className="ml-1 flex items-center gap-1 rounded bg-sky-900/60 px-1.5 py-0.5 text-[10px] text-sky-300">
              <ScanText className="h-3 w-3" /> OCR
            </span>
          )}
        </button>
        {settingsOpen && (
          <div className="px-4 pb-3 pt-1">
            <Settings
              settings={settings}
              onChange={setSettings}
              onTest={onTest}
              testing={testing}
              testResult={testResult}
            />
          </div>
        )}
      </section>

      {/* Progress / status */}
      {(progress || error) && (
        <section className="border-b border-neutral-800 bg-neutral-900/70 px-4 py-2">
          {error && <p className="mb-1 text-xs text-rose-400">{error}</p>}
          {progress && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-300">
                <span className="flex min-w-0 items-center gap-2">
                  {isRunning && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-400" />}
                  <span className="font-medium uppercase tracking-wide text-neutral-400">
                    {progress.status === "pipeline" ? "pipeline" : progress.status}
                  </span>
                  <span className="text-neutral-600">·</span>
                  <span className="truncate">{progress.message}</span>
                </span>
                <span className="flex items-center gap-3">
                  {progress.status === "ocr" && progress.ocrTotalPages > 0 && (
                    <span>
                      OCR {progress.ocrDonePages}/{progress.ocrTotalPages}
                    </span>
                  )}
                  {(progress.status === "pipeline" || progress.status === "translating") &&
                    progress.ocrPhase &&
                    progress.ocrTotalPages > 0 && (
                      <span>
                        OCR {progress.ocrDonePages}/{progress.ocrTotalPages}
                      </span>
                    )}
                  {progress.totalChunks > 0 && (
                    <span>
                      {progress.doneChunks}/{progress.totalChunks} chunks
                    </span>
                  )}
                  {progress.totalPages > 0 && <span>{progress.totalPages} pages</span>}
                  {progress.failedChunks > 0 && (
                    <span className="text-amber-400">{progress.failedChunks} failed</span>
                  )}
                  {isRunning && (
                    <button
                      onClick={onStop}
                      className="flex items-center gap-1 text-rose-400 hover:text-rose-300"
                    >
                      <Square className="h-3 w-3" /> Stop
                    </button>
                  )}
                  {progress.status === "completed" && markdown && (
                    <button
                      onClick={onExport}
                      className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
                    >
                      <Download className="h-3 w-3" /> Export .md
                    </button>
                  )}
                </span>
              </div>
              {/* OCR progress bar (standalone OCR phase) */}
              {progress.status === "ocr" && progress.ocrTotalPages > 0 && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-fuchsia-500 transition-all"
                    style={{ width: `${ocrPct}%` }}
                  />
                </div>
              )}
              {/* OCR progress bar (pipeline phase, while OCR still running) */}
              {progress.status === "pipeline" && progress.ocrPhase && progress.ocrTotalPages > 0 && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-fuchsia-500 transition-all"
                    style={{ width: `${ocrPct}%` }}
                  />
                </div>
              )}
              {/* Translation progress bar */}
              {(progress.status === "pipeline" || progress.status === "translating") &&
                progress.totalChunks > 0 && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Split view */}
      <section className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col border-b border-neutral-800 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-400">
            <FileText className="h-3.5 w-3.5" /> Original PDF
            {fileName && <span className="truncate text-neutral-500">· {fileName}</span>}
          </div>
          <div className="min-h-0 flex-1">
            <PdfViewer jobId={jobId} fileName={fileName} />
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-400">
            <FileText className="h-3.5 w-3.5" /> Translated Markdown
            {isRunning && markdown && (
              <span className="ml-auto animate-pulse text-[10px] text-sky-400">live…</span>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <MarkdownViewer markdown={markdown} />
          </div>
        </div>
      </section>

      {/* Recent jobs */}
      {recent.length > 0 && (
        <section className="max-h-36 overflow-auto border-t border-neutral-800 bg-neutral-950 px-4 py-2">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-neutral-400">
            <History className="h-3.5 w-3.5" /> Recent jobs ({recent.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((j) => (
              <button
                key={j.jobId}
                onClick={() => loadRecentJob(j)}
                className="rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-left text-xs hover:border-sky-600"
              >
                <span className="text-neutral-200">{j.fileName}</span>
                <span className="ml-2 text-neutral-500">
                  {j.source} → {j.target}
                </span>
                <span
                  className={
                    "ml-2 " +
                    (j.status === "completed"
                      ? "text-emerald-400"
                      : j.status === "failed"
                        ? "text-rose-400"
                        : j.status === "cancelled"
                          ? "text-amber-400"
                          : "text-neutral-500")
                  }
                >
                  {j.status}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
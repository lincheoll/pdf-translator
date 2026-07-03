"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, List, X } from "lucide-react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;

type ReactPdfModule = typeof import("react-pdf");

export default function PdfViewer(props: PdfViewerProps) {
  const { jobId, gotoPage } = props;
  const [pdfLib, setPdfLib] = useState<ReactPdfModule | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  const [showThumbs, setShowThumbs] = useState(false);
  const [activeThumb, setActiveThumb] = useState(1);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastGotoRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("react-pdf").then((mod) => {
      if (cancelled) return;
      mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      setPdfLib(mod);
      void import("react-pdf/dist/Page/AnnotationLayer.css");
      void import("react-pdf/dist/Page/TextLayer.css");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (gotoPage == null || gotoPage <= 0) return;
    if (lastGotoRef.current === gotoPage) return;
    lastGotoRef.current = gotoPage;
    setActiveThumb(gotoPage);
    scrollToPage(gotoPage);
  }, [gotoPage, numPages, scrollToPage]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
  }, []);

  useEffect(() => {
    setNumPages(0);
    setError(null);
    setScale(1.0);
    setActiveThumb(1);
    pageRefs.current.clear();
    lastGotoRef.current = null;
  }, [jobId]);

  // Track scroll to update active thumbnail.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || numPages === 0) return;
    const onScroll = () => {
      for (let p = numPages; p >= 1; p--) {
        const el = pageRefs.current.get(p);
        if (el && el.offsetTop - container.scrollTop <= 80) {
          setActiveThumb(p);
          return;
        }
      }
      setActiveThumb(1);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [numPages, pdfLib]);

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)));

  if (!jobId) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        <p>Upload a PDF to preview it here.</p>
      </div>
    );
  }
  if (!pdfLib) {
    return <div className="py-8 text-center text-xs text-neutral-500">Loading viewer…</div>;
  }

  const { Document, Page } = pdfLib;

  return (
    <div className="relative h-full">
      {/* Toolbar */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900/90 px-1.5 py-1 shadow-lg backdrop-blur">
        <button
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE}
          className="rounded p-1.5 text-neutral-300 hover:bg-neutral-700 disabled:opacity-30"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-neutral-400">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE}
          className="rounded p-1.5 text-neutral-300 hover:bg-neutral-700 disabled:opacity-30"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <div className="mx-0.5 h-5 w-px bg-neutral-700" />
        <button
          onClick={() => setShowThumbs((v) => !v)}
          className={`rounded p-1.5 hover:bg-neutral-700 ${showThumbs ? "text-sky-400" : "text-neutral-300"}`}
          title="Page thumbnails"
        >
          <List className="h-4 w-4" />
        </button>
      </div>

      {/* PDF content */}
      <div ref={scrollContainerRef} className="h-full overflow-auto bg-neutral-800">
        {error && (
          <div className="p-4 text-center text-sm text-rose-400">Failed to load PDF: {error}</div>
        )}
        <Document
          file={`/api/file/${jobId}`}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(e: unknown) =>
            setError(e instanceof Error ? e.message : String(e))
          }
          loading={<div className="py-8 text-center text-xs text-neutral-500">Loading PDF…</div>}
        >
          {/* Thumbnails sidebar — inside Document context so Page has a doc */}
          {showThumbs && (
            <div className="fixed left-3 top-[calc(3rem+0.75rem)] bottom-3 z-20 w-40 overflow-auto rounded-lg border border-neutral-700 bg-neutral-900/95 p-2 shadow-lg backdrop-blur">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase text-neutral-500">Pages</span>
                <button
                  onClick={() => setShowThumbs(false)}
                  className="text-neutral-500 hover:text-neutral-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setActiveThumb(p);
                      scrollToPage(p);
                    }}
                    className={`flex flex-col items-center gap-1 rounded border p-1 transition-colors ${
                      activeThumb === p
                        ? "border-sky-500 bg-sky-950/50"
                        : "border-neutral-700 hover:border-neutral-500"
                    }`}
                  >
                    <div className="overflow-hidden rounded bg-white">
                      <Page
                        pageNumber={p}
                        scale={0.15}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-neutral-400">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main pages */}
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              ref={(el) => {
                if (el) pageRefs.current.set(pageNum, el);
                else pageRefs.current.delete(pageNum);
              }}
              className="mb-3 flex justify-center"
            >
              <Page
                pageNumber={pageNum}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={
                  <div className="flex h-[400px] items-center text-xs text-neutral-500">
                    Loading page {pageNum}…
                  </div>
                }
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}

interface PdfViewerProps {
  jobId: string | null;
  fileName?: string;
  gotoPage?: number | null;
}

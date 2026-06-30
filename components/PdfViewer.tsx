"use client";

import { FileText } from "lucide-react";

interface PdfViewerProps {
  jobId: string | null;
  fileName?: string;
}

export default function PdfViewer({ jobId, fileName }: PdfViewerProps) {
  if (!jobId) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        <div className="text-center">
          <FileText className="mx-auto mb-3 h-12 w-12 opacity-40" />
          <p>Upload a PDF to preview it here.</p>
          <p className="mt-1 text-xs text-neutral-600">
            Native browser viewer · built-in zoom &amp; page navigation.
          </p>
        </div>
      </div>
    );
  }
  return (
    <iframe
      key={jobId}
      src={`/api/file/${jobId}`}
      title={fileName ?? "PDF preview"}
      className="h-full w-full bg-neutral-900"
    />
  );
}

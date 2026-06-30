import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { saveUploadedPdf } from "@/lib/storage";
import { initJob } from "@/lib/runtime";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }

  const jobId = randomUUID();
  const buf = Buffer.from(await file.arrayBuffer());
  await saveUploadedPdf(jobId, buf);

  const now = Date.now();
  initJob({
    jobId,
    fileName: file.name,
    status: "queued",
    totalPages: 0,
    totalChunks: 0,
    doneChunks: 0,
    failedChunks: 0,
    currentPage: 0,
    message: "Uploaded. Ready to translate.",
    startedAt: now,
    updatedAt: now,
    ocrTotalPages: 0,
    ocrDonePages: 0,
  });

  return NextResponse.json({ jobId, fileName: file.name });
}

import { NextRequest, NextResponse } from "next/server";
import { getJob, toProgress } from "@/lib/runtime";
import { buildMarkdown } from "@/lib/markdown";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { status: "unknown", message: "No such job in memory (server may have restarted)." },
      { status: 404 },
    );
  }

  const progress = toProgress(job);

  // Include ocrPhase for frontend UI.
  (progress as any).ocrPhase = job.ocrPhase;

  // Live preview: include partial markdown once any chunk has been translated.
  if (job.chunkPages.length > 0) {
    progress.markdown = buildMarkdown(job.totalPages, job.chunkPages, job.chunkResults, job.chunkSources);
  }

  return NextResponse.json(progress);
}
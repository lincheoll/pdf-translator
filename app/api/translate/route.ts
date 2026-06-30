import { NextRequest, NextResponse } from "next/server";
import { startTranslation } from "@/lib/translator";
import { getJob, requestCancel } from "@/lib/runtime";
import type { TranslationSettings } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body?.action === "stop") {
    if (body.jobId) requestCancel(body.jobId);
    return NextResponse.json({ ok: true });
  }

  const { jobId, settings, fileName } = (body ?? {}) as {
    jobId?: string;
    settings?: TranslationSettings;
    fileName?: string;
  };

  if (!jobId || !settings) {
    return NextResponse.json({ error: "jobId and settings are required" }, { status: 400 });
  }
  if (!settings.endpoint?.trim() || !settings.model?.trim()) {
    return NextResponse.json({ error: "endpoint and model are required" }, { status: 400 });
  }

  const existing = getJob(jobId);
  if (
    existing &&
    ["extracting", "translating", "merging"].includes(existing.status)
  ) {
    return NextResponse.json({ error: "Job already in progress" }, { status: 409 });
  }

  // Fire-and-forget: long-running translation continues after the response.
  void startTranslation({
    jobId,
    fileName: fileName ?? existing?.fileName ?? "document.pdf",
    settings,
  }).catch(() => {});

  return NextResponse.json({ ok: true, jobId });
}

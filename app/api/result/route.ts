import { NextRequest, NextResponse } from "next/server";
import { readMarkdown } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  const download = req.nextUrl.searchParams.get("download");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const md = await readMarkdown(jobId);
  if (md == null) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  if (download === "1") {
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="translated.md"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ jobId, markdown: md });
}

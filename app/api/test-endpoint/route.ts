import { NextRequest, NextResponse } from "next/server";
import { testEndpoint } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const cfg = await req.json().catch(() => ({}));
  if (!cfg?.endpoint || !cfg?.model) {
    return NextResponse.json(
      { ok: false, message: "endpoint and model are required" },
      { status: 400 },
    );
  }
  const res = await testEndpoint(cfg);
  return NextResponse.json(res);
}

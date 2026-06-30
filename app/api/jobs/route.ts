import { NextResponse } from "next/server";
import { loadRecentJobs } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const jobs = await loadRecentJobs();
  return NextResponse.json({ jobs });
}

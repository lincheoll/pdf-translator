import { promises as fs } from "node:fs";
import path from "node:path";
import type { RecentJob } from "./types";

const ROOT = path.join(process.cwd(), "data");
const UPLOADS = path.join(ROOT, "uploads");
const OUTPUT = path.join(ROOT, "output");
const JOBS_FILE = path.join(ROOT, "jobs.json");

export async function ensureDirs(): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.mkdir(UPLOADS, { recursive: true });
  await fs.mkdir(OUTPUT, { recursive: true });
}

export const pdfPath = (jobId: string) => path.join(UPLOADS, `${jobId}.pdf`);
export const mdPath = (jobId: string) => path.join(OUTPUT, `${jobId}.md`);

export async function saveUploadedPdf(jobId: string, buf: Buffer): Promise<void> {
  await ensureDirs();
  await fs.writeFile(pdfPath(jobId), buf);
}

export async function readUploadedPdf(jobId: string): Promise<Buffer> {
  return fs.readFile(pdfPath(jobId));
}

export async function saveMarkdown(jobId: string, md: string): Promise<void> {
  await ensureDirs();
  await fs.writeFile(mdPath(jobId), md, "utf8");
}

export async function readMarkdown(jobId: string): Promise<string | null> {
  try {
    return await fs.readFile(mdPath(jobId), "utf8");
  } catch {
    return null;
  }
}

export async function loadRecentJobs(): Promise<RecentJob[]> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(JOBS_FILE, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function upsertRecentJob(job: RecentJob): Promise<void> {
  const jobs = await loadRecentJobs();
  const idx = jobs.findIndex((j) => j.jobId === job.jobId);
  if (idx >= 0) jobs[idx] = { ...jobs[idx], ...job };
  else jobs.unshift(job);
  await fs.writeFile(JOBS_FILE, JSON.stringify(jobs.slice(0, 30), null, 2), "utf8");
}

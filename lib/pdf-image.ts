import { spawn } from "node:child_process";
import path from "node:path";
import { pdfPath } from "./storage";

const SCRIPT = path.join(process.cwd(), "scripts", "pdf_render.py");

/**
 * Render a single PDF page (1-indexed) to a PNG and return its base64.
 * Uses PyMuPDF via a Python subprocess managed by uv. Requires `uv sync`.
 */
export function renderPageToPngBase64(
  jobId: string,
  pageNumber: number,
  dpi = 150,
): Promise<string> {
  const target = pdfPath(jobId);
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "uv",
      ["run", "python", SCRIPT, target, String(pageNumber), String(dpi)],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const chunks: Buffer[] = [];
    let stderr = "";
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", (e) =>
      reject(new Error(`Failed to launch uv: ${e.message}. Install uv and run \`uv sync\`.`)),
    );
    proc.on("close", (code) => {
      if (code !== 0) {
        const hint = stderr.includes("No module named fitz")
          ? "OCR mode requires PyMuPDF. Run: uv sync"
          : stderr.trim();
        reject(new Error(`pdf_render.py failed (exit ${code}): ${hint}`));
        return;
      }
      resolve(Buffer.concat(chunks).toString());
    });
  });
}
import type { EndpointTestResult } from "./types";

export interface LlmConfig {
  endpoint: string;
  apiKey?: string;
  model: string;
}

function normalize(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, "");
}

const SYSTEM_PROMPT = "You are a professional translation engine.";

export async function testEndpoint(cfg: LlmConfig): Promise<EndpointTestResult> {
  const base = normalize(cfg.endpoint);
  if (!base) return { ok: false, message: "Endpoint is empty." };
  const modelsUrl = `${base}/models`;
  const headers: Record<string, string> = {};
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  try {
    const res = await fetch(modelsUrl, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, message: `HTTP ${res.status} ${res.statusText}. ${body.slice(0, 200)}` };
    }
    const json: unknown = await res.json();
    const models: string[] =
      Array.isArray((json as any)?.data)
        ? (json as any).data.map((m: any) => m?.id).filter(Boolean)
        : [];
    const modelOk = models.length === 0 || models.includes(cfg.model);
    return {
      ok: true,
      models: models.slice(0, 50),
      message: modelOk
        ? `Reachable · ${models.length} model(s) available.`
        : `Reachable, but model "${cfg.model}" not in list (will still try).`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export interface TranslateChunkParams {
  cfg: LlmConfig;
  text: string;
  source: string;
  target: string;
  signal?: AbortSignal;
}

export async function translateChunk({ cfg, text, source, target, signal }: TranslateChunkParams): Promise<string> {
  if (!text.trim()) return text;
  const base = normalize(cfg.endpoint);
  const url = `${base}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

  const userContent = buildUserPrompt(text, source, target);

  const res = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      stream: false,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM HTTP ${res.status}: ${detail.slice(0, 500)}`);
  }
  const json: unknown = await res.json();
  const content = (json as any)?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("LLM returned empty content");
  }
  return content.trim();
}

export interface OcrConfig {
  endpoint: string;
  apiKey?: string;
  model: string;
}

const OCR_SYSTEM_PROMPT =
  "You are an OCR engine. Extract all text from the provided document page image. " +
  "Output ONLY the extracted text in the original language, preserving paragraphs, " +
  "lists, tables, headings, and reading order. Do not translate. Do not add explanations.";

export async function ocrPage(cfg: OcrConfig, imageBase64Png: string, signal?: AbortSignal): Promise<string> {
  const base = normalize(cfg.endpoint);
  const url = `${base}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: OCR_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all text from this page." },
            { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64Png}` } },
          ],
        },
      ],
      temperature: 0,
      stream: false,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OCR HTTP ${res.status}: ${detail.slice(0, 500)}`);
  }
  const json: unknown = await res.json();
  const content = (json as any)?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OCR returned empty content");
  }
  return content.trim();
}

function buildUserPrompt(text: string, source: string, target: string): string {
  const srcPart = source.trim() ? `from ${source.trim()} ` : "";
  const targetName = target.trim() ? target.trim() : "the target language";
  return (
    `Translate the following text ${srcPart}into ${targetName}. ` +
    `Output ONLY the translation. No explanations, no preamble, no quotation marks around the whole output. ` +
    `Preserve paragraphs, line breaks, lists, tables, and code blocks exactly as in the source.\n\n` +
    `--- BEGIN SOURCE ---\n${text}\n--- END SOURCE ---`
  );
}

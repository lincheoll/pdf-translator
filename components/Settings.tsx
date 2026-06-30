"use client";

import { Loader2, Plug, CheckCircle2, XCircle, ScanText } from "lucide-react";
import type { TranslationSettings, EndpointTestResult } from "@/lib/types";

interface SettingsProps {
  settings: TranslationSettings;
  onChange: (s: TranslationSettings) => void;
  onTest: () => void;
  testing: boolean;
  testResult: EndpointTestResult | null;
}

const fieldCls =
  "w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

function Labeled({
  label,
  children,
  full,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  wide?: boolean;
}) {
  const span = full
    ? "col-span-2 md:col-span-3"
    : wide
      ? "md:col-span-2"
      : "";
  return (
    <label className={`block ${span}`}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function Settings({
  settings,
  onChange,
  onTest,
  testing,
  testResult,
}: SettingsProps) {
  const set = (k: keyof TranslationSettings, v: string | boolean) =>
    onChange({ ...settings, [k]: v });

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <Labeled label="Source Language">
        <input
          className={fieldCls}
          value={settings.source}
          onChange={(e) => set("source", e.target.value)}
          placeholder="e.g. English"
        />
      </Labeled>
      <Labeled label="Target Language">
        <input
          className={fieldCls}
          value={settings.target}
          onChange={(e) => set("target", e.target.value)}
          placeholder="e.g. Korean"
        />
      </Labeled>
      <Labeled label="Model">
        <input
          className={fieldCls}
          value={settings.model}
          onChange={(e) => set("model", e.target.value)}
          placeholder="gpt-4o-mini / llama3.1 / qwen2.5 ..."
        />
      </Labeled>

      <Labeled label="LLM Endpoint" full>
        <input
          className={fieldCls}
          value={settings.endpoint}
          onChange={(e) => set("endpoint", e.target.value)}
          placeholder="http://localhost:11434/v1  ·  https://api.openai.com/v1  ·  http://localhost:1234/v1"
          spellCheck={false}
        />
      </Labeled>

      <Labeled label="API Key (optional)">
        <input
          className={fieldCls}
          type="password"
          value={settings.apiKey ?? ""}
          onChange={(e) => set("apiKey", e.target.value)}
          placeholder="sk-... (leave empty for local servers)"
          autoComplete="off"
        />
      </Labeled>
      <Labeled label="&nbsp;">
        <button
          onClick={onTest}
          disabled={testing}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-700 disabled:opacity-60"
        >
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plug className="h-4 w-4" />
          )}
          Test Endpoint
        </button>
      </Labeled>

      {/* OCR mode toggle — own full-width row */}
      <div className="col-span-2 flex items-center gap-2 md:col-span-3">
        <button
          type="button"
          role="switch"
          aria-checked={settings.ocrMode}
          onClick={() => set("ocrMode", !settings.ocrMode)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            settings.ocrMode ? "bg-sky-600" : "bg-neutral-700"
          }`}
        >
          <span
            className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white transition-all duration-200 ${
              settings.ocrMode ? "left-[22px]" : "left-[2px]"
            }`}
          />
        </button>
        <ScanText className="h-4 w-4 shrink-0 text-sky-400" />
        <span className="text-sm text-neutral-200">OCR Mode</span>
        <span className="text-xs text-neutral-500">
          (scanned PDFs · page image → vision AI · needs PyMuPDF)
        </span>
      </div>

      {/* OCR fields — appear when toggle is on */}
      {settings.ocrMode && (
        <>
          <Labeled label="OCR Model">
            <input
              className={fieldCls}
              value={settings.ocrModel}
              onChange={(e) => set("ocrModel", e.target.value)}
              placeholder="gpt-4o / llava / minicpm-v"
            />
          </Labeled>
          <Labeled label="OCR Endpoint" wide>
            <input
              className={fieldCls}
              value={settings.ocrEndpoint}
              onChange={(e) => set("ocrEndpoint", e.target.value)}
              placeholder="leave empty to use main endpoint"
              spellCheck={false}
            />
          </Labeled>
        </>
      )}

      {testResult && (
        <div className="col-span-2 flex items-start gap-2 text-xs md:col-span-3">
          {testResult.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          )}
          <div className="min-w-0">
            <p className={testResult.ok ? "text-emerald-300" : "text-rose-300"}>
              {testResult.message}
            </p>
            {testResult.models && testResult.models.length > 0 && (
              <p className="mt-1 max-h-20 overflow-auto text-neutral-500">
                Available: {testResult.models.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
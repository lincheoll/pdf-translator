# PDF Translator

A local web app for uploading PDFs, translating them via an OpenAI-compatible LLM API, and viewing the original PDF alongside the translated Markdown.

## Features

- PDF upload and page-by-page preview (`react-pdf`)
- Text-extraction translation (default) or OCR mode for scanned PDFs
- OpenAI-compatible API support (Ollama, OpenAI, vLLM, etc.)
- Real-time translation progress
- Markdown viewer with PDF page navigation
- Recent job history stored locally in `data/`

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **PDF:** unpdf (text extraction), react-pdf (viewer), pdf.js worker
- **Translation:** OpenAI-compatible `/chat/completions` API
- **OCR (optional):** [uv](https://docs.astral.sh/uv/) + Python 3 + PyMuPDF (`scripts/pdf_render.py`)

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)
- LLM endpoint (default: `http://localhost:11434/v1` — Ollama)
- For OCR mode:
  - [uv](https://docs.astral.sh/uv/)
  - `uv sync`

## Getting Started

```bash
# install dependencies
pnpm install
uv sync

# development
pnpm dev

# production build
pnpm build
pnpm start

# type check
pnpm typecheck
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. In **Settings**, configure source/target languages, LLM endpoint, and model.
2. Click **Test Connection** to verify the endpoint.
3. Upload a PDF file.
4. Click **Translate** to start translation.
5. View the PDF on the left and translated Markdown on the right.

### OCR Mode

For scanned PDFs without a text layer, enable **OCR Mode** in Settings. Each page is rendered to PNG, then processed through a vision-capable model for OCR before translation.

```bash
uv sync
```

OCR endpoint and model can be configured separately from translation settings.

## Project Structure

```
app/              Next.js App Router (pages + API routes)
components/       UI (PdfViewer, MarkdownViewer, Settings)
lib/              PDF extraction, chunking, LLM client, storage
scripts/          Python helper for page rendering (OCR)
public/           Static assets (pdf.js worker)
data/             Local runtime data (gitignored)
  uploads/        Uploaded PDFs
  output/         Translated Markdown
  jobs.json       Recent job history
```

## API Routes

| Route | Description |
| --- | --- |
| `POST /api/upload` | Upload a PDF |
| `POST /api/translate` | Start a translation job |
| `GET /api/progress?jobId=` | Poll job progress |
| `GET /api/result?jobId=` | Fetch translated Markdown |
| `GET /api/file/[jobId]` | Stream uploaded PDF |
| `GET /api/jobs` | List recent jobs |
| `POST /api/test-endpoint` | Test LLM endpoint connectivity |

## Data & Privacy

Uploaded PDFs, translation output, and job history are stored locally under `data/`. This directory is listed in `.gitignore` and is not pushed to remote repositories.

Settings (endpoint, API key, model) are stored in the browser's `localStorage`.

## License

Private project — all rights reserved.

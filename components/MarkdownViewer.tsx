"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { FileText } from "lucide-react";

interface MarkdownViewerProps {
  markdown: string | null;
  onPageClick?: (page: number) => void;
}

export default function MarkdownViewer({ markdown, onPageClick }: MarkdownViewerProps) {
  if (!markdown) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        <div className="text-center">
          <FileText className="mx-auto mb-3 h-12 w-12 opacity-40" />
          <p>Translated markdown will appear here.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="md-content h-full overflow-auto px-5 py-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={
          onPageClick
            ? {
                h2: ({ children }) => {
                  const text = String(children);
                  const match = text.match(/Page\s+(\d+)/i);
                  if (match) {
                    const page = parseInt(match[1], 10);
                    return (
                      <button
                        type="button"
                        onClick={() => onPageClick(page)}
                        className="group flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors"
                        title={`Jump to PDF page ${page}`}
                      >
                        {children}
                        <span className="text-[10px] text-neutral-600 group-hover:text-sky-500 transition-colors">
                          ⤴ jump
                        </span>
                      </button>
                    );
                  }
                  return <h2>{children}</h2>;
                },
              }
            : undefined
        }
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

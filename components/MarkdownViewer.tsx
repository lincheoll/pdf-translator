"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { FileText } from "lucide-react";

interface MarkdownViewerProps {
  markdown: string | null;
}

export default function MarkdownViewer({ markdown }: MarkdownViewerProps) {
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
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

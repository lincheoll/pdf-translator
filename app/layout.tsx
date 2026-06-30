import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Translator",
  description: "Personal local PDF translation tool (OpenAI-compatible LLM)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

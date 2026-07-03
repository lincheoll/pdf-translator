/** @type {import('next').NextConfig} */
const nextConfig = {
  // Resolve unpdf/pdfjs natively in Node instead of letting the bundler try to
  // inline the worker bits (which breaks server-side text extraction).
  serverExternalPackages: ["unpdf", "react-pdf", "pdfjs-dist"],
};

export default nextConfig;

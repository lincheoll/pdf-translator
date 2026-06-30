#!/usr/bin/env python3
"""Render a single PDF page to a PNG and write base64 to stdout.

Usage: python3 pdf_render.py <pdf_path> <page_number_1indexed> [dpi]

Requires PyMuPDF: pip install pymupdf
"""
import sys
import base64


def main() -> None:
    if len(sys.argv) < 3:
        sys.stderr.write("usage: pdf_render.py <pdf_path> <page_number> [dpi]\n")
        sys.exit(2)

    pdf_path = sys.argv[1]
    page_num = int(sys.argv[2])
    dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 150

    try:
        import fitz  # PyMuPDF
    except ImportError:
        sys.stderr.write("No module named fitz\n")
        sys.exit(3)

    doc = fitz.open(pdf_path)
    if page_num < 1 or page_num > len(doc):
        sys.stderr.write(f"page {page_num} out of range (1..{len(doc)})\n")
        sys.exit(1)

    page = doc[page_num - 1]
    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=matrix)
    png_bytes = pix.tobytes("png")
    sys.stdout.buffer.write(base64.b64encode(png_bytes))


if __name__ == "__main__":
    main()
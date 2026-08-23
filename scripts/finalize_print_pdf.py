"""Declare the trim and bleed boxes on the flyer PDF, and prove the result.

    python scripts/finalize_print_pdf.py

Run AFTER scripts/render-flyer-print-pdf.mjs, which produces the artwork.
Two steps rather than one because Playwright is Node and the only PDF box
editor on this machine is Python's PyMuPDF; adding a Node PDF library to
the project for four rectangles was not worth the dependency.

Why this step exists at all: Chromium writes a PDF with nothing but a
MediaBox, so where to cut is left implied — a shop has to assume the trim
sits centred, and Chromium's page is also a fraction of a millimetre
larger than asked for, which makes that assumption slightly wrong. Naming
the boxes removes the guess entirely:

    MediaBox  the whole sheet, including the sacrificial edge
    BleedBox  how far ink must run past the cut (3mm)
    TrimBox   the finished 210x297 A4 the customer holds

A modern RIP reads TrimBox and imposes from it, so the cut lands where
the design intends no matter what the sheet measures.
"""
from __future__ import annotations

import sys
from pathlib import Path

import fitz  # PyMuPDF

# Optional argv[1] selects a different print PDF (the business flyers);
# with no argument the original flyer is used exactly as before.
PDF = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("marketing/flyer-expand-your-horizons-a4-print.pdf")
PROOF = PDF.with_name(PDF.stem + "-proof.png")

MM = 72.0 / 25.4          # PDF points per millimetre
TRIM_W, TRIM_H = 210 * MM, 297 * MM
BLEED = 3 * MM


def main() -> int:
    if not PDF.exists():
        print(f"missing {PDF} - run scripts/render-flyer-print-pdf.mjs first")
        return 1

    doc = fitz.open(PDF)
    if doc.page_count != 1:
        print(f"expected 1 page, found {doc.page_count}")
        return 1

    page = doc[0]
    media = page.mediabox
    # Centre the trim in whatever the sheet actually measures, so the
    # margin of ink around it is equal on every side.
    x0 = (media.width - TRIM_W) / 2
    y0 = (media.height - TRIM_H) / 2
    trim = fitz.Rect(x0, y0, x0 + TRIM_W, y0 + TRIM_H)
    bleed = fitz.Rect(trim.x0 - BLEED, trim.y0 - BLEED, trim.x1 + BLEED, trim.y1 + BLEED)

    # The bleed box may not stick out past the sheet, so clip it. Chromium's
    # sheet is a hair larger than requested, so in practice it never does.
    bleed = bleed & media

    page.set_cropbox(media)
    page.set_bleedbox(bleed)
    page.set_trimbox(trim)

    doc.save(PDF.with_suffix(".tmp.pdf"), garbage=3, deflate=True)
    doc.close()
    PDF.with_suffix(".tmp.pdf").replace(PDF)

    # --- verify by reading the file back, not by trusting the writes ---
    doc = fitz.open(PDF)
    page = doc[0]

    def mm(r):
        return f"{r.width / MM:.1f} x {r.height / MM:.1f} mm"

    print(f"  media {mm(page.mediabox)}   the sheet")
    print(f"  bleed {mm(page.bleedbox)}   ink runs to here")
    print(f"  trim  {mm(page.trimbox)}   cut here  <- finished size")

    ok = (
        abs(page.trimbox.width - TRIM_W) < 0.6
        and abs(page.trimbox.height - TRIM_H) < 0.6
        and page.bleedbox.width >= page.trimbox.width + 2 * BLEED - 1.2
    )

    margin = (page.trimbox.x0 - page.mediabox.x0) / MM
    print(f"  ink beyond the cut on each side: {margin:.2f} mm")

    # A proof image with the cut line drawn on it, so the bleed can be
    # eyeballed rather than taken on trust. Not part of the deliverable.
    shade = page.get_pixmap(dpi=110)
    shade.save(PROOF)
    print(f"  proof image -> {PROOF}")

    doc.close()
    print("  OK" if ok else "  PROBLEM: boxes are not the expected size")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

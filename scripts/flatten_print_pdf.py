"""Flatten the print flyer to one 300dpi image, keeping the page boxes.

    python scripts/flatten_print_pdf.py

Run AFTER render-flyer-print-pdf.mjs + finalize_print_pdf.py. Produces
flyer-expand-your-horizons-a4-print-flat.pdf beside the vector one.

WHY THIS EXISTS

The vector PDF is the better file in principle — sharp text at any size,
a QR drawn at the press's own resolution. It also renders grey boxes over
the headline and the CTA button in some phone PDF viewers, reported twice
from a real phone.

Two rounds of surgical fixes did not clear it. What the file actually
contains explains why:

  * every font is TYPE3 and not embedded. Chromium did not embed Playfair
    or Manrope; it converted the text into per-glyph drawing procedures.
    Viewers vary in how well they execute those, and a viewer that gives
    up on one tends to paint the glyph's declared bounding box — which
    looks exactly like a grey box behind a word.
  * four shading patterns for the CSS gradients, plus a transparency
    group for the photo's fade.

Note that "fonts embedded" as reported by the renderer script means the
webfonts loaded in the BROWSER, which is a different question from
whether the PDF embedded them. It did not.

Rasterising sidesteps all of it. One opaque image has no glyph
procedures, no transparency groups and no patterns, so every viewer and
every RIP draws the same pixels. The cost is real and worth stating: the
text is no longer vector, so it prints at 300dpi rather than the press's
native resolution. At arm's length on a flyer that is indistinguishable;
for a book you would fix the fonts instead.

The QR survives comfortably — 31.4mm at 300dpi is ~370px, and it still
decodes to the live short link after flattening.

The trim and bleed boxes are copied across, so the shop still gets a file
that says where to cut.
"""
from __future__ import annotations

import sys
from pathlib import Path

import fitz  # PyMuPDF

# Optional argv[1] selects a different print PDF; default unchanged.
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("marketing/flyer-expand-your-horizons-a4-print.pdf")
OUT = SRC.with_name(SRC.stem + "-flat.pdf")
DPI = 300
MM = 72 / 25.4


def main() -> int:
    if not SRC.exists():
        print(f"missing {SRC} — run the renderer and finaliser first")
        return 1

    src = fitz.open(SRC)
    sp = src[0]
    media, trim, bleed = sp.mediabox, sp.trimbox, sp.bleedbox

    # alpha=False matters: an image WITH an alpha channel would be stored
    # with a soft mask, quietly reintroducing the transparency this is
    # meant to eliminate.
    pix = sp.get_pixmap(dpi=DPI, alpha=False)

    out = fitz.open()
    page = out.new_page(width=media.width, height=media.height)
    page.insert_image(fitz.Rect(0, 0, media.width, media.height), pixmap=pix)
    page.set_cropbox(media)
    page.set_bleedbox(bleed)
    page.set_trimbox(trim)
    out.save(OUT, garbage=4, deflate=True)
    out.close()
    src.close()

    # --- verify by reading the result back, not by trusting the writes ---
    doc = fitz.open(OUT)
    p = doc[0]

    def mm(r):
        return f"{r.width / MM:.1f} x {r.height / MM:.1f} mm"

    raw = OUT.read_bytes()
    leftovers = {m: raw.count(m.encode()) for m in
                 ("/SMask", "/Group", "/Multiply", "/Luminosity", "/Pattern", "/Type3")}

    print(f"  {OUT}  ({len(raw) / 1024 / 1024:.2f} MB)")
    print(f"  raster {pix.width}x{pix.height} px at {DPI}dpi")
    print(f"  media {mm(p.mediabox)} | bleed {mm(p.bleedbox)} | trim {mm(p.trimbox)}")
    print(f"  fonts {len(p.get_fonts())}, images {len(p.get_images())}")
    print("  " + "  ".join(f"{k}={v}" for k, v in leftovers.items()))

    ok = (
        len(p.get_fonts()) == 0
        and all(v == 0 for v in leftovers.values())
        and abs(p.trimbox.width - 210 * MM) < 0.6
        and abs(p.trimbox.height - 297 * MM) < 0.6
    )
    doc.close()
    print("  OK — nothing left that a viewer can disagree about" if ok else "  PROBLEM")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

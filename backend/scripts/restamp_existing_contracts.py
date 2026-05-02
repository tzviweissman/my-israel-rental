"""One-shot migration: re-stamp existing signed contracts with the corrected
"name immediately above/below signature" placement logic.

This script targets bookings that:
  • have ``contract_signed == True``
  • have ``signature_data``, ``signature_position`` AND ``signer_legal_name`` set
  • have a ``signed_contract_url`` pointing to a file we can find on disk

For each match it re-runs the IMAGE/PDF stamping logic (mirrored from
``routes/bookings.py``) and overwrites the signed file in place. The booking
record itself isn't changed (URL/filename are kept), so existing chat/email
links still resolve.

Bookings missing ``signature_display`` (display_width/height of the signing
canvas) — which is every booking signed before this commit — are re-stamped
with ``scale = 1.0``. This is the same fall-through the original handler
used when the legacy signing client didn't pass display dims, so the output
matches the legacy file's layout for those rows as closely as possible.

Usage::

    cd /app/backend && python -m scripts.restamp_existing_contracts
    cd /app/backend && python -m scripts.restamp_existing_contracts --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import os
import shutil
from io import BytesIO
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image, ImageDraw, ImageFont

load_dotenv("/app/backend/.env")
ROOT_DIR = Path(__file__).resolve().parents[1]
UPLOAD_DIR = ROOT_DIR / "uploads"


def _stamp_image(
    contract_path: Path,
    out_path: Path,
    signature_b64: str,
    sig_x_disp: float,
    sig_y_disp: float,
    sig_w_disp: float,
    sig_h_disp: float,
    legal_name: str,
    display_width: float | None,
    display_height: float | None,
) -> None:
    contract_img = Image.open(contract_path).convert("RGBA")
    native_w, native_h = contract_img.size

    if display_width and display_height:
        scale_x = native_w / float(display_width)
        scale_y = native_h / float(display_height)
    else:
        scale_x = scale_y = 1.0

    sig_x = int(sig_x_disp * scale_x)
    sig_y = int(sig_y_disp * scale_y)
    sig_w = max(1, int(sig_w_disp * scale_x))
    sig_h = max(1, int(sig_h_disp * scale_y))

    sig_data = signature_b64.split(",", 1)[1] if "," in signature_b64 else signature_b64
    sig_img = Image.open(BytesIO(base64.b64decode(sig_data))).convert("RGBA")

    # Trim transparent margin so we anchor the name to the actual scribble.
    bbox = sig_img.getbbox()
    if bbox is not None:
        bx0, by0, bx1, by1 = bbox
        iw, ih = sig_img.size
        if iw > 0 and ih > 0 and (bx0 > 0 or by0 > 0 or bx1 < iw or by1 < ih):
            sig_img = sig_img.crop(bbox)
            sig_x = sig_x + int((bx0 / iw) * sig_w)
            sig_y = sig_y + int((by0 / ih) * sig_h)
            sig_w = max(1, int(((bx1 - bx0) / iw) * sig_w))
            sig_h = max(1, int(((by1 - by0) / ih) * sig_h))

    sig_img_scaled = sig_img.resize((sig_w, sig_h), Image.Resampling.LANCZOS)

    layer = Image.new("RGBA", contract_img.size, (255, 255, 255, 0))
    layer.paste(sig_img_scaled, (sig_x, sig_y), sig_img_scaled)

    draw = ImageDraw.Draw(layer)
    font_size = max(40, min(140, int(sig_h * 0.95)))
    font_reg: Any
    font_bold: Any
    try:
        font_reg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
        font_bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except Exception:
        font_reg = font_bold = ImageFont.load_default()

    pad = max(12, int(sig_h * 0.12))
    name_y_below = sig_y + sig_h + pad
    name_y_above = sig_y - font_size - pad
    if name_y_below + font_size + 4 <= native_h:
        name_y = name_y_below
    elif name_y_above >= 0:
        name_y = name_y_above
    else:
        name_y = name_y_below if name_y_below < native_h else max(0, name_y_above)

    label = "Name: "
    label_w = (
        draw.textlength(label, font=font_bold)
        if hasattr(draw, "textlength")
        else font_size * len(label) * 0.55
    )
    name_w = (
        draw.textlength(legal_name, font=font_reg)
        if hasattr(draw, "textlength")
        else font_size * len(legal_name) * 0.55
    )
    total_w = label_w + name_w
    name_x_start = sig_x + max(0, int((sig_w - total_w) / 2))
    if name_x_start + int(total_w) > native_w:
        name_x_start = max(0, native_w - int(total_w) - 4)
    draw.text((name_x_start, name_y), label, fill=(20, 20, 20, 255), font=font_bold)
    draw.text((name_x_start + int(label_w), name_y), legal_name, fill=(20, 20, 20, 255), font=font_reg)

    signed = Image.alpha_composite(contract_img, layer)
    if out_path.suffix.lower() in (".jpg", ".jpeg"):
        signed = signed.convert("RGB")
    signed.save(out_path)


def _stamp_pdf(
    contract_path: Path,
    out_path: Path,
    signature_b64: str,
    sig_x_disp: float,
    sig_y_disp: float,
    sig_w_disp: float,
    sig_h_disp: float,
    legal_name: str,
    display_width: float | None,
    display_height: float | None,
) -> None:
    from PyPDF2 import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas as rpcanvas

    reader = PdfReader(str(contract_path))
    writer = PdfWriter()
    first_page = reader.pages[0]
    page_w = float(first_page.mediabox.width)
    page_h = float(first_page.mediabox.height)

    if display_width and display_height:
        scale_x = page_w / float(display_width)
        scale_y = page_h / float(display_height)
    else:
        scale_x = scale_y = 1.0

    sig_x = sig_x_disp * scale_x
    sig_y = sig_y_disp * scale_y
    sig_w = sig_w_disp * scale_x
    sig_h = sig_h_disp * scale_y

    sig_data = signature_b64.split(",", 1)[1] if "," in signature_b64 else signature_b64
    sig_img = Image.open(BytesIO(base64.b64decode(sig_data))).convert("RGBA")

    # Trim transparent margin so we anchor name + draw box to the actual scribble.
    bbox = sig_img.getbbox()
    if bbox is not None:
        bx0, by0, bx1, by1 = bbox
        iw, ih = sig_img.size
        if iw > 0 and ih > 0 and (bx0 > 0 or by0 > 0 or bx1 < iw or by1 < ih):
            sig_img = sig_img.crop(bbox)
            sig_x = sig_x + (bx0 / iw) * sig_w
            sig_y = sig_y + (by0 / ih) * sig_h
            sig_w = ((bx1 - bx0) / iw) * sig_w
            sig_h = ((by1 - by0) / ih) * sig_h

    sig_img_scaled = sig_img.resize((max(1, int(sig_w)), max(1, int(sig_h))), Image.Resampling.LANCZOS)

    overlay = BytesIO()
    c = rpcanvas.Canvas(overlay, pagesize=(page_w, page_h))
    tmp = UPLOAD_DIR / f"_restamp_tmp_{os.getpid()}.png"
    sig_img_scaled.save(str(tmp), "PNG")
    pdf_y = page_h - sig_y - sig_h
    c.drawImage(str(tmp), sig_x, pdf_y, width=sig_w, height=sig_h, mask="auto", preserveAspectRatio=True)

    name_font_size = max(24.0, min(64.0, sig_h * 0.95))
    pad = max(6.0, sig_h * 0.18)
    name_y_below = pdf_y - pad - name_font_size
    name_y_above = pdf_y + sig_h + pad
    if name_y_below >= 0:
        name_y_pdf = name_y_below
    elif name_y_above + name_font_size <= page_h:
        name_y_pdf = name_y_above
    else:
        name_y_pdf = max(0.0, name_y_below)

    c.setFillColorRGB(0.08, 0.08, 0.08)
    label = "Name: "
    label_w = c.stringWidth(label, "Helvetica-Bold", name_font_size)
    name_w = c.stringWidth(legal_name, "Helvetica", name_font_size)
    total_w = label_w + name_w
    name_x = sig_x + max(0.0, (sig_w - total_w) / 2.0)
    if name_x + total_w > page_w:
        name_x = max(0.0, page_w - total_w - 4.0)
    c.setFont("Helvetica-Bold", name_font_size)
    c.drawString(name_x, name_y_pdf, label)
    c.setFont("Helvetica", name_font_size)
    c.drawString(name_x + label_w, name_y_pdf, legal_name)
    c.save()
    tmp.unlink(missing_ok=True)

    overlay.seek(0)
    overlay_pdf = PdfReader(overlay)
    first_page.merge_page(overlay_pdf.pages[0])
    writer.add_page(first_page)
    for i in range(1, len(reader.pages)):
        writer.add_page(reader.pages[i])
    with out_path.open("wb") as f:
        writer.write(f)


async def main(dry_run: bool = False) -> None:
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    candidates = await db.bookings.find(
        {
            "contract_signed": True,
            "signature_data": {"$exists": True, "$ne": None},
            "signature_position": {"$exists": True, "$ne": None},
            "signer_legal_name": {"$exists": True, "$ne": None},
            "signed_contract_url": {"$exists": True, "$ne": None},
        },
        {"_id": 0},
    ).to_list(200)

    print(f"Found {len(candidates)} re-stampable bookings")
    fixed = 0
    skipped = 0
    for b in candidates:
        bid = b["id"]
        signed_url = (b.get("signed_contract_url") or "").lstrip("/")
        if not signed_url.startswith("api/uploads/"):
            print(f"  ✗ {bid[:8]} — unexpected url shape: {signed_url}")
            skipped += 1
            continue
        signed_filename = signed_url.split("api/uploads/", 1)[1]
        signed_path = UPLOAD_DIR / signed_filename
        # The original (unsigned) contract is referenced by the property/booking
        # contract_url. We try to recover the original by parsing the signed
        # filename: ``signed_<booking_id>_<contract_filename>``.
        prefix = f"signed_{bid}_"
        if not signed_filename.startswith(prefix):
            print(f"  ✗ {bid[:8]} — signed filename doesn't match expected prefix: {signed_filename}")
            skipped += 1
            continue
        original_filename = signed_filename[len(prefix):]
        original_path = UPLOAD_DIR / original_filename
        if not original_path.exists():
            print(f"  ✗ {bid[:8]} — original contract missing: {original_path}")
            skipped += 1
            continue

        sig = b["signature_position"]
        display = b.get("signature_display") or {}
        dw, dh = display.get("width"), display.get("height")
        ext = original_path.suffix.lower()

        if dry_run:
            print(f"  ◐ DRY {bid[:8]} {ext} sig={sig} display=({dw}x{dh}) → would re-stamp {signed_filename}")
            continue

        # Backup original signed file (idempotent — if a backup already exists
        # from a previous run, leave it as the source of truth).
        backup = signed_path.with_suffix(signed_path.suffix + ".prefix_bak")
        if signed_path.exists() and not backup.exists():
            shutil.copy2(signed_path, backup)

        try:
            if ext == ".pdf":
                _stamp_pdf(
                    original_path, signed_path, b["signature_data"],
                    sig["x"], sig["y"], sig["width"], sig["height"],
                    b["signer_legal_name"], dw, dh,
                )
            else:
                _stamp_image(
                    original_path, signed_path, b["signature_data"],
                    sig["x"], sig["y"], sig["width"], sig["height"],
                    b["signer_legal_name"], dw, dh,
                )
            print(f"  ✓ {bid[:8]} re-stamped {signed_filename}")
            fixed += 1
        except Exception as e:
            print(f"  ✗ {bid[:8]} re-stamp FAILED: {e}")
            skipped += 1

    print(f"\nDone. Re-stamped: {fixed}  Skipped: {skipped}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    asyncio.run(main(dry_run=args.dry_run))

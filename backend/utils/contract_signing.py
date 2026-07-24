"""Stamp a renter's signature + printed legal name onto a property's
rental contract (PDF or image). Pure I/O helpers, no FastAPI awareness.

Public API:
    stamp_signature_on_contract(
        contract_path, signed_path, signature_data,
        sig_x, sig_y, sig_w, sig_h,
        display_width, display_height, legal_name,
    ) -> None  # raises ValueError / IOError on failure

Internally dispatches to the PDF or image branch based on file extension.
"""
from __future__ import annotations

import base64
import logging
from io import BytesIO
from pathlib import Path
from typing import Any

logger = logging.getLogger("server")

from PIL import Image, ImageDraw, ImageFont


# ---------- shared helpers -----------------------------------------------

def _decode_signature_image(signature_data: str) -> Image.Image:
    """Decode a base64 PNG (with optional `data:image/png;base64,` prefix)
    into an RGBA PIL Image."""
    image_data = signature_data.split(',')[1] if ',' in signature_data else signature_data
    return Image.open(BytesIO(base64.b64decode(image_data))).convert("RGBA")


def _crop_to_visible_ink(
    sig_img: Image.Image,
    sig_x: float, sig_y: float, sig_w: float, sig_h: float,
) -> tuple[Image.Image, float, float, float, float]:
    """Trim transparent margin off `sig_img` so the printed name anchors to
    the actual visible scribble. Returns (cropped_img, x, y, w, h) where the
    new (x, y, w, h) describe the scribble's bounding box in the same
    coordinate system as the inputs."""
    bbox = sig_img.getbbox()
    if bbox is None:
        return sig_img, sig_x, sig_y, sig_w, sig_h
    bx0, by0, bx1, by1 = bbox
    iw, ih = sig_img.size
    if iw <= 0 or ih <= 0:
        return sig_img, sig_x, sig_y, sig_w, sig_h
    if bx0 == 0 and by0 == 0 and bx1 == iw and by1 == ih:
        return sig_img, sig_x, sig_y, sig_w, sig_h  # already tight
    new_x = sig_x + (bx0 / iw) * sig_w
    new_y = sig_y + (by0 / ih) * sig_h
    new_w = ((bx1 - bx0) / iw) * sig_w
    new_h = ((by1 - by0) / ih) * sig_h
    return sig_img.crop(bbox), new_x, new_y, new_w, new_h


# ---------- PDF stamping --------------------------------------------------

def _stamp_signature_on_pdf(
    contract_path: Path, signed_path: Path,
    sig_img: Image.Image,
    sig_x: float, sig_y: float, sig_w: float, sig_h: float,
    display_width: float | None, display_height: float | None,
    legal_name: str, booking_id: str, uploads_dir: Path,
) -> None:
    """Stamp signature + name onto the first page of a PDF contract."""
    from PyPDF2 import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas

    reader = PdfReader(str(contract_path))
    writer = PdfWriter()
    first_page = reader.pages[0]
    page_width = float(first_page.mediabox.width)
    page_height = float(first_page.mediabox.height)

    # Scale signature coords from display pixels -> PDF points.
    if display_width and display_height:
        scale_x = page_width / float(display_width)
        scale_y = page_height / float(display_height)
    else:
        scale_x = scale_y = 1.0
    sig_x, sig_y = sig_x * scale_x, sig_y * scale_y
    sig_w, sig_h = sig_w * scale_x, sig_h * scale_y
    sig_img, sig_x, sig_y, sig_w, sig_h = _crop_to_visible_ink(
        sig_img, sig_x, sig_y, sig_w, sig_h,
    )

    # Resize signature to scaled dimensions
    sig_scaled = sig_img.resize(
        (max(1, int(sig_w)), max(1, int(sig_h))), Image.Resampling.LANCZOS,
    )

    # Save to temp PNG so reportlab can read it
    temp_sig_path = uploads_dir / f"temp_sig_{booking_id}.png"
    sig_scaled.save(str(temp_sig_path), "PNG")

    try:
        # Draw signature on PDF (PDF origin is bottom-left)
        overlay = BytesIO()
        c = canvas.Canvas(overlay, pagesize=(page_width, page_height))
        pdf_y = page_height - sig_y - sig_h
        c.drawImage(
            str(temp_sig_path), sig_x, pdf_y,
            width=sig_w, height=sig_h, mask='auto', preserveAspectRatio=True,
        )

        # Print "Name: <legal_name>" centred under the signature box, never above.
        font_size = max(32.0, min(80.0, sig_h * 1.1))
        pad = max(6.0, sig_h * 0.18)
        name_y = max(0.0, pdf_y - pad - font_size)

        c.setFillColorRGB(0.08, 0.08, 0.08)
        label = "Name: "
        label_w = c.stringWidth(label, "Helvetica-Bold", font_size)
        name_w = c.stringWidth(legal_name, "Helvetica", font_size)
        total_w = label_w + name_w
        name_x = sig_x + max(0.0, (sig_w - total_w) / 2.0)
        if name_x + total_w > page_width:
            name_x = max(0.0, page_width - total_w - 4.0)
        c.setFont("Helvetica-Bold", font_size)
        c.drawString(name_x, name_y, label)
        c.setFont("Helvetica", font_size)
        c.drawString(name_x + label_w, name_y, legal_name)
        c.save()

        # Merge overlay onto first page; keep remaining pages verbatim
        overlay.seek(0)
        first_page.merge_page(PdfReader(overlay).pages[0])
        writer.add_page(first_page)
        for page_num in range(1, len(reader.pages)):
            writer.add_page(reader.pages[page_num])
        with open(signed_path, 'wb') as out:
            writer.write(out)
    finally:
        temp_sig_path.unlink(missing_ok=True)


# ---------- Image stamping ------------------------------------------------

def _stamp_signature_on_image(
    contract_path: Path, signed_path: Path, file_ext: str,
    sig_img: Image.Image,
    sig_x: float, sig_y: float, sig_w: float, sig_h: float,
    display_width: float | None, display_height: float | None,
    legal_name: str,
) -> None:
    """Stamp signature + name onto a JPG/PNG/etc contract image."""
    contract_img = Image.open(contract_path).convert("RGBA")
    native_w, native_h = contract_img.size

    if display_width and display_height:
        scale_x = native_w / float(display_width)
        scale_y = native_h / float(display_height)
    else:
        scale_x = scale_y = 1.0
    isig_x = int(sig_x * scale_x)
    isig_y = int(sig_y * scale_y)
    isig_w = max(1, int(sig_w * scale_x))
    isig_h = max(1, int(sig_h * scale_y))

    sig_img, fx, fy, fw, fh = _crop_to_visible_ink(
        sig_img, isig_x, isig_y, isig_w, isig_h,
    )
    isig_x, isig_y = int(fx), int(fy)
    isig_w, isig_h = max(1, int(fw)), max(1, int(fh))

    sig_scaled = sig_img.resize((isig_w, isig_h), Image.Resampling.LANCZOS)

    # Layer for signature + printed name
    layer = Image.new('RGBA', contract_img.size, (255, 255, 255, 0))
    layer.paste(sig_scaled, (isig_x, isig_y), sig_scaled)

    draw = ImageDraw.Draw(layer)
    font_size = max(56, min(180, int(isig_h * 1.1)))
    font_reg: Any
    font_bold: Any
    # Prefer the fonts bundled in backend/fonts/ — the /usr/share paths below
    # only existed in Emergent's image. Without a real TTF, Pillow falls back
    # to a tiny bitmap font and the signer's printed name is barely legible on
    # a full-resolution contract scan.
    _fonts_dir = Path(__file__).resolve().parent.parent / "fonts"
    _candidates = [
        (_fonts_dir / "DejaVuSans.ttf", _fonts_dir / "DejaVuSans-Bold.ttf"),
        (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
         Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")),
    ]
    font_reg = font_bold = None
    for reg_path, bold_path in _candidates:
        try:
            if reg_path.exists() and bold_path.exists():
                font_reg = ImageFont.truetype(str(reg_path), font_size)
                font_bold = ImageFont.truetype(str(bold_path), font_size)
                break
        except Exception:
            continue
    if font_reg is None or font_bold is None:
        logger.warning("DejaVu fonts unavailable — signature name will use a bitmap fallback")
        font_reg = font_bold = ImageFont.load_default()

    pad = max(12, int(isig_h * 0.18))
    name_y = min(isig_y + isig_h + pad, native_h - font_size - 4)
    if name_y < 0:
        name_y = 0

    label = "Name: "
    if hasattr(draw, 'textlength'):
        label_w = draw.textlength(label, font=font_bold)
        name_w = draw.textlength(legal_name, font=font_reg)
    else:
        label_w = font_size * len(label) * 0.55
        name_w = font_size * len(legal_name) * 0.55
    total_w = label_w + name_w
    name_x = isig_x + max(0, int((isig_w - total_w) / 2))
    if name_x + int(total_w) > native_w:
        name_x = max(0, native_w - int(total_w) - 4)
    draw.text((name_x, name_y), label, fill=(20, 20, 20, 255), font=font_bold)
    draw.text((name_x + int(label_w), name_y), legal_name, fill=(20, 20, 20, 255), font=font_reg)

    signed = Image.alpha_composite(contract_img, layer)
    if file_ext in ('.jpg', '.jpeg'):
        signed = signed.convert('RGB')
    signed.save(signed_path)


# ---------- public entry point --------------------------------------------

def stamp_signature_on_contract(
    contract_path: Path, signed_path: Path,
    signature_data: str,
    sig_x: float, sig_y: float, sig_w: float, sig_h: float,
    display_width: float | None, display_height: float | None,
    legal_name: str, booking_id: str, uploads_dir: Path,
) -> None:
    """Dispatch to the right stamping branch based on contract extension.
    Raises ValueError / IOError on failure."""
    sig_img = _decode_signature_image(signature_data)
    file_ext = contract_path.suffix.lower()
    if file_ext == '.pdf':
        _stamp_signature_on_pdf(
            contract_path, signed_path, sig_img,
            sig_x, sig_y, sig_w, sig_h,
            display_width, display_height,
            legal_name, booking_id, uploads_dir,
        )
    else:
        _stamp_signature_on_image(
            contract_path, signed_path, file_ext, sig_img,
            sig_x, sig_y, sig_w, sig_h,
            display_width, display_height, legal_name,
        )

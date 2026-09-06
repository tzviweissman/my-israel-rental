"""Turn a signed rental agreement into a document you can actually send
someone.

(Reached today from the sublease signing link, but the document is a
rental agreement and is named as one: not every contract signed through
that link is a sublease.)

Until now the signature lived beside the contract rather than on it: a PNG
in `contracts.signatures[]`, and a Download button that handed back the
original, unsigned file. Both parties could see that a signature existed;
neither had a single artefact showing the agreement and the signature
together, which is the only form that is any use to a lawyer, a bank or a
Beit Din.

WHY THIS IS NOT `utils/contract_signing.py`. That module already stamps a
signature onto a contract, and the booking flow uses it. It cannot be used
here, for a reason that is worth writing down rather than rediscovering:
it needs `sig_x, sig_y, sig_w, sig_h` - where on the page to put the
signature - which the booking flow gets from the renter dragging a box over
a preview of the document. The sublease signing page has no such step, and
inventing coordinates would print somebody's signature across the middle of
their own contract text. A guess about where a page is blank is not a thing
to be guessing about on a legal document.

SO THIS APPENDS RATHER THAN STAMPS. A signature page is added at the end,
carrying the signer's name, their signature, the time, and a SHA-256 of the
exact bytes they signed. That is the convention every e-signature product
follows, and it has three properties a stamp does not: it cannot cover
anything, it works whatever the original looks like, and the hash makes the
pairing checkable - if the original is later altered, the digest on the
signature page stops matching, and anyone can verify that themselves.

THREE KINDS OF ORIGINAL, because the upload allows all of them:

  * PDF     - every original page, then the signature page.
  * image   - the photo on its own page, then the signature page.
  * DOCX    - the signature page alone. Rendering Word to PDF needs a
              converter this project does not have and should not grow for
              this; the hash still binds the page to the file, and the
              original is still downloadable beside it. Named plainly on
              the page so nobody thinks a page is missing.
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from io import BytesIO
from pathlib import Path
from zoneinfo import ZoneInfo

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

logger = logging.getLogger("server")

# The clock a contract in Israel is read against.
IL_TZ = ZoneInfo("Asia/Jerusalem")

INK = HexColor("#0F172A")
MUTED = HexColor("#64748B")
LINE = HexColor("#CBD5E1")

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def _has_hebrew(text: str) -> bool:
    return any("֐" <= ch <= "׿" for ch in text or "")


def _fonts_for(text: str) -> tuple[str, str, str]:
    """(regular, bold, display_text) for a name that may be in Hebrew.

    Reuses the faces the contract template already bundles and registers.
    The alternative is Helvetica, which has no Hebrew glyphs, so a Hebrew
    signer's printed name would come out as empty boxes on the one page
    whose whole purpose is to say who signed.
    """
    from utils.contract_template import _register_fonts

    _register_fonts()
    if not _has_hebrew(text):
        return "Inter", "Inter-Bold", text
    try:
        from bidi.algorithm import get_display
        return "Hebrew", "Hebrew-Bold", get_display(text)
    except ImportError:
        return "Hebrew", "Hebrew-Bold", text


def _decode_signature(signature_data: str) -> BytesIO | None:
    """The signature PNG, or None if there is nothing usable in it.

    Returns None rather than raising: a signature page with the name, the
    time and the hash but no scribble is still worth producing, and losing
    the whole document over a malformed data URL would be worse.
    """
    import base64

    try:
        raw = signature_data.split(",", 1)[1] if "," in signature_data else signature_data
        data = base64.b64decode(raw, validate=False)
        if not data:
            return None
        return BytesIO(data)
    except Exception:
        logger.warning("signed contract: signature image could not be decoded")
        return None


def _signature_page(
    *,
    signer_name: str,
    signed_at: datetime,
    signature_data: str,
    document_title: str,
    original_filename: str,
    digest: str,
    original_included: bool,
) -> BytesIO:
    reg, bold, name_display = _fonts_for(signer_name)
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)

    y = PAGE_H - MARGIN

    c.setFillColor(INK)
    c.setFont(bold, 16)
    c.drawString(MARGIN, y, "Signature")
    y -= 7 * mm
    c.setFillColor(MUTED)
    c.setFont(reg, 9)
    c.drawString(MARGIN, y, "This page forms part of the agreement it is attached to.")
    y -= 4 * mm
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.line(MARGIN, y, PAGE_W - MARGIN, y)
    y -= 12 * mm

    def row(label: str, value: str, value_font: str = None, gap: float = 11 * mm) -> None:
        nonlocal y
        c.setFillColor(MUTED)
        c.setFont(reg, 8)
        c.drawString(MARGIN, y, label)
        c.setFillColor(INK)
        c.setFont(value_font or reg, 11)
        c.drawString(MARGIN, y - 5 * mm, value)
        y -= gap

    row("Agreement", document_title or original_filename)
    row("Document", original_filename)
    row("Signed by", name_display, value_font=bold)
    row("Signed at", signed_at.astimezone(IL_TZ).strftime("%d %B %Y, %H:%M (%Z)"))

    # The scribble.
    y -= 2 * mm
    c.setFillColor(MUTED)
    c.setFont(reg, 8)
    c.drawString(MARGIN, y, "Signature")
    y -= 42 * mm
    box_w, box_h = 80 * mm, 34 * mm
    image = _decode_signature(signature_data)
    if image is not None:
        try:
            from reportlab.lib.utils import ImageReader
            c.drawImage(
                ImageReader(image), MARGIN, y + 4 * mm,
                width=box_w, height=box_h,
                mask="auto", preserveAspectRatio=True, anchor="sw",
            )
        except Exception:
            logger.warning("signed contract: signature image could not be drawn")
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.line(MARGIN, y + 2 * mm, MARGIN + box_w, y + 2 * mm)
    c.setFillColor(INK)
    c.setFont(reg, 9)
    c.drawString(MARGIN, y - 4 * mm, name_display)

    y -= 18 * mm
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(MARGIN, y, PAGE_W - MARGIN, y)
    y -= 7 * mm

    # The hash, and what it is for, said in words a person can act on.
    c.setFillColor(MUTED)
    c.setFont(reg, 8)
    c.drawString(MARGIN, y, "Document fingerprint (SHA-256)")
    y -= 5 * mm
    c.setFillColor(INK)
    c.setFont(reg, 8)
    for chunk in (digest[:32], digest[32:]):
        c.drawString(MARGIN, y, chunk)
        y -= 4.5 * mm
    y -= 2 * mm
    c.setFillColor(MUTED)
    c.setFont(reg, 7.5)
    note = (
        "This is a fingerprint of the exact file that was signed. If that file is "
        "altered afterwards, the fingerprint no longer matches, and anyone can check that."
    )
    if not original_included:
        note += (
            "  The signed document is a Word file, which cannot be attached to this page; "
            "it is downloadable separately and the fingerprint above identifies it."
        )
    for line in _wrap(note, 110):
        c.drawString(MARGIN, y, line)
        y -= 4 * mm

    c.setFillColor(MUTED)
    c.setFont(reg, 7)
    c.drawString(MARGIN, 12 * mm, "Signed on myisraelrental.com")

    c.save()
    buf.seek(0)
    return buf


def _wrap(text: str, width: int) -> list[str]:
    out, cur = [], ""
    for word in text.split():
        if len(cur) + len(word) + 1 > width:
            out.append(cur.strip())
            cur = word
        else:
            cur = f"{cur} {word}".strip()
    if cur:
        out.append(cur)
    return out


def build_signed_pdf(
    original: Path,
    out: Path,
    *,
    signer_name: str,
    signed_at: datetime,
    signature_data: str,
    document_title: str = "",
    original_filename: str = "",
) -> Path:
    """Write `out`: the agreement with a signature page after it.

    Raises on failure. The caller decides what a failure means - here it
    must never mean the signature was lost, because the signature is the
    part that cannot be recreated.
    """
    from PyPDF2 import PdfReader, PdfWriter

    digest = hashlib.sha256(original.read_bytes()).hexdigest()
    ext = original.suffix.lower()
    writer = PdfWriter()

    if ext == ".pdf":
        for page in PdfReader(str(original)).pages:
            writer.add_page(page)
        original_included = True
    elif ext in IMAGE_EXTS:
        writer.add_page(PdfReader(_image_page(original)).pages[0])
        original_included = True
    else:
        original_included = False

    page = _signature_page(
        signer_name=signer_name,
        signed_at=signed_at,
        signature_data=signature_data,
        document_title=document_title,
        # What the owner called it, not the uuid it is stored under.
        original_filename=original_filename or original.name,
        digest=digest,
        original_included=original_included,
    )
    writer.add_page(PdfReader(page).pages[0])

    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "wb") as fh:
        writer.write(fh)
    return out


def _image_page(image_path: Path) -> BytesIO:
    """A photographed or scanned contract, on one page, whole.

    Fitted rather than cropped, for the same reason listing photos are:
    trimming a document to fill a page is the one thing a copy of an
    agreement must never do.
    """
    from PIL import Image
    from reportlab.lib.utils import ImageReader

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    with Image.open(image_path) as img:
        iw, ih = img.size
    avail_w, avail_h = PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN
    scale = min(avail_w / iw, avail_h / ih)
    w, h = iw * scale, ih * scale
    c.drawImage(
        ImageReader(str(image_path)),
        (PAGE_W - w) / 2, (PAGE_H - h) / 2,
        width=w, height=h, mask="auto", preserveAspectRatio=True,
    )
    c.save()
    buf.seek(0)
    return buf

"""Generate the MyIsraelRental fillable rental-contract PDF templates.

Called at server startup to (re)generate English and Hebrew blank templates
in /app/backend/uploads/templates/. They're then served via the
/api/contract-template/{lang} endpoint and downloadable from the dashboard.

Design: soft blue/gray palette, clean modern layout, AcroForm text fields so
the landlord or tenant can fill it directly in Acrobat / Preview / browser.

TERMS_ARE_THEIRS
----------------
Every clause in this document is blank, and that is a decision rather than
an omission (Tzvi, 6 Sep 2026: "leave all terms empty so people can choose
their own terms").

It used to ship three pre-written conditions, a liability waiver, and a
governing-law clause naming one particular forum. Three things were wrong
with that. It put words into an agreement between two people who never
asked for them; the pre-written clauses were the only ones with no form
field over them, so they were the only ones nobody could edit; and a
liability waiver we drafted is a legal position we are in no position to
take on somebody else's behalf.

So the headings stay - they tell a person what a rental agreement usually
covers - and the words are theirs. If a clause is ever added back, it must
be editable, and it must be a clause we are willing to have argued in a
Beit Din with our name on it.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

try:
    from bidi.algorithm import get_display
except ImportError:  # pragma: no cover
    def get_display(text: str) -> str:  # fallback: no RTL reordering
        return text

# ---------- Palette ----------
INK = HexColor("#0F172A")      # slate-900, body text
MUTED = HexColor("#64748B")    # slate-500
LINE = HexColor("#CBD5E1")     # slate-300, field underlines
CARD = HexColor("#F8FAFC")     # slate-50, section cards
BORDER = HexColor("#E2E8F0")   # slate-200
BRAND = HexColor("#2563EB")    # blue-600 (soft professional blue)
BRAND_DARK = HexColor("#1E40AF")   # blue-800
ACCENT = HexColor("#0EA5E9")   # sky-500 accent

# ---------- Layout constants ----------
PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

FONTS_DIR = Path(__file__).resolve().parent.parent / "fonts"


def _register_fonts() -> None:
    """Register the body + Hebrew fonts. Idempotent.

    Fonts are BUNDLED in backend/fonts/ rather than read from system paths.
    The old code pointed at /usr/share/fonts/... which only existed inside
    Emergent's custom image — on any other host those files are absent and
    Hebrew silently falls back to Helvetica, which has no Hebrew glyphs, so
    Hebrew contracts render as blank boxes. System paths are kept as a
    secondary fallback for images that do provide them.
    """
    # Static Regular/Bold instances generated from the upstream variable fonts
    # (Arimo is the metric-compatible open substitute for Liberation Sans).
    # Using the variable file directly would render at its default weight —
    # Thin — which is too light to read on a legal document.
    mappings = [
        # (registered name, bundled file, legacy system path)
        ("Inter", "Arimo-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
        ("Inter-Bold", "Arimo-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
        ("Inter-Italic", "Arimo-Italic.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf"),
        ("Hebrew", "NotoSansHebrew-Regular.ttf", "/usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf"),
        ("Hebrew-Bold", "NotoSansHebrew-Bold.ttf", "/usr/share/fonts/truetype/noto/NotoSansHebrew-Bold.ttf"),
    ]
    for name, bundled, system_path in mappings:
        if name in pdfmetrics.getRegisteredFontNames():
            continue
        for candidate in (FONTS_DIR / bundled, Path(system_path)):
            try:
                if candidate.exists():
                    pdfmetrics.registerFont(TTFont(name, str(candidate)))
                    break
            except Exception:
                continue  # try the next candidate; Helvetica is the last resort


def _he(text: str) -> str:
    """Reorder Hebrew text for RTL display in a LTR PDF canvas."""
    return get_display(text)


# -----------------------------------------------------------------------------
# English content
# -----------------------------------------------------------------------------
EN = {
    "brand": "MyIsraelRental",
    "brand_tag": "YOUR HOME IN ISRAEL",
    "title": "RENTAL CONTRACT",
    "site": "myisraelrental.com",
    "date": "Date",
    "property": "Property Address",
    "landlord": "Landlord / Sublessor",
    "tenant": "Tenant",
    "name": "Full Name",
    "id": "ID / Passport No.",
    "phone": "Phone",
    "email": "Email",
    "period": "Rental Period",
    "from": "From",
    "to": "To",
    "nights": "Total nights / period",
    "price": "Rental Price",
    "total_amount": "Total Amount",
    "currency": "Currency",
    "deposit": "Security Deposit",
    "deposit_note": "(refundable after checkout, minus any damages)",
    "utilities": "Utilities price",
    "terms": "Terms & Conditions",
    "liability": "Liability",
    "law": "Governing Law",
    "signatures": "Signatures",
    "landlord_sig": "Landlord / Sublessor",
    "tenant_sig": "Tenant",
    "notes": "Inventory / Property Condition Notes (optional)",
    "footer": "Generated by myisraelrental.com",
    # Deliberately empty. See TERMS_ARE_THEIRS at the top of this file.
    "terms_items": ["", "", "", "", "", "", "", "", ""],
}

HE = {
    "brand": "MyIsraelRental",
    "brand_tag": _he("הבית שלך בישראל"),
    "title": _he("חוזה שכירות"),
    "site": "myisraelrental.com",
    "date": _he("תאריך"),
    "property": _he("כתובת הנכס"),
    "landlord": _he("משכיר / שוכר משנה"),
    "tenant": _he("שוכר"),
    "name": _he("שם מלא"),
    "id": _he("מספר תעודת זהות / דרכון"),
    "phone": _he("טלפון"),
    "email": _he("דואר אלקטרוני"),
    "period": _he("תקופת השכירות"),
    "from": _he("מתאריך"),
    "to": _he("עד תאריך"),
    "nights": _he("סך הלילות / תקופה"),
    "price": _he("דמי השכירות"),
    "total_amount": _he("סכום כולל"),
    "currency": _he("מטבע"),
    "deposit": _he("פיקדון ביטחון"),
    "deposit_note": _he("(יוחזר לאחר היציאה, בניכוי נזקים ככל שיהיו)"),
    "utilities": _he("עלות שירותים"),
    "terms": _he("תנאים והתניות"),
    "liability": _he("אחריות"),
    "law": _he("דין חל"),
    "signatures": _he("חתימות"),
    "landlord_sig": _he("משכיר / שוכר משנה"),
    "tenant_sig": _he("שוכר"),
    "notes": _he("הערות מצב הנכס / רשימת מלאי (רשות)"),
    "footer": _he("הופק על ידי myisraelrental.com"),
    # Deliberately empty. See TERMS_ARE_THEIRS at the top of this file.
    "terms_items": ["", "", "", "", "", "", "", "", ""],
}


# -----------------------------------------------------------------------------
# Low-level drawing helpers
# -----------------------------------------------------------------------------
def _body_font(rtl: bool) -> tuple[str, str]:
    return ("Hebrew", "Hebrew-Bold") if rtl else ("Inter", "Inter-Bold")


def _draw_header(c: canvas.Canvas, t: dict, rtl: bool) -> None:
    # Full-width header band
    c.setFillColor(BRAND_DARK)
    c.rect(0, PAGE_H - 28 * mm, PAGE_W, 28 * mm, fill=1, stroke=0)

    # Lighter accent stripe
    c.setFillColor(ACCENT)
    c.rect(0, PAGE_H - 28 * mm, PAGE_W, 1.5 * mm, fill=1, stroke=0)

    reg, bold = _body_font(rtl)
    # Brand text
    c.setFillColorRGB(1, 1, 1)
    c.setFont(bold, 22)
    c.drawString(MARGIN, PAGE_H - 14 * mm, t["brand"])
    c.setFillColor(HexColor("#93C5FD"))  # blue-300
    c.setFont(reg, 8)
    c.drawString(MARGIN, PAGE_H - 19 * mm, t["brand_tag"])

    # Title on the right
    c.setFillColorRGB(1, 1, 1)
    c.setFont(bold, 16)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 14 * mm, t["title"])
    c.setFont(reg, 9)
    c.setFillColor(HexColor("#93C5FD"))
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 19 * mm, t["site"])


def _draw_footer(c: canvas.Canvas, t: dict, rtl: bool, page_num: int) -> None:
    reg, _ = _body_font(rtl)
    c.setFillColor(MUTED)
    c.setFont(reg, 8)
    c.drawCentredString(PAGE_W / 2, 10 * mm, t["footer"])
    c.setFont(reg, 7)
    c.drawRightString(PAGE_W - MARGIN, 10 * mm, f"p. {page_num}")


def _section_header(c: canvas.Canvas, y: float, label: str, rtl: bool) -> float:
    """Bold accent bar + label. Returns next y position."""
    _, bold = _body_font(rtl)
    c.setFillColor(BRAND)
    c.rect(MARGIN, y - 1, 3, 12, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(bold, 11)
    c.drawString(MARGIN + 7, y + 2, label)
    return y - 6


def _label(c: canvas.Canvas, x: float, y: float, text: str, rtl: bool) -> None:
    reg, _ = _body_font(rtl)
    c.setFillColor(MUTED)
    c.setFont(reg, 8)
    c.drawString(x, y, text)


def _field(
    c: canvas.Canvas,
    name: str,
    x: float,
    y: float,
    w: float,
    h: float = 9 * mm,
    rtl: bool = False,
    multiline: bool = False,
    font_size: int = 10,
) -> None:
    """Draw an AcroForm text field with a soft underline so it looks
    elegant both blank and filled."""
    reg, _ = _body_font(rtl)
    # Soft underline for the line-look
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.line(x, y, x + w, y)
    # Interactive form field (invisible border, sits ON the line)
    try:
        c.acroForm.textfield(
            name=name,
            x=x,
            y=y + 1,
            width=w,
            height=h,
            borderWidth=0,
            fillColor=Color(1, 1, 1, alpha=0),
            textColor=INK,
            fontName=reg,
            fontSize=font_size,
            fieldFlags="multiline" if multiline else "",
            forceBorder=False,
        )
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Page renderer
# -----------------------------------------------------------------------------
def _build_page(c: canvas.Canvas, t: dict, rtl: bool, lang_prefix: str) -> None:
    reg, bold = _body_font(rtl)

    _draw_header(c, t, rtl)

    y = PAGE_H - 36 * mm
    col_w = (PAGE_W - 2 * MARGIN - 6 * mm) / 2

    # Date row
    _label(c, MARGIN, y, t["date"], rtl)
    _field(c, f"{lang_prefix}_date", MARGIN + 18 * mm, y - 2, 60 * mm, 8 * mm, rtl=rtl)
    y -= 14 * mm

    # Property Address
    _label(c, MARGIN, y + 4, t["property"], rtl)
    _field(c, f"{lang_prefix}_property_address", MARGIN, y, PAGE_W - 2 * MARGIN, 9 * mm, rtl=rtl)
    y -= 16 * mm

    # -- Landlord section
    y = _section_header(c, y, t["landlord"], rtl)
    y -= 6 * mm
    _label(c, MARGIN, y + 4, t["name"], rtl)
    _field(c, f"{lang_prefix}_ll_name", MARGIN, y, col_w, 8 * mm, rtl=rtl)
    _label(c, MARGIN + col_w + 6 * mm, y + 4, t["id"], rtl)
    _field(c, f"{lang_prefix}_ll_id", MARGIN + col_w + 6 * mm, y, col_w, 8 * mm, rtl=rtl)
    y -= 14 * mm
    _label(c, MARGIN, y + 4, t["phone"], rtl)
    _field(c, f"{lang_prefix}_ll_phone", MARGIN, y, col_w, 8 * mm, rtl=rtl)
    _label(c, MARGIN + col_w + 6 * mm, y + 4, t["email"], rtl)
    _field(c, f"{lang_prefix}_ll_email", MARGIN + col_w + 6 * mm, y, col_w, 8 * mm, rtl=rtl)
    y -= 14 * mm

    # -- Tenant section
    y = _section_header(c, y, t["tenant"], rtl)
    y -= 6 * mm
    _label(c, MARGIN, y + 4, t["name"], rtl)
    _field(c, f"{lang_prefix}_tn_name", MARGIN, y, col_w, 8 * mm, rtl=rtl)
    _label(c, MARGIN + col_w + 6 * mm, y + 4, t["id"], rtl)
    _field(c, f"{lang_prefix}_tn_id", MARGIN + col_w + 6 * mm, y, col_w, 8 * mm, rtl=rtl)
    y -= 14 * mm
    _label(c, MARGIN, y + 4, t["phone"], rtl)
    _field(c, f"{lang_prefix}_tn_phone", MARGIN, y, col_w, 8 * mm, rtl=rtl)
    _label(c, MARGIN + col_w + 6 * mm, y + 4, t["email"], rtl)
    _field(c, f"{lang_prefix}_tn_email", MARGIN + col_w + 6 * mm, y, col_w, 8 * mm, rtl=rtl)
    y -= 14 * mm

    # -- Rental period + price (single card with soft background)
    card_h = 52 * mm
    c.setFillColor(CARD)
    c.setStrokeColor(BORDER)
    c.roundRect(MARGIN, y - card_h + 4, PAGE_W - 2 * MARGIN, card_h, 6, fill=1, stroke=1)

    inner_y = y - 4
    c.setFillColor(INK)
    c.setFont(bold, 10)
    c.drawString(MARGIN + 5 * mm, inner_y, t["period"])
    inner_y -= 9 * mm
    _label(c, MARGIN + 5 * mm, inner_y + 4, t["from"], rtl)
    _field(c, f"{lang_prefix}_from", MARGIN + 5 * mm, inner_y, 45 * mm, 7 * mm, rtl=rtl)
    _label(c, MARGIN + 55 * mm, inner_y + 4, t["to"], rtl)
    _field(c, f"{lang_prefix}_to", MARGIN + 55 * mm, inner_y, 45 * mm, 7 * mm, rtl=rtl)
    _label(c, MARGIN + 110 * mm, inner_y + 4, t["nights"], rtl)
    _field(c, f"{lang_prefix}_nights", MARGIN + 110 * mm, inner_y, 55 * mm, 7 * mm, rtl=rtl)

    inner_y -= 12 * mm
    c.setFillColor(INK)
    c.setFont(bold, 10)
    c.drawString(MARGIN + 5 * mm, inner_y, t["price"])
    inner_y -= 9 * mm
    _label(c, MARGIN + 5 * mm, inner_y + 4, t["total_amount"], rtl)
    _field(c, f"{lang_prefix}_total", MARGIN + 5 * mm, inner_y, 40 * mm, 7 * mm, rtl=rtl)
    _label(c, MARGIN + 50 * mm, inner_y + 4, t["currency"] + " (NIS / USD)", rtl)
    _field(c, f"{lang_prefix}_currency", MARGIN + 50 * mm, inner_y, 25 * mm, 7 * mm, rtl=rtl)
    _label(c, MARGIN + 80 * mm, inner_y + 4, t["deposit"], rtl)
    _field(c, f"{lang_prefix}_deposit", MARGIN + 80 * mm, inner_y, 40 * mm, 7 * mm, rtl=rtl)
    _label(c, MARGIN + 125 * mm, inner_y + 4, t["utilities"], rtl)
    _field(c, f"{lang_prefix}_utilities", MARGIN + 125 * mm, inner_y, 40 * mm, 7 * mm, rtl=rtl)

    # Deposit footnote
    c.setFillColor(MUTED)
    c.setFont(reg, 7)
    c.drawString(MARGIN + 5 * mm, y - card_h + 8, t["deposit_note"])

    y = y - card_h - 6 * mm

    # -- Terms & Conditions
    y = _section_header(c, y, t["terms"], rtl)
    y -= 4 * mm

    c.setFillColor(INK)
    c.setFont(reg, 9)
    for i, _ in enumerate(t["terms_items"], start=1):
        # Page-break guard, in the space a numbered blank actually needs.
        if y - 14 * mm < 30 * mm:
            c.showPage()
            _draw_header(c, t, rtl)
            y = PAGE_H - 36 * mm
            y = _section_header(c, y, t["terms"] + " (continued)", rtl)
            y -= 4 * mm

        c.setFont(bold, 9)
        c.drawString(MARGIN, y, f"{i}.")
        c.setFont(reg, 9)
        y = _ruled_field(c, y, f"{lang_prefix}_term_{i}", rtl, x=MARGIN + 6 * mm) + 3 * mm - 4 * mm

    y -= 2 * mm

    # Start page 2 for liability/signatures if we're running low
    if y < 120 * mm:
        c.showPage()
        _draw_header(c, t, rtl)
        y = PAGE_H - 36 * mm

    # -- Liability. Headed, and blank: see TERMS_ARE_THEIRS.
    y = _section_header(c, y, t["liability"], rtl)
    y -= 6 * mm
    c.setFillColor(INK)
    y = _ruled_field(c, y, f"{lang_prefix}_liability", rtl, lines=2)

    # -- Governing law. The clause this replaced named one particular
    #    forum, which is not ours to choose for two other people.
    y = _section_header(c, y, t["law"], rtl)
    y -= 6 * mm
    y = _ruled_field(c, y, f"{lang_prefix}_law", rtl, lines=1)
    y -= 2 * mm

    # -- Signatures
    y = _section_header(c, y, t["signatures"], rtl)
    # Give enough vertical room so the "Landlord / Sublessor" label sits BELOW
    # the section header and doesn't overlap it.
    y -= 18 * mm
    sig_w = (PAGE_W - 2 * MARGIN - 10 * mm) / 2

    def _sig_block(x: float, role_label: str, field_prefix: str) -> None:
        # Role label sits above the signature line
        c.setFillColor(INK)
        c.setFont(bold, 9)
        c.drawString(x, y + 10 * mm, role_label)
        # Signature line + date line
        c.setStrokeColor(LINE)
        c.setLineWidth(0.8)
        c.line(x, y, x + sig_w * 0.7, y)
        c.line(x + sig_w * 0.72, y, x + sig_w - 2, y)
        # Sub-labels below the lines (with breathing room)
        c.setFillColor(MUTED)
        c.setFont(reg, 8)
        c.drawString(x, y - 4 * mm, "Signature")
        c.drawString(x + sig_w * 0.72, y - 4 * mm, t["date"])
        # Invisible AcroForm text fields over the lines (lets someone type name)
        _field(c, f"{field_prefix}_name", x, y + 0.5, sig_w * 0.68, 7 * mm, rtl=rtl, font_size=10)
        _field(c, f"{field_prefix}_date", x + sig_w * 0.72, y + 0.5, sig_w * 0.26, 7 * mm, rtl=rtl, font_size=10)

    _sig_block(MARGIN, t["landlord_sig"], f"{lang_prefix}_ll_sig")
    _sig_block(MARGIN + sig_w + 10 * mm, t["tenant_sig"], f"{lang_prefix}_tn_sig")

    y -= 18 * mm

    # -- Property Condition / Inventory Notes
    y = _section_header(c, y, t["notes"], rtl)
    y -= 4 * mm
    notes_h = 30 * mm
    c.setFillColor(CARD)
    c.setStrokeColor(BORDER)
    c.roundRect(MARGIN, y - notes_h, PAGE_W - 2 * MARGIN, notes_h, 5, fill=1, stroke=1)
    _field(
        c,
        f"{lang_prefix}_notes",
        MARGIN + 2 * mm,
        y - notes_h + 2 * mm,
        PAGE_W - 2 * MARGIN - 4 * mm,
        notes_h - 4 * mm,
        rtl=rtl,
        multiline=True,
        font_size=9,
    )


def _ruled_field(
    c: canvas.Canvas,
    y: float,
    name: str,
    rtl: bool,
    x: float = MARGIN,
    lines: int = 2,
    gap: float = 7 * mm,
) -> float:
    """`lines` writing rules with one invisible typing field over them.

    Somewhere for a person to write their own words, on paper or on screen.
    Returns the new y.
    """
    reg, _ = _body_font(rtl)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    for i in range(lines):
        c.line(x, y - 1 - i * gap, PAGE_W - MARGIN, y - 1 - i * gap)
    try:
        c.acroForm.textfield(
            name=name,
            x=x,
            y=y - (lines - 1) * gap - 1 * mm,
            width=PAGE_W - MARGIN - x,
            height=lines * gap,
            borderWidth=0,
            fillColor=Color(1, 1, 1, alpha=0),
            textColor=INK,
            fontName=reg,
            fontSize=10,
            fieldFlags="multiline",
            forceBorder=False,
        )
    except Exception:
        # A PDF that cannot be typed into is still a PDF that can be
        # printed and written on. Never fail the whole document over it.
        pass
    return y - (lines * gap) - 3 * mm



# -----------------------------------------------------------------------------
# Public API
# -----------------------------------------------------------------------------
def generate_template(lang: str, out_path: Path) -> Path:
    """Generate the PDF template for the given language and save it."""
    _register_fonts()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    t = EN if lang == "en" else HE
    rtl = (lang == "he")

    c = canvas.Canvas(str(out_path), pagesize=A4)
    c.setTitle(f"MyIsraelRental Rental Contract ({lang.upper()})")
    c.setAuthor("myisraelrental.com")

    _build_page(c, t, rtl, lang)

    # Apply footer to each page we've drawn
    total_pages = c.getPageNumber()
    _draw_footer(c, t, rtl, total_pages)
    c.save()
    return out_path


def ensure_templates(uploads_root: Path) -> dict[str, Path]:
    """Idempotent helper - call at FastAPI startup.

    REGENERATES WHEN THIS FILE CHANGES, and that is not a nicety. The two
    PDFs are committed to the repo, and the old rule here was "generate if
    missing" - so they were never missing, and an edit to the wording above
    reached nobody. A contract change that silently does not ship is the
    worst kind, because the deploy is green and the document is stale.

    The stamp is a hash of this module written beside the PDFs. No PDF
    parser, no new dependency, and it costs one small read per boot.
    """
    out_dir = uploads_root / "templates"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp_file = out_dir / ".generator-stamp"
    stamp = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()[:16]
    try:
        current = stamp_file.read_text(encoding="utf-8").strip()
    except OSError:
        current = ""

    results = {}
    stale = current != stamp
    for lang in ("en", "he"):
        out = out_dir / f"myisraelrental_contract_{lang}.pdf"
        if stale or not out.exists():
            generate_template(lang, out)
        results[lang] = out
    if stale:
        try:
            stamp_file.write_text(stamp, encoding="utf-8")
        except OSError:
            # A read-only templates dir just means we regenerate every
            # boot, which is correct behaviour and costs milliseconds.
            pass
    return results

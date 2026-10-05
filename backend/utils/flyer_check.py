"""Is this picture a photo or a flyer? Page builder v3, phase 2.

docs/page-builder-design-rules.md, part 4: a picture with baked-in text (a
flyer, a poster, a menu board) is never the hero and is never cropped; it is
shown whole in a "From the business" slot. The rule for "baked-in text", from
the build prompt: text covering more than about 8% of the picture, or a price
or a phone number found in it.

Free and local (Tzvi, 5 Oct 2026): Tesseract through pytesseract, which the
repo already depends on (utils/files.py). When the Tesseract program is not
installed, nothing is guessed: every picture comes back "unknown", and an
unknown picture is never used as a hero, so the page falls back to the
typographic panel rather than risk cropping a flyer.

    classify(image_bytes) -> {"kind": "photo" | "flyer" | "unknown", ...}
    decide(words, width, height) -> the same, from OCR boxes (pure, tested)
"""
from __future__ import annotations

import io
import os
import re
from typing import Optional

TEXT_AREA_LIMIT = 0.08
MIN_CONFIDENCE = 60
MANY_WORDS = 8
# A price: a shekel or dollar sign beside digits, or "NIS"/"ש"ח" after them.
_PRICE = re.compile(r"(₪\s?\d|\d\s?₪|\$\s?\d|\d+\s?(nis|ils|ש\"?ח|שח)\b)", re.I)
# A phone number: an Israeli prefix or 9-12 digits written with separators.
_PHONE = re.compile(r"(\+?972[\s-]?\d|\b0\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b|\b\d{3}[\s-]\d{3}[\s-]\d{4}\b)")


def decide(words: list[tuple[str, float, int, int]], width: int, height: int) -> dict:
    """words: (text, confidence 0-100, box width, box height) per OCR word."""
    real = [(t, w, h) for t, c, w, h in words if c >= MIN_CONFIDENCE and len((t or "").strip()) >= 2]
    area = sum(w * h for _, w, h in real) / max(1, width * height)
    text = " ".join(t for t, _, _ in real)
    has_price, has_phone = bool(_PRICE.search(text)), bool(_PHONE.search(text))
    # Word boxes are tight, so a poster full of lines can still box under 8%;
    # a run of confident words is the second sign (a photo has a label or
    # two at most). Measured on real flyers, 5 Oct 2026.
    many_words = sum(1 for t, _, _ in real if len(t.strip()) >= 3 and t.strip().isalnum()) >= MANY_WORDS
    flyer = area > TEXT_AREA_LIMIT or many_words or has_price or has_phone
    return {"kind": "flyer" if flyer else "photo", "text_area": round(min(area, 1.0), 3),
            "words": len(real), "has_price": has_price, "has_phone": has_phone}


def _tesseract() -> Optional[object]:
    try:
        import pytesseract
        cmd = os.environ.get("TESSERACT_CMD", "").strip()
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd
        pytesseract.get_tesseract_version()
        return pytesseract
    except Exception:  # noqa: BLE001 - not installed: report unknown, never guess
        return None


def available() -> bool:
    return _tesseract() is not None


def _read(tess, img, langs) -> list[tuple[str, float, int, int]]:
    """Words from one picture, read in overlapping horizontal strips.

    Tesseract's page layout step gives up on posters with a busy background:
    on L.A. Cholent's flyer it found nothing in the whole picture, but read
    the phone number at once from the bottom strip alone. So each strip is
    read on its own, greyscaled, stretched in contrast and enlarged. About
    seven seconds a picture."""
    from PIL import ImageOps
    g = ImageOps.autocontrast(ImageOps.grayscale(img))
    # Ten strips, a third overlapping: measured best of four settings on ten
    # known pictures (L.A. Cholent's four flyers, six plain food photos), all
    # ten right; fewer strips missed the flyer, other modes missed several.
    bands, overlap = 10, 0.3
    step = g.height / bands
    words = []
    for n in range(bands):
        top = max(0, int(n * step - step * overlap))
        bottom = min(g.height, int((n + 1) * step + step * overlap))
        strip = g.crop((0, top, g.width, bottom))
        scale = 2 if strip.width < 1600 else 1
        if scale > 1:
            strip = strip.resize((strip.width * scale, strip.height * scale))
        d = tess.image_to_data(strip, lang=langs, config="--psm 6", output_type=tess.Output.DICT)
        for i in range(len(d["text"])):
            words.append((d["text"][i], float(d["conf"][i]),
                          int(d["width"][i]) // scale, int(d["height"][i]) // scale))
    return words


def classify(image_bytes: bytes) -> dict:
    tess = _tesseract()
    if tess is None:
        return {"kind": "unknown", "reason": "no text reader installed"}
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:  # noqa: BLE001
        return {"kind": "unknown", "reason": "not an image"}
    img.thumbnail((1400, 1400))
    langs = "eng+heb" if "heb" in (tess.get_languages(config="") or []) else "eng"
    # Overlapping strips read some words twice; the area is capped at the
    # picture so a repeat can only make a flyer more certain, never a photo.
    return decide(_read(tess, img, langs), img.width, img.height)


if __name__ == "__main__":
    # For the quality gate (scripts/check-page.mjs): one JSON verdict per URL.
    #   python -m utils.flyer_check URL [URL ...]
    import json
    import sys
    import urllib.request

    from dotenv import load_dotenv
    load_dotenv()   # TESSERACT_CMD and TESSDATA_PREFIX, run from backend/
    for url in sys.argv[1:]:
        try:
            with urllib.request.urlopen(url, timeout=20) as r:  # noqa: S310 - our own image URLs
                verdict = classify(r.read())
        except Exception as e:  # noqa: BLE001
            verdict = {"kind": "unknown", "reason": str(e)[:80]}
        print(json.dumps({"url": url, **verdict}))

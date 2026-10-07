"""Page builder v3, phase 2: flyers are told apart from photos, and a flyer
or an unchecked picture is never the hero (docs/page-builder-design-rules.md,
part 4). The decision is tested without Tesseract; reading real pictures is
tested when the Tesseract program is installed, and skipped (not failed)
when it is not.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tests.test_design_brief import CHOLENT  # noqa: E402
from utils.design_brief import DesignBrief, build_brief, photo_candidates  # noqa: E402
from utils.flyer_check import available, classify, decide  # noqa: E402

W, H = 1000, 1000


def test_lots_of_text_is_a_flyer():
    words = [("SHABBOS", 95, 300, 90), ("CHOLENT", 92, 320, 90), ("ORDER", 90, 200, 60)]
    assert decide(words, W, H)["kind"] == "photo"          # 6.8% of the picture: under the line
    words.append(("TODAY", 91, 260, 80))
    assert decide(words, W, H)["kind"] == "flyer"          # 8.9%: over it


def test_a_price_or_a_phone_number_makes_it_a_flyer_even_when_small():
    assert decide([("From", 90, 40, 12), ("₪100", 88, 40, 12)], W, H)["has_price"]
    assert decide([("055-331-1442", 90, 90, 12)], W, H)["kind"] == "flyer"
    assert decide([("+972", 85, 30, 12), ("55", 85, 15, 12)], W, H)["has_phone"]


def test_a_photo_with_a_little_stray_text_is_a_photo():
    # A label on a jar: one small word, no price, no phone.
    assert decide([("Olive", 91, 60, 20)], W, H)["kind"] == "photo"
    # Low-confidence noise (texture read as letters) does not count.
    assert decide([("iiil", 20, 600, 600)], W, H)["kind"] == "photo"


def test_a_flyer_or_unchecked_picture_is_never_the_hero():
    pics = [{"ref": "listing:g1:gallery:0", "kind": "flyer"}, {"ref": "listing:g1:item:0:0", "kind": "unknown"}]
    brief = build_brief(CHOLENT, None, pics)
    assert brief.hero.tier == 3, "no real photo: the typographic panel"
    assert "food photos" in brief.missing_content
    bad = {**brief.model_dump(), "hero": {"tier": 1, "media_id": "listing:g1:gallery:0", "subject_side": "right"}}
    with pytest.raises(ValidationError, match="never a flyer"):
        DesignBrief(**bad)


def test_a_checked_photo_becomes_a_tier_1_hero():
    pics = [{"ref": "listing:g1:gallery:0", "kind": "flyer"}, {"ref": "listing:g1:item:1:0", "kind": "photo"}]
    brief = build_brief(CHOLENT, None, pics)
    assert brief.hero.tier == 1 and brief.hero.media_id == "listing:g1:item:1:0"


def test_pictures_are_named_by_reference_never_by_url():
    refs = [r for r, _ in photo_candidates({**CHOLENT, "cover_url": "https://x/c.jpg"})]
    assert refs[0] == "cover" and "listing:g1:gallery:0" in refs
    with pytest.raises(ValidationError):
        DesignBrief(**{**build_brief(CHOLENT).model_dump(),
                       "photos": [{"ref": "https://evil.example/x.jpg", "kind": "photo"}]})


def _flyer_png() -> bytes:
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (900, 1200), (30, 24, 20))
    d = ImageDraw.Draw(img)
    try:
        big = ImageFont.truetype("arial.ttf", 90)
        small = ImageFont.truetype("arial.ttf", 54)
    except OSError:
        big = small = ImageFont.load_default()
    d.text((60, 120), "FAMOUS CHOLENT", fill="white", font=big)
    d.text((60, 300), "ORDER FOR SHABBOS", fill="white", font=small)
    d.text((60, 420), "Medium 100 NIS", fill="white", font=small)
    d.text((60, 1000), "055-331-1442", fill="white", font=small)
    buf = io.BytesIO(); img.save(buf, "PNG")
    return buf.getvalue()


def _photo_png() -> bytes:
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (900, 700), (120, 90, 60))
    d = ImageDraw.Draw(img)
    for i in range(0, 700, 7):
        d.line((0, i, 900, i + 120), fill=(150 + i % 60, 110, 70), width=5)
    d.ellipse((250, 180, 650, 520), fill=(90, 60, 40))
    buf = io.BytesIO(); img.save(buf, "PNG")
    return buf.getvalue()


@pytest.mark.skipif(not available(), reason="the Tesseract program is not installed here")
def test_real_ocr_tells_a_flyer_from_a_photo():
    assert classify(_flyer_png())["kind"] == "flyer"
    assert classify(_photo_png())["kind"] == "photo"


def test_without_tesseract_nothing_is_guessed(monkeypatch):
    import utils.flyer_check as fc
    monkeypatch.setattr(fc, "_tesseract", lambda: None)
    assert fc.classify(_flyer_png())["kind"] == "unknown"


@pytest.mark.parametrize("langs,want", [(["eng", "heb", "osd"], True), (["eng", "osd"], False), (None, False)])
def test_health_reports_ocr_only_with_hebrew_and_english(monkeypatch, langs, want):
    """English alone is not enough: Hebrew flyers would read as photos."""
    import utils.flyer_check as fc

    class Tess:
        @staticmethod
        def get_languages(config=""):
            return langs
    monkeypatch.setattr(fc, "_tesseract", lambda: Tess if langs is not None else None)
    fc.reads_both_languages.cache_clear()
    try:
        assert fc.reads_both_languages() is want
    finally:
        fc.reads_both_languages.cache_clear()

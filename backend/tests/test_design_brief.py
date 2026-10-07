"""Page builder v3: the design brief's rules (utils/design_brief.py).

docs/page-builder-design-rules.md (v3), section 1 of the build prompt: a
brief that fails contrast, names a font off the allowlist, invents a price
or paraphrases the owner is refused. Pure: no server, no network, no AI.
"""
from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.design_brief import (  # noqa: E402
    DesignBrief, brief_problems, build_brief, contrast, derive_palette, extract_accent, film_problems, page_v3_on,
)

CHOLENT = {
    "name": "L.A. Cholent by Rabbi Samuels",
    "description": ("Rabbi Samuels LA Cholent has been a fan favorite for over a decade, and now we've opened "
                    "an Israel line! Order for your family visiting, your shabbos meals, Thursday nights, "
                    "kiddushim, shalom zachors, and simchos of any size. Just throw our raw ingredients into "
                    "your crock pot, add water, and enjoy!"),
    "areas": ["jerusalem"], "serves_nationwide": True,
    "kosher_certification": {"body": "Rabbi Weiner"},
    "listings": [{"id": "g1", "title": "Catering", "category": "events-catering", "gig_type": "deliverable",
                  "gallery": ["flyer.jpg"],
                  "tiers": [{"name": "Medium", "price": 100, "description": "Feeds 4-6 people"},
                            {"name": "Large", "price": 180, "description": "Feeds 8-12 people"}]}],
}


def _gold_logo() -> bytes:
    """A logo like theirs: a gold gradient ring and black lettering on white."""
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (200, 200), "white")
    d = ImageDraw.Draw(img)
    for i, shade in enumerate(((150, 112, 40), (201, 160, 78), (236, 205, 130))):
        d.ellipse((10 + i * 8, 10 + i * 8, 190 - i * 8, 190 - i * 8), outline=shade, width=8)
    d.rectangle((70, 90, 130, 110), fill="black")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def _good() -> dict:
    return build_brief(CHOLENT).model_dump()


def test_a_brief_built_from_their_data_is_valid_and_their_own():
    b = build_brief(CHOLENT, _gold_logo())
    assert b.preset == "candlelight" and b.category == "food"
    assert b.primary_action.kind == "message" and b.primary_action.href == "#message", "chat-only"
    assert b.primary_action.price_anchor == 100
    assert all(t.text in CHOLENT["description"] and "!" not in t.text for t in b.taglines)
    assert "food photos" in b.missing_content and "delivery terms" in b.missing_content
    assert brief_problems(b, CHOLENT) == []


def test_the_accent_comes_from_the_logo_mid_tone():
    accent = extract_accent(_gold_logo())
    assert accent is not None
    r, g, bl = (int(accent[i:i + 2], 16) for i in (1, 3, 5))
    # The middle gold (201, 160, 78), within a tolerance; not the shadow, not the highlight.
    assert abs(r - 201) <= 30 and abs(g - 160) <= 30 and abs(bl - 78) <= 30, accent
    assert extract_accent(b"not an image") is None


def test_low_contrast_is_refused():
    bad = _good()
    bad["palette"]["text"] = bad["palette"]["ground"]
    with pytest.raises(ValidationError, match="text on ground"):
        DesignBrief(**bad)
    bad = _good()
    bad["palette"]["accent"] = "#1a1612"           # a button that vanishes into the ground
    with pytest.raises(ValidationError, match="accent on ground"):
        DesignBrief(**bad)


def test_fonts_off_the_allowlist_are_refused():
    bad = _good()
    bad["type"]["display"] = "Comic Sans MS"
    with pytest.raises(ValidationError, match="allowlist"):
        DesignBrief(**bad)


def test_an_invented_price_anchor_is_refused():
    b = DesignBrief(**{**_good(), "primary_action": {"kind": "message", "href": "#message", "price_anchor": 79}})
    assert any("price anchor 79" in p for p in brief_problems(b, CHOLENT))


def test_a_tagline_not_word_for_word_is_refused():
    b = DesignBrief(**{**_good(), "taglines": [
        {"text": "The best cholent in Israel, trusted by thousands.", "lang": "en", "source": "description"}]})
    assert any("not word for word" in p for p in brief_problems(b, CHOLENT))


def test_the_action_never_leaves_the_site_or_shows_a_number():
    for href in ("tel:+972551234567", "mailto:a@b.c", "https://wa.me/972551234567", "javascript:alert(1)"):
        with pytest.raises(ValidationError):
            DesignBrief(**{**_good(), "primary_action": {"kind": "message", "href": href}})


def test_every_preset_palette_is_readable_with_any_accent():
    for preset in ("candlelight", "bold-pantry", "jerusalem-stone", "studio", "field", "workshop"):
        for accent in ("#c19554", "#f2c230", "#1e5f8c", "#d6336c", "#2e7d4f", "#111111", "#fefefe"):
            p = derive_palette(preset, accent)
            assert contrast(p["text"], p["ground"]) >= 4.5, (preset, accent)
            assert contrast(p["muted"], p["ground"]) >= 4.5, (preset, accent)
            assert contrast(p["accent"], p["ground"]) >= 3.0, (preset, accent)
            assert contrast(p["on_accent"], p["accent"]) >= 4.5, (preset, accent)


def test_v3_needs_the_site_switch_and_the_business_switch(monkeypatch):
    passed = {"passed": True, "brief_at": "t1", "failures": []}
    biz = {"page_v3": True, "design_brief": _good(), "design_brief_at": "t1", "page_check": passed}
    monkeypatch.delenv("PAGE_BUILDER_V3_ENABLED", raising=False)
    assert not page_v3_on(biz), "off by default"
    assert not page_v3_on(biz, admin=True), "off by default, even for an admin"
    monkeypatch.setenv("PAGE_BUILDER_V3_ENABLED", "1")
    assert page_v3_on(biz)
    assert not page_v3_on({**biz, "page_v3": False}), "one business at a time"
    assert not page_v3_on({"page_v3": True}), "no brief, no v3"


def test_visitors_see_v3_only_after_the_quality_gate_passed_this_brief(monkeypatch):
    monkeypatch.setenv("PAGE_BUILDER_V3_ENABLED", "1")
    biz = {"page_v3": True, "design_brief": _good(), "design_brief_at": "t2"}
    assert not page_v3_on(biz), "never checked"
    assert page_v3_on(biz, admin=True), "an admin sees it, so the gate can render it"
    for check, why in (({"passed": False, "brief_at": "t2"}, "failed"),
                       ({"passed": True, "brief_at": "t1"}, "passed an older brief"),
                       ({"passed": "yes", "brief_at": "t2"}, "not a real pass")):
        assert not page_v3_on({**biz, "page_check": check}), why
    assert page_v3_on({**biz, "page_check": {"passed": True, "brief_at": "t2"}})
    assert os.environ.get("PAGE_BUILDER_V3_ENABLED") == "1"


FILM = {"url": "https://res.cloudinary.com/x/video/upload/f.mp4", "poster_url": "p.jpg", "made_with": "3d"}


def test_the_brand_film_is_the_hero_only_without_a_real_photo():
    """Rule 4: photo, then film, then the typographic panel."""
    with_film = {**CHOLENT, "brand_film": FILM}
    assert build_brief(with_film).hero.tier == 2 and build_brief(with_film).hero.media_id == "film"
    assert build_brief(CHOLENT).hero.tier == 3
    b = build_brief({**with_film, "cover_url": "c.jpg"}, photos=[{"ref": "cover", "kind": "photo"}])
    assert b.hero.tier == 1 and b.hero.media_id == "cover"


def test_a_film_hero_without_a_film_or_a_film_id_elsewhere_is_refused():
    film_hero = {"tier": 2, "media_id": "film", "subject_side": "right"}
    # A hand-built film brief carries no effects: those were picked for a
    # photo or panel hero, and a looping film rules several out.
    bare = {**_good(), "hero": film_hero, "effects": [], "showstopper": "hero"}
    assert any("brand film" in p for p in brief_problems(DesignBrief(**bare), CHOLENT))
    for hero in ({"tier": 2, "subject_side": "right"}, {"tier": 3, "media_id": "film"},
                 {"tier": 2, "media_id": "https://evil.example/x.mp4"}):
        with pytest.raises(ValidationError):
            DesignBrief(**{**_good(), "hero": hero})


def test_a_film_off_spec_is_refused_with_the_reason():
    good = {"codec": "h264", "duration": 8.0, "width": 1920, "height": 1080, "bytes": 3_500_000}
    assert film_problems(good) == []
    assert film_problems({**good, "width": 3840, "height": 2160}) == []
    for change, words in (({"codec": "hevc"}, "H.264"), ({"duration": 14.2}, "6 to 10"),
                          ({"width": 1080, "height": 1920}, "16:9"), ({"bytes": 6_000_000}, "4MB")):
        assert any(words in p for p in film_problems({**good, **change})), change


# ------------------------------------------------------------------ effects (6 Oct 2026)

def test_a_brief_written_before_effects_still_loads():
    """Every stored brief predates effects: no `effects`, showstopper "hero"."""
    old = build_brief(CHOLENT).model_dump()
    old.pop("effects")
    old["showstopper"] = "hero"
    assert DesignBrief(**old).effects == []


def test_a_built_brief_carries_one_valid_bold_moment():
    b = build_brief(CHOLENT)
    peaks = [e for e in b.effects if e in {"pin-hero-hold", "pin-hero-pushin", "scrub-film", "rail-gallery",
                                           "rail-occasions", "rail-steps", "stack-steps", "pin-offer-count"}]
    assert len(peaks) <= 1
    assert b.showstopper == (peaks[0] if peaks else "hero")
    assert brief_problems(b, CHOLENT) == []


def test_a_brief_naming_an_unknown_effect_is_refused():
    d = build_brief(CHOLENT).model_dump()
    d["effects"] = ["sparkle-storm"]
    with pytest.raises(ValidationError, match="unknown effect"):
        DesignBrief(**d)


def test_the_same_business_gets_the_same_page_and_a_new_generation_a_new_one():
    from utils.design_brief import effects_seed
    assert build_brief(CHOLENT).effects == build_brief(CHOLENT).effects
    assert effects_seed(CHOLENT, 0) != effects_seed(CHOLENT, 1)


def test_recent_pages_steer_the_bold_moment():
    first = build_brief(CHOLENT)
    if first.showstopper == "hero":
        pytest.skip("this record affords no peak to steer")
    again = build_brief(CHOLENT, recent=[{"effects": first.effects, "showstopper": first.showstopper}])
    assert again.showstopper != first.showstopper


def test_adding_a_film_repicks_the_effects_instead_of_breaking_the_brief():
    """Found while building effects: re-picking only the hero kept effects a
    looping film rules out, so the brief failed to validate on film upload."""
    from utils.design_brief import pick_hero, with_hero
    stored = build_brief(CHOLENT).model_dump()
    filmed = {**CHOLENT, "brand_film": {"url": "https://res.cloudinary.com/x/film.mp4"}}
    b = with_hero(stored, filmed, pick_hero(None, True, stored["preset"]))
    assert b.hero.tier == 2
    assert b.showstopper in ("hero", "scrub-film")
    assert "load-sequence-hero" not in b.effects
    assert brief_problems(b, filmed) == []

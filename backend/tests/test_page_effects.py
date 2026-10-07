"""Page builder v3: the effects catalog (utils/page_effects.py).

One bold moment per page, effects only with their material, caps that keep a
page from becoming a showreel, and a "not too similar" rule against recent
pages (Tzvi, 6 Oct 2026). Pure: no server, no network, no AI.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.page_effects import (  # noqa: E402
    AXES, EFFECTS, MIN_AXES, PEAK_WINDOW, PRESET_WEIGHTS, SLOTS, available, check_effect_unique,
    effect_fingerprint, effects_problems, material, pick_effects,
)

PRESETS = ("candlelight", "bold-pantry", "jerusalem-stone", "studio", "field", "workshop")


def brief(photos=0, flyers=0, tier=3, occasions=0, steps=0, tagline=False, price=None, langs=("en", "he")):
    """A brief-shaped dict with exactly the material asked for, in each language."""
    pics = [{"ref": f"cover{i}", "kind": "photo"} for i in range(photos)]
    pics += [{"ref": f"flyer{i}", "kind": "flyer"} for i in range(flyers)]
    return {
        "hero": {"tier": tier, "media_id": "film" if tier == 2 else ("cover0" if tier == 1 else None)},
        "photos": pics,
        "occasions": [{"text": f"o{i}", "lang": lang} for lang in langs for i in range(occasions)],
        "steps": [{"text": f"s{i}", "lang": lang} for lang in langs for i in range(steps)],
        "taglines": [{"text": "Made by hand", "lang": "en"}] if tagline else [],
        "primary_action": {"kind": "message", "price_anchor": price},
    }


RICH = material(brief(photos=8, tier=1, occasions=6, steps=4, tagline=True, price=100),
                {"logo_url": "x.png", "name": "Lechem"})
BARE = material(brief(), {"name": "A long business name here"})


# ------------------------------------------------------------------ vocabulary

def test_the_vocabulary_is_closed_and_well_formed():
    for eid, rec in EFFECTS.items():
        assert eid == eid.lower() and " " not in eid, eid
        assert rec["cat"] in ("motion", "entrance", "touch", "still"), eid
        assert rec["tier"] in ("peak", "accent", "quiet"), eid
        assert rec["slot"] in SLOTS, eid
        assert rec["axis"] in AXES, eid
        assert rec["phone"] in ("on", "off") and rec["rtl"] in ("none", "mirror"), eid
    for preset, weights in PRESET_WEIGHTS.items():
        assert preset in PRESETS
        assert set(weights) <= set(EFFECTS), set(weights) - set(EFFECTS)


def test_every_peak_is_motion_and_parallax_is_off_on_phones():
    # "No parallax on phones" (5 Oct): every parallax effect declares it.
    for eid, rec in EFFECTS.items():
        if rec["tier"] == "peak":
            assert rec["cat"] == "motion", eid
        if "parallax" in eid:
            assert rec["phone"] == "off", eid


def test_an_unknown_effect_is_refused():
    assert effects_problems(["sparkle-storm"], "hero", RICH) == ["unknown effect 'sparkle-storm'"]


# ------------------------------------------------------------------ material

def test_a_flyer_is_never_a_photo():
    m = material(brief(photos=1, flyers=9))
    assert m["photos"] == 1
    assert "rail-gallery" not in available(m)


def test_effects_appear_only_with_their_material():
    assert "scrub-film" not in available(RICH)          # no film
    assert "scrub-film" in available(material(brief(tier=2)))
    assert "rail-gallery" not in available(material(brief(photos=4, tier=1)))
    assert "rail-gallery" in available(material(brief(photos=5, tier=1)))
    assert "count-price" not in available(BARE)          # no price, no counter
    assert "rail-steps" not in available(material(brief(steps=2)))
    assert "stagger-steps" in available(material(brief(steps=2)))


def test_a_bold_moment_needs_its_list_in_both_languages():
    """Their occasions in English only: the Hebrew page draws no list, so a
    rail of them would leave it with no bold moment. A quiet touch may stay."""
    english = material(brief(occasions=6, steps=4, langs=("en",)))
    assert not {"rail-occasions", "rail-steps", "stack-steps"} & set(available(english))
    assert {"stagger-biglist", "stagger-steps"} <= set(available(english))
    both = material(brief(occasions=6, steps=4))
    assert {"rail-occasions", "rail-steps", "stack-steps"} <= set(available(both))


def test_letters_animate_only_on_a_short_name():
    short = material(brief(), {"name": "Lechem"})
    long_ = material(brief(), {"name": "L.A. Cholent by Rabbi Samuels"})
    assert "kinetic-chars-wordmark" in available(short)
    assert "kinetic-chars-wordmark" not in available(long_)


def test_a_film_is_the_loop_or_the_scrub_never_both():
    m = material(brief(tier=2, steps=4, price=50))
    peaks = [e for e in available(m) if EFFECTS[e]["tier"] == "peak"]
    assert peaks == ["scrub-film"]
    assert "load-sequence-hero" not in available(m)
    assert effects_problems(["stack-steps"], "stack-steps", m)


# ------------------------------------------------------------------ caps

@pytest.mark.parametrize("effects,show,why", [
    (["pin-hero-hold", "rail-gallery"], "pin-hero-hold", "peaks"),
    (["rail-gallery"], "hero", "showstopper"),
    (["load-sequence-hero", "kinetic-words-headline", "btn-fill-wipe", "ground-split-hero"], "hero", "accents"),
    (["drift-ground", "progress-hairline", "btn-press", "rules-double", "label-small-caps"], "hero", "quiet"),
    (["kinetic-words-headline", "kinetic-words-tagline"], "hero", "kinetic"),
    (["btn-fill-wipe", "btn-invert"], "hero", "button-style"),
    (["card-tilt-offer", "spotlight-offer"], "hero", "offer-pointer"),
    (["pin-hero-hold", "parallax-hero"], "pin-hero-hold", "hero-motion"),
    (["corners-sharp", "corners-soft"], "hero", "corners"),
])
def test_every_cap_is_enforced(effects, show, why):
    problems = effects_problems(effects, show, RICH, with_record=True)
    assert problems, effects
    assert any(why in p for p in problems), problems


def test_a_section_the_page_does_not_draw_cannot_carry_an_effect():
    problems = effects_problems(["rail-occasions"], "rail-occasions", material(brief(occasions=2)))
    assert any("does not draw" in p or "needs" in p for p in problems)


# ------------------------------------------------------------------ picking

@pytest.mark.parametrize("preset", PRESETS)
@pytest.mark.parametrize("profile", ["rich", "bare", "film", "steps-only"])
def test_every_pick_is_valid_with_exactly_one_peak(preset, profile):
    m = {"rich": RICH, "bare": BARE, "film": material(brief(tier=2, price=80), {"name": "Ok"}),
         "steps-only": material(brief(steps=3), {"name": "Ok"})}[profile]
    for seed in range(20):
        effects, show = pick_effects(m, preset, seed=seed)
        assert effects_problems(effects, show, m, with_record=True) == [], (preset, profile, seed, effects)
        peaks = [e for e in effects if EFFECTS[e]["tier"] == "peak"]
        assert len(peaks) <= 1
        assert show == (peaks[0] if peaks else "hero")


def test_workshop_never_travels_sideways():
    for seed in range(60):
        effects, _ = pick_effects(RICH, "workshop", seed=seed)
        assert not any(e.startswith("rail-") or "parallax" in e for e in effects), effects


def test_the_same_seed_gives_the_same_page():
    assert pick_effects(RICH, "studio", seed=7) == pick_effects(RICH, "studio", seed=7)


def test_fifty_businesses_get_at_least_six_different_bold_moments():
    """Variety, not uniqueness: the claim being bought."""
    peaks = set()
    for n in range(50):
        preset = PRESETS[n % len(PRESETS)]
        m = material(brief(photos=n % 9, tier=1 if n % 9 else 3, occasions=n % 7, steps=n % 5,
                           tagline=bool(n % 2), price=100 if n % 3 else None), {"name": "Cafe"})
        peaks.add(pick_effects(m, preset, seed=n)[1])
    assert len(peaks - {"hero"}) >= 6, peaks


# ------------------------------------------------------------------ not too similar

def test_a_peak_is_not_reused_among_the_most_recent_pages():
    recent = [{"effects": ["pin-hero-hold"], "showstopper": "pin-hero-hold"}]
    for seed in range(40):
        assert pick_effects(RICH, "jerusalem-stone", recent=recent, seed=seed)[1] != "pin-hero-hold"


def test_an_older_page_may_share_the_peak():
    old = [{"effects": [], "showstopper": "other"}] * PEAK_WINDOW + \
          [{"effects": ["pin-hero-hold"], "showstopper": "pin-hero-hold"}]
    peaks = {pick_effects(RICH, "jerusalem-stone", recent=old, seed=s)[1] for s in range(40)}
    assert "pin-hero-hold" in peaks


@pytest.mark.parametrize("preset", PRESETS)
def test_three_versions_carry_three_different_bold_moments(preset):
    """Across many generations, not one lucky triple: without avoidance the
    weighted pick lands on the same peak twice well within 30 tries."""
    for base in range(30):
        shown, peaks = set(), []
        for n in range(3):
            _, show = pick_effects(RICH, preset, seed=base * 3 + n, avoid_peaks=shown)
            shown.add(show)
            peaks.append(show)
        assert len(set(peaks)) == 3, (preset, base, peaks)


def test_close_on_six_axes_fails_close_on_five_passes():
    base = effect_fingerprint(["pin-hero-hold", "kinetic-words-headline", "btn-invert"], "pin-hero-hold")
    one_axis = dict(base, type=frozenset({"load-sequence-hero"}))             # differs on 1 axis
    two_axes = dict(one_axis, pointer=frozenset({"btn-press"}))                # differs on 2 axes
    assert MIN_AXES == 2
    assert not check_effect_unique(one_axis, [base])["passed"]
    assert check_effect_unique(two_axes, [base])["passed"]


def test_a_pick_differs_from_recent_pages_on_enough_axes():
    recent = []
    for seed in range(8):
        effects, show = pick_effects(RICH, "studio", recent=recent, seed=seed)
        fp = effect_fingerprint(effects, show)
        recent_fps = [effect_fingerprint(r["effects"], r["showstopper"]) for r in recent]
        assert check_effect_unique(fp, recent_fps)["passed"], (seed, effects)
        recent.insert(0, {"effects": effects, "showstopper": show})


# ------------------------------------------------------------------ the mirror

def test_the_frontend_mirror_agrees_with_the_catalog():
    """The page renders these ids (frontend/.../v3/effects.js); a mirror that
    silently disagrees would drop an effect, or stamp one the API refuses."""
    import re
    js = (Path(__file__).resolve().parents[2] / "frontend" / "src" / "components" / "pagebuilder" / "v3"
          / "effects.js").read_text(encoding="utf-8")
    mirror = {m[0]: (m[1], m[2] == "true")
              for m in re.findall(r"'([a-z0-9-]+)': \['([a-z]+)', (true|false)\]", js)}
    assert set(mirror) == set(EFFECTS), set(mirror) ^ set(EFFECTS)
    for eid, (slot, engine) in mirror.items():
        assert (slot, engine) == (EFFECTS[eid]["slot"], EFFECTS[eid]["engine"]), eid

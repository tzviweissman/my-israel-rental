"""Page builder v3: the effects a generated page may carry (Tzvi, 6 Oct 2026).

Every effect is data here; the frontend mirror is
frontend/src/components/pagebuilder/v3/effects.js, and a test keeps the two
sets of ids identical. A page gets one bold moment (its peak, named by the
brief's `showstopper`), up to three accents and up to four quiet touches,
never more than eight. Rules only, no model call, like the brief itself.

The standard is "not too similar", not "unlike every other page" (Tzvi,
6 Oct): pages may share a framing or a button style. Three named numbers
below set how strict that is; each is a one-line change.

    material(brief, record=None)              -> what the page has to work with
    pick_effects(material, preset, recent, seed) -> (effects, showstopper)
    effects_problems(effects, showstopper, material) -> [] or the broken caps
    effect_fingerprint(effects, showstopper)  -> {axis: frozenset(ids)}
    check_effect_unique(fp, recent_fps)       -> {"passed", "too_close"}
"""
from __future__ import annotations

import random
from typing import Optional

# How strict "not too similar" is. A peak is not reused among the most recent
# PEAK_WINDOW live pages of a category; a page must differ from each of the
# most recent COMPARE_WINDOW on at least MIN_AXES of the seven axes.
PEAK_WINDOW = 5
COMPARE_WINDOW = 10
MIN_AXES = 2

MAX_ACCENTS = 3
MAX_QUIET = 4
MAX_EFFECTS = 8

# The seven axes a page can differ on, after scrollcraft/FINGERPRINTS.md.
AXES = ("travel", "hero", "type", "pointer", "surface", "framing", "close")

# Where an effect lives on the page. A slot that a page does not draw (no
# occasions, no steps, one photo) cannot carry an effect.
SLOTS = ("hero", "biglist", "steps", "palate", "rail", "offer", "button", "page")


def _fx(cat: str, tier: str, slot: str, axis: str, *, needs: Optional[dict] = None,
        group: Optional[str] = None, engine: bool = False, phone: str = "on",
        rtl: str = "none") -> dict:
    """One record. `cat` is motion / entrance / touch / still; `tier` is
    peak / accent / quiet. `group` names a family of which a page carries at
    most one. `engine` means it needs the scroll engine (scrollcraft).
    `phone` "off" means it is inert on a touch screen or a narrow one, and
    `rtl` "mirror" means it runs the other way on a Hebrew page."""
    return {"cat": cat, "tier": tier, "slot": slot, "axis": axis, "needs": needs or {},
            "group": group, "engine": engine, "phone": phone, "rtl": rtl}


EFFECTS: dict[str, dict] = {
    # ---- motion: the page moves as you scroll. Every peak is here.
    "pin-hero-hold":     _fx("motion", "peak", "hero", "hero", group="hero-motion", engine=True),
    "pin-hero-pushin":   _fx("motion", "peak", "hero", "hero", needs={"hero_photo": True},
                             group="hero-motion", engine=True),
    "scrub-film":        _fx("motion", "peak", "hero", "hero", needs={"film": True},
                             group="hero-motion", engine=True),
    "rail-gallery":      _fx("motion", "peak", "rail", "travel", needs={"photos": 5},
                             engine=True, rtl="mirror"),
    "rail-occasions":    _fx("motion", "peak", "biglist", "travel", needs={"occasions_both": 5},
                             group="biglist-motion", engine=True, rtl="mirror"),
    "rail-steps":        _fx("motion", "peak", "steps", "travel", needs={"steps_both": 3},
                             group="steps-motion", engine=True, rtl="mirror"),
    "stack-steps":       _fx("motion", "peak", "steps", "travel", needs={"steps_both": 3},
                             group="steps-motion", engine=True),
    "pin-offer-count":   _fx("motion", "peak", "offer", "close", needs={"price": True},
                             group="offer-count", engine=True),
    "parallax-hero":     _fx("motion", "accent", "hero", "hero", needs={"hero_photo": True},
                             group="hero-motion", engine=True, phone="off"),
    "parallax-palate":   _fx("motion", "accent", "palate", "framing", needs={"photos": 2},
                             engine=True, phone="off"),
    "drift-ground":      _fx("motion", "quiet", "page", "surface", engine=True),
    "progress-hairline": _fx("motion", "quiet", "page", "surface", engine=True, rtl="mirror"),

    # ---- entrances: how things arrive.
    # One hero entrance per page: these all animate the same block.
    "load-sequence-hero":     _fx("entrance", "accent", "hero", "type", group="hero-entrance"),
    "kinetic-words-headline": _fx("entrance", "accent", "hero", "type", group="hero-entrance"),
    "kinetic-words-tagline":  _fx("entrance", "accent", "hero", "type", needs={"tagline": True},
                                  group="hero-entrance"),
    # taste.md says splitting into letters is "almost never"; a short name
    # is the one place it reads as a wordmark rather than a gimmick.
    "kinetic-chars-wordmark": _fx("entrance", "accent", "hero", "type", needs={"name_max": 12},
                                  group="hero-entrance"),
    "wipe-up-sections":       _fx("entrance", "quiet", "page", "surface", group="section-entrance"),
    "fade-rise-sections":     _fx("entrance", "quiet", "page", "surface", group="section-entrance"),
    "wipe-side-photos":       _fx("entrance", "quiet", "palate", "framing", needs={"photos": 2},
                                  group="palate-entrance", rtl="mirror"),
    "iris-palate":            _fx("entrance", "accent", "palate", "framing", needs={"photos": 2},
                                  group="palate-entrance"),
    "stagger-biglist":        _fx("entrance", "quiet", "biglist", "type", needs={"occasions": 3},
                                  group="biglist-motion"),
    "stagger-steps":          _fx("entrance", "quiet", "steps", "type", needs={"steps": 2},
                                  group="steps-motion"),
    # A counter is a claim: the price anchor is already proven to be one of
    # their own prices (design_brief.brief_problems), so it may count up.
    "count-price":            _fx("entrance", "accent", "offer", "close", needs={"price": True},
                                  group="offer-count"),
    "hairline-draw":          _fx("entrance", "quiet", "page", "surface", rtl="mirror"),
    "logo-settle":            _fx("entrance", "quiet", "hero", "hero", needs={"logo": True},
                                  group="hero-entrance"),

    # ---- touches: what answers the hand.
    "btn-fill-wipe":       _fx("touch", "accent", "button", "pointer", group="button-style", rtl="mirror"),
    "btn-arrow-nudge":     _fx("touch", "quiet", "button", "pointer", group="button-style", rtl="mirror"),
    "btn-invert":          _fx("touch", "quiet", "button", "pointer", group="button-style"),
    "btn-press":           _fx("touch", "quiet", "button", "pointer"),
    # Magnet on the primary action only, and only with a mouse: the engine
    # gates it to (hover: hover) and (pointer: fine).
    "btn-magnet":          _fx("touch", "accent", "button", "pointer", engine=True, phone="off"),
    "link-underline-grow": _fx("touch", "quiet", "page", "pointer", rtl="mirror"),
    "card-tilt-offer":     _fx("touch", "accent", "offer", "pointer", needs={"price": True},
                               group="offer-pointer", engine=True, phone="off"),
    "spotlight-offer":     _fx("touch", "accent", "offer", "pointer", needs={"price": True},
                               group="offer-pointer", engine=True, phone="off"),
    "photo-hover-zoom":    _fx("touch", "quiet", "palate", "pointer", needs={"photos": 2}, phone="off"),
    "rule-brighten":       _fx("touch", "quiet", "offer", "pointer", needs={"price": True}, phone="off"),

    # ---- still treatments: no motion at all, so no motion risk.
    "scrim-lead":         _fx("still", "quiet", "hero", "hero", needs={"hero_media": True},
                              group="scrim", rtl="mirror"),
    "scrim-band":         _fx("still", "quiet", "hero", "hero", needs={"hero_media": True}, group="scrim"),
    "scrim-vignette":     _fx("still", "quiet", "hero", "hero", needs={"hero_media": True}, group="scrim"),
    # The split ground and the centred stack only read on the typographic
    # hero: a photo hides the ground, and centred copy sits on its brightest part.
    "ground-split-hero":  _fx("still", "accent", "hero", "hero", needs={"hero_media": False},
                              group="hero-frame", rtl="mirror"),
    "hero-split":         _fx("still", "accent", "hero", "framing", needs={"hero_photo": True},
                              group="hero-frame", rtl="mirror"),
    "hero-split-narrow":  _fx("still", "accent", "hero", "framing", needs={"hero_photo": True},
                              group="hero-frame", rtl="mirror"),
    "hero-center-stack":  _fx("still", "accent", "hero", "framing", needs={"hero_media": False},
                              group="hero-frame"),
    "subject-bleed":      _fx("still", "accent", "hero", "framing", needs={"hero_photo": True},
                              group="hero-frame", rtl="mirror"),
    "tagline-pullquote":  _fx("still", "accent", "hero", "type", needs={"tagline": True}),
    "oversize-numerals":  _fx("still", "accent", "page", "type", needs={"steps_or_price": True}),
    "label-small-caps":   _fx("still", "quiet", "page", "type"),
    "duotone-photos":     _fx("still", "accent", "page", "surface", needs={"photos": 1}, group="grade"),
    "contrast-photos":    _fx("still", "quiet", "page", "surface", needs={"photos": 1}, group="grade"),
    "rules-double":       _fx("still", "quiet", "page", "surface"),
    "palate-offset":      _fx("still", "accent", "palate", "framing", needs={"photos": 2},
                              group="palate-frame", rtl="mirror"),
    "palate-mat":         _fx("still", "quiet", "palate", "framing", needs={"photos": 2}, group="palate-frame"),
    "corners-sharp":      _fx("still", "quiet", "page", "framing", group="corners"),
    "corners-soft":       _fx("still", "quiet", "page", "framing", group="corners"),
}

# Each preset leans toward some effects (3) and away from others (0 = never).
# Everything unlisted weighs 1. Workshop never travels sideways: a trade's
# page is read for a phone number and a price, not explored.
PRESET_WEIGHTS: dict[str, dict[str, int]] = {
    "candlelight": {"pin-hero-pushin": 3, "scrub-film": 3, "kinetic-words-tagline": 3, "scrim-vignette": 3,
                    "palate-mat": 3, "load-sequence-hero": 3, "iris-palate": 3},
    "bold-pantry": {"rail-gallery": 3, "rail-occasions": 3, "btn-fill-wipe": 3, "corners-soft": 3,
                    "stagger-biglist": 3, "hero-split": 3},
    "jerusalem-stone": {"pin-hero-hold": 3, "pin-hero-pushin": 3, "palate-mat": 3, "hero-center-stack": 3,
                        "rules-double": 3, "label-small-caps": 3, "fade-rise-sections": 3,
                        "btn-magnet": 0, "kinetic-chars-wordmark": 0},
    "studio": {"kinetic-chars-wordmark": 3, "btn-invert": 3, "hero-split-narrow": 3, "spotlight-offer": 3,
               "corners-sharp": 3, "wipe-up-sections": 3},
    "field": {"rail-gallery": 3, "rail-steps": 3, "parallax-hero": 3, "parallax-palate": 3,
              "subject-bleed": 3, "progress-hairline": 3},
    "workshop": {"stack-steps": 3, "pin-offer-count": 3, "oversize-numerals": 3, "hairline-draw": 3,
                 "rules-double": 3, "btn-arrow-nudge": 3, "corners-sharp": 3,
                 "rail-gallery": 0, "rail-occasions": 0, "rail-steps": 0,
                 "parallax-hero": 0, "parallax-palate": 0},
}

# Material keys a brief alone can answer, versus ones that need the record.
RECORD_NEEDS = {"logo", "name_max"}


# ------------------------------------------------------------------ material

def _get(x, k, default=None):
    return x.get(k, default) if isinstance(x, dict) else getattr(x, k, default)


def material(brief, record: Optional[dict] = None) -> dict:
    """What the page has to work with. Only pictures the flyer check passed as
    photos count: a flyer is never a photo of the business (rule 4)."""
    hero = _get(brief, "hero") or {}
    tier = _get(hero, "tier")
    photos = sum(1 for p in (_get(brief, "photos") or []) if _get(p, "kind") == "photo")

    # Lists the owner wrote are drawn only in their own language, and every
    # page is shown in English and Hebrew. A touch counts the fuller language
    # (missing from the other page, it is simply not there); a bold moment
    # counts the thinner one, or a Hebrew visitor gets a page with none.
    def per_lang(items, worst=False):
        counts = {"en": 0, "he": 0}
        for t in items or []:
            counts[_get(t, "lang")] = counts.get(_get(t, "lang"), 0) + 1
        return (min if worst else max)(counts.values())

    action = _get(brief, "primary_action") or {}
    price = _get(action, "price_anchor") is not None
    steps = per_lang(_get(brief, "steps"))
    m = {
        "photos": photos,
        "hero_photo": tier == 1,
        "film": tier == 2,
        "hero_media": tier in (1, 2),
        "occasions": per_lang(_get(brief, "occasions")),
        "occasions_both": per_lang(_get(brief, "occasions"), worst=True),
        "steps": steps,
        "steps_both": per_lang(_get(brief, "steps"), worst=True),
        "tagline": bool(_get(brief, "taglines")),
        "price": price,
        "steps_or_price": price or steps >= 2,
    }
    if record is not None:
        m["logo"] = bool(record.get("logo_url"))
        m["name_max"] = len((record.get("name") or "").strip())
    return m


def _meets(needs: dict, m: dict, with_record: bool) -> bool:
    for key, want in needs.items():
        if key in RECORD_NEEDS and not with_record:
            continue
        have = m.get(key)
        if key == "name_max":
            if not have or have > want:
                return False
        elif isinstance(want, bool):
            if bool(have) != want:
                return False
        elif (have or 0) < want:
            return False
    return True


def _slot_ok(slot: str, m: dict) -> bool:
    return {"biglist": m["occasions"] >= 3, "steps": m["steps"] >= 2, "palate": m["photos"] >= 2,
            "rail": m["photos"] >= 5, "offer": m["price"]}.get(slot, True)


def _film_ok(eid: str, m: dict) -> bool:
    """A brand film is the looping hero or the scrubbed film, never both, and
    a looping film never shares the hero with a load sequence (rules, part 6)."""
    if not m["film"]:
        return True
    rec = EFFECTS[eid]
    if rec["tier"] == "peak" and rec["cat"] == "motion":
        return eid == "scrub-film"
    return eid != "load-sequence-hero"


def available(m: dict, with_record: bool = True) -> list[str]:
    return [eid for eid, rec in EFFECTS.items()
            if _meets(rec["needs"], m, with_record) and _slot_ok(rec["slot"], m) and _film_ok(eid, m)]


# ------------------------------------------------------------------ the caps

def effects_problems(effects: list[str], showstopper: str, m: dict, with_record: bool = False) -> list[str]:
    """Why a set of effects breaks the rules. Empty means usable. Rejected,
    never repaired, like every other check in the builder."""
    out = []
    unknown = [e for e in effects if e not in EFFECTS]
    if unknown:
        return [f"unknown effect {u!r}" for u in unknown]
    if len(set(effects)) != len(effects):
        out.append("an effect is listed twice")
    tiers = [EFFECTS[e]["tier"] for e in effects]
    peaks = [e for e in effects if EFFECTS[e]["tier"] == "peak"]
    if len(peaks) > 1:
        out.append(f"{len(peaks)} peaks; a page has one bold moment")
    want = peaks[0] if peaks else "hero"
    if showstopper != want:
        out.append(f"the showstopper is {showstopper!r} but the peak is {want!r}")
    if tiers.count("accent") > MAX_ACCENTS:
        out.append(f"{tiers.count('accent')} accents; at most {MAX_ACCENTS}")
    if tiers.count("quiet") > MAX_QUIET:
        out.append(f"{tiers.count('quiet')} quiet touches; at most {MAX_QUIET}")
    if len(effects) > MAX_EFFECTS:
        out.append(f"{len(effects)} effects; at most {MAX_EFFECTS}")
    groups: dict[str, str] = {}
    for e in effects:
        g = EFFECTS[e]["group"]
        if g and g in groups:
            out.append(f"{groups[g]} and {e} are both {g}; a page carries one")
        elif g:
            groups[g] = e
    for e in effects:
        rec = EFFECTS[e]
        if not _meets(rec["needs"], m, with_record):
            out.append(f"{e} needs {rec['needs']} and the page lacks it")
        if not _slot_ok(rec["slot"], m):
            out.append(f"{e} sits in the {rec['slot']} section, which this page does not draw")
        if not _film_ok(e, m):
            out.append(f"{e} cannot share the page with a looping brand film")
    return out


# ------------------------------------------------------------------ uniqueness

def effect_fingerprint(effects: list[str], showstopper: str = "hero") -> dict:
    """The page's effects by axis. Two pages are close on an axis when they
    carry exactly the same effects there."""
    fp = {a: set() for a in AXES}
    for e in effects:
        if e in EFFECTS:
            fp[EFFECTS[e]["axis"]].add(e)
    return {a: frozenset(v) for a, v in fp.items()}


def check_effect_unique(fp: dict, recent: list[dict]) -> dict:
    """Same shape as page_rules.check_unique: fails when this page differs
    from any recent page on fewer than MIN_AXES axes."""
    too_close = []
    for i, other in enumerate(recent[:COMPARE_WINDOW]):
        diff = sum(fp.get(a, frozenset()) != other.get(a, frozenset()) for a in AXES)
        if diff < MIN_AXES:
            too_close.append({"index": i, "differs_on": diff})
    return {"passed": not too_close, "too_close": too_close}


# ------------------------------------------------------------------ picking

def _weighted(rng: random.Random, ids: list[str], preset: str) -> Optional[str]:
    w = PRESET_WEIGHTS.get(preset, {})
    weighted = [(e, w.get(e, 1)) for e in ids if w.get(e, 1) > 0]
    if not weighted:
        return None
    return rng.choices([e for e, _ in weighted], weights=[x for _, x in weighted], k=1)[0]


def _draw(rng: random.Random, pool: list[str], preset: str, k: int, groups: set[str]) -> list[str]:
    picked: list[str] = []
    pool = list(pool)
    while pool and len(picked) < k:
        e = _weighted(rng, pool, preset)
        if e is None:
            break
        pool.remove(e)
        g = EFFECTS[e]["group"]
        if g and g in groups:
            continue
        picked.append(e)
        if g:
            groups.add(g)
    return picked


def pick_effects(m: dict, preset: str, recent: Optional[list[dict]] = None, seed: int = 0,
                 avoid_peaks: Optional[set[str]] = None) -> tuple[list[str], str]:
    """One page's effects, deterministic for a seed. `recent` is the most
    recent live pages of the same category, newest first, each as
    {"effects": [...], "showstopper": str}. A peak used by any of the newest
    PEAK_WINDOW is not reused (nor any in `avoid_peaks`, so three versions
    shown side by side carry three different bold moments); with nothing left
    the hero is the peak, as it is today.

    ponytail: up to 12 seeds tried for the axis rule, then the closest miss is
    kept rather than refusing the business a page; widen the catalog if that
    starts happening often."""
    recent = list(recent or [])
    used = {r.get("showstopper") for r in recent[:PEAK_WINDOW]} | set(avoid_peaks or ())
    recent_fps = [effect_fingerprint(r.get("effects") or [], r.get("showstopper") or "hero")
                  for r in recent[:COMPARE_WINDOW]]
    pool = available(m)
    best: Optional[tuple[int, list[str], str]] = None
    for attempt in range(12):
        rng = random.Random(seed * 101 + attempt)
        groups: set[str] = set()
        peaks = [e for e in pool if EFFECTS[e]["tier"] == "peak" and e not in used]
        peak = _weighted(rng, peaks, preset) if peaks else None
        chosen = [peak] if peak else []
        if peak and EFFECTS[peak]["group"]:
            groups.add(EFFECTS[peak]["group"])
        chosen += _draw(rng, [e for e in pool if EFFECTS[e]["tier"] == "accent"], preset, MAX_ACCENTS, groups)
        chosen += _draw(rng, [e for e in pool if EFFECTS[e]["tier"] == "quiet"], preset, MAX_QUIET, groups)
        show = peak or "hero"
        fp = effect_fingerprint(chosen, show)
        worst = min((sum(fp[a] != other[a] for a in AXES) for other in recent_fps), default=len(AXES))
        if worst >= MIN_AXES:
            return chosen, show
        if best is None or worst > best[0]:
            best = (worst, chosen, show)
    return best[1], best[2]

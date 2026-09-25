"""Page recipes: the layouts the future page generator chooses from. No AI.

From the category study of 24 Sep 2026 (docs/ai-page-builder-spec.md,
"Category study"): real sites were studied at design time in Inspo and
Mobbin, and what the good ones had IN COMMON was written down here using
only our own blocks and dials. Nothing from those sites is in this file,
and nothing here fetches anything (P5).

    fill(business, lang)             -> a composition, or None and why
    options(business, lang)          -> the three options of P7d

A recipe is DATA: a preferred block order and a starting theme per value
of the brief's `showing`. The functions below only select, order and fill
it from the business's own record:

  * `showing` picks the recipe (a food business with a certificate or a
    caterer gets `food` whatever it answered, because the certificate
    decides for its customers).
  * `action` guarantees the block the action happens in (book/order ->
    services, message -> contact, visit -> facts) and, for visit, puts the
    facts right after the lead.
  * `pricing` and `audience` move the dials, the same way briefToTheme()
    does on the client.
  * `strengths` that the data backs and the facts band shows (kosher,
    licensed, experience, english) pull the facts up to second place.

Hero text is filled ONLY from their own words: a listing title (what they
sell, in their words, so `congruency` holds), their area, and one sentence
of their own description or brief note. If a page can't be written in a
language from what they gave us, `fill` returns None and says what is
missing; it never writes around the gap. Every composition it returns is
meant to pass utils/page_rules.check_composition, and the tests prove it.
"""
from __future__ import annotations

import re
from copy import deepcopy
from typing import Any, Optional

from utils.locations_catalog import HEBREW_AREA_NAMES
from utils.page_clarity import FOOD_CATEGORIES, _has_photo, _listing_title, upgrade_view
from utils.page_composition import BLOCKS, DIALS
from utils.page_rules import (
    HERO_LEDE_MAX_WORDS, HERO_TITLE_MAX_WORDS, SIZES_MIN, _any_price, _category, _photo_count, _words, playbook_for,
)

# ---------------------------------------------------------------- the data
# `order` is the preferred order of content blocks after the hero; a block
# the business has no material for is left out (see _available). `blocks`
# gives each one's variant and props. The hero is always first.
RECIPES: dict[str, dict[str, Any]] = {
    # Profile pages of booking apps for cleaners, salons and handymen: the
    # facts (licence, years, hours, languages) stand in for photos, then a
    # compact list of jobs with price and duration. Dense, plain type.
    "services": {
        "order": ["facts", "services", "gallery", "contact"],
        "blocks": {"services": ("list", {"source": "all", "limit": 12})},
        "theme": {"type": "grotesque", "density": "balanced", "imagery": "thumbnail",
                  "price_prominence": "normal", "motion": "still"},
    },
    # Shops: one photo and one line, then the products straight away with
    # their prices; the facts after, where a buyer checks how to get it.
    # The size ladder when they measured three products, one peak only.
    "catalogue": {
        "order": ["services", "sizes", "facts", "gallery", "contact"],
        "blocks": {"services": ("grid", {"source": "all", "limit": 12})},
        "theme": {"type": "serif", "density": "balanced", "imagery": "grid",
                  "price_prominence": "normal", "motion": "subtle"},
    },
    # One offer: room around it, the one listing shown whole, their photos
    # if they have enough, then the facts (duration, languages, licence).
    "one-thing": {
        "order": ["services", "gallery", "facts", "contact"],
        "blocks": {"services": ("list", {"source": "all", "limit": 1})},
        "theme": {"type": "serif", "density": "airy", "imagery": "full-bleed",
                  "price_prominence": "normal", "motion": "still"},
    },
    # Somewhere you visit: hours and where come before the description on
    # every place page studied, then photos, then what they sell.
    "place": {
        "order": ["facts", "gallery", "services", "contact"],
        "blocks": {"services": ("grid", {"source": "all", "limit": 6})},
        "theme": {"type": "serif", "density": "balanced", "imagery": "full-bleed",
                  "price_prominence": "normal", "motion": "still"},
    },
    # Hosts: the place first, then who they are. There is no property
    # block, so this only works when their stays are business listings;
    # the gap is written up in the spec.
    "properties": {
        "order": ["gallery", "services", "facts", "contact"],
        "blocks": {"services": ("grid", {"source": "all", "limit": 6})},
        "theme": {"type": "serif", "density": "airy", "imagery": "full-bleed",
                  "price_prominence": "normal", "motion": "still"},
    },
    # Food with a certificate, or a caterer: the food leads (the playbook
    # says so), and the facts band with the hechsher comes second, inside
    # the first scroll. The proof line beside the button already says kosher.
    "food": {
        "order": ["gallery", "facts", "services", "contact"],
        "blocks": {"services": ("grid", {"source": "all", "limit": 12})},
        "theme": {"type": "serif", "density": "balanced", "imagery": "full-bleed",
                  "price_prominence": "normal", "motion": "subtle"},
    },
}

# The hero's shapes. Each is words from their data joined by grammar, never
# an adjective of ours. (en, he) with {what}, {what2}, {area}.
HERO_SHAPES: dict[str, tuple[str, str]] = {
    "what_where": ("{what} in {area}", "{what} ב{area}"),
    "what_comma_where": ("{what}, {area}", "{what}, {area}"),
    "two_things": ("{what} and", "{what} וגם"),   # accent: {what2}
    "what": ("{what}", "{what}"),
    # Three or more listings: one title would stand for all of them. Not
    # their description's first line, which the page header already
    # prints under their name (seen in the previews, 24 Sep 2026).
    "several": ("{what}, {what2} and more in {area}", "{what}, {what2} ועוד ב{area}"),
}

# Strengths the facts band shows when the data backs them.
FACTS_STRENGTHS = {"kosher", "licensed", "experience", "english"}
# Slugs whose Hebrew key differs from the slug (utils/locations_catalog).
_HE_AREA_KEY = {"bet shemesh": "beit shemesh", "rishon": "rishon lezion"}


# ---------------------------------------------------------------- choosing

def recipe_name(b: dict) -> str:
    showing = (b.get("page_brief") or {}).get("showing")
    cat = _category(b)
    certified = bool((b.get("kosher_certification") or {}).get("body"))
    if cat == "events-catering" or (certified and cat in FOOD_CATEGORIES):
        return "food"
    if showing in RECIPES:
        return showing
    stores = any((g or {}).get("gig_type") == "store" for g in b.get("listings") or [])
    return "catalogue" if stores else "services"


def _measured_store(b: dict) -> Optional[str]:
    for g in b.get("listings") or []:
        g = g or {}
        if g.get("gig_type") == "store" and sum(1 for p in g.get("products") or [] if (p or {}).get("width_cm")) >= SIZES_MIN:
            return g.get("id")
    return None


def _has_facts(b: dict) -> bool:
    return any(b.get(k) for k in ("hours", "languages", "founded_year", "license_number", "delivery_note",
                                  "payment_note")) or bool((b.get("kosher_certification") or {}).get("body"))


def _listing_refs(b: dict) -> list[str]:
    return [f"listing:{g['id']}" for g in b.get("listings") or [] if (g or {}).get("id") and _has_photo(g)]


def _hero_image(b: dict) -> Optional[str]:
    """A photo of what they sell, not the cover: the page header already
    draws the cover, and the previews showed it twice, stacked."""
    return next(iter(_listing_refs(b)), None) or ("cover" if b.get("cover_url") else None)


def _gallery_refs(b: dict) -> list[str]:
    """Every photo that draws, once: never the hero's again."""
    refs = [r for r in _listing_refs(b) if r != _hero_image(b)] + (["cover"] if b.get("cover_url") else [])
    return [r for r in refs if r != _hero_image(b)][:12]


def _available(block: str, b: dict) -> bool:
    if block == "gallery":
        # Three pictures that will actually draw: the gallery shows one per
        # reference, so three photos on one listing is still one picture.
        return _photo_count(b) >= 3 and len(_gallery_refs(b)) >= 3
    if block == "sizes":
        return _measured_store(b) is not None
    if block == "facts":
        return _has_facts(b) or (b.get("page_brief") or {}).get("action") == "visit"
    return True


def _block(kind: str, recipe: dict, b: dict) -> dict:
    variant, props = recipe["blocks"].get(kind, (BLOCKS[kind]["variants"][0], {}))
    props = deepcopy(props)
    if kind == "gallery":
        props = {"images": _gallery_refs(b)}
    if kind == "sizes":
        props = {"listing": _measured_store(b)}
    return {"id": {"services": "catalog"}.get(kind, kind), "type": kind, "variant": variant, "props": props}


def _order(b: dict, recipe: dict, lead_pref: Optional[list[str]] = None) -> list[str]:
    kinds = [k for k in recipe["order"] if _available(k, b)]
    brief = b.get("page_brief") or {}
    if brief.get("action") == "visit" and "facts" not in kinds:
        kinds.insert(0, "facts")
    lead = playbook_for(b)["lead"]
    # The playbook decides what may lead; the recipe decides the rest.
    for want in (lead_pref or []) + kinds:
        if want in kinds and want in lead:
            kinds.remove(want)
            kinds.insert(0, want)
            break
    # Facts second when the brief wants a visit, or a backed strength lives there.
    strengths = set(upgrade_view(b)["strengths"]) & FACTS_STRENGTHS
    if "facts" in kinds and kinds[0] != "facts" and (brief.get("action") == "visit" or strengths):
        kinds.remove("facts")
        kinds.insert(1, "facts")
    return kinds


def theme_for(b: dict, recipe: dict) -> dict:
    """The recipe's dials, moved by the brief as briefToTheme() moves them,
    then held to what the business can support (page_rules `images`, `prices`)."""
    t = {"palette": b.get("accent") if b.get("accent") in DIALS["palette"] else "stone", **recipe["theme"]}
    brief = b.get("page_brief") or {}
    pricing, audience, action = brief.get("pricing"), brief.get("audience"), brief.get("action")
    if pricing == "premium":
        t.update(density="airy", price_prominence="quiet", type="serif", imagery="full-bleed")
    if pricing == "value":
        t.update(density="packed", price_prominence="loud", type="grotesque")
    if pricing == "quote":
        t["price_prominence"] = "quiet"
    # `showing` moves a dial even when another recipe won (a caterer asked
    # "one main thing" saw nothing change, and every brief question must).
    showing = brief.get("showing")
    if showing == "one-thing":
        t["density"] = "airy"
    if showing == "catalogue" and t["density"] == "balanced":
        t["density"] = "packed"
    if showing == "place":
        t["imagery"] = "full-bleed"
    if audience == "businesses":
        t.update(type="geometric", imagery="grid")
    if audience == "tourists":
        t["imagery"] = "full-bleed"
    if action == "order" and pricing not in ("premium", "quote"):
        t["price_prominence"] = "loud"
    if action == "understand":
        t["price_prominence"] = "quiet"
    if t["imagery"] == "full-bleed" and not b.get("cover_url"):
        t["imagery"] = "grid"
    if t["price_prominence"] == "loud" and not _any_price(b):
        t["price_prominence"] = "normal"
    return t


# ---------------------------------------------------------------- their words

def _area(b: dict, lang: str) -> Optional[str]:
    """Where they work, named the way the page names it. Hebrew only from
    the hand-written table: a machine-translated place name is how one
    neighbourhood becomes two."""
    raw = next(iter(b.get("areas") or []), None) or next(
        ((g or {}).get("area") for g in b.get("listings") or [] if (g or {}).get("area")), None)
    if not raw:
        return None
    raw = str(raw).split(" - ")[0].strip()
    key = raw.lower().replace("-", " ")
    if lang == "he":
        return raw if re.search(r"[֐-׿]", raw) else HEBREW_AREA_NAMES.get(_HE_AREA_KEY.get(key, key))
    if re.search(r"[֐-׿]", raw):
        return None
    return " ".join(w[:1].upper() + w[1:] for w in raw.replace("-", " ").split()) if raw == raw.lower() else raw


def _things(b: dict, lang: str) -> list[str]:
    return [t.strip() for g in b.get("listings") or [] if g and (t := _listing_title(g, lang))]


def _lede(b: dict, lang: str, title: str = "") -> str:
    """One sentence of their own, in this language, short enough for a hero,
    and not the headline said twice."""
    heb = re.compile(r"[֐-׿]")
    said = set(re.findall(r"\w+", title.lower()))
    sources = ((b.get("description_he") if lang == "he" else None) or b.get("description") or "",
               (b.get("page_brief") or {}).get("note") or "")
    for text in sources:
        # "!" ends a sentence too; a live description written in them
        # read as one long sentence and left the lede empty.
        for s in re.split(r"(?<=[.?!])\s+", text.strip()):
            s = s.strip()
            if not s or ("!" in s) or "—" in s or "–" in s or not (3 <= len(s.split()) <= HERO_LEDE_MAX_WORDS):
                continue
            if bool(heb.search(s)) != (lang == "he") or len(s) > 200:
                continue
            if set(re.findall(r"\w+", s.lower())) <= said | {"in", "and", "ב", "ו"}:
                continue
            return s
    return ""


def hero(b: dict, lang: str, shape: str, image: Optional[str]) -> Optional[dict]:
    things, area = _things(b, lang), _area(b, lang)
    if not things:
        return None
    what, what2 = things[0], (things[1] if len(things) > 1 else None)
    if shape in ("what_where", "what_comma_where", "several") and not area:
        return None
    if shape == "two_things" and not what2 or shape == "several" and len(things) < 3:
        return None
    title = HERO_SHAPES[shape][lang == "he"].format(what=what, what2=what2 or "", area=area or "")
    accent = what2 if shape == "two_things" else ""
    if len(f"{title} {accent}".split()) > HERO_TITLE_MAX_WORDS or len(title) > 80 or len(accent) > 40:
        return None
    return {"id": "hero", "type": "hero", "variant": "band",
            "props": {"image": image, "title": title, "accent_word": accent,
                      "lede": _lede(b, lang, f"{title} {accent}")}}


# ---------------------------------------------------------------- filling

def fill(b: dict, lang: str = "en", shapes: tuple[str, ...] = ("several", "what_where", "what_comma_where", "what"),
         lead_pref: Optional[list[str]] = None, name: Optional[str] = None) -> dict:
    """{recipe, composition} or {recipe, composition: None, why}."""
    name = name or recipe_name(b)
    recipe = RECIPES[name]
    image = _hero_image(b)
    h = next((x for s in shapes if (x := hero(b, lang, s, image))), None)
    if not h:
        why = ("no listing is named in Hebrew" if lang == "he" else "no listing is named in English") \
            if not _things(b, lang) else "their listing names are too long for a headline"
        return {"recipe": name, "composition": None, "why": why}
    blocks = [h] + [_block(k, recipe, b) for k in _order(b, recipe, lead_pref)]
    return {"recipe": name, "composition": {"theme": theme_for(b, recipe), "blocks": blocks}}


def _next_type(t: str) -> str:
    return {"serif": "grotesque", "grotesque": "serif", "geometric": "serif"}[t]


def options(b: dict, lang: str = "en") -> list[Optional[dict]]:
    """The three options of rulebook §7: the brief straight, photo-led,
    words-led. Each is a composition or None (with the reason in fill())."""
    straight = fill(b, lang)["composition"]
    photo = fill(b, lang, shapes=("two_things", "what", "what_comma_where"), lead_pref=["gallery"])["composition"]
    words = fill(b, lang, shapes=("what_comma_where", "what", "two_things"), lead_pref=["facts", "services"])["composition"]
    if photo:
        if b.get("cover_url"):
            photo["theme"]["imagery"] = "full-bleed"
        if straight and [x["type"] for x in photo["blocks"]] == [x["type"] for x in straight["blocks"]]:
            # Not enough photos to lead with them: a different order instead
            # (§7, "otherwise a different lead"), keeping what leads.
            body = photo["blocks"][2:-1]
            photo["blocks"][2:-1] = body[::-1]
            if [x["type"] for x in photo["blocks"]] == [x["type"] for x in straight["blocks"]]:
                photo["theme"]["density"] = "airy" if photo["theme"]["density"] != "airy" else "balanced"
                photo["theme"]["motion"] = "subtle" if photo["theme"]["motion"] == "still" else "still"
    if words:
        th = words["theme"]
        th["type"] = _next_type(th["type"])
        premium = (b.get("page_brief") or {}).get("pricing") == "premium"
        th["density"] = "balanced" if premium or th["density"] == "packed" else "packed"
        th["imagery"] = "thumbnail" if th["imagery"] != "thumbnail" else "grid"
        for x in words["blocks"]:
            if x["type"] == "services":
                x["variant"] = "list"
    return [straight, photo, words]

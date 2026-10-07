"""Page builder v3, phase 1: the design brief, built by rules. No AI.

docs/page-builder-design-rules.md (v3) asks the builder to plan before it
builds: a brief naming the feeling, preset, palette, type, texture, hero
tier and primary action, validated before a page is drawn from it. Tzvi's
rulings for v3 (5 Oct 2026, recorded in docs/ai-page-builder-spec.md):
  * no AI calls yet: the brief is built here from the business's own data;
  * chat-only: the primary action opens the chat, never a phone or email;
  * the "List your business" band and "New on MyIsraelRental" stay.

    build_brief(business, logo_bytes=None)  -> DesignBrief (validated)
    brief_problems(brief, business)         -> [] or why it can't be used
    extract_accent(image_bytes)             -> "#rrggbb" or None

Field names are snake_case (the spec's TypeScript is camelCase) because
every other record in this codebase is.
"""
from __future__ import annotations

import colorsys
import hashlib
import io
import re
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from utils.page_effects import MAX_EFFECTS, effects_problems, material, pick_effects


HEX = r"^#[0-9a-f]{6}$"

# Families the page may load from Google Fonts: the six presets' pairings
# (rules 3.3) and nothing else. A brief naming any other face is rejected.
FONT_ALLOWLIST = {
    "Oswald", "Pinyon Script", "Figtree", "Bricolage Grotesque", "DM Sans",
    "Cormorant Garamond", "Manrope", "Archivo", "Anton", "Work Sans",
    "Barlow Condensed", "Barlow",
}

# Rules 3.3. `ground`, `text`, `muted`, `surface` and `rule` are written as
# (saturation, lightness) taken at the ACCENT's hue, so neutrals lean toward
# the brand (rule 3.2) instead of being pure grey.
PRESETS: dict[str, dict] = {
    "candlelight": {
        "use": "Shabbos catering, bakeries, evening food, wine",
        "feeling": "warm, candlelit, Friday night",
        "accent": "#d9a54a",
        "neutrals": {"ground": (0.25, 0.05), "surface": (0.22, 0.08), "text": (0.40, 0.91),
                     "muted": (0.12, 0.64), "rule": (0.16, 0.20)},
        "type": {"display": "Oswald", "body": "Figtree", "accent": "Pinyon Script"},
        "display_weight": 200, "caps": True, "tracking": "0.04em",
        "texture": "grain", "hero_side": "left",
    },
    "bold-pantry": {
        "use": "daytime food, groceries, cafes, packaged goods",
        "feeling": "bright, generous, daytime",
        "accent": "#e2572b",
        "neutrals": {"ground": (0.55, 0.22), "surface": (0.50, 0.27), "text": (0.20, 0.97),
                     "muted": (0.25, 0.85), "rule": (0.35, 0.35)},
        "type": {"display": "Bricolage Grotesque", "body": "DM Sans"},
        "display_weight": 800, "caps": False, "tracking": "-0.01em",
        "texture": "paper", "hero_side": "left",
    },
    "jerusalem-stone": {
        "use": "premium stays, villas, boutique hotels",
        "feeling": "quiet, sunlit stone, unhurried",
        "accent": "#9a7a3c",
        "neutrals": {"ground": (0.22, 0.93), "surface": (0.20, 0.89), "text": (0.10, 0.14),
                     "muted": (0.08, 0.36), "rule": (0.14, 0.80)},
        "type": {"display": "Cormorant Garamond", "body": "Manrope"},
        "display_weight": 300, "caps": True, "tracking": "0.3em",
        "texture": "stone", "hero_side": "center",
    },
    "studio": {
        "use": "beauty, wellness, fitness, classes",
        "feeling": "clean, confident, one bright note",
        "accent": "#d6336c",
        "neutrals": {"ground": (0.10, 0.985), "surface": (0.10, 0.95), "text": (0.12, 0.08),
                     "muted": (0.06, 0.36), "rule": (0.08, 0.86)},
        "type": {"display": "Archivo", "body": "Archivo"},
        "display_weight": 700, "caps": False, "tracking": "-0.02em",
        "texture": "none", "hero_side": "left",
    },
    "field": {
        "use": "tours, experiences, drivers, outdoor",
        "feeling": "open air, early start, the road ahead",
        "accent": "#e8a33d",
        "neutrals": {"ground": (0.18, 0.09), "surface": (0.16, 0.13), "text": (0.15, 0.95),
                     "muted": (0.10, 0.70), "rule": (0.12, 0.24)},
        "type": {"display": "Anton", "body": "Work Sans"},
        "display_weight": 400, "caps": True, "tracking": "0.01em",
        "texture": "grain", "hero_side": "left",
    },
    "workshop": {
        "use": "trades, movers, cleaners, repair",
        "feeling": "practical, on time, done right",
        "accent": "#f2c230",
        "neutrals": {"ground": (0.12, 0.96), "surface": (0.14, 0.92), "text": (0.55, 0.14),
                     "muted": (0.20, 0.36), "rule": (0.15, 0.84)},
        "type": {"display": "Barlow Condensed", "body": "Barlow"},
        "display_weight": 700, "caps": True, "tracking": "0.01em",
        "texture": "linen", "hero_side": "left",
    },
}

CATEGORY_OF = {
    "events-catering": "food", "shops-products": "food",
    "personal-care": "wellness", "health-fitness": "wellness",
    "home-services-repair": "trades", "cleaning-services": "trades", "moving-relocation": "trades",
    "travel-tourism": "experiences",
}
_EVENING_FOOD = ("shabbos", "shabbat", "cholent", "challah", "kiddush", "simcha", "wine", "bakery",
                 "שבת", "חלה", "קידוש", "צ'ולנט", "יין", "מאפייה")


# ------------------------------------------------------------------ colour

def _rgb(h: str) -> tuple[float, float, float]:
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))  # type: ignore[return-value]


def _hex(r: float, g: float, b: float) -> str:
    return "#" + "".join(f"{round(max(0, min(1, c)) * 255):02x}" for c in (r, g, b))


def luminance(h: str) -> float:
    def ch(c):
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(c) for c in _rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def _at_hue(hue: float, s: float, l: float) -> str:
    return _hex(*colorsys.hls_to_rgb(hue, l, s))


def _push_apart(color: str, ground: str, need: float) -> str:
    """Move `color`'s lightness away from the ground until it reaches `need`."""
    h, l, s = colorsys.rgb_to_hls(*_rgb(color))
    step = 0.02 if luminance(ground) < 0.18 else -0.02
    while contrast(color, ground) < need and 0 <= l <= 1:
        l += step
        color = _hex(*colorsys.hls_to_rgb(h, max(0, min(1, l)), s))
    return color


def extract_accent(image_bytes: bytes) -> Optional[str]:
    """The dominant non-neutral colour of a logo, taken at its mid-tone.

    Transparent and near-white/near-black/grey pixels are ignored, hues are
    binned, and the strongest bin's median-lightness pixel wins, so a gold
    gradient gives its middle gold rather than its highlight or its shadow
    (rule 3.2)."""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    except Exception:  # noqa: BLE001 - not an image: no accent, not a crash
        return None
    img.thumbnail((96, 96))
    bins: dict[int, list[tuple[float, float, float, float]]] = {}
    for r, g, b, a in img.getdata():
        if a < 128:
            continue
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if s < 0.28 or not 0.18 <= l <= 0.85:
            continue
        bins.setdefault(int(h * 24) % 24, []).append((l, r / 255, g / 255, b / 255))
    if not bins:
        return None
    best = max(bins.values(), key=len)
    if len(best) < 12:
        return None
    best.sort()
    _, r, g, b = best[len(best) // 2]
    return _hex(r, g, b)


def derive_palette(preset: str, accent: str) -> dict[str, str]:
    p = PRESETS[preset]
    hue = colorsys.rgb_to_hls(*_rgb(accent))[0]
    pal = {k: _at_hue(hue, s, l) for k, (s, l) in p["neutrals"].items()}
    pal["text"] = _push_apart(pal["text"], pal["ground"], 7.0)
    pal["muted"] = _push_apart(pal["muted"], pal["ground"], 4.6)
    pal["accent"] = _push_apart(accent.lower(), pal["ground"], 3.0)
    on = "#ffffff" if contrast("#ffffff", pal["accent"]) >= contrast("#111111", pal["accent"]) else "#111111"
    # The button's text must read too (4.5:1). If the accent sits in the
    # middle, nudge it away from its text colour while it still clears the
    # ground (found by the preset test: pink on Bold Pantry was 4.39:1).
    h, l, s = colorsys.rgb_to_hls(*_rgb(pal["accent"]))
    step = -0.01 if on == "#ffffff" else 0.01
    for _ in range(60):
        if contrast(on, pal["accent"]) >= 4.5:
            break
        nxt = _hex(*colorsys.hls_to_rgb(h, max(0, min(1, l + step)), s))
        if contrast(nxt, pal["ground"]) < 3.0:
            on = "#111111" if on == "#ffffff" else "#ffffff"   # flip the text instead
            step = -step
            continue
        l += step
        pal["accent"] = nxt
    pal["on_accent"] = on
    return pal


# ------------------------------------------------------------------ the brief

class Palette(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ground: str = Field(..., pattern=HEX)
    text: str = Field(..., pattern=HEX)
    muted: str = Field(..., pattern=HEX)
    accent: str = Field(..., pattern=HEX)
    surface: str = Field(..., pattern=HEX)
    rule: str = Field(..., pattern=HEX)
    on_accent: str = Field(..., pattern=HEX)


class TypeSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display: str
    body: str
    accent: Optional[str] = None
    display_weight: int = Field(400, ge=100, le=900)
    caps: bool = False
    tracking: str = Field("0em", pattern=r"^-?0?\.\d{1,3}em$|^0em$")

    @model_validator(mode="after")
    def _allowlisted(self) -> "TypeSpec":
        for face in (self.display, self.body, self.accent):
            if face is not None and face not in FONT_ALLOWLIST:
                raise ValueError(f"font {face!r} is not on the allowlist")
        return self


# A picture of theirs, by reference, never a URL (P1): the cover, or one
# image of one listing (its gallery, or a tier's or product's images).
PHOTO_REF = r"^(cover|listing:[A-Za-z0-9_-]{1,64}:(gallery:\d{1,2}|item:\d{1,2}:\d{1,2}))$"


class PhotoRef(BaseModel):
    """One of their pictures and what the flyer check made of it."""
    model_config = ConfigDict(extra="forbid")
    ref: str = Field(..., pattern=PHOTO_REF)
    kind: Literal["photo", "flyer", "unknown"]


class Hero(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tier: Literal[1, 2, 3]
    # One of their pictures (tier 1), or "film": the business's brand film,
    # stored on the record as brand_film (tier 2).
    media_id: Optional[str] = Field(None, pattern=rf"^(film|{PHOTO_REF[1:-1]})$")
    poster_id: Optional[str] = Field(None, max_length=64)
    subject_side: Literal["left", "right", "center"] = "right"


class Action(BaseModel):
    """Chat-only (Tzvi, 5 Oct 2026): the action opens the on-site chat or an
    order/booking page of ours. Never a phone, email or outside URL."""
    model_config = ConfigDict(extra="forbid")
    kind: Literal["message", "order", "book"]
    href: str = Field(..., pattern=r"^(#message|/order/[A-Za-z0-9_-]{1,64}|/services/gig/[A-Za-z0-9_-]{1,64})$")
    price_anchor: Optional[float] = Field(None, gt=0)
    currency: str = Field("ILS", pattern=r"^[A-Z]{3}$")


class Tagline(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(..., min_length=3, max_length=200)
    lang: Literal["en", "he"]
    source: str = Field(..., max_length=80)   # the record field it was taken from


class DesignBrief(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: Literal[3] = 3
    category: Literal["food", "stays", "services", "experiences", "restaurants", "wellness", "trades"]
    feeling: str = Field(..., max_length=80)
    preset: Literal["candlelight", "bold-pantry", "jerusalem-stone", "studio", "field", "workshop"]
    brand_source: str = Field(..., max_length=120)
    palette: Palette
    type: TypeSpec
    texture: Literal["grain", "paper", "stone", "linen", "none"]
    hero: Hero
    # The page's one bold moment (utils/page_effects.py): the peak among
    # `effects`, or "hero" when the page has none, which is every brief
    # written before effects existed.
    showstopper: str = Field("hero", max_length=60)
    effects: list[str] = Field(default_factory=list, max_length=MAX_EFFECTS)
    signature_detail: str = Field("", max_length=120)
    primary_action: Action
    taglines: list[Tagline] = Field(default_factory=list, max_length=6)
    missing_content: list[str] = Field(default_factory=list, max_length=12)
    photos: list[PhotoRef] = Field(default_factory=list, max_length=24)
    # Phase 4 sections, each from their own words (rule 1): the occasions they
    # list, set as big type, and the steps of how ordering works, only when
    # they wrote them as steps. Same shape and same check as a tagline.
    occasions: list[Tagline] = Field(default_factory=list, max_length=16)
    steps: list[Tagline] = Field(default_factory=list, max_length=6)

    @model_validator(mode="after")
    def _never_a_flyer_as_hero(self) -> "DesignBrief":
        """Rule 4: a flyer is never the hero, and neither is a picture the
        check could not read. Tier 1 must name a picture checked as a photo."""
        if self.hero.tier == 1:
            kinds = {p.ref: p.kind for p in self.photos}
            if kinds.get(self.hero.media_id or "") != "photo":
                raise ValueError("a tier 1 hero must be a picture checked as a photo, never a flyer or unchecked")
        if (self.hero.tier == 2) != (self.hero.media_id == "film"):
            raise ValueError("a tier 2 hero is the brand film, and only tier 2 is")
        return self

    @model_validator(mode="after")
    def _effects_hold(self) -> "DesignBrief":
        """One bold moment, the caps, and only effects the page has the
        material for. Checks that need the record (a logo, the name's
        length) run in brief_problems."""
        problems = effects_problems(self.effects, self.showstopper, material(self))
        if problems:
            raise ValueError("; ".join(problems))
        return self

    @model_validator(mode="after")
    def _readable(self) -> "DesignBrief":
        p = self.palette
        if contrast(p.text, p.ground) < 4.5:
            raise ValueError(f"text on ground is {contrast(p.text, p.ground):.2f}:1; needs 4.5:1")
        if contrast(p.muted, p.ground) < 4.5:
            raise ValueError(f"muted text on ground is {contrast(p.muted, p.ground):.2f}:1; needs 4.5:1")
        if contrast(p.accent, p.ground) < 3.0:
            raise ValueError(f"the accent on ground is {contrast(p.accent, p.ground):.2f}:1; the button needs 3:1")
        if contrast(p.on_accent, p.accent) < 4.5:
            raise ValueError(f"button text on the accent is {contrast(p.on_accent, p.accent):.2f}:1; needs 4.5:1")
        return self


# ------------------------------------------------------------------ their data

def _prices(b: dict) -> list[float]:
    out = []
    for g in b.get("listings") or []:
        for i in ((g or {}).get("tiers") or []) + ((g or {}).get("products") or []):
            try:
                if (i or {}).get("price") and float(i["price"]) > 0:
                    out.append(float(i["price"]))
            except (TypeError, ValueError):
                continue
    return out


def _owner_fields(b: dict) -> dict[str, str]:
    """Every field the owner wrote, by name, for taglines and their proof."""
    out = {"description": b.get("description") or "", "description_he": b.get("description_he") or ""}
    for n, g in enumerate(b.get("listings") or []):
        g = g or {}
        for k in ("title", "title_he", "description", "description_he"):
            if g.get(k):
                out[f"listings.{n}.{k}"] = str(g[k])
        for m, i in enumerate((g.get("tiers") or []) + (g.get("products") or [])):
            if (i or {}).get("description"):
                out[f"listings.{n}.items.{m}.description"] = str(i["description"])
    return out


def brief_problems(brief: DesignBrief, b: dict) -> list[str]:
    """What the record can't back. Empty means usable (rule 1: real content)."""
    problems = []
    a = brief.primary_action
    if a.price_anchor is not None and a.price_anchor not in _prices(b):
        problems.append(f"price anchor {a.price_anchor:g} is not a price on the business")
    fields = _owner_fields(b)
    for t in brief.taglines:
        if t.text not in fields.get(t.source, ""):
            problems.append(f"tagline {t.text[:40]!r} is not word for word in {t.source}")
    for kind, items in (("occasion", brief.occasions), ("step", brief.steps)):
        for t in items:
            if t.text.lower() not in fields.get(t.source, "").lower():
                problems.append(f"{kind} {t.text[:40]!r} is not in their words in {t.source}")
    if brief.hero.tier == 2 and not (b.get("brand_film") or {}).get("url"):
        problems.append("the hero names a brand film the business does not have")
    problems += effects_problems(brief.effects, brief.showstopper, material(brief, b), with_record=True)
    return problems


def pick_hero(photo_ref: Optional[str], has_film: bool, preset: str) -> dict:
    """Rule 4: the highest tier their content allows. A real photo, else the
    brand film, else the typographic panel. The film's subject sits on the
    right third, so the copy goes left (rules, part 4)."""
    if photo_ref:
        return {"tier": 1, "media_id": photo_ref, "subject_side": "right"}
    if has_film:
        return {"tier": 2, "media_id": "film", "subject_side": "right"}
    return {"tier": 3, "subject_side": PRESETS[preset]["hero_side"]}


# Rules, part 4 and check 15: 6-10s, 1920x1080 H.264, under 4MB.
FILM_MAX_BYTES = 4 * 1024 * 1024


def film_problems(facts: dict) -> list[str]:
    """What is wrong with an uploaded brand film, from Cloudinary's own
    reading of it (never the browser's). Empty means it can be used.
    ponytail: the loop seam (rules, part 4) is checked by eye before upload;
    automate it when the server has ffmpeg."""
    out = []
    codec = (facts.get("codec") or "").lower()
    if codec != "h264":
        out.append(f"it is {codec or 'an unknown codec'}; it must be H.264")
    seconds = float(facts.get("duration") or 0)
    if not 5.9 <= seconds <= 10.1:
        out.append(f"it runs {seconds:.1f}s; a loop is 6 to 10 seconds")
    w, h = int(facts.get("width") or 0), int(facts.get("height") or 0)
    if w < 1920 or not h or abs(w / h - 16 / 9) > 0.02:
        out.append(f"it is {w}x{h}; it must be 1920x1080 or a larger 16:9")
    if int(facts.get("bytes") or 0) > FILM_MAX_BYTES:
        out.append("it is over 4MB")
    return out


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.?!])\s+", (text or "").strip()) if s.strip()]


_LEAD_IN = re.compile(r"^(?:(?:order|perfect|great|ideal|made)\s+for|for|and|or|your|our|the|also)\s+", re.I)
_LEAD_IN_HE = re.compile(r"^(?:ו|ל|ול)(?=\S{3,})")


def _occasions(b: dict) -> list[Tagline]:
    """The occasions they list themselves, word for word: a sentence of theirs
    with at least three comma-separated items, each item trimmed of lead-in
    words ("Order for your", "and") and nothing else. "Order for your family
    visiting, your shabbos meals, Thursday nights, kiddushim..." gives
    family visiting · shabbos meals · Thursday nights · kiddushim..."""
    out = []
    for lang, field in (("en", "description"), ("he", "description_he")):
        heb = lang == "he"
        for s in _sentences(b.get(field) or ""):
            body = s.rstrip(".!?")
            parts = [p.strip() for p in re.split(r",\s*|\s+and\s+(?=[^,]+$)", body) if p.strip()]
            if len(parts) < 3:
                continue
            items = []
            for p in parts:
                prev = None
                while prev != p:
                    prev = p
                    p = (_LEAD_IN_HE if heb else _LEAD_IN).sub("", p).strip()
                words = p.split()
                if 1 <= len(words) <= 4 and not re.search(r"\d|[!?]", p) and bool(re.search(r"[\u0590-\u05FF]", p)) == heb:
                    items.append(p)
            if len(items) >= 3:
                out += [Tagline(text=x, lang=lang, source=field) for x in items[:8]]
                break
    return out


def _taglines(b: dict) -> list[Tagline]:
    """Their own sentences, word for word, best first: short, and not shouting.
    Rule 8 allows one "!" per page, so a tagline carries none."""
    out = []
    for lang, field in (("en", "description"), ("he", "description_he")):
        heb = lang == "he"
        picks = [s for s in _sentences(b.get(field) or "")
                 if "!" not in s and 4 <= len(s.split()) <= 22 and bool(re.search(r"[֐-׿]", s)) == heb]
        out += [Tagline(text=s, lang=lang, source=field) for s in picks[:2]]
    return out


def _category(b: dict) -> str:
    cats = [g.get("category") for g in b.get("listings") or [] if g] + list(b.get("categories") or [])
    for c in cats:
        if c in CATEGORY_OF:
            return CATEGORY_OF[c]
    return "services"


def _preset(category: str, b: dict) -> str:
    text = " ".join(str(x) for x in (b.get("description"), b.get("description_he"), b.get("name"))).lower()
    if category in ("food", "restaurants"):
        return "candlelight" if any(w in text for w in _EVENING_FOOD) else "bold-pantry"
    return {"stays": "jerusalem-stone", "wellness": "studio", "experiences": "field",
            "trades": "workshop"}.get(category, "studio")


def _missing(b: dict, category: str, photos: Optional[list[dict]] = None) -> list[str]:
    """The owner checklist (rule 1): what would unlock more of the page.
    Photos count only when the flyer check passed them: a flyer is not a
    photo of the food."""
    out = []
    if photos is None:
        real = sum(len((g or {}).get("gallery") or []) for g in b.get("listings") or [])
    else:
        real = sum(1 for x in photos if x.get("kind") == "photo")
    if real < 3:
        out.append("photos" if category != "food" else "food photos")
    if not _prices(b):
        out.append("prices")
    if category == "food":
        if not b.get("lead_time"):
            out.append("order deadline")
        if not b.get("delivery_note"):
            out.append("delivery terms")
    if not b.get("hours") and category in ("restaurants", "food"):
        out.append("hours")
    if not b.get("description_he"):
        out.append("description in Hebrew")
    if category == "food":
        out.append("how ordering works, step by step")
    return out


def photo_candidates(b: dict) -> list[tuple[str, str]]:
    """(ref, url) for every picture of theirs, in the order a hero would be
    chosen: the cover, then each listing's gallery, then its items' images."""
    out = [("cover", b["cover_url"])] if b.get("cover_url") else []
    for g in b.get("listings") or []:
        g = g or {}
        gid = g.get("id")
        if not gid:
            continue
        for n, url in enumerate((g.get("gallery") or [])[:10]):
            out.append((f"listing:{gid}:gallery:{n}", url))
        for m, item in enumerate(((g.get("tiers") or []) + (g.get("products") or []))[:10]):
            pics = (item or {}).get("images") or ([item["image"]] if (item or {}).get("image") else [])
            for k, url in enumerate(pics[:5]):
                out.append((f"listing:{gid}:item:{m}:{k}", url))
    return out[:24]


def with_hero(brief: dict, b: dict, hero: dict) -> DesignBrief:
    """The stored brief with a new hero, its effects picked again: a film
    added or removed changes what the page can carry (a looping film never
    shares the hero with a scrolling peak). Same seed, so the page stays
    this business's. Validated, never patched."""
    fields = {**brief, "hero": hero}
    effects, showstopper = pick_effects(material(fields, b), fields["preset"], None, effects_seed(b))
    return DesignBrief(**{**fields, "effects": effects, "showstopper": showstopper})


def effects_seed(b: dict, generation: int = 0) -> int:
    """A stable seed per business, so rebuilding gives the same page, and a
    different one per generation, so asking again gives a new one."""
    key = f"{b.get('_id') or b.get('id') or b.get('name') or ''}:{generation}"
    return int(hashlib.sha256(key.encode()).hexdigest()[:8], 16)


def build_brief(b: dict, logo_bytes: Optional[bytes] = None,
                photos: Optional[list[dict]] = None, recent: Optional[list[dict]] = None,
                seed: Optional[int] = None, avoid_peaks: Optional[set[str]] = None) -> DesignBrief:
    """A brief from the business's own data and our presets. Raises if the
    result would not validate; callers report that, they don't patch it.

    `recent` is the newest live briefs of the same category (effects and
    showstopper each), so the page is not too similar to them; `avoid_peaks`
    keeps versions shown side by side on different bold moments."""
    category = _category(b)
    preset = _preset(category, b)
    p = PRESETS[preset]
    logo_accent = extract_accent(logo_bytes) if logo_bytes else None
    hero_photo = next((x["ref"] for x in photos or [] if x.get("kind") == "photo"), None)
    palette = derive_palette(preset, logo_accent or p["accent"])
    listings = [g for g in b.get("listings") or [] if g]
    store = next((g for g in listings if g.get("gig_type") == "store"), None)
    prices = _prices(b)
    if store:
        action = {"kind": "order", "href": f"/order/{store['id']}"}
    else:
        action = {"kind": "message", "href": "#message"}   # chat-only, never a phone
    if prices:
        action["price_anchor"] = min(prices)
    fields = dict(
        category=category,
        feeling=p["feeling"],
        preset=preset,
        brand_source="logo accent" if logo_accent else f"{preset} preset accent (no usable logo colour)",
        palette=palette,
        type={**p["type"], "display_weight": p["display_weight"], "caps": p["caps"], "tracking": p["tracking"]},
        texture=p["texture"],
        # Tier 1 when the flyer check found a real photo; never a flyer or a
        # picture it could not read (rule 4). Then their film, then the panel.
        hero=pick_hero(hero_photo, bool((b.get("brand_film") or {}).get("url")), preset),
        photos=photos or [],
        signature_detail=("kashrut certificate shown as a document"
                          if (b.get("kosher_certification") or {}).get("body") and category == "food" else ""),
        primary_action=action,
        taglines=_taglines(b),
        occasions=_occasions(b),
        missing_content=_missing(b, category, photos),
    )
    effects, showstopper = pick_effects(material(fields, b), preset, recent,
                                        effects_seed(b) if seed is None else seed, avoid_peaks)
    brief = DesignBrief(**fields, effects=effects, showstopper=showstopper)
    problems = brief_problems(brief, b)
    if problems:
        raise ValueError("; ".join(problems))
    return brief


# ------------------------------------------------------------------ the switch

def v3_enabled() -> bool:
    """PAGE_BUILDER_V3_ENABLED, off by default. Read per call so a test or a
    restart changes it without touching code."""
    import os
    return os.environ.get("PAGE_BUILDER_V3_ENABLED", "").strip().lower() in ("1", "true", "yes")


def page_check_passed(biz: dict) -> bool:
    """The quality gate (rules, part 9; scripts/check-page.mjs) passed for
    THIS brief. A new brief, a film added or removed, needs a new pass."""
    c = (biz or {}).get("page_check") or {}
    return c.get("passed") is True and bool(c.get("brief_at")) and c.get("brief_at") == (biz or {}).get("design_brief_at")


def page_v3_on(biz: dict, admin: bool = False) -> bool:
    """On only when the site switch is on AND this business was switched on
    by an admin: one business at a time, as asked. Visitors see it only once
    the quality gate passed for this brief; an admin sees it before, which
    is how the gate renders it."""
    b = biz or {}
    if not (v3_enabled() and b.get("page_v3") and b.get("design_brief")):
        return False
    return admin or page_check_passed(b)

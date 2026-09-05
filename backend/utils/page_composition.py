"""The composition document: a business page as data, not as code.

Phase 1 of `docs/ai-page-builder-spec.md`. There is no AI here and no
generation. This is the vocabulary a generator will later be constrained
to, built and shipped first, because a vocabulary that turns out to be
wrong is cheap to change now and expensive to change once a model is
emitting it.

    {"theme":  {"palette": "sea", "density": "airy", ...},
     "blocks": [{"id": "hero", "type": "hero", "variant": "band",
                 "props": {"title": "Fresh every morning"}}, ...]}

FOUR PROPERTIES, and every one of them is a decision that was argued for
in the spec rather than a default:

1.  **A CLOSED VOCABULARY.** `type` and `variant` must exist in `BLOCKS`.
    Props are typed, bounded, and `extra="forbid"` at every level, so a
    key nobody designed for cannot ride along in the document waiting for
    a renderer to find it.

2.  **NO URLS. AT ALL.** Not "validated URLs" - none. An image prop is a
    REFERENCE into the business's own assets (`cover`, `logo`,
    `listing:<id>`), resolved at render time against what that business
    actually owns. This is the difference between a rule ("only their own
    photos") and a guarantee: there is no shape a URL can take that fits
    in an `ImageRef`, so no validator has to be right for the rule to
    hold. It also means a business that replaces its cover photo does not
    have a page pointing at the old one.

    Text props are text. React renders them as text nodes, never as
    markup, which is the same reason P1 refuses model-written HTML.

3.  **REJECT, DO NOT REPAIR.** Invalid input is a 422 naming the field.
    Nothing here trims a too-long list, coerces an unknown variant, or
    drops an unexpected key: silent repair is how an escape hatch appears,
    because the repaired document is the one nobody reviewed.

    The one place the codebase does coerce - `accent`, where an unknown
    name lands on the default rather than costing the owner the
    description they were editing - is deliberate and stays that way. An
    accent is decoration supplied by a possibly stale client. A
    composition is the page.

4.  **STALE REFERENCES ARE TOLERATED AT RENDER, NOT AT WRITE.** A block
    may name a service that is later deleted. Validating ids against the
    gig list would make a business un-saveable because of something it
    deleted last month, which is the reasoning already written into
    `Collection` in routes/marketplace/businesses.py. So ids are shape-
    checked only, and the renderer skips what it cannot resolve.

WHERE THIS LIVES. On the business document, not in its own collection.
Every read that needs it already holds the business (`_public`, the page
payload, the OG builder all start from one `find_one`), it is one-to-one,
`_owned()` already decides who may edit it, and deleting a business
carries its page with it. When Phase 3 adds the "every version is kept"
promise of P7g, THAT goes in its own collection: version history is
one-to-many and unbounded, and a few KB per composition times N versions
on one record eventually meets Mongo's 16MB ceiling.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# --------------------------------------------------------------- theme

# The six dials of P2. Every value is closed; the renderer maps each to
# CSS custom properties (frontend/src/styles/page-theme.css) so a dial
# can never produce a colour or a length the design system has not seen.
#
# `palette` is a NAMED FAMILY rather than P2's hue-count range
# (monochrome -> duotone -> saturated), for one reason: a hue count with
# no hue is not renderable, and the four names already exist, already
# have a contrast-checked table in frontend/src/utils/businessAccent.js,
# and are already what the editor edits. The hue-count axis is additive
# when a fifth family arrives; inventing a second place for the accent to
# live is not.
DIALS: dict[str, tuple[str, ...]] = {
    "palette": ("stone", "sea", "deep", "gold"),
    # A PAIRING, not a face. RTL swaps the font variables and Playfair has
    # no Hebrew glyphs, so a literal family name here is the exact bug
    # already found ~69 times in this codebase.
    "type": ("serif", "grotesque", "geometric"),
    "density": ("airy", "balanced", "packed"),
    "imagery": ("full-bleed", "grid", "thumbnail"),
    "price_prominence": ("quiet", "normal", "loud"),
    # There is no "lively". Motion above `subtle` on a page an owner sends
    # to a customer is decoration that costs the reader time, and every
    # value here is already gated behind prefers-reduced-motion.
    "motion": ("still", "subtle"),
}

DIAL_DEFAULTS: dict[str, str] = {
    "palette": "stone",
    "type": "serif",
    "density": "balanced",
    "imagery": "grid",
    "price_prominence": "normal",
    "motion": "subtle",
}


class Theme(BaseModel):
    """Where a business sits on the six dials.

    Every field has a default, so `{"theme": {}}` is a complete theme and
    a client that knows about five dials does not have to guess the sixth.
    """
    model_config = ConfigDict(extra="forbid")

    palette: Literal["stone", "sea", "deep", "gold"] = "stone"
    type: Literal["serif", "grotesque", "geometric"] = "serif"
    density: Literal["airy", "balanced", "packed"] = "balanced"
    imagery: Literal["full-bleed", "grid", "thumbnail"] = "grid"
    price_prominence: Literal["quiet", "normal", "loud"] = "normal"
    motion: Literal["still", "subtle"] = "subtle"


# --------------------------------------------------------------- blocks

# An image reference, never a URL. `cover` and `logo` are the business's
# own two; `listing:<gig_id>` is the cover of one of its services. A
# reference that no longer resolves renders nothing.
IMAGE_REF = r"^(cover|logo|listing:[A-Za-z0-9_-]{1,64})$"

# Ids are the handle a diff and a rollback need (P1: "it can be diffed,
# versioned, rolled back"). Lowercase and bounded so they can also be
# element ids and test ids without escaping.
BLOCK_ID = r"^[a-z0-9][a-z0-9_-]{0,31}$"

MAX_BLOCKS = 24


class _Props(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HeroProps(_Props):
    """common/HeroBand.jsx - the dark photo band.

    `title` and `accent_word` are separate for the same reason the
    component keeps them separate: the accent is the coloured tail of the
    headline and Hebrew emphasises a different word, so the two halves
    have to be translatable independently. A single interpolated string
    would make that impossible and is why this is not one field.
    """
    image: Optional[str] = Field(None, pattern=IMAGE_REF)
    title: str = Field("", max_length=80)
    accent_word: str = Field("", max_length=40)
    lede: str = Field("", max_length=200)


class RuleProps(_Props):
    """common/SkylineRule.jsx - the divider shaped like the logo.

    `tone` names a role, not a colour. The component takes a colour from
    its caller and the caller is the renderer, which reads the theme.
    """
    tone: Literal["border", "accent", "muted"] = "border"
    size: Literal["s", "m", "l"] = "m"


class FactsProps(_Props):
    """marketplace/GoodToKnow.jsx - hours, languages, hechsher, licence.

    No props. Every row is drawn from the business and every row is
    optional, which is P4's "a page with no photos and no prices still
    looks deliberate" already built: the whole band disappears when there
    is nothing to say rather than advertising that we asked and got no
    answer.
    """


class ServicesProps(_Props):
    """marketplace/ServiceCard.jsx, in the variant the block names.

    `source` is what the block is FOR, and `ids` is only read when it is
    `pick`. Ids are shape-checked and not validated against the gig list;
    see the module docstring.
    """
    heading: str = Field("", max_length=60)
    source: Literal["all", "featured", "collection", "pick"] = "all"
    collection_id: Optional[str] = Field(None, max_length=64)
    ids: list[str] = Field(default_factory=list, max_length=24)
    limit: int = Field(12, ge=1, le=48)

    @field_validator("ids")
    @classmethod
    def _shape(cls, v: list[str]) -> list[str]:
        for gid in v:
            if not gid or len(gid) > 64:
                raise ValueError("service ids are 1 to 64 characters")
        return v


class ProvidersProps(_Props):
    """marketplace/FeaturedProviders.jsx - the featured row.

    Renders nothing when nothing is flagged, which on a page this size is
    the likely state. Self-hiding is why it qualified for phase 1.
    """
    limit: int = Field(3, ge=1, le=8)


class CoverProps(_Props):
    """marketplace/BusinessCoverBand.jsx - the band behind the name."""
    height: Literal["s", "m", "l"] = "m"


class GalleryProps(_Props):
    """property/ImageGallery.jsx - photos, whole, over their own colours.

    References only, capped. Twelve is what the strip can show before it
    stops being one glance.
    """
    images: list[str] = Field(default_factory=list, max_length=12)

    @field_validator("images")
    @classmethod
    def _refs(cls, v: list[str]) -> list[str]:
        for ref in v:
            if not re.match(IMAGE_REF, ref or ""):
                raise ValueError(
                    "images are references to this business's own assets "
                    "(cover, logo, listing:<id>), never URLs",
                )
        return v


class ContactProps(_Props):
    """marketplace/ContactChannels.jsx - WhatsApp, email, message here.

    No props: which channels exist is the SERVER's answer, not the
    owner's. On-site messaging is always present and always last because
    it is the only channel that cannot silently fail.
    """


# The library. Order is the spec's own "least work first" ordering
# (docs/ai-page-builder-spec.md, phase-1 block set), which is also the
# order they were converted.
BLOCKS: dict[str, dict[str, Any]] = {
    "hero": {"variants": ("band", "compact"), "props": HeroProps},
    "rule": {"variants": ("skyline", "hairline"), "props": RuleProps},
    "facts": {"variants": ("list",), "props": FactsProps},
    "services": {"variants": ("grid", "list"), "props": ServicesProps},
    "providers": {"variants": ("rows",), "props": ProvidersProps},
    "cover": {"variants": ("photo", "tint"), "props": CoverProps},
    "gallery": {"variants": ("carousel",), "props": GalleryProps},
    "contact": {"variants": ("stack",), "props": ContactProps},
}


class Block(BaseModel):
    """One block. `type` and `variant` must both be in the library."""
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., pattern=BLOCK_ID)
    type: str = Field(..., max_length=32)
    variant: str = Field(..., max_length=32)
    props: dict[str, Any] = Field(default_factory=dict)

    @field_validator("type")
    @classmethod
    def _known_type(cls, v: str) -> str:
        if v not in BLOCKS:
            raise ValueError(
                f"unknown block type {v!r}; known: {', '.join(sorted(BLOCKS))}",
            )
        return v

    # `mode="after"` and not `model_post_init`: a ValueError raised in a
    # model validator is wrapped into a ValidationError, which FastAPI
    # renders as a 422 naming the field. One raised in model_post_init is
    # not, and reaches the client as a 500 - "reject" has to mean "told
    # them what was wrong", not "fell over".
    @model_validator(mode="after")
    def _known_variant_and_props(self) -> "Block":
        spec = BLOCKS[self.type]
        if self.variant not in spec["variants"]:
            raise ValueError(
                f"block {self.type!r} has no variant {self.variant!r}; "
                f"known: {', '.join(spec['variants'])}",
            )
        # Validated by the block's OWN props model, then written back as
        # the parsed dict. Round-tripping through the model is what makes
        # `extra="forbid"` bite: an unexpected key raises here rather than
        # sitting in the document until a renderer finds it.
        self.props = spec["props"](**self.props).model_dump()
        return self


class PageComposition(BaseModel):
    """A whole page.

    At least one block: a composition with none is not a page, and
    storing it would leave the owner looking at nothing while the field
    said their page was composed. Clearing the design is `page: null`.
    """
    model_config = ConfigDict(extra="forbid")

    theme: Theme = Field(default_factory=Theme)
    blocks: list[Block] = Field(..., min_length=1, max_length=MAX_BLOCKS)

    @field_validator("blocks")
    @classmethod
    def _unique_ids(cls, v: list[Block]) -> list[Block]:
        seen = set()
        for b in v:
            if b.id in seen:
                raise ValueError(f"duplicate block id {b.id!r}")
            seen.add(b.id)
        return v


# ---------------------------------------------------------------- brief

# P7b. Six questions, mostly taps, and the FORM is the prompt engineering:
# nobody types a prompt, they answer a brief and the brief is what a model
# will later receive. Stored because "regenerating never re-asks" and
# "editing the brief is free" are both promises in the spec.
#
# Every answer is optional. "Everything is skippable and every default is
# good" is not a nicety here - it is what stops the form being a wall
# between an owner and their page.
BRIEF_OPTIONS: dict[str, tuple[str, ...]] = {
    # 1. What are you showing people? (drives the block set)
    "showing": ("services", "catalogue", "one-thing", "place", "properties"),
    # 2. What should someone do when they land here? (drives CTA + layout)
    "action": ("message", "book", "visit", "order", "understand"),
    # 3. Who is it mostly for? (drives tone and language emphasis)
    "audience": ("locals", "olim", "tourists", "businesses", "everyone"),
    # 4. Where do your prices sit? (drives price prominence and density).
    #    Phrased without judgement in the UI, because nobody ticks "cheap".
    "pricing": ("premium", "fair", "value", "quote"),
}

# 5. What should people know first? Up to TWO, and the cap is the point:
#    a business that leads with eight things leads with none.
BRIEF_STRENGTHS: tuple[str, ...] = (
    "quality", "speed", "price", "experience",
    "kosher", "english", "family", "licensed",
)
MAX_STRENGTHS = 2

# There is no colour question and no adjective list, deliberately. A
# colour question is a colour picker by the back door, and the reason
# there is no colour picker is P1. Adjectives get ticked arbitrarily and
# the output then feels random, which reads as the tool being bad rather
# than the question being bad.


class PageBrief(BaseModel):
    """The six answers. All optional; `note` is the only place they type."""
    model_config = ConfigDict(extra="forbid")

    showing: Optional[Literal["services", "catalogue", "one-thing", "place", "properties"]] = None
    action: Optional[Literal["message", "book", "visit", "order", "understand"]] = None
    audience: Optional[Literal["locals", "olim", "tourists", "businesses", "everyone"]] = None
    pricing: Optional[Literal["premium", "fair", "value", "quote"]] = None
    strengths: list[Literal[
        "quality", "speed", "price", "experience",
        "kosher", "english", "family", "licensed",
    ]] = Field(default_factory=list, max_length=MAX_STRENGTHS)
    # 200 characters, clearly optional. Their voice, and the only free
    # text in the whole flow.
    note: str = Field("", max_length=200)

    @field_validator("strengths")
    @classmethod
    def _no_repeats(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("each strength may be chosen once")
        return v


# ------------------------------------------------------------ helpers


def dial_catalog() -> dict[str, Any]:
    """The vocabulary, for a client that must not keep its own copy.

    The frontend mirrors these names (frontend/src/utils/pageComposition.js)
    because it has to render them, and a mirror goes stale. Serving the
    real thing means a form can be built against what the API will
    actually accept, and a check can assert the two agree.
    """
    return {
        "dials": {k: list(v) for k, v in DIALS.items()},
        "dial_defaults": dict(DIAL_DEFAULTS),
        "blocks": {
            name: {
                "variants": list(spec["variants"]),
                "props": sorted(spec["props"].model_fields),
            }
            for name, spec in BLOCKS.items()
        },
        "max_blocks": MAX_BLOCKS,
        "brief": {
            **{k: list(v) for k, v in BRIEF_OPTIONS.items()},
            "strengths": list(BRIEF_STRENGTHS),
            "max_strengths": MAX_STRENGTHS,
        },
    }

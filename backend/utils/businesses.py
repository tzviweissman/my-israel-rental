"""Businesses — the thing a user can have several of (spec M1).

The model this replaces: one `marketplace_providers` row per user_id, so
one person was structurally one provider, and their business was literally
their own name. A manager with a side AC-repair trade had nowhere to put
it.

What stays put, deliberately (spec M6 and the step-1..3 constraint):

  * `marketplace_providers` remains ONE PER USER and keeps everything that
    is genuinely about the person — subscription and trial state, provider
    settings. Multiplying subscription per business would make someone with
    three businesses look like three subscribers.
  * `provider_user_id` remains the ownership key on gigs. Every existing
    authorisation check keeps working untouched. `business_id` is for
    grouping and display only at this stage; rewriting authorisation and
    the data model in one change is how you end up unable to tell which
    half broke something.

So this module creates and finds businesses. It does not decide who may
touch one — that is still the provider check, unchanged.
"""
from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from routes.deps import db

UTC = timezone.utc

# Five is a guess at "enough for a real person, few enough that the
# categories cannot be papered with near-identical shells" (spec M8).
MAX_BUSINESSES_PER_USER = 5

# ── Slugs are also subdomains ───────────────────────────────────────────
#
# `blazinboards.myisraelrental.com` is the same page as
# `/business/blazinboards`: the subdomain IS the slug, with the same rename
# history and the same resolver. That makes two things load-bearing that
# were harmless while a slug was only ever a path segment.
#
# RESERVED WORDS. As a path, /business/api is just a page. As a host,
# api.myisraelrental.com resolving to somebody's cleaning business is an
# outage, and mail. or autodiscover. breaks email clients. `unique_slug`
# refuses these, so no path (signup, migration, rename) can mint one, and a
# collision is handled exactly like a duplicate name: -2, -3.
#
# Three copies of this list exist, because three runtimes need it: this
# one, frontend/businessHost.js (the Node server, which decides what a Host
# header means) and frontend/src/utils/businessHost.js (the browser app).
# scripts/test-business-hosts.mjs fails if they differ.
RESERVED_SLUGS = frozenset("""
www admin api app mail smtp imap pop ftp cdn static assets media img
ns1 ns2 dns mx autodiscover autoconfig webmail dev staging test preview
blog help support docs status dashboard account accounts auth login
p og short link links go my me new signup register business businesses
properties property stays services requests jobs manager chat
""".split())

# A DNS label: lowercase letters, digits and inner hyphens, 1-60 long (the
# slug cap, under DNS's 63). `slugify` already produces exactly this shape;
# the pattern exists for addresses an OWNER types, which nothing normalises.
SLUG_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$")


def address_problem(candidate: str) -> str | None:
    """Why `candidate` cannot be a web address, or None if its SHAPE is fine.

    'invalid' or 'reserved'. Whether another business already holds it is a
    database question, answered by the caller.
    """
    if not SLUG_PATTERN.fullmatch(candidate or ""):
        return "invalid"
    if candidate in RESERVED_SLUGS:
        return "reserved"
    return None


def slug_change(biz: dict[str, Any], new_slug: str) -> dict[str, Any]:
    """The update that moves a business to `new_slug` and keeps the old one.

    Shared by rename and by the owner choosing an address, so there is one
    rule for what happens to a slug being replaced: it retires into
    `previous_slugs`, where `_resolve` still finds it and `unique_slug` will
    not hand it to anyone else. Capped at twenty, oldest dropped first.
    """
    old = biz.get("slug")
    update: dict[str, Any] = {"slug": new_slug}
    history = [x for x in (biz.get("previous_slugs") or []) if x != new_slug]
    if old and old != new_slug:
        history.append(old)
    update["previous_slugs"] = history[-20:]
    return update


def public_site_host() -> str:
    """The apex the subdomains hang off. Staging runs on a different host."""
    return (os.environ.get("PUBLIC_SITE_HOST") or "myisraelrental.com").strip().lower().rstrip(".")


def business_canonical_url(slug: str) -> str:
    """Where search engines should consolidate a business page.

    Two URLs serve the same page. Google treats a subdomain as largely a
    separate site, so authority earned by myisraelrental.com does not flow
    to it well; by default the canonical is therefore the PATH form, and the
    subdomain is the address people share. BUSINESS_CANONICAL=subdomain flips
    it, if a business address should one day rank on its own. The browser
    app reads the same decision from REACT_APP_BUSINESS_CANONICAL.
    """
    host = public_site_host()
    if (os.environ.get("BUSINESS_CANONICAL") or "path").strip().lower() == "subdomain":
        return f"https://{slug}.{host}/"
    return f"https://{host}/business/{slug}"


def slugify(name: str, *, fallback: str = "business") -> str:
    """A URL-safe slug for /business/{slug} (spec M4, used from M1 so the
    field is populated before the public page exists).

    Hebrew is transliterated by NOBODY here — a Hebrew name yields an empty
    ASCII slug, and rather than invent a romanisation we fall back to a
    short id. A wrong transliteration in a URL is permanent in a way an
    opaque slug is not.
    """
    ascii_only = re.sub(r"[^a-zA-Z0-9]+", "-", str(name or "")).strip("-").lower()
    ascii_only = re.sub(r"-{2,}", "-", ascii_only)[:60]
    return ascii_only or f"{fallback}-{uuid.uuid4().hex[:8]}"


async def unique_slug(name: str, *, exclude_id: str | None = None) -> str:
    """`slugify`, then made unique. Two movers both called "Cohen Movers"
    are a normal thing to happen, not an error.

    Uniqueness is checked against RETIRED slugs as well as live ones. A
    business that renames keeps its old slug as an alias so links already
    shared or printed on a QR keep resolving (see `previous_slugs`), and a
    new business allowed to claim that retired string would silently hijack
    every one of those links — the lookup would find two documents and
    return whichever came first.

    `exclude_id` is the business being renamed: its own slugs must not
    count as a clash with itself.

    Reserved words (RESERVED_SLUGS) count as taken, so "API Solutions"
    becomes api-solutions and a business called just "Admin" gets admin-2.
    """
    base = slugify(name)
    slug = base
    n = 2
    while True:
        if slug not in RESERVED_SLUGS:
            taken = {"$or": [{"slug": slug}, {"previous_slugs": slug}]}
            if exclude_id:
                taken = {"$and": [taken, {"_id": {"$ne": exclude_id}}]}
            if not await db.businesses.find_one(taken, {"_id": 1}):
                return slug
        slug = f"{base}-{n}"
        n += 1
        if n > 50:  # pathological; give up and use an opaque one
            return f"{base}-{uuid.uuid4().hex[:6]}"


def new_business_doc(
    owner_user_id: str,
    name: str,
    *,
    slug: str,
    description: str = "",
    categories: list[str] | None = None,
    areas: list[str] | None = None,
) -> dict[str, Any]:
    """The document shape, in one place so the migration and the runtime
    path cannot drift into producing different records."""
    now = datetime.now(UTC).isoformat()
    return {
        "_id": str(uuid.uuid4()),
        "owner_user_id": owner_user_id,
        "name": (name or "").strip() or "My business",
        # Filled by the bilingual pipeline, same as gigs and requests: the
        # side that is MISSING gets translated, whichever language it was
        # written in.
        "name_he": None,
        "name_en": None,
        "source_lang": None,
        "slug": slug,
        "logo_url": None,
        "description": description or "",
        "description_he": None,
        "description_en": None,
        "categories": categories or [],
        # Canonical LOCATION slugs — see shared.normalize_service_areas.
        "areas": areas or [],
        # Separate from `areas` rather than "all twelve cities": a new city
        # added to the catalogue should widen a nationwide business by
        # itself, and leave a city-list business exactly as its owner set
        # it. The two also read differently to a customer.
        "serves_nationwide": False,
        # Per business, not per person (spec M5). Verifying someone owns an
        # apartment says nothing about their trade licence. The user-level
        # verification stays where it is, for identity.
        "verified": False,
        "verified_at": None,
        # C6 — the facts that earn trust, kept OUT of the service list.
        # All optional, all absent by default: the band renders only what
        # a business has actually filled in, and nothing at all when it
        # has filled in none of it. Real data or no row.
        "hours": None,              # free text, e.g. "Sun-Thu 9:00-18:00"
        "languages": [],            # e.g. ["Hebrew", "English"]
        "founded_year": None,       # int; "years in business" is derived
        "delivery_note": None,      # areas served / how delivery works
        "lead_time": None,          # e.g. "48 hours notice"
        "payment_note": None,       # e.g. "Cash, Bit, bank transfer"
        # Certifying body plus optional logo and certificate image. In
        # Israel this is often the single most decisive fact on a food
        # business's page, and it deserves a real element rather than a
        # truncated row reading "Under the strict Hashgach…".
        "kosher_certification": None,
        "license_number": None,
        # K1/K2 — page identity. Both absent by default: the page is
        # designed to look finished with neither, and a business that
        # never opens the editor must look exactly as it did before
        # these existed.
        "cover_url": None,
        "accent": "stone",
        "payment_links": [],
        "active": True,
        "created_at": now,
        "updated_at": now,
    }


async def ensure_default_business(user_id: str, *, name: str | None = None) -> dict[str, Any]:
    """The user's default business, created on first use.

    Mirrors `_ensure_provider_record`: idempotent, called from the gig
    create path, and never raises just because a business already exists.

    The default name is the user's own name, which is exactly what their
    business is called today — so nothing changes visually for anyone until
    they rename it or add a second (spec M3).
    """
    existing = await db.businesses.find_one({"owner_user_id": user_id, "active": True})
    if existing:
        return existing

    if not name:
        user = await db.users.find_one({"id": user_id}) or await db.users.find_one({"_id": user_id})
        name = (user or {}).get("name") or "My business"

    doc = new_business_doc(user_id, name, slug=await unique_slug(name))
    await db.businesses.insert_one(doc)
    return doc

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

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from routes.deps import db

UTC = timezone.utc

# Five is a guess at "enough for a real person, few enough that the
# categories cannot be papered with near-identical shells" (spec M8).
MAX_BUSINESSES_PER_USER = 5


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


async def unique_slug(name: str) -> str:
    """`slugify`, then made unique. Two movers both called "Cohen Movers"
    are a normal thing to happen, not an error."""
    base = slugify(name)
    slug = base
    n = 2
    while await db.businesses.find_one({"slug": slug}, {"_id": 1}):
        slug = f"{base}-{n}"
        n += 1
        if n > 50:  # pathological; give up and use an opaque one
            return f"{base}-{uuid.uuid4().hex[:6]}"
    return slug


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
        "areas": areas or [],
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

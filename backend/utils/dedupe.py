"""Duplicate-listing detection.

A property is considered a duplicate when the **same owner** lists the
**same address** under the **same rental_type** AND the **same bedroom
count** AND the **same floor** twice. Cross-rental-type copies of one
apartment (e.g. an owner listing the same flat as both long-term and
vacation) are explicitly allowed — that's a common pattern for owners
who want max exposure across pricing models.

The bedroom + floor checks matter in cities like Jerusalem where owners
commonly have several units in the same building — without them, the
detector flagged distinct apartments (3BR top-floor + 2BR ground-floor
at the same street address) as duplicates.

The address comparison is whitespace-/case-normalized so trivial typos
("123  Main st" vs "123 Main St") still collapse to the same key.
"""
from __future__ import annotations

import re
from typing import Any

# Archived / cancelled rows are excluded from dedupe so a user who
# deactivates a listing can later re-create it cleanly.
_ACTIVE_STATUSES = ("active", "pending", "draft")


def normalize_address(addr: str | None) -> str | None:
    """Lowercase, trim, collapse runs of whitespace. Returns None for
    empty / blank inputs so we don't accidentally dedupe missing fields."""
    if not addr or not isinstance(addr, str):
        return None
    cleaned = re.sub(r"\s+", " ", addr).strip().lower()
    return cleaned or None


def _norm_int(v: Any) -> int | None:
    """Round-trip numeric-like values to int. Treats '', None, NaN, and
    unparseable strings as None so they DON'T act as wildcards — they
    explicitly mismatch any concrete value (we'd rather miss a real
    duplicate than flag two different-sized units in one building)."""
    if v is None or v == "":
        return None
    try:
        n = int(float(v))
    except (TypeError, ValueError):
        return None
    return n


def _norm_tags(tags: Any) -> tuple:
    """Normalize a holiday-tags input into a hashable, order-stable tuple.

    Accepts a list (`['sukkot']`), a comma-separated string (`'sukkot,pesach'`)
    or None. Returns `()` for "no holiday tags" so a listing without tags
    matches another tag-less listing but never matches a tagged one.
    """
    if tags is None:
        return ()
    if isinstance(tags, str):
        items = [t.strip().lower() for t in tags.split(",") if t.strip()]
    elif isinstance(tags, (list, tuple, set)):
        items = [str(t).strip().lower() for t in tags if str(t).strip()]
    else:
        return ()
    return tuple(sorted(set(items)))


def dedupe_signature(
    *,
    owner_id: str | None,
    address: str | None,
    rental_type: str | None,
    bedrooms: Any = None,
    floor: Any = None,
) -> tuple | None:
    """Composite key that two property docs must share to be considered
    duplicates. Returns None when the address / rental_type / owner
    fields aren't usable, so creates with missing data don't get blocked.

    Bedrooms and floor are part of the key so distinct apartments at
    the same street address (different unit in the same building) don't
    collide. ``None`` means "this listing didn't specify" — two such
    listings still match each other but never match a concrete value.

    NOTE: `holiday_tags` is intentionally NOT part of the signature.
    A single vacation listing can carry holiday pricing AND a regular
    nightly rate — the UI shows the right one based on whether the
    renter is browsing /vacation vs /sukkot. We don't want owners to
    end up with two near-identical listings just to capture holiday
    premium pricing.
    """
    norm = normalize_address(address)
    if not norm or not owner_id or not rental_type:
        return None
    return (
        owner_id,
        norm,
        rental_type,
        _norm_int(bedrooms),
        _norm_int(floor),
    )


async def find_duplicate(
    db,
    *,
    owner_id: str,
    address: str | None,
    rental_type: str | None,
    bedrooms: Any = None,
    floor: Any = None,
    exclude_property_id: str | None = None,
) -> dict | None:
    """Return the existing property document that would collide with the
    requested signature — or None if no collision. Pass `exclude_property_id`
    when updating an existing row so we don't flag the row against itself.
    """
    sig = dedupe_signature(
        owner_id=owner_id, address=address, rental_type=rental_type,
        bedrooms=bedrooms, floor=floor,
    )
    if sig is None:
        return None

    query: dict = {
        "owner_id": owner_id,
        "rental_type": rental_type,
        "status": {"$in": list(_ACTIVE_STATUSES)},
    }
    if exclude_property_id:
        query["id"] = {"$ne": exclude_property_id}

    candidates = await db.properties.find(
        query,
        {"_id": 0, "id": 1, "address": 1, "title": 1, "rental_type": 1,
         "bedrooms": 1, "floor": 1},
    ).to_list(500)
    for c in candidates:
        cand_sig = dedupe_signature(
            owner_id=owner_id, address=c.get("address"), rental_type=rental_type,
            bedrooms=c.get("bedrooms"), floor=c.get("floor"),
        )
        if cand_sig == sig:
            return c
    return None

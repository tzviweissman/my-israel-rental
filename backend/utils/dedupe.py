"""Duplicate-listing detection.

A property is considered a duplicate when the **same owner** lists the
**same address** under the **same rental_type** twice. Cross-rental-type
copies of one apartment (e.g. an owner listing the same flat as both
long-term and vacation) are explicitly allowed — that's a common pattern
for owners who want max exposure across pricing models.

The address comparison is whitespace-/case-normalized so trivial typos
("123  Main st" vs "123 Main St") still collapse to the same key.
"""
from __future__ import annotations

import re

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


async def find_duplicate(
    db,
    *,
    owner_id: str,
    address: str | None,
    rental_type: str | None,
    exclude_property_id: str | None = None,
) -> dict | None:
    """Return the existing property document that would collide with the
    requested (owner_id, address, rental_type) tuple — or None if no
    collision. Pass `exclude_property_id` when updating an existing row
    so we don't flag the row against itself.
    """
    norm = normalize_address(address)
    if not norm or not owner_id or not rental_type:
        # Without a normalized address + rental_type + owner there's no
        # safe dedupe key — fall back to "no duplicate" rather than
        # block legitimate creates.
        return None

    query: dict = {
        "owner_id": owner_id,
        "rental_type": rental_type,
        "status": {"$in": list(_ACTIVE_STATUSES)},
    }
    if exclude_property_id:
        query["id"] = {"$ne": exclude_property_id}

    # We can't store the normalized address pre-computed on every existing
    # doc without a migration, so we compare in-app. Properties-per-owner
    # is small (tens, not thousands), so the scan cost is negligible.
    candidates = await db.properties.find(query, {"_id": 0, "id": 1, "address": 1, "title": 1, "rental_type": 1}).to_list(500)
    for c in candidates:
        if normalize_address(c.get("address")) == norm:
            return c
    return None

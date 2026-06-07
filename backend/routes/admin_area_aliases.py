"""Admin CRUD for neighborhood aliases.

An "alias" maps a user-typed area variant (street name, colloquial form,
common typo) to a canonical neighborhood name. Both sides are stored
lower-cased so matching is robust.

Examples:
  alias="Levi Eshkol"      → canonical="Ramat Eshkol"
  alias="Lev Ha'Ir"        → canonical="City Center (Lev Ha'Ir)"

The merged map (static seed in ``utils/locations_catalog.py`` +
DB rows here) is used by ``utils/area_filter`` to widen the regex
match for the regular property search, Smart Lists, and saved-search
matching — so adding an alias here immediately affects all three
without a redeploy.

The ``GET .../suggestions`` endpoint scans the catalog for area values
that aren't recognised and proposes closest-match aliases, so admins
can clean up dozens of typos with one-click confirmations.
"""
from __future__ import annotations

import difflib
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, verify_token
from utils.area_filter import (
    canonicalize_area,
    invalidate_db_aliases,
    refresh_db_aliases,
)
from utils.locations_catalog import NEIGHBORHOOD_INDEX

router = APIRouter()
api_router = router


class AreaAlias(BaseModel):
    id: str
    alias: str
    canonical: str
    created_at: str


class AreaAliasCreate(BaseModel):
    alias: str = Field(min_length=1, max_length=120)
    canonical: str = Field(min_length=1, max_length=120)


class AreaAliasBulkCreate(BaseModel):
    items: list[AreaAliasCreate] = Field(min_length=1)


class AreaAliasBulkResult(BaseModel):
    created: list[AreaAlias]
    skipped: list[dict]  # {alias, reason}


class AreaAliasBulkDelete(BaseModel):
    ids: list[str] = Field(min_length=1)


def _require_admin(payload: dict) -> None:
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _to_out(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "alias": doc["alias"],
        "canonical": doc["canonical"],
        "created_at": doc["created_at"],
    }


@api_router.get("/admin/area-aliases", response_model=list[AreaAlias])
async def list_area_aliases(payload: dict = Depends(verify_token)) -> list[dict]:
    _require_admin(payload)
    docs = (
        await db.area_aliases.find({}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(500)
    )
    return [_to_out(d) for d in docs]


@api_router.post("/admin/area-aliases", response_model=AreaAlias)
async def create_area_alias(
    body: AreaAliasCreate,
    payload: dict = Depends(verify_token),
) -> dict:
    _require_admin(payload)
    alias = body.alias.strip()
    canonical = body.canonical.strip()
    if not alias or not canonical:
        raise HTTPException(status_code=400, detail="Alias and canonical are required")
    if alias.lower() == canonical.lower():
        raise HTTPException(
            status_code=400,
            detail="Alias must be different from the canonical neighborhood",
        )

    # Strip a city prefix from the canonical for cleaner matching
    # ("Jerusalem - Ramat Eshkol" → "Ramat Eshkol"). The lookup index
    # in area_filter is keyed by neighborhood only.
    canon_bare = canonical.split(" - ", 1)[1].strip() if " - " in canonical else canonical

    # Reject duplicates on the alias side (alias is the lookup key).
    existing = await db.area_aliases.find_one({"alias": alias.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail=f'Alias "{alias}" already exists')

    alias_id = str(uuid.uuid4())
    created_at = datetime.now(UTC).isoformat()
    doc = {
        "id": alias_id,
        # Persist user-facing strings *and* lower-cased keys. The matching
        # layer uses the lower-cased form; the API surfaces the display
        # form so the admin sees what they typed.
        "alias_display": alias,
        "canonical_display": canon_bare,
        "alias": alias.lower(),
        "canonical": canon_bare.lower(),
        "created_at": created_at,
        "created_by": payload.get("user_id"),
    }
    await db.area_aliases.insert_one(doc)
    invalidate_db_aliases()  # next search picks up the new alias immediately
    await refresh_db_aliases(db, force=True)

    return {
        "id": alias_id,
        "alias": alias,
        "canonical": canon_bare,
        "created_at": created_at,
    }


@api_router.delete("/admin/area-aliases/{alias_id}")
async def delete_area_alias(
    alias_id: str,
    payload: dict = Depends(verify_token),
) -> dict:
    _require_admin(payload)
    res = await db.area_aliases.delete_one({"id": alias_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alias not found")
    invalidate_db_aliases()
    await refresh_db_aliases(db, force=True)
    return {"message": "Alias deleted"}


@api_router.post(
    "/admin/area-aliases/bulk", response_model=AreaAliasBulkResult
)
async def bulk_create_area_aliases(
    body: AreaAliasBulkCreate,
    payload: dict = Depends(verify_token),
) -> dict:
    """Create many aliases at once. Powers the "Bulk Map ≥ 90%" button on
    the dashboard. Skips duplicates and same-alias-as-canonical rows
    silently (reported in ``skipped``) so a partially-clean batch still
    succeeds without an error toast for every conflict."""
    _require_admin(payload)
    created: list[dict] = []
    skipped: list[dict] = []
    now = datetime.now(UTC).isoformat()
    for item in body.items:
        alias = item.alias.strip()
        canonical = item.canonical.strip()
        if not alias or not canonical:
            skipped.append({"alias": alias, "reason": "empty"})
            continue
        if alias.lower() == canonical.lower():
            skipped.append({"alias": alias, "reason": "alias matches canonical"})
            continue
        canon_bare = (
            canonical.split(" - ", 1)[1].strip() if " - " in canonical else canonical
        )
        existing = await db.area_aliases.find_one(
            {"alias": alias.lower()}, {"_id": 0, "id": 1}
        )
        if existing:
            skipped.append({"alias": alias, "reason": "duplicate"})
            continue
        alias_id = str(uuid.uuid4())
        doc = {
            "id": alias_id,
            "alias_display": alias,
            "canonical_display": canon_bare,
            "alias": alias.lower(),
            "canonical": canon_bare.lower(),
            "created_at": now,
            "created_by": payload.get("user_id"),
        }
        await db.area_aliases.insert_one(doc)
        created.append(
            {
                "id": alias_id,
                "alias": alias,
                "canonical": canon_bare,
                "created_at": now,
            }
        )

    if created:
        invalidate_db_aliases()
        await refresh_db_aliases(db, force=True)

    return {"created": created, "skipped": skipped}


@api_router.post("/admin/area-aliases/bulk-delete")
async def bulk_delete_area_aliases(
    body: AreaAliasBulkDelete,
    payload: dict = Depends(verify_token),
) -> dict:
    """Undo for the bulk-create endpoint. Deletes only ids passed in — never
    touches anything else, so an undo can't accidentally wipe a long-standing
    alias the admin added manually."""
    _require_admin(payload)
    if not body.ids:
        return {"deleted": 0}
    res = await db.area_aliases.delete_many({"id": {"$in": body.ids}})
    if res.deleted_count:
        invalidate_db_aliases()
        await refresh_db_aliases(db, force=True)
    return {"deleted": res.deleted_count}


# ---------------------------------------------------------------------------
# Suggestions — scan catalog for unrecognised area values
# ---------------------------------------------------------------------------
class AliasSuggestion(BaseModel):
    unknown_value: str
    suggested_alias: str
    suggested_canonical: str
    suggested_canonical_full: str
    listing_count: int
    confidence: float


@api_router.get(
    "/admin/area-aliases/suggestions", response_model=list[AliasSuggestion]
)
async def suggest_area_aliases(
    payload: dict = Depends(verify_token),
    cutoff: float = 0.6,
) -> list[dict]:
    """Scan active properties and propose alias mappings for any ``area``
    value that doesn't currently resolve to a canonical neighborhood.

    Uses ``difflib`` for fuzzy matching against the canonical neighborhood
    list. Returns one suggestion per unique unknown value, sorted by listing
    count desc (so the most impactful fixes float to the top).
    """
    _require_admin(payload)

    areas = await db.properties.distinct(
        "area", {"status": "active", "area": {"$nin": [None, ""]}}
    )

    canonical_keys = list(NEIGHBORHOOD_INDEX.keys())
    suggestions: list[dict] = []
    seen: set[str] = set()
    for raw in areas:
        if not raw or raw in seen:
            continue
        seen.add(raw)
        # Already resolves cleanly (canonical, bare-known, or alias) → skip.
        if canonicalize_area(raw):
            continue

        # Strip city prefix if present so we fuzzy-match against neighborhood
        # names only.
        bare = raw.split(" - ", 1)[1].strip() if " - " in raw else raw.strip()
        bare_lower = bare.lower()
        # Strip trailing numbers (street addresses like "Levi Eshkol 12").
        # Helps "Jaffa Street 14" fuzzy-match "Jaffa Road".
        bare_clean = " ".join(
            tok for tok in bare_lower.split() if not tok.isdigit()
        )
        if not bare_clean:
            continue

        match = difflib.get_close_matches(
            bare_clean, canonical_keys, n=1, cutoff=cutoff
        )
        if not match:
            continue

        canon_key = match[0]
        city, neighborhood = NEIGHBORHOOD_INDEX[canon_key]
        confidence = difflib.SequenceMatcher(None, bare_clean, canon_key).ratio()
        count = await db.properties.count_documents(
            {"area": raw, "status": "active"}
        )
        suggestions.append(
            {
                "unknown_value": raw,
                "suggested_alias": bare,
                "suggested_canonical": neighborhood,
                "suggested_canonical_full": f"{city} - {neighborhood}",
                "listing_count": count,
                "confidence": round(confidence, 2),
            }
        )

    suggestions.sort(key=lambda s: (-s["listing_count"], -s["confidence"]))
    return suggestions

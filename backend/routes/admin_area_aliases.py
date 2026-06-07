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
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, verify_token
from utils.area_filter import invalidate_db_aliases, refresh_db_aliases

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

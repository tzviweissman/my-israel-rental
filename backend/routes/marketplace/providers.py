"""Marketplace catalog + provider profile endpoints.

Public read surface (categories, locations, languages, nearest-city,
public provider view) plus the authed provider self-update.

Extracted from ``marketplace.py`` in the 2026-07 refactor.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel  # noqa: F401 — kept for consistency w/ other admin modules

from routes.deps import db, verify_token

from .shared import (
    CATEGORIES,
    LOCATIONS,
    SUPPORTED_LANGUAGES,
    TOP_RATED_MIN_AVG,
    TOP_RATED_MIN_COUNT,
    ProviderPatch,
    _LANGUAGE_SET,
    _batch_rating_aggregate,
    _cheapest_tier_price,
    _clean_gig,
    _ensure_provider_record,
    _haversine_km,
    _member_since_year,
    _provider_is_active,
    _response_bucket,
)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

@router.get("/categories")
async def list_categories():
    return CATEGORIES



@router.get("/locations")
async def list_locations():
    """Return curated locations with a live count of published gigs
    matching each city (case-insensitive `area` substring). Cities with
    zero listings still ship so providers can see them as valid targets."""
    counts: dict[str, int] = {loc["slug"]: 0 for loc in LOCATIONS}
    # One aggregation across all published gigs — filter to active
    # providers inline so the counts match what the browse page shows.
    active_ids = {
        p["user_id"] async for p in db.marketplace_providers.find({}, {"user_id": 1, "subscription_status": 1, "trial_ends_at": 1, "active": 1})
        if _provider_is_active(p)
    }
    async for gig in db.marketplace_gigs.find(
        {"status": "published", "provider_user_id": {"$in": list(active_ids)}},
        {"area": 1},
    ):
        area = (gig.get("area") or "").lower()
        if not area:
            continue
        for loc in LOCATIONS:
            if loc["label"].lower() in area:
                counts[loc["slug"]] += 1
                break
    return [{**loc, "count": counts[loc["slug"]]} for loc in LOCATIONS]



@router.get("/languages")
async def list_languages():
    """Return the closed set of provider-language options — the frontend
    filter modal + edit-profile chips read from this to guarantee they
    stay in sync with the backend allowlist."""
    return SUPPORTED_LANGUAGES



@router.get("/nearest-city")
async def nearest_city(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    """Given renter coords, return the closest supported city from the
    LOCATIONS table. Frontend calls this right after the "Show nearby"
    opt-in so it can pre-select the corresponding location chip and
    give first-time visitors a zero-click browsing anchor. Returns
    `null` (204-ish) semantics via a small payload — cheaper than
    handling a 404 client-side."""
    best = None
    best_d = None
    for loc in LOCATIONS:
        d = _haversine_km((lat, lng), (loc["lat"], loc["lng"]))
        if best_d is None or d < best_d:
            best_d = d
            best = loc
    if not best:
        return {"slug": None, "label": None, "distance_km": None}
    return {"slug": best["slug"], "label": best["label"], "distance_km": best_d}



@router.get("/providers/{user_id}")
async def public_provider(user_id: str):
    prov = await db.marketplace_providers.find_one({"user_id": user_id})
    if not prov:
        raise HTTPException(status_code=404, detail="Provider not found")
    user = await db.users.find_one({"_id": user_id}) or await db.users.find_one({"id": user_id})
    cursor = db.marketplace_gigs.find({"provider_user_id": user_id, "status": "published"}).sort("created_at", -1)
    raw = [g async for g in cursor]
    ratings = await _batch_rating_aggregate([g["_id"] for g in raw])
    for g in raw:
        agg = ratings.get(g["_id"], {"rating_avg": None, "rating_count": 0})
        g["rating_avg"] = agg["rating_avg"]
        g["rating_count"] = agg["rating_count"]
        g["cheapest_price"] = _cheapest_tier_price(g)
        g["is_top_rated"] = (
            agg["rating_avg"] is not None
            and agg["rating_avg"] >= TOP_RATED_MIN_AVG
            and agg["rating_count"] >= TOP_RATED_MIN_COUNT
        )
    gigs = [_clean_gig(g) for g in raw]
    return {
        "user_id": user_id,
        "name": (user or {}).get("name", "Provider"),
        "bio": prov.get("bio", ""),
        "tagline": prov.get("tagline", ""),
        "avatar": prov.get("avatar"),
        "active": _provider_is_active(prov),
        "gigs": gigs,
        # Trust & Discovery
        "languages": prov.get("languages") or [],
        "credentials": prov.get("credentials", ""),
        "credential_docs": prov.get("credential_docs") or [],
        "response_bucket": _response_bucket(prov),
        "member_since_year": _member_since_year(user, prov),
    }



@router.patch("/providers/me")
async def update_provider(payload: ProviderPatch, user=Depends(verify_token)):
    await _ensure_provider_record(user["user_id"])
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "languages" in update:
        # Drop unknown language strings silently so a stale UI can't 400.
        update["languages"] = [lang for lang in update["languages"] if lang in _LANGUAGE_SET]
    if "credentials" in update:
        # Match the ReviewIn cap philosophy — cheap DoS protection on a
        # free-text field that renders publicly.
        update["credentials"] = update["credentials"][:2000]
    if "credential_docs" in update:
        # Coerce Pydantic → dict for Mongo, and cap at 8 docs so nobody
        # can dump their whole Google Drive here.
        update["credential_docs"] = [
            d if isinstance(d, dict) else d.model_dump()
            for d in update["credential_docs"][:8]
        ]
    await db.marketplace_providers.update_one({"user_id": user["user_id"]}, {"$set": update})
    prov = await db.marketplace_providers.find_one({"user_id": user["user_id"]})
    prov["id"] = prov.pop("_id")
    return prov



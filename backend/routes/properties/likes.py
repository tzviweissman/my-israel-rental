"""Renter "like" endpoints — toggle a like, fetch liked properties,
fetch just the ids for the UI's optimistic re-render.

Extracted from ``properties.py`` in the 2026-07 refactor.

Since 7 Oct 2026 (storefront phase 5) the same collection also holds saved
SERVICES AND PRODUCTS (marketplace gigs): rows with `gig_id` and no
`property_id`. Extended rather than duplicated, so account deletion
(admin/core.py, by user_id) clears both. Every property query here
therefore asks for rows that HAVE a property_id.
"""
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Body, Depends, HTTPException

from models_response import LikeToggleResponse, PropertyOut
from routes.deps import db, logger, verify_token
from utils.property_rows import keep_valid_property_rows

router = APIRouter()
api_router = router


@api_router.post("/properties/{property_id}/like", response_model=LikeToggleResponse)
async def toggle_like_property(property_id: str, payload: dict = Depends(verify_token)) -> dict:
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    existing_like = await db.liked_properties.find_one({
        "user_id": payload['user_id'],
        "property_id": property_id
    })

    if existing_like:
        await db.liked_properties.delete_one({"user_id": payload['user_id'], "property_id": property_id})
        return {"liked": False, "message": "Property removed from favorites"}
    else:
        await db.liked_properties.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": payload['user_id'],
            "property_id": property_id,
            "created_at": datetime.now(UTC).isoformat()
        })
        return {"liked": True, "message": "Property saved to favorites"}



@api_router.get("/liked-properties", response_model=list[PropertyOut])
async def get_liked_properties(payload: dict = Depends(verify_token)) -> list[dict]:
    likes = await db.liked_properties.find(
        {"user_id": payload['user_id'], "property_id": {"$exists": True}}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    property_ids = [like['property_id'] for like in likes]
    if not property_ids:
        return []

    properties = await db.properties.find(
        {"id": {"$in": property_ids}}, {"_id": 0}
    ).to_list(500)

    # One malformed liked property must not empty the whole Liked tab.
    properties = keep_valid_property_rows(properties, route="GET /liked-properties", logger=logger)

    # Preserve order from likes
    prop_map = {p['id']: p for p in properties}
    result = []
    for pid in property_ids:
        if pid in prop_map:
            prop_map[pid]['liked'] = True
            result.append(prop_map[pid])
    return result



@api_router.get("/liked-property-ids", response_model=list[str])
async def get_liked_property_ids(payload: dict = Depends(verify_token)) -> list[str]:
    likes = await db.liked_properties.find(
        {"user_id": payload['user_id'], "property_id": {"$exists": True}}, {"_id": 0, "property_id": 1}
    ).to_list(500)
    return [like['property_id'] for like in likes]


# ---------------------------------------------------------------- items

@api_router.post("/gigs/{gig_id}/save")
async def save_gig(gig_id: str, body: dict = Body(default={}), payload: dict = Depends(verify_token)) -> dict:
    """Save or unsave a service or product. `{"saved": true}` sets it (the
    save that completes after signing in must never undo one); no body
    toggles, like the heart does."""
    gig = await db.marketplace_gigs.find_one({"_id": gig_id, "status": "published"}, {"_id": 1})
    if not gig:
        raise HTTPException(status_code=404, detail="Not found")
    uid = payload["user_id"]
    have = await db.liked_properties.find_one({"user_id": uid, "gig_id": gig_id}, {"_id": 1})
    want = (not have) if "saved" not in (body or {}) else bool(body["saved"])
    if want and not have:
        await db.liked_properties.insert_one({"id": str(uuid.uuid4()), "user_id": uid, "gig_id": gig_id,
                                              "created_at": datetime.now(UTC).isoformat()})
    elif not want and have:
        await db.liked_properties.delete_one({"user_id": uid, "gig_id": gig_id})
    return {"saved": want}


@api_router.get("/saved-gig-ids", response_model=list[str])
async def saved_gig_ids(payload: dict = Depends(verify_token)) -> list[str]:
    rows = await db.liked_properties.find({"user_id": payload["user_id"], "gig_id": {"$exists": True}},
                                          {"_id": 0, "gig_id": 1}).to_list(500)
    return [r["gig_id"] for r in rows]


@api_router.get("/saved-gigs")
async def saved_gigs(payload: dict = Depends(verify_token)) -> list[dict]:
    """The person's saved services and products, newest first, as cards:
    only ones still published, with no contact details and the business
    they belong to (name and link)."""
    from routes.marketplace.businesses import _public_listing
    from utils import highlights as hl
    rows = await db.liked_properties.find({"user_id": payload["user_id"], "gig_id": {"$exists": True}},
                                          {"_id": 0, "gig_id": 1}).sort("created_at", -1).to_list(200)
    ids = [r["gig_id"] for r in rows]
    gigs = {g["_id"]: g async for g in db.marketplace_gigs.find({"_id": {"$in": ids}, "status": "published"})}
    biz_ids = list({g.get("business_id") for g in gigs.values() if g.get("business_id")})
    bizs = {b["_id"]: b async for b in db.businesses.find({"_id": {"$in": biz_ids}, "active": {"$ne": False}},
                                                       {"name": 1, "name_he": 1, "slug": 1, "categories": 1})}
    out = []
    for gid in ids:
        g = gigs.get(gid)
        if not g:
            continue
        b = bizs.get(g.get("business_id")) or {}
        item = _public_listing(dict(g))
        item["highlights"] = hl.visible(g.get("highlights"), hl.kind_of(g), hl.is_food([*(b.get("categories") or []), g.get("category")]))
        item["provider"] = {"name": b.get("name") or ""}
        item["business"] = {"name": b.get("name") or "", "name_he": b.get("name_he"), "slug": b.get("slug")}
        out.append(item)
    return out



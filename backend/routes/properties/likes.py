"""Renter "like" endpoints — toggle a like, fetch liked properties,
fetch just the ids for the UI's optimistic re-render.

Extracted from ``properties.py`` in the 2026-07 refactor.
"""
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException

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
        {"user_id": payload['user_id']}, {"_id": 0}
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
        {"user_id": payload['user_id']}, {"_id": 0, "property_id": 1}
    ).to_list(500)
    return [like['property_id'] for like in likes]



"""Auto-extracted from server.py during the 2026-04 refactor."""
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException

from models import SavedSearchCreate
from models_response import MessageResponse, SavedSearchCreateResponse, SavedSearchOut
from routes.deps import db, verify_token

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/saved-searches", response_model=SavedSearchCreateResponse)
async def create_saved_search(body: SavedSearchCreate, payload: dict = Depends(verify_token)) -> dict:
    """Renter subscribes to an availability alert for a given criteria+dates.
    Auto-expires after 60 days. Requires sign-in."""
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "email": 1, "name": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    filters = body.filters.model_dump()
    # Derive a name if the user didn't provide one
    name = body.name
    if not name:
        parts = []
        if filters.get("area"):
            parts.append(filters["area"])
        if filters.get("rental_type"):
            parts.append(filters["rental_type"].replace("-", " ").title())
        if filters.get("bedrooms_min"):
            parts.append(f"{filters['bedrooms_min']}+ BR")
        if filters.get("max_price"):
            parts.append(f"≤ {int(filters['max_price']):,}")
        if filters.get("start_date") and filters.get("end_date"):
            parts.append(f"{filters['start_date']} → {filters['end_date']}")
        name = " · ".join(parts) or "My alert"

    now = datetime.now(UTC)
    expires_at = now + timedelta(days=60)
    search_id = str(uuid.uuid4())

    # Dedupe: if the exact same filters already exist & are active, return it
    existing = await db.saved_searches.find_one({
        "user_id": payload['user_id'],
        "filters": filters,
        "active": True,
        "expires_at": {"$gt": now.isoformat()},
    }, {"_id": 0})
    if existing:
        return {"id": existing["id"], "message": "Alert already active", "existing": True}

    await db.saved_searches.insert_one({
        "id": search_id,
        "user_id": payload['user_id'],
        "email": user.get("email"),
        "user_name": user.get("name", ""),
        "name": name,
        "filters": filters,
        "date_fuzziness_days": int(body.date_fuzziness_days or 30),
        "active": True,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
    })
    return {"id": search_id, "message": "Alert saved", "expires_at": expires_at.isoformat()}



@api_router.get("/saved-searches", response_model=list[SavedSearchOut])
async def list_saved_searches(payload: dict = Depends(verify_token)) -> list[dict]:
    """List the current user's active saved searches (newest first)."""
    now = datetime.now(UTC).isoformat()
    rows = await db.saved_searches.find(
        {"user_id": payload['user_id'], "active": True, "expires_at": {"$gt": now}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    return rows



@api_router.delete("/saved-searches/{search_id}", response_model=MessageResponse)
async def delete_saved_search(search_id: str, payload: dict = Depends(verify_token)) -> dict:
    """Renter deletes (deactivates) a saved search."""
    search = await db.saved_searches.find_one({"id": search_id}, {"_id": 0})
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
    if search['user_id'] != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.saved_searches.delete_one({"id": search_id})
    return {"message": "Alert removed"}



# --- Liked Properties ---

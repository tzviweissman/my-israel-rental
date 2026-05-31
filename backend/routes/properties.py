"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from models import PropertyCreate
from models_response import (
    BulkEditResponse,
    ContractStatusResponse,
    IdMessageResponse,
    LikeToggleResponse,
    ManagerPropertiesResponse,
    MessageResponse,
    PropertyContractUploadResponse,
    PropertyOut,
)
from routes.deps import (
    ROOT_DIR,
    db,
    logger,
    verify_token,
)
from utils.dedupe import find_duplicate
from utils.email import (
    send_email,
)
from utils.events import publish
from utils.helpers import get_usd_ils_rate
from utils.saved_search import match_property_against_searches

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/properties", response_model=IdMessageResponse)
async def create_property(property_data: PropertyCreate, payload: dict = Depends(verify_token)) -> dict:
    # Block duplicate listings: same owner + same address + same rental_type
    # is a copy-paste mistake. Same address with a different rental_type
    # (e.g. long-term + vacation of the same flat) is intentionally allowed.
    dup = await find_duplicate(
        db,
        owner_id=payload['user_id'],
        address=property_data.address,
        rental_type=property_data.rental_type,
    )
    if dup:
        raise HTTPException(status_code=409, detail={
            "code": "DUPLICATE_LISTING",
            "message": (
                f"You already have this address listed as {property_data.rental_type}. "
                "Edit the existing listing, or list this apartment under a different rental type."
            ),
            "existing_property_id": dup["id"],
            "existing_title": dup.get("title"),
        })

    property_id = str(uuid.uuid4())
    property_doc = property_data.model_dump()
    property_doc['id'] = property_id
    property_doc['owner_id'] = payload['user_id']
    property_doc['created_at'] = datetime.now(UTC).isoformat()
    property_doc['views'] = 0
    property_doc['status'] = 'active'
    
    await db.properties.insert_one(property_doc)

    # Fire saved-search alerts (non-blocking)
    try:
        asyncio.create_task(match_property_against_searches(
            db, property_id, reason="new_listing", send_email_fn=send_email,
        ))
    except Exception as e:
        logger.warning(f"saved-search trigger failed (create): {e}")

    return {"id": property_id, "message": "Property created successfully"}


@api_router.get("/properties", response_model=list[PropertyOut])
async def get_properties(
    rental_type: str | None = None,
    holiday_tag: str | None = None,
    min_bedrooms: float | None = None,
    max_price: float | None = None,
    area: str | None = None,
    owner_id: str | None = None,
    min_price: float | None = None,
    currency: str | None = None,
    min_bathrooms: float | None = None,
    max_floor: float | None = None,
    min_porches: int | None = None,
    has_elevator: bool | None = None,
    condition: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None
) -> list[dict]:
    query: dict = {}
    if rental_type:
        query['rental_type'] = rental_type
    if holiday_tag:
        # Mongo array `$in`/contains — matches docs whose `holiday_tags`
        # array contains the requested value (e.g. "sukkot" or "pesach").
        query['holiday_tags'] = holiday_tag
    if min_bedrooms:
        query['bedrooms'] = {"$gte": min_bedrooms}
    if area:
        query['area'] = {"$regex": area, "$options": "i"}
    if owner_id:
        query['owner_id'] = owner_id
    if min_bathrooms:
        query['bathrooms'] = {"$gte": min_bathrooms}
    if max_floor is not None:
        query['floor'] = {"$lte": max_floor}
    if min_porches:
        query['porches'] = {"$gte": min_porches}
    if has_elevator is not None:
        query['has_elevator'] = has_elevator
    if condition:
        query['condition'] = condition
    
    properties = await db.properties.find(query, {"_id": 0}).to_list(1000)
    
    # Cross-currency price filtering
    if min_price or max_price:
        rate = await get_usd_ils_rate()
        filtered = []
        for p in properties:
            # Use whichever price the property has
            raw_price = p.get('monthly_price') or p.get('nightly_price') or 0
            prop_currency = p.get('currency', 'ILS')
            # Convert property price to the filter currency
            if currency and prop_currency != currency:
                if currency == 'USD' and prop_currency == 'ILS':
                    price_in_filter_currency = raw_price / rate
                elif currency == 'ILS' and prop_currency == 'USD':
                    price_in_filter_currency = raw_price * rate
                else:
                    price_in_filter_currency = raw_price
            else:
                price_in_filter_currency = raw_price
            if min_price and price_in_filter_currency < min_price:
                continue
            if max_price and price_in_filter_currency > max_price:
                continue
            filtered.append(p)
        properties = filtered
    
    # Filter out properties that have overlapping bookings for requested dates
    if date_from and date_to:
        booked_property_ids = set()
        overlapping_bookings = await db.bookings.find(
            {
                "status": {"$in": ["pending", "confirmed"]},
                "start_date": {"$lt": date_to},
                "end_date": {"$gt": date_from}
            },
            {"_id": 0, "property_id": 1}
        ).to_list(10000)
        for b in overlapping_bookings:
            booked_property_ids.add(b['property_id'])
        # Also check external iCal bookings
        external_overlaps = await db.external_bookings.find(
            {
                "start_date": {"$lt": date_to},
                "end_date": {"$gt": date_from}
            },
            {"_id": 0, "property_id": 1}
        ).to_list(10000)
        for b in external_overlaps:
            booked_property_ids.add(b['property_id'])
        # Admin manual blocks (indefinite => end_date is null; open-start => start_date is null)
        admin_blocks = await db.admin_blocks.find(
            {}, {"_id": 0, "property_id": 1, "start_date": 1, "end_date": 1}
        ).to_list(10000)
        for b in admin_blocks:
            bs = b.get('start_date') or '0000-01-01'
            be = b.get('end_date') or '9999-12-31'
            if bs < date_to and be > date_from:
                booked_property_ids.add(b['property_id'])
        properties = [p for p in properties if p['id'] not in booked_property_ids]
    
    return properties


@api_router.get("/properties/{property_id}", response_model=PropertyOut)
async def get_property(property_id: str) -> dict:
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    await db.properties.update_one({"id": property_id}, {"$inc": {"views": 1}})
    property_data['views'] = property_data.get('views', 0) + 1
    
    owner = await db.users.find_one({"id": property_data.get("owner_id")}, {"_id": 0, "name": 1, "email": 1})
    if owner:
        property_data['owner_name'] = owner.get('name', '')
        property_data['owner_email'] = owner.get('email', '')
    
    return property_data


@api_router.put("/properties/{property_id}", response_model=MessageResponse)
async def update_property(property_id: str, property_data: PropertyCreate, payload: dict = Depends(verify_token)) -> dict:
    existing = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if existing['owner_id'] != payload['user_id'] and payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")

    # Re-run dedupe in case the user changed the address or rental_type
    # of an existing row into something that collides with another listing
    # they own. Exclude the row being edited so it doesn't match itself.
    dup = await find_duplicate(
        db,
        owner_id=existing['owner_id'],
        address=property_data.address,
        rental_type=property_data.rental_type,
        exclude_property_id=property_id,
    )
    if dup:
        raise HTTPException(status_code=409, detail={
            "code": "DUPLICATE_LISTING",
            "message": (
                f"Another of your listings already uses this address as {property_data.rental_type}."
            ),
            "existing_property_id": dup["id"],
            "existing_title": dup.get("title"),
        })

    update_doc = property_data.model_dump()
    await db.properties.update_one({"id": property_id}, {"$set": update_doc})

    # Fire saved-search alerts when price drops or listing re-activates
    try:
        old_price = existing.get("monthly_price") or existing.get("nightly_price")
        new_price = update_doc.get("monthly_price") or update_doc.get("nightly_price")
        old_status = existing.get("status")
        new_status = update_doc.get("status", old_status)
        reason = None
        if old_status != "active" and new_status == "active":
            reason = "reactivated"
        elif old_price and new_price and float(new_price) < float(old_price):
            reason = "price_drop"
        if reason:
            asyncio.create_task(match_property_against_searches(
                db, property_id, reason=reason, send_email_fn=send_email,
            ))
    except Exception as e:
        logger.warning(f"saved-search trigger failed (update): {e}")

    return {"message": "Property updated successfully"}


@api_router.delete("/properties/{property_id}", response_model=MessageResponse)
async def delete_property(property_id: str, payload: dict = Depends(verify_token)) -> dict:
    existing = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if existing['owner_id'] != payload['user_id'] and payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Cascade: detach any active subleases that referenced this property so
    # they don't become dead links pointing to /property/<deleted-id>. They
    # remain visible as standalone listings on /sublease/<id>.
    await db.subleases.update_many(
        {"original_property_id": property_id},
        {"$set": {"original_property_id": None}},
    )
    await db.properties.delete_one({"id": property_id})
    return {"message": "Property deleted successfully"}


@api_router.post("/properties/{property_id}/cover", response_model=MessageResponse)
async def set_cover_image(
    property_id: str,
    body: dict,
    payload: dict = Depends(verify_token),
) -> dict:
    """Promote a single image URL to the cover slot (``images[0]``).

    Reorders the existing list — never adds, never deletes — so a malicious
    or stale client can't smuggle in a new URL via this endpoint. Returns
    400 if the URL isn't already attached to the property.
    """
    image_url = (body or {}).get("image_url")
    if not image_url:
        raise HTTPException(status_code=400, detail="image_url is required")

    existing = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Property not found")
    if existing.get("owner_id") != payload["user_id"] and payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    images = list(existing.get("images") or [])
    if image_url not in images:
        raise HTTPException(status_code=400, detail="image_url is not attached to this property")

    reordered = [image_url, *[u for u in images if u != image_url]]
    if reordered == images:
        return {"message": "Already the cover image"}

    await db.properties.update_one({"id": property_id}, {"$set": {"images": reordered}})
    await publish("invalidate", {"prefixes": ["/api/properties", "/api/admin/properties"]})
    return {"message": "Cover image updated"}


# ---------------------------------------------------------------------------
# Bulk Manager — host-side multi-property operations.
# Used by the "Bulk Manager" dashboard tab to patch shared fields across many
# owned listings at once, and to fan-out an uploaded photo set to several
# properties in a single round-trip.
# ---------------------------------------------------------------------------

# Whitelist of fields the Bulk Manager is permitted to set/update. Mirrors the
# editable surface of PropertyCreate; excludes server-managed fields like
# owner_id, status, images, videos, created_at, etc.
_BULK_EDITABLE_FIELDS: set[str] = {
    "title", "description", "rental_type", "property_type",
    "bedrooms", "bathrooms", "floor",
    "area", "address",
    "square_meters", "porch_square_meters", "porches",
    "has_elevator", "is_shabbat_elevator", "is_tama", "sukkah_compatible",
    "has_agent_fee", "agent_fee_price", "agent_fee_currency",
    "has_cleaning_fee", "cleaning_fee_price", "cleaning_fee_currency",
    "max_guests",
    "condition", "furniture_option", "amenities",
    "monthly_price", "nightly_price", "currency",
    "cancellation_policy", "custom_cancellation_policy",
    "available_from", "starting_date", "minimum_booking_days",
    "checkin_time", "checkout_time",
}


class BulkEditBody(BaseModel):
    property_ids: list[str]
    updates: dict
    # Optional: prefix to apply on top of each property's existing title.
    title_prefix: str | None = None
    # Optional: how to merge the `amenities` field — replace (default) or append.
    amenities_mode: str | None = "replace"
    # Optional: per-property update map ``{pid: {field: value, …}}`` used by
    # the Undo flow to restore each property's previous values in a single
    # round-trip. When set, the per-property values OVERRIDE the global
    # ``updates`` for that property; properties not listed fall back to the
    # global ``updates`` (so callers can mix modes if they ever need to).
    per_property_updates: dict[str, dict] | None = None


class BulkImagesBody(BaseModel):
    property_ids: list[str]
    image_urls: list[str]
    # If present, scope each url-list to a specific property id; takes
    # precedence over `image_urls` (which is the fan-out-to-all path).
    per_property: dict[str, list[str]] | None = None


def _filter_updates(updates: dict) -> dict:
    """Drop keys not in the editable whitelist; keep ``None``/``""`` so callers
    can intentionally clear a field."""
    return {k: v for k, v in updates.items() if k in _BULK_EDITABLE_FIELDS}


@api_router.post("/properties/bulk-edit", response_model=BulkEditResponse)
async def bulk_edit_properties(body: BulkEditBody, payload: dict = Depends(verify_token)) -> dict:
    """Patch a whitelisted set of fields across many owned properties.

    Returns ``snapshots`` for each successfully updated property so the
    frontend can offer a one-click Undo (re-POST the snapshots back here).
    """
    updates = _filter_updates(body.updates or {})
    has_prefix = bool((body.title_prefix or "").strip())
    per_prop_raw = body.per_property_updates or {}
    # Filter the per-property maps through the same whitelist; this keeps
    # the Undo path immune to any drift between client- and server-side
    # field lists, and stops malicious clients from sneaking in fields like
    # ``owner_id`` via the per-property channel.
    per_prop: dict[str, dict] = {pid: _filter_updates(d) for pid, d in per_prop_raw.items()}
    if not updates and not has_prefix and not any(per_prop.values()):
        raise HTTPException(status_code=400, detail="Nothing to update")
    if not body.property_ids:
        raise HTTPException(status_code=400, detail="No properties selected")

    is_admin = payload.get("role") == "admin"
    user_id = payload["user_id"]

    updated: list[dict] = []
    skipped: list[dict] = []

    for pid in body.property_ids:
        existing = await db.properties.find_one({"id": pid}, {"_id": 0})
        if not existing:
            skipped.append({"id": pid, "reason": "not_found"})
            continue
        if not is_admin and existing.get("owner_id") != user_id:
            skipped.append({"id": pid, "reason": "forbidden"})
            continue

        # Per-property override beats the global updates for the matching id.
        # When the per-property map for this id is empty (or absent), fall
        # back to the shared ``updates`` so call sites that mix modes still
        # work as expected.
        per_prop_patch = per_prop.get(pid)
        patch: dict[str, Any] = dict(per_prop_patch) if per_prop_patch else dict(updates)

        # If neither global nor per-property channel had anything for this
        # id and there's no title prefix, skip cleanly so we don't issue an
        # empty $set or fabricate an empty snapshot.
        if not patch and not has_prefix:
            skipped.append({"id": pid, "reason": "no_changes"})
            continue

        # Title prefix: prepended to the existing title once, idempotently.
        if has_prefix:
            prefix = (body.title_prefix or "").strip()
            current_title = patch.get("title", existing.get("title", ""))
            if not current_title.startswith(prefix):
                patch["title"] = f"{prefix} {current_title}".strip()

        # Amenities append-mode keeps existing amenities and unions the new set.
        if (body.amenities_mode == "append") and ("amenities" in patch):
            existing_amenities = existing.get("amenities") or []
            incoming = patch["amenities"] or []
            seen = set()
            merged: list[str] = []
            for a in [*existing_amenities, *incoming]:
                if a and a not in seen:
                    seen.add(a)
                    merged.append(a)
            patch["amenities"] = merged

        # Build a snapshot of the fields we're touching so Undo can revert
        # exactly those keys (and only those keys).
        snapshot = {k: existing.get(k) for k in patch.keys()}

        await db.properties.update_one({"id": pid}, {"$set": patch})

        updated.append({"id": pid, "snapshot": snapshot})

    if updated:
        await publish("invalidate", {"prefixes": ["/api/properties", "/api/admin/properties"]})

    return {"updated": updated, "skipped": skipped, "summary": {"updated": len(updated), "skipped": len(skipped)}}


@api_router.post("/properties/bulk-images", response_model=BulkEditResponse)
async def bulk_attach_images(body: BulkImagesBody, payload: dict = Depends(verify_token)) -> dict:
    """Append already-uploaded image URLs to one or many owned properties.

    Two modes:
      • ``image_urls``  – fan the same list out to every id in ``property_ids``.
      • ``per_property`` – {pid: [url, url, …]} for distinct sets per property.
    """
    if not body.property_ids:
        raise HTTPException(status_code=400, detail="No properties selected")

    is_admin = payload.get("role") == "admin"
    user_id = payload["user_id"]

    updated: list[dict] = []
    skipped: list[dict] = []

    for pid in body.property_ids:
        existing = await db.properties.find_one({"id": pid}, {"_id": 0})
        if not existing:
            skipped.append({"id": pid, "reason": "not_found"})
            continue
        if not is_admin and existing.get("owner_id") != user_id:
            skipped.append({"id": pid, "reason": "forbidden"})
            continue

        urls: list[str] = []
        if body.per_property and pid in body.per_property:
            urls = [u for u in body.per_property[pid] if u]
        else:
            urls = [u for u in (body.image_urls or []) if u]

        if not urls:
            skipped.append({"id": pid, "reason": "no_urls"})
            continue

        await db.properties.update_one({"id": pid}, {"$push": {"images": {"$each": urls}}})
        updated.append({"id": pid, "added": len(urls)})

    if updated:
        await publish("invalidate", {"prefixes": ["/api/properties", "/api/admin/properties"]})

    return {"updated": updated, "skipped": skipped, "summary": {"updated": len(updated), "skipped": len(skipped)}}


# --- Saved Searches (renter availability alerts) ---


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


@api_router.post("/properties/{property_id}/contract", response_model=PropertyContractUploadResponse)
async def upload_property_contract(
    property_id: str,
    file: UploadFile = File(...),
    payload: dict = Depends(verify_token)
) -> dict:
    """Upload contract for a property (owner/manager only)"""
    # Verify property exists and user is owner
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property_data['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if property is long-term or short-term
    rental_type = property_data.get('rental_type', '')
    if rental_type not in ['long-term', 'short-term']:
        raise HTTPException(status_code=400, detail="Contracts only available for long-term and short-term rentals")
    
    # Validate file type (PDF and image formats)
    ALLOWED_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif'
    ]
    if not file.content_type or file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF and image files (JPG, PNG, WEBP, HEIC) are allowed for contracts")
    
    # Save file
    UPLOAD_DIR = ROOT_DIR / "uploads"
    UPLOAD_DIR.mkdir(exist_ok=True)
    file_id = str(uuid.uuid4())
    
    # Get file extension from content type
    extension_map = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/heic': 'heic',
        'image/heif': 'heif'
    }
    ext = extension_map.get(file.content_type, 'pdf')
    filename = f"contract_{file_id}.{ext}"
    file_path = UPLOAD_DIR / filename
    
    size = 0
    MAX_CONTRACT_SIZE = 10 * 1024 * 1024  # 10MB
    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > MAX_CONTRACT_SIZE:
                f.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Contract file too large. Max 10MB")
            f.write(chunk)
    
    contract_url = f"/api/uploads/{filename}"
    
    # Update property with contract URL
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {
            "contract_url": contract_url,
            "contract_uploaded_at": datetime.now(UTC).isoformat()
        }}
    )

    # Retroactively send the contract to any already-confirmed bookings that
    # haven't had one yet (owner accepted the booking BEFORE uploading a contract)
    pending_bookings = await db.bookings.find({
        "property_id": property_id,
        "status": "confirmed",
        "contract_signed": {"$ne": True},
        "contract_sign_token": {"$in": [None, ""]},
    }, {"_id": 0}).to_list(500)

    notified_count = 0
    for bk in pending_bookings:
        sign_token = str(uuid.uuid4())
        await db.bookings.update_one(
            {"id": bk["id"]},
            {"$set": {
                "contract_sign_token": sign_token,
                "contract_sent_at": datetime.now(UTC).isoformat(),
                "contract_signed": False,
            }}
        )
        # Notify renter
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": bk["renter_id"],
            "type": "contract_pending",
            "booking_id": bk["id"],
            "property_id": property_id,
            "message": f"The owner has uploaded a contract for {property_data.get('title', 'your booking')}. Please sign it to finalize your rental.",
            "read": False,
            "created_at": datetime.now(UTC).isoformat(),
        })
        # Email the renter
        try:
            renter = await db.users.find_one({"id": bk["renter_id"]}, {"_id": 0, "email": 1, "name": 1})
            if renter and renter.get("email"):
                frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
                dashboard_link = f"{frontend}/dashboard?tab=bookings" if frontend else "/dashboard"
                html = f"""
                <p>Hi {renter.get('name','there')},</p>
                <p>The owner of <strong>{property_data.get('title', 'your rental')}</strong> has uploaded the rental contract.
                Please review and sign it to finalize your booking.</p>
                <p><a href="{dashboard_link}" style="background:#1E6A6A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">Open your dashboard to sign</a></p>
                """
                asyncio.create_task(send_email(
                    renter["email"],
                    f"Action needed: sign your rental contract — {property_data.get('title', 'My Israel Rental')}",
                    html,
                    tag="contract-pending",
                ))
        except Exception as e:
            logger.warning(f"Failed to queue contract-pending email for booking {bk['id']}: {e}")
        notified_count += 1

    return {
        "contract_url": contract_url,
        "message": "Contract uploaded successfully",
        "retroactive_notifications_sent": notified_count,
    }



@api_router.get("/properties/{property_id}/contract", response_model=ContractStatusResponse)
async def get_property_contract(property_id: str) -> dict:
    """Get contract details for a property"""
    property_data = await db.properties.find_one(
        {"id": property_id}, 
        {"_id": 0, "contract_url": 1, "contract_uploaded_at": 1, "rental_type": 1}
    )
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    return {
        "has_contract": bool(property_data.get('contract_url')),
        "contract_url": property_data.get('contract_url'),
        "uploaded_at": property_data.get('contract_uploaded_at'),
        "rental_type": property_data.get('rental_type')
    }



@api_router.delete("/properties/{property_id}/contract", response_model=MessageResponse)
async def delete_property_contract(property_id: str, payload: dict = Depends(verify_token)) -> dict:
    """Delete contract for a property"""
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property_data['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete file from disk
    if property_data.get('contract_url'):
        filename = property_data['contract_url'].split('/')[-1]
        file_path = ROOT_DIR / "uploads" / filename
        file_path.unlink(missing_ok=True)
    
    # Remove from database
    await db.properties.update_one(
        {"id": property_id},
        {"$unset": {"contract_url": "", "contract_uploaded_at": ""}}
    )
    
    return {"message": "Contract deleted successfully"}


@api_router.get("/manager/{manager_id}/properties", response_model=ManagerPropertiesResponse)
async def get_manager_properties(manager_id: str) -> dict:
    properties = await db.properties.find({"owner_id": manager_id}, {"_id": 0}).to_list(1000)
    manager = await db.users.find_one({"id": manager_id, "role": {"$in": ["manager", "owner"]}}, {"_id": 0, "password": 0})
    
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    
    return {
        "manager": manager,
        "properties": properties
    }


# --- Owner / Manager availability dashboard ---


@api_router.get("/owner/availability")
async def get_owner_availability(payload: dict = Depends(verify_token)) -> dict:
    """Per-property availability summary for the signed-in owner/manager.

    Returns one row per active listing with:
      - status:  'available' | 'booked' | 'upcoming'
      - current_until: ISO date the current booking ends (or null)
      - next_available: ISO date the property is next free
      - upcoming: list of confirmed/pending bookings in the next 365 days
      - vacant_days_next_90: integer count of vacant days in the next 90d
      - occupancy_pct_next_90: integer percentage 0–100

    The owner-facing UI uses this to spot soon-to-be-vacant units at a
    glance and plan re-listings / cleaning. Renters never hit this route.
    """
    if payload['role'] not in ('owner', 'manager', 'admin'):
        raise HTTPException(status_code=403, detail="Owners only")

    user_id = payload['user_id']
    today = datetime.now(UTC).date()
    horizon = today + timedelta(days=365)

    properties = await db.properties.find(
        {"owner_id": user_id, "status": {"$ne": "archived"}},
        {"_id": 0},
    ).to_list(2000)

    # One bulk query for all bookings on these properties; cheaper than
    # N round-trips when an owner has dozens of listings.
    prop_ids = [p['id'] for p in properties]
    bookings = await db.bookings.find(
        {
            "property_id": {"$in": prop_ids},
            "status": {"$in": ["pending", "confirmed"]},
            "end_date": {"$gte": today.isoformat()},
        },
        {"_id": 0, "property_id": 1, "start_date": 1, "end_date": 1,
         "status": 1, "renter_id": 1, "id": 1},
    ).to_list(5000)

    by_property: dict[str, list[dict]] = {}
    for b in bookings:
        by_property.setdefault(b['property_id'], []).append(b)

    rows: list[dict] = []
    for prop in properties:
        prop_bookings = sorted(
            by_property.get(prop['id'], []),
            key=lambda b: b['start_date'],
        )
        # Compute current status
        current = next(
            (b for b in prop_bookings
             if b['start_date'] <= today.isoformat() <= b['end_date']),
            None,
        )
        future = [b for b in prop_bookings if b['start_date'] > today.isoformat()]

        if current:
            status = 'booked'
            current_until = current['end_date']
            next_available = current['end_date']
            # If a back-to-back booking follows, push the first vacancy
            # past consecutive bookings.
            cursor = current['end_date']
            for fb in future:
                if fb['start_date'] <= cursor:
                    cursor = max(cursor, fb['end_date'])
                else:
                    break
            next_available = cursor
        elif future:
            status = 'upcoming'
            current_until = None
            next_available = today.isoformat()
        else:
            status = 'available'
            current_until = None
            next_available = today.isoformat()

        # 90-day occupancy slice — useful for planning resignaling
        window_end = today + timedelta(days=90)
        booked_days = 0
        for b in prop_bookings:
            try:
                bs = datetime.fromisoformat(b['start_date']).date()
                be = datetime.fromisoformat(b['end_date']).date()
            except (ValueError, TypeError):
                continue
            overlap_start = max(bs, today)
            overlap_end = min(be, window_end)
            if overlap_end >= overlap_start:
                booked_days += (overlap_end - overlap_start).days + 1
        booked_days = min(booked_days, 90)
        vacant_days = 90 - booked_days
        occupancy_pct = int(round(booked_days / 90 * 100))

        # Renter names for the upcoming list (lightweight enrichment)
        renter_ids = list({b['renter_id'] for b in prop_bookings if b.get('renter_id')})
        renters_map: dict[str, str] = {}
        if renter_ids:
            user_docs = await db.users.find(
                {"id": {"$in": renter_ids}},
                {"_id": 0, "id": 1, "name": 1, "email": 1},
            ).to_list(len(renter_ids))
            for u in user_docs:
                renters_map[u['id']] = u.get('name') or u.get('email') or 'Guest'

        upcoming = [
            {
                "id": b.get('id'),
                "start_date": b['start_date'],
                "end_date": b['end_date'],
                "status": b['status'],
                "renter_name": renters_map.get(b.get('renter_id', ''), 'Guest'),
            }
            for b in prop_bookings
            if b['end_date'] <= horizon.isoformat()
        ]

        rows.append({
            "property_id": prop['id'],
            "title": prop.get('title', ''),
            "area": prop.get('area', ''),
            "rental_type": prop.get('rental_type', ''),
            "bedrooms": prop.get('bedrooms'),
            "image": (prop.get('images') or [None])[0],
            "status": status,
            "current_until": current_until,
            "next_available": next_available,
            "upcoming": upcoming,
            "booked_days_next_90": booked_days,
            "vacant_days_next_90": vacant_days,
            "occupancy_pct_next_90": occupancy_pct,
        })

    return {"properties": rows, "total": len(rows)}

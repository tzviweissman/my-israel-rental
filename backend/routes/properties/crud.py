"""Property CRUD — create, update, delete, and cover-image endpoints.

Extracted from ``properties.py`` in the 2026-07 refactor.
"""
import asyncio
import os
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from models import PropertyCreate
from models_response import IdMessageResponse, MessageResponse
from routes.deps import ROOT_DIR, db, logger, verify_token
from utils.dedupe import find_duplicate
from utils.email import notify_renters_of_property_deletion, send_email
from utils.events import publish
from utils.helpers import get_usd_ils_rate
from utils.saved_search import match_property_against_searches

from .shared import _normalize_rental_types

router = APIRouter()
api_router = router


# ── Soft duplicate warning (pre-submit) ────────────────────────────────
# Called by AddPropertyModal as the host types their address, so we can
# nudge them BEFORE they submit if they already have an active listing
# at the same address + rental_type + bedroom count + floor. Purely
# advisory: the actual duplicate BLOCK still lives inside
# `create_property` below — this endpoint just surfaces the same
# information earlier in the flow.
# NOTE: intentionally not placed here — see `browse.py` for the route
# definition. Kept as a comment for grep-ability.



@api_router.post("/properties", response_model=IdMessageResponse)
async def create_property(property_data: PropertyCreate, payload: dict = Depends(verify_token)) -> dict:
    # Block duplicate listings: same owner + same address + same rental_type
    # + same bedrooms + same floor is a copy-paste mistake. Different
    # bedroom counts or floor numbers indicate distinct units in the same
    # building. Holiday pricing lives on the SAME listing (lump + per-night
    # toggle on the listing's edit page) so we don't split on holiday_tags.
    dup = await find_duplicate(
        db,
        owner_id=payload['user_id'],
        address=property_data.address,
        rental_type=property_data.rental_type,
        bedrooms=property_data.bedrooms,
        floor=getattr(property_data, "floor", None),
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
    # Normalize rental_types: always include the primary rental_type so
    # `rental_types` can be a single truth source for the multi-list filter.
    _normalize_rental_types(property_doc)

    await db.properties.insert_one(property_doc)

    # Kick off Nominatim geocoding in the background so the Stays map
    # can pin this property at street-level accuracy without slowing
    # down the create response. Fire-and-forget; if it fails or misses
    # we simply won't have coords, and the frontend falls back to the
    # area-centroid lookup or hides the pin.
    if property_data.address or property_data.area:
        from utils.geocode import geocode_property_bg
        asyncio.create_task(geocode_property_bg(
            property_id, property_data.address, property_data.area,
        ))

    # Fire saved-search alerts (non-blocking)
    try:
        asyncio.create_task(match_property_against_searches(
            db, property_id, reason="new_listing", send_email_fn=send_email,
        ))
    except Exception as e:
        logger.warning(f"saved-search trigger failed (create): {e}")

    return {"id": property_id, "message": "Property created successfully"}



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
        bedrooms=property_data.bedrooms,
        floor=getattr(property_data, "floor", None),
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
    _normalize_rental_types(update_doc)
    await db.properties.update_one({"id": property_id}, {"$set": update_doc})

    # Re-geocode when address / area changed. Keeping this in-place
    # (rather than only on create) is critical because owners often
    # correct the street name after listing — we want the map pin to
    # follow the fix without them having to know we're geocoding.
    if (
        update_doc.get("address") != existing.get("address")
        or update_doc.get("area") != existing.get("area")
    ):
        from utils.geocode import geocode_property_bg
        asyncio.create_task(geocode_property_bg(
            property_id, update_doc.get("address"), update_doc.get("area"),
        ))

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

    # If a surviving duplicate twin exists (same owner + address + rental_type
    # + bedrooms + floor), reattach every chat / booking / like / nudge /
    # block / sublease pointer to it BEFORE we delete this row. Without this,
    # deleting one of two duplicate listings would leave existing chats
    # opening to "Property not found" and lose any booking history. Same
    # logic the bulk dedupe resolver runs — extracted here so the everyday
    # "owner deletes one of their two duplicate cards" path is safe too.
    twin = await find_duplicate(
        db,
        owner_id=existing["owner_id"],
        address=existing.get("address"),
        rental_type=existing.get("rental_type"),
        bedrooms=existing.get("bedrooms"),
        floor=existing.get("floor"),
        exclude_property_id=property_id,
    )
    reattached = {"to": None, "messages": 0, "bookings": 0, "likes": 0,
                  "nudges": 0, "blocks": 0, "subleases": 0, "images_merged": 0}
    if twin:
        twin_id = twin["id"]
        reattached["to"] = twin_id
        # If both the loser and the twin have likes from the same user,
        # drop the loser-side like first so the update_many below doesn't
        # try to create a (user_id, property_id) pair that already exists.
        twin_likers = {
            row["user_id"]
            async for row in db.liked_properties.find(
                {"property_id": twin_id}, {"_id": 0, "user_id": 1}
            )
        }
        if twin_likers:
            await db.liked_properties.delete_many({
                "property_id": property_id,
                "user_id": {"$in": list(twin_likers)},
            })
        msgs_r = await db.messages.update_many(
            {"property_id": property_id}, {"$set": {"property_id": twin_id}}
        )
        bookings_r = await db.bookings.update_many(
            {"property_id": property_id}, {"$set": {"property_id": twin_id}}
        )
        likes_r = await db.liked_properties.update_many(
            {"property_id": property_id}, {"$set": {"property_id": twin_id}}
        )
        nudges_r = await db.chat_nudges.update_many(
            {"property_id": property_id}, {"$set": {"property_id": twin_id}}
        )
        blocks_r = await db.admin_blocks.update_many(
            {"property_id": property_id}, {"$set": {"property_id": twin_id}}
        )
        subleases_r = await db.subleases.update_many(
            {"original_property_id": property_id},
            {"$set": {"original_property_id": twin_id}},
        )
        reattached.update({
            "messages": msgs_r.modified_count,
            "bookings": bookings_r.modified_count,
            "likes": likes_r.modified_count,
            "nudges": nudges_r.modified_count,
            "blocks": blocks_r.modified_count,
            "subleases": subleases_r.modified_count,
        })

        # Rescue this row's images + videos into the twin (dedupe by URL,
        # twin's URLs first to preserve its cover choice, cap matches the
        # importer). Same pattern as the bulk duplicate resolver.
        twin_full = await db.properties.find_one(
            {"id": twin_id}, {"_id": 0, "images": 1, "videos": 1}
        ) or {}
        twin_imgs = list(twin_full.get("images") or [])
        twin_vids = list(twin_full.get("videos") or [])
        seen_imgs = {u for u in twin_imgs if u}
        seen_vids = {u for u in twin_vids if u}
        new_imgs = 0
        for u in (existing.get("images") or []):
            if u and u not in seen_imgs:
                twin_imgs.append(u)
                seen_imgs.add(u)
                new_imgs += 1
        for u in (existing.get("videos") or []):
            if u and u not in seen_vids:
                twin_vids.append(u)
                seen_vids.add(u)
        merged_imgs = twin_imgs[:30]
        merged_vids = twin_vids[:5]
        reattached["images_merged"] = max(0, len(merged_imgs) - len(twin_full.get("images") or []))
        if reattached["images_merged"] > 0 or len(merged_vids) > len(twin_full.get("videos") or []):
            needs_mirror = any(
                "cloudinary.com" not in (u or "") for u in merged_imgs + merged_vids
            )
            patch = {"images": merged_imgs, "videos": merged_vids}
            if needs_mirror:
                patch["mirror_pending"] = True
            await db.properties.update_one({"id": twin_id}, {"$set": patch})
    else:
        # No twin → detach subleases so they live on as standalone listings.
        # Matches the long-standing behavior; only changes when we DO find
        # a twin (above), where we re-point the subleases instead.
        await db.subleases.update_many(
            {"original_property_id": property_id},
            {"$set": {"original_property_id": None}},
        )

        # Property is truly going away — send a courtesy heads-up to any
        # renter left mid-conversation or with a pending booking, so
        # they're not stuck refreshing an inbox waiting on a reply that
        # will never come. Best-effort: failures are logged but never
        # block the delete. Only fires in the no-twin branch because
        # the twin branch above re-attaches every chat + booking, so
        # renters can still transact — nothing to notify about.
        try:
            summary = await notify_renters_of_property_deletion(existing)
            if summary["notified"]:
                logger.info(
                    "property-removed notice: emailed %d renter(s) after delete of %s",
                    summary["notified"], property_id,
                )
        except Exception as e:  # noqa: BLE001
            logger.error("property-removed notice failed for %s: %s", property_id, e)

    await db.properties.delete_one({"id": property_id})
    msg = "Property deleted successfully"
    if reattached["to"]:
        bits = []
        if reattached["messages"]:
            bits.append(f"{reattached['messages']} chats")
        if reattached["bookings"]:
            bits.append(f"{reattached['bookings']} bookings")
        if reattached["likes"]:
            bits.append(f"{reattached['likes']} likes")
        if reattached["images_merged"]:
            bits.append(f"{reattached['images_merged']} photos")
        if bits:
            msg = f"Deleted — moved {', '.join(bits)} to the duplicate twin."
    return {"message": msg, "reattached": reattached}



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



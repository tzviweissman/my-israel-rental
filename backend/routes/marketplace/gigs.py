"""Marketplace gig CRUD, browse, booking flow, and reviews.

The core "seller" surface — providers create/edit gigs here, buyers
browse the catalog and book, and both parties leave reviews.

Extracted from ``marketplace.py`` in the 2026-07 refactor.
"""
import asyncio
import os
import re
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel  # noqa: F401 — kept for consistency

from routes.deps import db, logger, verify_token

from .shared import (
    CATEGORIES,
    FRONTEND_URL,
    LOCATIONS,
    MIN_RESPONSES_FOR_BADGE,
    TOP_RATED_MIN_AVG,
    TOP_RATED_MIN_COUNT,
    UTC,
    BookingIn,
    BookingPatch,
    GigIn,
    GigPatch,
    ReviewIn,
    _LANGUAGE_SET,
    _LOCATION_BY_SLUG,
    _batch_rating_aggregate,
    _cheapest_tier_price,
    _clean_gig,
    _ensure_provider_record,
    _haversine_km,
    _member_since_year,
    _provider_is_active,
    _rating_aggregate,
    _resolve_gig_coords,
    _response_bucket,
    _update_response_ema,
    _validate_category,
)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

@router.get("/gigs")
async def list_gigs(
    category: Optional[str] = None,
    location: Optional[str] = None,
    q: Optional[str] = None,
    # Trust & Discovery filters — all optional. Defaults to previous behavior.
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    response_time: Optional[str] = Query(None, pattern="^(1h|24h)$"),
    languages: Optional[str] = None,                       # csv, e.g. "English,Hebrew"
    booking_mode: Optional[str] = Query(None, pattern="^(whatsapp|in_platform)$"),
    sort: Optional[str] = Query("match", pattern="^(match|rating|reviews|newest|price_asc|distance)$"),
    # Nearby-mode inputs. When both `lat` and `lng` are provided we embed
    # `distance_km` on each card + unlock the `sort=distance` option.
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    # Distance ceiling — silently ignored when lat/lng weren't supplied
    # (nothing to measure against). Gigs whose area can't be resolved to
    # coords are treated as unmatched.
    max_distance_km: Optional[float] = Query(None, ge=0, le=500),
    limit: int = Query(60, ge=1, le=200),
):
    query: dict[str, Any] = {"status": "published"}
    if category:
        _validate_category(category)
        query["category"] = category
    if location:
        # Case-insensitive substring match on the `area` field so a gig
        # tagged "Jerusalem, Old City" matches the "jerusalem" slug.
        loc = _LOCATION_BY_SLUG.get(location)
        if not loc:
            raise HTTPException(status_code=400, detail=f"Unknown location '{location}'")
        query["area"] = {"$regex": re.escape(loc["label"]), "$options": "i"}
    if q:
        # SEC-003: escape the user input so it's treated as a literal
        # substring, not a regex — prevents catastrophic-backtracking DoS
        # on this unauthenticated endpoint. Also cap the length to keep
        # the query size sane. Search across bilingual fields too so
        # Hebrew queries match `title_he` / `description_he`.
        needle = re.escape(q[:80])
        query["$or"] = [
            {"title":          {"$regex": needle, "$options": "i"}},
            {"description":    {"$regex": needle, "$options": "i"}},
            {"title_he":       {"$regex": needle, "$options": "i"}},
            {"description_he": {"$regex": needle, "$options": "i"}},
        ]
    if booking_mode:
        query["booking_mode"] = booking_mode

    # Fetch more than `limit` because the post-filters (rating floor,
    # price band, response bucket, languages) may prune the initial page
    # down below the requested count.
    fetch_multiplier = 3 if any(v is not None for v in (min_rating, min_price, max_price, response_time, languages)) else 1
    cursor = db.marketplace_gigs.find(query).sort("created_at", -1).limit(limit * fetch_multiplier)
    raw = [g async for g in cursor]

    # One providers lookup covers every gig, dedup'd by user_id.
    provider_ids = list({g.get("provider_user_id") for g in raw if g.get("provider_user_id")})
    provs = {
        p["user_id"]: p
        async for p in db.marketplace_providers.find({"user_id": {"$in": provider_ids}})
    }
    users = {
        (u.get("id") or u.get("_id")): u
        async for u in db.users.find({"$or": [{"id": {"$in": provider_ids}}, {"_id": {"$in": provider_ids}}]})
    }
    ratings = await _batch_rating_aggregate([g["_id"] for g in raw])

    language_filter = None
    if languages:
        wanted = {s.strip() for s in languages.split(",") if s.strip()}
        # Silently drop unknown languages so a stale frontend build doesn't 400.
        language_filter = wanted & _LANGUAGE_SET or None

    kept: list[dict[str, Any]] = []
    for gig in raw:
        prov = provs.get(gig.get("provider_user_id"))
        if not prov or not _provider_is_active(prov):
            continue  # Hide expired-trial providers from public browse.

        agg = ratings.get(gig["_id"], {"rating_avg": None, "rating_count": 0})
        # Rating floor — providers with 0 reviews are treated as passing
        # any min_rating filter set to 0, but pruned when min_rating > 0.
        if min_rating and (agg["rating_avg"] is None or agg["rating_avg"] < min_rating):
            continue

        cheapest = _cheapest_tier_price(gig)
        if min_price is not None and (cheapest is None or cheapest < min_price):
            continue
        if max_price is not None and (cheapest is None or cheapest > max_price):
            continue

        bucket = _response_bucket(prov)
        if response_time == "1h" and bucket != "1h":
            continue
        if response_time == "24h" and bucket not in ("1h", "24h"):
            continue

        prov_langs = prov.get("languages") or []
        if language_filter and not (language_filter & set(prov_langs)):
            continue

        user = users.get(gig.get("provider_user_id"))
        gig["provider"] = {
            "user_id": gig.get("provider_user_id"),
            "name": (user or {}).get("name", "Provider"),
            "avatar": prov.get("avatar"),
            "tagline": prov.get("tagline"),
            "languages": prov_langs,
            "response_bucket": bucket,
            "member_since_year": _member_since_year(user, prov),
        }
        gig["rating_avg"] = agg["rating_avg"]
        gig["rating_count"] = agg["rating_count"]
        gig["cheapest_price"] = cheapest
        gig["is_top_rated"] = (
            agg["rating_avg"] is not None
            and agg["rating_avg"] >= TOP_RATED_MIN_AVG
            and agg["rating_count"] >= TOP_RATED_MIN_COUNT
        )
        # Distance from the renter's coords — only computed when both
        # lat/lng were provided so we don't waste cycles on non-nearby
        # requests. Gigs without resolvable coords get `None`.
        if lat is not None and lng is not None:
            coords = _resolve_gig_coords(gig)
            gig["distance_km"] = _haversine_km((lat, lng), coords) if coords else None
            # Distance ceiling — drop gigs beyond the requested radius.
            # Unresolvable coords are pruned too (no way to promise the
            # renter it's within their walking/biking range).
            if max_distance_km is not None:
                if gig["distance_km"] is None or gig["distance_km"] > max_distance_km:
                    continue
        kept.append(gig)

    # Sort strategy — all sorts happen in Python since rating & price
    # aren't stored in the base gig doc.
    def _match_score(g: dict[str, Any]) -> tuple:
        # Higher score first → we negate so tuple sort ascending == best first.
        top = 1 if g.get("is_top_rated") else 0
        avg = g.get("rating_avg") or 0
        count = g.get("rating_count") or 0
        return (-top, -avg, -count, -_iso_ts(g.get("created_at")))

    def _iso_ts(iso: Any) -> float:
        try:
            return datetime.fromisoformat(iso).timestamp()
        except (TypeError, ValueError):
            return 0.0

    if sort == "rating":
        kept.sort(key=lambda g: (-(g.get("rating_avg") or 0), -(g.get("rating_count") or 0)))
    elif sort == "reviews":
        kept.sort(key=lambda g: -(g.get("rating_count") or 0))
    elif sort == "newest":
        kept.sort(key=lambda g: -_iso_ts(g.get("created_at")))
    elif sort == "price_asc":
        # Gigs without any pricing float to the end.
        kept.sort(key=lambda g: (g.get("cheapest_price") is None, g.get("cheapest_price") or 0))
    elif sort == "distance":
        # Silently degrades to `match` when no coords were supplied.
        if lat is not None and lng is not None:
            # Gigs whose area we couldn't resolve (distance_km == None)
            # bubble to the bottom of the nearby list.
            kept.sort(key=lambda g: (g.get("distance_km") is None, g.get("distance_km") or 0))
        else:
            kept.sort(key=_match_score)
    else:
        kept.sort(key=_match_score)

    return [_clean_gig(g) for g in kept[:limit]]



@router.post("/gigs")
async def create_gig(payload: GigIn, user=Depends(verify_token)):
    _validate_category(payload.category)
    if payload.booking_mode not in ("whatsapp", "in_platform"):
        raise HTTPException(status_code=400, detail="booking_mode must be 'whatsapp' or 'in_platform'")
    if payload.booking_mode == "whatsapp" and not (payload.whatsapp or "").strip():
        raise HTTPException(status_code=400, detail="WhatsApp number required for WhatsApp booking mode")
    # Service area is required — every published gig has to land in the
    # /services?nearby=1 discovery net. Free text so providers can add
    # neighborhoods after the city (e.g. "Tel Aviv, Florentin"), but the
    # head-of-string still has to resolve to something.
    if not (payload.area or "").strip():
        raise HTTPException(status_code=400, detail="Service area (city) is required")
    prov = await _ensure_provider_record(user["user_id"])
    now = datetime.now(UTC).isoformat()
    gig = {
        "_id": str(uuid.uuid4()),
        "provider_user_id": user["user_id"],
        "provider_id": prov["_id"],
        "title": payload.title.strip(),
        "title_he": (payload.title_he or "").strip() or None,
        "category": payload.category,
        "description": payload.description,
        "description_he": (payload.description_he or "").strip() or None,
        "tiers": [t.model_dump() for t in payload.tiers],
        "gallery": payload.gallery,
        "booking_mode": payload.booking_mode,
        "whatsapp": payload.whatsapp,
        "area": payload.area,
        "faqs": payload.faqs,
        "status": "published",
        "created_at": now,
        "updated_at": now,
    }
    await db.marketplace_gigs.insert_one(gig)
    # Kick off Nominatim geocoding in the background so /services?nearby=1
    # can sort/pin this gig with street-level precision rather than the
    # ~2 km city-center fallback. Fire-and-forget: the create response
    # returns immediately; the coords land on the doc within ~1s. If
    # Nominatim is down / rate-limited, the frontend simply falls back
    # to `resolveGigCoords` city-center pin.
    if (payload.area or "").strip():
        from utils.geocode import geocode_gig_area_bg
        asyncio.create_task(geocode_gig_area_bg(gig["_id"], payload.area))
    # Hebrew auto-translation — done inline so the response the provider
    # sees already has ``title_he`` / ``description_he`` populated. Adds
    # ~3-6 s to the publish latency (one Claude Sonnet round-trip per
    # missing field), but means a Hebrew renter loading the gig one
    # second later sees native Hebrew copy immediately. If the LLM call
    # fails we log and continue with English-only; better a working
    # publish than a hard failure on a nice-to-have translation.
    if not gig["title_he"] or not gig["description_he"]:
        from .shared import auto_translate_gig_inline
        translated = await auto_translate_gig_inline(
            gig["title"] if not gig["title_he"] else None,
            gig["description"] if not gig["description_he"] else None,
        )
        if translated:
            gig.update(translated)
            await db.marketplace_gigs.update_one({"_id": gig["_id"]}, {"$set": translated})
    return _clean_gig(gig)



@router.get("/gigs/{gig_id}")
async def get_gig(gig_id: str):
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    prov = await db.marketplace_providers.find_one({"user_id": gig["provider_user_id"]})
    user = await db.users.find_one({"_id": gig["provider_user_id"]}) \
        or await db.users.find_one({"id": gig["provider_user_id"]})
    gig["provider"] = {
        "user_id": gig["provider_user_id"],
        "name": (user or {}).get("name", "Provider"),
        "avatar": (prov or {}).get("avatar"),
        "tagline": (prov or {}).get("tagline"),
        "bio": (prov or {}).get("bio"),
        "active": _provider_is_active(prov or {}),
        # Trust & Discovery fields (Phase 3 UI consumes these).
        "languages": (prov or {}).get("languages") or [],
        "response_bucket": _response_bucket(prov or {}),
        "member_since_year": _member_since_year(user, prov),
        "credentials": (prov or {}).get("credentials", ""),
        "credential_docs": (prov or {}).get("credential_docs") or [],
    }
    agg = await _rating_aggregate(gig_id)
    gig["rating_avg"] = agg["rating_avg"]
    gig["rating_count"] = agg["rating_count"]
    gig["cheapest_price"] = _cheapest_tier_price(gig)
    gig["is_top_rated"] = (
        agg["rating_avg"] is not None
        and agg["rating_avg"] >= TOP_RATED_MIN_AVG
        and agg["rating_count"] >= TOP_RATED_MIN_COUNT
    )
    return _clean_gig(gig)



@router.patch("/gigs/{gig_id}")
async def patch_gig(gig_id: str, payload: GigPatch, user=Depends(verify_token)):
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["provider_user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your gig")
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "tiers" in update:
        update["tiers"] = [t if isinstance(t, dict) else t.model_dump() for t in update["tiers"]]
    if "category" in update:
        _validate_category(update["category"])
    update["updated_at"] = datetime.now(UTC).isoformat()
    await db.marketplace_gigs.update_one({"_id": gig_id}, {"$set": update})
    # If area changed, re-geocode in the background so distance sort
    # stays accurate. Compare against the pre-update value to skip the
    # network call when the field is unchanged.
    if "area" in update and (update["area"] or "").strip() and update["area"] != gig.get("area"):
        from utils.geocode import geocode_gig_area_bg
        asyncio.create_task(geocode_gig_area_bg(gig_id, update["area"]))
    # Refresh Hebrew copy inline whenever the English text changes so
    # the response we return already reflects the new Hebrew version.
    # Skipped when the provider is explicitly editing the Hebrew field
    # themselves (they're overriding the auto-translation on purpose).
    title_changed = "title" in update and update["title"] != gig.get("title")
    desc_changed = "description" in update and update["description"] != gig.get("description")
    override_title_he = "title_he" in update
    override_desc_he = "description_he" in update
    needs_title_tr = title_changed and not override_title_he
    needs_desc_tr = desc_changed and not override_desc_he
    if needs_title_tr or needs_desc_tr:
        from .shared import auto_translate_gig_inline
        translated = await auto_translate_gig_inline(
            update["title"] if needs_title_tr else None,
            update["description"] if needs_desc_tr else None,
        )
        if translated:
            await db.marketplace_gigs.update_one({"_id": gig_id}, {"$set": translated})
    fresh = await db.marketplace_gigs.find_one({"_id": gig_id})
    return _clean_gig(fresh)



@router.delete("/gigs/{gig_id}")
async def delete_gig(gig_id: str, user=Depends(verify_token)):
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["provider_user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your gig")
    await db.marketplace_gigs.delete_one({"_id": gig_id})
    return {"ok": True}



@router.get("/my-gigs")
async def my_gigs(user=Depends(verify_token)):
    cursor = db.marketplace_gigs.find({"provider_user_id": user["user_id"]}).sort("created_at", -1)
    out = [_clean_gig(g) async for g in cursor]
    prov = await db.marketplace_providers.find_one({"user_id": user["user_id"]})
    return {
        "gigs": out,
        "provider": {
            "subscription_status": (prov or {}).get("subscription_status", "trial"),
            "trial_ends_at": (prov or {}).get("trial_ends_at"),
            "subscribed_until": (prov or {}).get("subscribed_until"),
            "active": _provider_is_active(prov or {}),
        },
    }



@router.post("/gigs/{gig_id}/book")
async def book_gig(gig_id: str, payload: BookingIn, user=Depends(verify_token)):
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig.get("booking_mode") != "in_platform":
        raise HTTPException(status_code=400, detail="This gig only accepts WhatsApp bookings")
    booking = {
        "_id": str(uuid.uuid4()),
        "gig_id": gig_id,
        "provider_user_id": gig["provider_user_id"],
        "client_user_id": user["user_id"],
        "tier_name": payload.tier_name,
        "message": payload.message,
        "contact_email": payload.contact_email,
        "contact_phone": payload.contact_phone,
        "preferred_date": payload.preferred_date,
        "status": "pending",
        "created_at": datetime.now(UTC).isoformat(),
    }
    await db.marketplace_bookings.insert_one(booking)
    logger.info("[marketplace] booking created: gig=%s client=%s tier=%s", gig_id, user["user_id"], payload.tier_name)
    return {"ok": True, "booking_id": booking["_id"]}



@router.patch("/bookings/{booking_id}")
async def update_booking(booking_id: str, payload: BookingPatch, user=Depends(verify_token)):
    """Provider action on a pending booking. Feeds the response-time EMA
    on the first transition out of `pending`. Idempotent for subsequent
    updates (completed/cancelled don't re-fire the EMA)."""
    booking = await db.marketplace_bookings.find_one({"_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["provider_user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your booking")

    now = datetime.now(UTC)
    was_pending = booking.get("status") == "pending"
    update: dict[str, Any] = {"status": payload.status, "updated_at": now.isoformat()}
    if payload.reply:
        update["provider_reply"] = payload.reply[:2000]
    if was_pending and payload.status in ("accepted", "declined"):
        try:
            created = datetime.fromisoformat(booking["created_at"])
        except (KeyError, ValueError):
            created = now
        elapsed = (now - created).total_seconds() / 3600.0
        await _update_response_ema(user["user_id"], elapsed)
        update["responded_at"] = now.isoformat()

    await db.marketplace_bookings.update_one({"_id": booking_id}, {"$set": update})
    fresh = await db.marketplace_bookings.find_one({"_id": booking_id})
    fresh["id"] = fresh.pop("_id")
    return fresh



@router.get("/gigs/{gig_id}/reviews")
async def list_reviews(gig_id: str):
    """Public list of reviews for one gig. Attaches a lightweight
    reviewer snapshot (name) so the UI can render '★ 5.0 — from Sarah'
    without a second round-trip per row."""
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    cursor = db.marketplace_reviews.find({"gig_id": gig_id}).sort("created_at", -1)
    reviews = []
    async for r in cursor:
        client = await db.users.find_one({"_id": r["client_user_id"]}) \
            or await db.users.find_one({"id": r["client_user_id"]})
        reviews.append({
            "id": r["_id"],
            "gig_id": r["gig_id"],
            "client_user_id": r["client_user_id"],
            "client_name": (client or {}).get("name", "Client"),
            "rating": r["rating"],
            "comment": r.get("comment", ""),
            "created_at": r.get("created_at"),
            "updated_at": r.get("updated_at"),
        })
    agg = await _rating_aggregate(gig_id)
    return {"reviews": reviews, **agg}



@router.post("/gigs/{gig_id}/reviews")
async def upsert_review(gig_id: str, payload: ReviewIn, user=Depends(verify_token)):
    """Create or update the caller's review for a gig. Providers can't
    review their own gigs. One review per user per gig — a second POST
    updates the existing row (upsert semantics)."""
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["provider_user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="You cannot review your own gig")
    now = datetime.now(UTC).isoformat()
    existing = await db.marketplace_reviews.find_one({"gig_id": gig_id, "client_user_id": user["user_id"]})
    if existing:
        await db.marketplace_reviews.update_one(
            {"_id": existing["_id"]},
            {"$set": {"rating": payload.rating, "comment": payload.comment, "updated_at": now}},
        )
        review_id = existing["_id"]
    else:
        review_id = str(uuid.uuid4())
        await db.marketplace_reviews.insert_one({
            "_id": review_id,
            "gig_id": gig_id,
            "provider_user_id": gig["provider_user_id"],
            "client_user_id": user["user_id"],
            "rating": payload.rating,
            "comment": payload.comment,
            "created_at": now,
            "updated_at": now,
        })
    return {"ok": True, "review_id": review_id}



@router.delete("/gigs/{gig_id}/reviews/mine")
async def delete_my_review(gig_id: str, user=Depends(verify_token)):
    """Let the caller withdraw their review."""
    res = await db.marketplace_reviews.delete_one(
        {"gig_id": gig_id, "client_user_id": user["user_id"]},
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No review to delete")
    return {"ok": True}

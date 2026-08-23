"""Marketplace gig CRUD, browse, booking flow, and reviews.

The core "seller" surface — providers create/edit gigs here, buyers
browse the catalog and book, and both parties leave reviews.

Extracted from ``marketplace.py`` in the 2026-07 refactor.
"""
import asyncio
import os
import re
import uuid
from datetime import UTC, datetime, time, timedelta
from typing import Any, Optional
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from routes.deps import db, logger, verify_token
from utils.businesses import ensure_default_business

from .shared import (
    TOP_RATED_MIN_AVG,
    TOP_RATED_MIN_COUNT,
    UTC,
    BookingIn,
    BookingPatch,
    GigIn,
    GigPatch,
    ReviewIn,
    _search_clauses,
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
    _validate_subcategory,
)
from utils.user_contact import user_whatsapp
from utils.whatsapp_link import build_whatsapp_link

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

# Leads are bucketed by Israel's calendar day, matching short-link scans —
# the same reasoning as routes/short_links.py: the owner lives here.
_IL_TZ = ZoneInfo("Asia/Jerusalem")


def _admin_only(user: dict) -> None:
    """Mirror of the guard in jobs.py. Defined locally rather than
    imported to keep gigs.py from depending on a sibling router module."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")


class FeaturedIn(BaseModel):
    featured: bool

@router.get("/gigs")
async def list_gigs(
    category: Optional[str] = None,
    # Optional sub-bucket filter. Only applied when a top-level
    # category is also selected — narrows the match to gigs tagged
    # with this specific sub-bucket. Free-text values pass through
    # (a poster tagged "solar-panel-installation" still shows up
    # when the filter matches).
    subcategory: Optional[str] = None,
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
    # Date filter — YYYY-MM-DD. When set, appointment gigs are kept
    # only if their weekly_availability has a window on that weekday.
    # Store & deliverable gigs are considered always-available and pass
    # through untouched (they don't publish per-day schedules).
    available_on: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    # Editorially featured gigs only. Set by an admin, never by the
    # provider — see PATCH /gigs/{id}/featured. `featured=false` is
    # treated as "no filter" rather than "only unfeatured": nothing needs
    # to browse the un-featured set, and reading it that way would make a
    # stray `?featured=false` silently hide every featured gig.
    featured: Optional[bool] = None,
    limit: int = Query(60, ge=1, le=200),
):
    query: dict[str, Any] = {"status": "published"}
    if featured:
        query["featured"] = True
    if category:
        _validate_category(category)
        query["category"] = category
        # Subcategory only applies when scoping to a top-level category
        # — a global "?subcategory=plumbing" is meaningless.
        if subcategory:
            query["subcategory"] = subcategory
    if location:
        # Case-insensitive substring match on the `area` field so a gig
        # tagged "Jerusalem, Old City" matches the "jerusalem" slug.
        loc = _LOCATION_BY_SLUG.get(location)
        if not loc:
            raise HTTPException(status_code=400, detail=f"Unknown location '{location}'")
        query["area"] = {"$regex": re.escape(loc["label"]), "$options": "i"}
    if q:
        # Word-by-word rather than one substring, and shared with the
        # Requests board so both searches behave the same way. It fixes the
        # same misses here: "2 hour" never found "2-hour", and "three" and
        # "3" were different searches.
        #
        # SEC-003 still holds — _search_clauses re.escapes every alternative
        # it builds, so user input is never treated as a regex, and it caps
        # both the query length and the token count so a pathological query
        # cannot build a huge pipeline on this unauthenticated endpoint.
        clauses = _search_clauses(q)
        if clauses:
            query["$and"] = query.get("$and", []) + clauses
    if booking_mode:
        query["booking_mode"] = booking_mode

    # Resolve the date filter once, ahead of the per-gig loop. Any invalid
    # date has already been rejected by the query pattern regex, so this
    # `strptime` call cannot raise ValueError.
    available_weekday_key: Optional[str] = None
    if available_on:
        d = datetime.strptime(available_on, "%Y-%m-%d").date()
        # datetime.date.weekday(): Mon=0..Sun=6 — map to the schema keys
        # used by weekly_availability (sun/mon/…/sat).
        available_weekday_key = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][d.weekday()]

    # Fetch more than `limit` because the post-filters (rating floor,
    # price band, response bucket, languages, availability) may prune the
    # initial page down below the requested count.
    fetch_multiplier = 3 if any(v is not None for v in (min_rating, min_price, max_price, response_time, languages, available_weekday_key)) else 1
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

        # Date filter — only prunes appointment gigs. Store/deliverable
        # gigs are always considered available (no per-day schedule).
        if available_weekday_key and gig.get("gig_type") == "appointment":
            wa = gig.get("weekly_availability") or {}
            windows = wa.get(available_weekday_key) or []
            if not windows:
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
    _validate_subcategory(payload.category, payload.subcategory)
    if payload.booking_mode not in ("whatsapp", "in_platform"):
        raise HTTPException(status_code=400, detail="booking_mode must be 'whatsapp' or 'in_platform'")
    # Still required: choosing WhatsApp as the PREFERRED channel without a
    # number would offer a button that dials nothing. Other channels remain
    # available regardless, so this is not a dead end for the provider.
    if payload.booking_mode == "whatsapp" and not (payload.whatsapp or "").strip():
        raise HTTPException(status_code=400, detail="WhatsApp number required for WhatsApp booking mode")
    # Service area is required — every published gig has to land in the
    # /services?nearby=1 discovery net. Free text so providers can add
    # neighborhoods after the city (e.g. "Tel Aviv, Florentin"), but the
    # head-of-string still has to resolve to something.
    if not (payload.area or "").strip():
        raise HTTPException(status_code=400, detail="Service area (city) is required")
    # Type-specific content validation. Store gigs need at least one
    # product because there's literally nothing to show otherwise. For
    # deliverable/appointment gigs we don't require tiers up-front so
    # existing tests + legacy API clients that publish a "message me
    # for a quote" gig keep working. The wizard enforces tier presence
    # at UI level.
    if payload.gig_type == "store" and not payload.products:
        raise HTTPException(status_code=400, detail="Store gigs need at least one product")
    # A listing must show something. A photoless card is the single
    # biggest reason a business page reads as abandoned, and the fix that
    # actually works is not letting one be published in the first place.
    #
    # This does NOT hide or down-rank anything already live: spec S5 is
    # explicit that a business is never penalised for having no photo,
    # and listings created before this rule keep working untouched. The
    # requirement applies at the moment of creation, going forward.
    if not _has_any_photo(payload):
        raise HTTPException(
            status_code=400,
            detail="Add at least one photo — a listing without one is very hard to book.",
        )
    prov = await _ensure_provider_record(user["user_id"])
    # Every gig belongs to a business (spec M2). Today that is the one
    # created from the user's own name, so nothing looks different to
    # anyone until they rename it or add a second.
    #
    # NOTE the ownership key is still provider_user_id, deliberately —
    # business_id groups and displays, it does not authorise. Every check
    # at :419/:514 keeps working untouched.
    business = await ensure_default_business(user["user_id"])
    now = datetime.now(UTC).isoformat()
    gig = {
        "_id": str(uuid.uuid4()),
        "provider_user_id": user["user_id"],
        "provider_id": prov["_id"],
        "business_id": business["_id"],
        "title": payload.title.strip(),
        "title_he": (payload.title_he or "").strip() or None,
        "category": payload.category,
        "subcategory": (payload.subcategory or "").strip() or None,
        "description": payload.description,
        "description_he": (payload.description_he or "").strip() or None,
        "gig_type": payload.gig_type,
        "tiers": [t.model_dump() for t in payload.tiers],
        "products": [p.model_dump() for p in payload.products],
        "weekly_availability": (
            {d: [w.model_dump() for w in wins] for d, wins in payload.weekly_availability.items()}
            if payload.weekly_availability else None
        ),
        "slot_duration_minutes": payload.slot_duration_minutes if payload.gig_type == "appointment" else None,
        "enable_date_booking": bool(payload.enable_date_booking) if payload.gig_type == "deliverable" else False,
        "gallery": payload.gallery,
        "booking_mode": payload.booking_mode,
        "whatsapp_confirmed": bool(payload.whatsapp_confirmed),
        "contact_email": (payload.contact_email or "").strip() or None,
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
        # Fallback WhatsApp number for the contact CTA, mirroring
        # `owner_whatsapp` on GET /properties/{id}. A gig carries its own
        # per-gig `whatsapp` field (filled in the create wizard); this is
        # what we use when the provider picked WhatsApp booking mode but
        # left that field blank — we'd otherwise render a dead button.
        # Order: provider record → user account setting. Empty string when
        # neither is set, which tells the frontend to fall back to the
        # in-platform inquiry flow.
        #
        # Detail endpoint only — never added to the browse/list routes, so
        # the whole provider phonebook can't be scraped in one request.
        # The account-level half of this fallback read `whatsapp_number`,
        # which nothing writes — so a provider who set their number in
        # Settings still got the dead path. Resolved via utils.user_contact.
        "whatsapp": (
            ((prov or {}).get("whatsapp") or "").strip()
            or user_whatsapp(user)
        ),
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
    if "products" in update:
        update["products"] = [p if isinstance(p, dict) else p.model_dump() for p in update["products"]]
    if "weekly_availability" in update and update["weekly_availability"] is not None:
        update["weekly_availability"] = {
            d: [w if isinstance(w, dict) else w.model_dump() for w in (wins or [])]
            for d, wins in update["weekly_availability"].items()
        }
    if "category" in update:
        _validate_category(update["category"])
    # Re-validate subcategory on patch too so a malicious update
    # can't smuggle HTML or overlong strings past the create-time
    # guard. Uses the effective category (new value if being patched,
    # otherwise the existing one on the doc).
    if "subcategory" in update:
        effective_cat = update.get("category") or gig.get("category") or ""
        _validate_subcategory(effective_cat, update["subcategory"])
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



@router.patch("/gigs/{gig_id}/featured")
async def set_gig_featured(
    gig_id: str, payload: FeaturedIn, user=Depends(verify_token),
):
    """Flag a gig as editorially featured. **Admin only.**

    Deliberately a separate endpoint rather than a field on ``GigPatch``:
    that route authorises on ``provider_user_id == user_id``, so putting
    ``featured`` there would let every provider feature their own gig.
    "Featured" has to mean someone at MyIsraelRental chose it, or the
    "Featured near you" row on /services is just an unlabelled ad slot.

    Not gated on the subscription plan either — every listed provider is
    already paying, so a plan check would feature everyone.
    """
    _admin_only(user)
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    await db.marketplace_gigs.update_one(
        {"_id": gig_id},
        {"$set": {
            "featured": payload.featured,
            # Who and when, so a surprising front page can be traced back
            # to a decision rather than guessed at.
            "featured_by": user["user_id"] if payload.featured else None,
            "featured_at": datetime.now(UTC).isoformat() if payload.featured else None,
            "updated_at": datetime.now(UTC).isoformat(),
        }},
    )
    logger.info(
        "[marketplace] gig %s featured=%s by admin %s",
        gig_id, payload.featured, user["user_id"],
    )
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
            # Cancelling sets THIS field, not `subscription_status` — the
            # provider keeps paid-for access until the period ends. Without
            # it the dashboard cannot tell "active" from "cancelled, winding
            # down", so a successful cancel looked like nothing happened and
            # the Upgrade button never came back.
            "paypal_subscription_status": (prov or {}).get("paypal_subscription_status"),
            "cancelled_at": (prov or {}).get("cancelled_at"),
            # What they picked in the gig wizard, for "your plan starts on X".
            "selected_plan_key": (prov or {}).get("selected_plan_key"),
        },
    }



# ── Leads (L1 of docs/leads-and-views-spec.md) ────────────────────────────
#
# `lead_events` has been written since the WhatsApp redirect shipped, and
# until now nothing read it. This is the read side: the owner's own leads,
# nobody else's.
#
# Two things here are easy to get wrong and silently produce a plausible
# number:
#
# 1. `created_at` is stored as an ISO **string** (see the insert in
#    `contact_gig`), not a datetime. A datetime cutoff matches nothing and
#    returns a confident zero — the exact failure that made /admin/metrics
#    report 0 users in 30 days. Every cutoff below is a UTC ISO string, and
#    the writes are always `datetime.now(UTC).isoformat()`, so the `+00:00`
#    offset is uniform and lexical comparison is sound.
#
# 2. Days are ISRAEL calendar days, matching short_links. Slicing the first
#    ten characters off a UTC timestamp would be simpler and wrong: a tap at
#    23:30 in Jerusalem is 20:30 or 21:30 UTC the same day, but one at 01:00
#    is 22:00 UTC the day *before*, so a late-evening lead would land on
#    yesterday's bar.
LEADS_PERIOD_DAYS = 30

_LEAD_TYPES = ("whatsapp_click",)


def _il_day_window(days: int) -> tuple[str, list[str]]:
    """(UTC ISO cutoff, list of Israel day keys oldest-first) for `days` days."""
    today = datetime.now(_IL_TZ).date()
    start_day = today - timedelta(days=days - 1)
    # Midnight in Israel on the first day of the window, expressed in UTC —
    # so it can be compared against the stored UTC ISO strings.
    start_il = datetime.combine(start_day, time.min, tzinfo=_IL_TZ)
    cutoff = start_il.astimezone(UTC).isoformat()
    keys = [(start_day + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    return cutoff, keys


def _il_day_of(created_at: str) -> Optional[str]:
    """The Israel calendar day an ISO timestamp falls on, or None if unparseable."""
    try:
        dt = datetime.fromisoformat(created_at)
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:          # tolerate a naive legacy row
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(_IL_TZ).strftime("%Y-%m-%d")


@router.get("/leads/summary")
async def leads_summary(
    business_id: Optional[str] = Query(None),
    user=Depends(verify_token),
):
    """How many people tried to make contact, for the caller's own listings.

    Scoped by `provider_id`, which the redirect denormalises off the gig, so
    this cannot read another provider's leads even if they share a business.

    `business_id` narrows every number in the response, not just the
    breakdown. The services dashboard is entered through one business, and a
    whole-account headline sitting above a single business's rows would
    invite exactly the wrong reading.

    `lead_events` stores no business_id — only the gig — so scoping resolves
    the business's gigs first. One consequence worth knowing: a tap against a
    since-deleted gig cannot be attributed to a business, so it counts in the
    unfiltered view and not in a filtered one.
    """
    provider_id = user["user_id"]
    base = {"provider_id": provider_id, "type": {"$in": list(_LEAD_TYPES)}}

    if business_id:
        owned = await db.marketplace_gigs.find(
            # provider_user_id as well as business_id: business_id groups and
            # displays, it does not authorise (see create_gig).
            {"business_id": business_id, "provider_user_id": provider_id},
            {"_id": 1},
        ).to_list(None)
        gig_ids = [g["_id"] for g in owned]
        if not gig_ids:
            return {
                "total": 0, "period_days": LEADS_PERIOD_DAYS, "period_total": 0,
                "daily": [{"date": k, "count": 0} for k in _il_day_window(LEADS_PERIOD_DAYS)[1]],
                "since": None, "by_gig": [],
            }
        base["gig_id"] = {"$in": gig_ids}

    total = await db.lead_events.count_documents(base)

    # When counting began — for THIS provider, not the platform. Without it
    # "3 leads" reads as a verdict on the listing rather than on a window we
    # only started measuring recently.
    # Returned as an Israel calendar date (YYYY-MM-DD), matching the keys in
    # `daily` — one date convention across the whole payload. Also what the
    # frontend's formatDate() can actually parse: hand it a full timestamp
    # and it falls back to printing the raw ISO string at the reader.
    since = None
    first = await db.lead_events.find(base, {"created_at": 1}).sort("created_at", 1).limit(1).to_list(1)
    if first:
        since = _il_day_of(first[0].get("created_at"))

    cutoff, day_keys = _il_day_window(LEADS_PERIOD_DAYS)
    buckets = {k: 0 for k in day_keys}
    per_gig: dict[str, int] = {}
    period_total = 0

    cursor = db.lead_events.find(
        {**base, "created_at": {"$gte": cutoff}},
        {"created_at": 1, "gig_id": 1},
    )
    async for ev in cursor:
        day = _il_day_of(ev.get("created_at"))
        # A row can sit just outside the window after the UTC→Israel shift;
        # count it in the period total only if it lands on a day we render.
        if day not in buckets:
            continue
        buckets[day] += 1
        period_total += 1
        gid = ev.get("gig_id")
        if gid:
            per_gig[gid] = per_gig.get(gid, 0) + 1

    # Name the listings. Only the caller's own, and only ones that still
    # exist — a lead against a deleted gig still counts in the total but has
    # no row to show, which is honest: the contact happened.
    by_gig = []
    if per_gig:
        gig_query = {"_id": {"$in": list(per_gig)}, "provider_user_id": provider_id}
        if business_id:
            gig_query["business_id"] = business_id
        cursor = db.marketplace_gigs.find(gig_query, {"title": 1, "business_id": 1})
        async for g in cursor:
            by_gig.append({
                "gig_id": g["_id"],
                "title": g.get("title") or "",
                "business_id": g.get("business_id"),
                "count": per_gig.get(g["_id"], 0),
            })
        by_gig.sort(key=lambda r: (-r["count"], r["title"]))

    return {
        "total": total,
        "period_days": LEADS_PERIOD_DAYS,
        "period_total": period_total,
        # Same shape as short_links' `daily`, so ScanChart renders it as-is.
        "daily": [{"date": k, "count": buckets[k]} for k in day_keys],
        "since": since,
        "by_gig": by_gig,
    }


@router.post("/gigs/{gig_id}/book")
async def book_gig(gig_id: str, payload: BookingIn, user=Depends(verify_token)):
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    # Store gigs use direct messaging only — no calendar / no tier booking.
    if (gig.get("gig_type") or "deliverable") == "store":
        raise HTTPException(status_code=400, detail="Store gigs do not accept bookings — message the seller directly")
    if gig.get("booking_mode") != "in_platform":
        raise HTTPException(status_code=400, detail="This gig only accepts WhatsApp bookings")
    # Appointment gigs require an explicit time slot so the calendar can
    # be enforced. Deliverable gigs may optionally include a preferred
    # date if the provider enabled `enable_date_booking`.
    if (gig.get("gig_type") or "deliverable") == "appointment" and not payload.time_slot:
        raise HTTPException(status_code=400, detail="Please pick an available time slot")
    # S0 — a held booking removes its span from availability. Enforced
    # HERE and not only by hiding the slot: hiding is a courtesy, and two
    # people pressing send at the same moment both saw it available.
    duration = _booking_duration(gig, payload.tier_name)
    if payload.time_slot and payload.preferred_date:
        start = _minutes(payload.time_slot)
        if start is None:
            raise HTTPException(status_code=400, detail="Invalid time slot")
        taken = (await _busy_spans(gig_id, gig.get("provider_user_id"), payload.preferred_date)).get(payload.preferred_date, [])
        if _overlaps(start, start + duration, taken):
            # 409 rather than 400: the request was well formed, someone
            # else simply got there first, and the client should refresh
            # the picker rather than correct the input.
            raise HTTPException(
                status_code=409,
                detail="That time has just been taken — please pick another.",
            )

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
        "time_slot": payload.time_slot,
        # Frozen at creation — see _booking_duration.
        "duration_minutes": duration,
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





def _has_any_photo(payload_or_doc: Any) -> bool:
    """Does this listing carry at least one image, anywhere?

    Checked across all three places a photo can live — the gig gallery,
    a product, or a tier — because a store that photographed each product
    and a barber who photographed each tier have both done the thing we
    are asking for, and only the gig-level gallery being empty is not a
    reason to refuse them.
    """
    def _g(obj, key, default=None):
        return obj.get(key, default) if isinstance(obj, dict) else getattr(obj, key, default)

    if _g(payload_or_doc, "gallery") or []:
        return True
    for prod in _g(payload_or_doc, "products") or []:
        if _g(prod, "image") or (_g(prod, "images") or []):
            return True
    for tier in _g(payload_or_doc, "tiers") or []:
        if _g(tier, "images") or []:
            return True
    return False


# --------------------------------------------------------------------------
# Slot holds (spec S0)
# --------------------------------------------------------------------------

# A booking in one of these states occupies its time. `declined` and
# `cancelled` free it immediately; `completed` is in the past and cannot
# collide with a future request. Kept as one constant because the test
# is made in three places and getting it wrong in any of them silently
# double-books.
HELD_STATUSES = ("pending", "accepted")


def _minutes(hhmm: str) -> Optional[int]:
    try:
        h, m = str(hhmm).split(":")
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return None


def _booking_duration(gig: dict[str, Any], tier_name: Optional[str]) -> int:
    """How long a booking of this tier occupies.

    Resolved ONCE, at creation, and frozen onto the booking. Reading it
    back off the tier at display time — which is what the page does
    today — means renaming a tier or changing its length silently
    rewrites how long every past booking took.
    """
    for t in gig.get("tiers") or []:
        if t.get("name") == tier_name and t.get("duration_minutes"):
            return int(t["duration_minutes"])
    return int(gig.get("slot_duration_minutes") or 30)


async def _busy_spans(
    gig_id: str,
    provider_user_id: Optional[str] = None,
    date_iso: Optional[str] = None,
) -> dict[str, list[tuple[int, int]]]:
    """Every occupied [start, end) minute range per date.

    Two sources, deliberately merged here rather than checked separately
    by each caller: bookings held against THIS gig, and time the owner
    has blocked out (spec S3a).

    Blocks are per PERSON, not per gig. Someone at a wedding is not
    available for any of the things they offer, and blocking each listing
    separately would be busywork that guarantees one gets forgotten.
    """
    query: dict[str, Any] = {"gig_id": gig_id, "status": {"$in": list(HELD_STATUSES)}}
    if date_iso:
        query["preferred_date"] = date_iso
    spans: dict[str, list[tuple[int, int]]] = {}
    async for b in db.marketplace_bookings.find(
        query, {"preferred_date": 1, "time_slot": 1, "duration_minutes": 1, "_id": 0},
    ):
        day = b.get("preferred_date")
        start = _minutes(b.get("time_slot"))
        if not day or start is None:
            continue
        # Bookings written before durations were frozen fall back to the
        # gig's own slot length rather than being treated as zero-length,
        # which would leave them bookable over.
        end = start + int(b.get("duration_minutes") or 30)
        spans.setdefault(day, []).append((start, end))

    if provider_user_id:
        bq: dict[str, Any] = {"provider_user_id": provider_user_id}
        if date_iso:
            bq["date"] = date_iso
        async for blk in db.marketplace_blocks.find(
            bq, {"date": 1, "start_time": 1, "end_time": 1, "_id": 0},
        ):
            day = blk.get("date")
            start = _minutes(blk.get("start_time"))
            end = _minutes(blk.get("end_time"))
            if not day or start is None or end is None or end <= start:
                continue
            spans.setdefault(day, []).append((start, end))

    return spans


def _overlaps(start: int, end: int, taken: list[tuple[int, int]]) -> bool:
    return any(start < t_end and t_start < end for t_start, t_end in taken)



async def ensure_booking_indexes() -> None:
    """Make the one-booking-per-slot rule a database guarantee.

    The check in book_gig is check-then-insert, which is racy exactly
    where exclusivity is promised: two requests can both read "free" and
    both write. This index makes the second write fail instead.

    PARTIAL, filtered to held statuses, so a declined or cancelled
    booking does not reserve its slot forever — the same reason
    HELD_STATUSES exists. Same guarantee, and the same reasoning, as the
    unique index on short-link slugs.

    Failure is logged and swallowed. An index that cannot be built —
    usually because existing rows already collide — must not stop the
    API from starting; the application-level check still holds, and a
    silent double-booking is a smaller emergency than an outage.
    """
    try:
        await db.marketplace_bookings.create_index(
            [("gig_id", 1), ("preferred_date", 1), ("time_slot", 1)],
            name="uniq_held_slot",
            unique=True,
            partialFilterExpression={"status": {"$in": list(HELD_STATUSES)}},
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("could not create uniq_held_slot index: %s", e)


# --------------------------------------------------------------------------
# Blocked time (spec S3a)
# --------------------------------------------------------------------------

class BlockIn(BaseModel):
    """A stretch of time the owner is not available.

    Held against the PERSON rather than a listing: someone at a wedding
    is unavailable for everything they offer, and asking them to block
    each listing separately guarantees one gets missed.

    Date and time are the same naive local strings bookings already use,
    so the two can be compared without converting between formats. That
    is a compromise inherited from the booking model, not a good idea on
    its own - see the timezone note in docs/booking-slots-spec.md.
    """
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: str = Field("00:00", pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field("23:59", pattern=r"^\d{2}:\d{2}$")
    note: str = Field("", max_length=200)


@router.get("/blocks")
async def list_blocks(user=Depends(verify_token)):
    """This person's blocked time, soonest first.

    Past blocks are dropped: they cannot affect a future booking, and a
    list that grows forever becomes one nobody reads.
    """
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    rows = [
        b async for b in db.marketplace_blocks.find(
            {"provider_user_id": user["user_id"], "date": {"$gte": today}},
        ).sort("date", 1)
    ]
    for r in rows:
        r["id"] = r.pop("_id")
    return rows


@router.post("/blocks")
async def create_block(payload: BlockIn, user=Depends(verify_token)):
    if _minutes(payload.end_time) <= _minutes(payload.start_time):
        raise HTTPException(status_code=400, detail="The end time must be after the start time")
    doc = {
        "_id": str(uuid.uuid4()),
        "provider_user_id": user["user_id"],
        "date": payload.date,
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "note": payload.note.strip(),
        "created_at": datetime.now(UTC).isoformat(),
    }
    await db.marketplace_blocks.insert_one(doc)
    doc["id"] = doc.pop("_id")
    return doc


@router.delete("/blocks/{block_id}")
async def delete_block(block_id: str, user=Depends(verify_token)):
    """Freeing time back up is a one-click undo, deliberately.

    An owner who blocked the wrong day should not have to think about
    it, and nothing depends on a block having existed.
    """
    res = await db.marketplace_blocks.delete_one(
        {"_id": block_id, "provider_user_id": user["user_id"]},
    )
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.get("/gigs/{gig_id}/taken-slots")
async def taken_slots(gig_id: str):
    """Which times are already held, so the picker can leave them out.

    Public and unauthenticated on purpose: the slot grid is public, and
    which times are gone is not private information — it is the same
    thing a caller learns by asking "are you free Tuesday at three?".
    No customer names, no booking ids, nothing but times.

    The picker is built in the browser from weekly_availability, which is
    why this exists at all: the front end had no way to know a slot was
    spoken for, so it offered every one of them to everybody.
    """
    gig = await db.marketplace_gigs.find_one(
        {"_id": gig_id}, {"_id": 1, "slot_duration_minutes": 1, "provider_user_id": 1},
    )
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")

    spans = await _busy_spans(gig_id, gig.get("provider_user_id"))
    # Returned as start times on the gig's own grid rather than raw
    # ranges, because that is what the picker compares against — doing
    # the arithmetic here keeps one implementation of it.
    step = int(gig.get("slot_duration_minutes") or 30)
    out: dict[str, list[str]] = {}
    for day, ranges in spans.items():
        blocked = set()
        for start, end in ranges:
            # Every grid slot the booking touches, not just the one it
            # starts on: a 90-minute service booked at 10:00 must take
            # 10:30 and 11:00 with it.
            first = (start // step) * step
            t = first
            while t < end:
                blocked.add(f"{t // 60:02d}:{t % 60:02d}")
                t += step
        out[day] = sorted(blocked)
    return out


@router.get("/gigs/{gig_id}/contact")
async def contact_gig_on_whatsapp(
    gig_id: str,
    request: Request,
    text: str = Query("", max_length=1000),
) -> RedirectResponse:
    """Count a WhatsApp lead, then hand the visitor to WhatsApp.

    Provider subscriptions are the paid side of the marketplace, and until
    now a WhatsApp inquiry left no trace at all — the deep link went straight
    from the browser to ``wa.me``. Nothing could tell a provider (or us) how
    many leads a gig produced, which makes the subscription impossible to
    justify with numbers. This is the measurement point that the provider
    analytics dashboard will read from.

    Deliberately a redirect rather than a POST-then-open: a popup blocker
    kills a window opened after an await, and a failed beacon would silently
    lose the lead. The browser navigates here and we bounce it onward, so the
    click and the measurement are the same action.

    **Logging never blocks the lead.** Every failure path still redirects —
    a broken analytics write must not cost a provider a customer.

    The ``wa.me`` URL is built server-side from the stored number rather than
    accepted from the caller; taking a client-supplied destination would make
    this an open redirect.
    """
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")

    # Same precedence the gig detail payload uses: per-gig number first,
    # then the provider record, then the account-level number.
    provider_user_id = gig.get("provider_user_id")
    number = (gig.get("whatsapp") or "").strip()
    if not number:
        prov = await db.marketplace_providers.find_one({"user_id": provider_user_id})
        number = ((prov or {}).get("whatsapp") or "").strip()
    if not number:
        user = await db.users.find_one({"_id": provider_user_id}) \
            or await db.users.find_one({"id": provider_user_id})
        number = user_whatsapp(user)

    target = build_whatsapp_link(number, text)
    if not target:
        # No dialable number. Send them back to the gig rather than showing a
        # raw API error — the in-platform inquiry flow is on that page.
        frontend = os.environ.get("FRONTEND_URL", "https://myisraelrental.com").rstrip("/")
        return RedirectResponse(f"{frontend}/services/gig/{gig_id}", status_code=302)

    try:
        await db.lead_events.insert_one({
            "_id": str(uuid.uuid4()),
            "type": "whatsapp_click",
            "gig_id": gig_id,
            "provider_id": provider_user_id,
            "created_at": datetime.now(UTC).isoformat(),
            # Coarse only — enough to tell apart "found us on Google" from
            # "clicked through from a listing", with no new PII. The full
            # user-agent and IP are deliberately not stored.
            "referrer_host": _referrer_host(request.headers.get("referer")),
        })
    except Exception:  # noqa: BLE001 — the lead matters more than the metric
        logger.exception("lead_events insert failed for gig %s", gig_id)

    return RedirectResponse(target, status_code=302)


def _referrer_host(referer: Optional[str]) -> str:
    """Host portion of a Referer header, or '' — never the full URL.

    Query strings on our own pages carry filter state (and on the rentals
    side, sometimes a searched address), so only the host is kept.
    """
    if not referer:
        return ""
    try:
        return (urlparse(referer).hostname or "")[:100]
    except Exception:  # noqa: BLE001
        return ""


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

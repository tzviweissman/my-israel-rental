"""Public property browse — list, detail, and manager listing.

Extracted from ``properties.py`` in the 2026-07 refactor.
"""
import asyncio
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException

from models_response import ManagerPropertiesResponse, PropertyOut
from routes.deps import db, logger
from utils.area_filter import area_mongo_query
from utils.helpers import get_usd_ils_rate

from .shared import _normalize_rental_types

router = APIRouter()
api_router = router


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
    date_to: str | None = None,
    page: int = 1,
    limit: int | None = None,
) -> list[dict]:
    query: dict = {}
    if rental_type:
        # Multi-list: match the primary `rental_type` field OR the newer
        # `rental_types` array (property is available under multiple
        # categories, e.g. a short-term listing that's also bookable for
        # Sukkot as vacation). Legacy docs without `rental_types` still
        # match via the primary field.
        query['$or'] = [
            {'rental_type': rental_type},
            {'rental_types': rental_type},
        ]
    if holiday_tag:
        # Mongo array `$in`/contains — matches docs whose `holiday_tags`
        # array contains the requested value (e.g. "sukkot" or "pesach").
        query['holiday_tags'] = holiday_tag
    if min_bedrooms:
        query['bedrooms'] = {"$gte": min_bedrooms}
    if area:
        # Build a city-scoped, prefix-anchored regex that handles legacy bare
        # neighborhoods and transliteration variants while preventing cross-city
        # bleed (e.g. "Jerusalem - Old City" must not match "Beersheba - Old City").
        # See utils/area_filter.py for the full reasoning.
        area_q = area_mongo_query(area)
        if area_q is not None:
            query['area'] = area_q
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

    # Slim the list payload: the public listing grid renders only the
    # cover image per card, so shipping all 20-30 image URLs per
    # property is pure waste. A 100-property page with 25 imgs each
    # would otherwise carry 2500 URLs in the JSON response — trimming
    # to just the cover drops the response size 20-30x. The detail
    # endpoint still returns the full array.
    for p in properties:
        if p.get("images"):
            p["images"] = p["images"][:1]
        # videos are tiny in count (usually 0-1) — leave intact so the
        # card can still synthesize a video poster when no image exists.

    # Stamp `is_featured` on every property so the home page / cards can
    # surface admin-curated picks. The list of featured ids lives in a
    # single ``site_settings`` doc (key='global'), edited via the admin
    # ``PUT /admin/properties/{id}/featured`` toggle. Reading it here keeps
    # the public endpoint as the single source of truth for that flag.
    settings = await db.site_settings.find_one(
        {"key": "global"}, {"_id": 0, "featured_property_ids": 1}
    )
    featured_ids = set((settings or {}).get("featured_property_ids") or [])
    for p in properties:
        p["is_featured"] = p["id"] in featured_ids

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
    
    # Pagination — applied AFTER all filters (price + date overlap filters
    # are post-query in Python, so DB-level skip/limit would slice the wrong
    # set). When `limit` is omitted, behavior is unchanged: return everything
    # (capped at the original 1000) so existing callers (Home, Dashboard,
    # admin tooling) don't break. The frontend infers "no more pages" when
    # the returned slice is shorter than `limit`.
    if limit is not None and limit > 0:
        start = max(0, (page - 1) * limit)
        properties = properties[start:start + limit]

    return properties


@api_router.get("/properties/{property_id}", response_model=PropertyOut)
async def get_property(property_id: str) -> dict:
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    await db.properties.update_one({"id": property_id}, {"$inc": {"views": 1}})
    property_data['views'] = property_data.get('views', 0) + 1
    # Fire-and-forget timestamped view event — drives the Smart Pricing
    # demand signal (rolling 14d). Never blocks the page render.
    try:
        from routes.smart_pricing import record_view_event
        asyncio.create_task(record_view_event(property_id))
    except Exception:  # noqa: BLE001
        pass
    
    owner = await db.users.find_one({"id": property_data.get("owner_id")}, {"_id": 0, "name": 1, "email": 1})
    if owner:
        property_data['owner_name'] = owner.get('name', '')
        property_data['owner_email'] = owner.get('email', '')

    # Stamp is_featured the same way the list endpoint does, so the property
    # detail page can render the "Featured" badge consistently.
    settings = await db.site_settings.find_one(
        {"key": "global"}, {"_id": 0, "featured_property_ids": 1}
    )
    featured_ids = set((settings or {}).get("featured_property_ids") or [])
    property_data['is_featured'] = property_id in featured_ids

    return property_data



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



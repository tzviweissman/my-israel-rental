"""Public property browse — list, detail, and manager listing.

Extracted from ``properties.py`` in the 2026-07 refactor.
"""
import asyncio
import os
import time
import uuid
from collections.abc import Coroutine
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse

from models_response import ManagerPropertiesResponse, PropertyOut
from routes.deps import db, logger, optional_user, verify_token
from utils import view_tracking
from utils.whatsapp_link import build_whatsapp_link
from utils.area_filter import area_mongo_query
from utils.dedupe import find_duplicate
from utils.helpers import get_usd_ils_rate
from utils.user_contact import WHATSAPP_PROJECTION, user_whatsapp


router = APIRouter()
api_router = router


# ── Payload / round-trip budget ────────────────────────────────────────
# Every Mongo round-trip to Atlas costs ~160ms from the app region, and
# the public list endpoint used to pull all ~63 fields of every property
# document (564 KB uncompressed for ~315 listings) only to render card
# grids that read a fraction of them. The projection below is the exact
# field set the public consumers touch:
#
#   • PropertyCard.jsx  — title, area, bedrooms, bathrooms, square_meters,
#     floor, currency, monthly/nightly price, rental_type, holiday_* rate
#     fields, images (cover), videos (video-poster fallback).
#   • Home.js featured strip — same minus floor.
#   • Stays.jsx client-side filter chain — area, rental_type, bedrooms,
#     bathrooms, porches, condition, furnished, has_elevator, prices,
#     currency, amenities, available_from/available_to.
#   • StaysMapView / "near this address" sort — lat, lng.
#   • PropertyOut requires id / title / rental_type / property_type / area.
#
# `furnished` is not written by any backend path today (the model field is
# `furniture_option`) — Stays.jsx filters on it anyway, so it is projected
# to keep that filter's behavior byte-identical if the field ever lands.
#
# Deliberately EXCLUDED because no card-grid consumer reads them:
# description (~77 KB of the old payload), status, views,
# owner_id, contract_url/contract_uploaded_at, ical_*,
# bulk_created, max_guests, sukkah_compatible, furniture_option,
# minimum_booking_days, checkin_time/checkout_time, cancellation_policy,
# custom_cancellation_policy, starting_date, porch_square_meters,
# is_tama, is_shabbat_elevator, agent/cleaning fee fields,
# holiday_start_date/holiday_end_date, rental_types, is_hidden.
# The DETAIL endpoint (`/properties/{id}`) still returns the full document,
# and the owner-scoped variant of this endpoint (`?owner_id=`) is exempt —
# the dashboard edit form hydrates from it and needs every field.
#
# `images` is sliced server-side rather than trimmed in Python so the
# unused 20-30 URLs per listing never cross the wire from Atlas either.
LIST_PROJECTION: dict = {
    "_id": 0,
    "id": 1,
    "title": 1,
    # 120 listings store the area as their title, so the card falls back to
    # the street to tell them apart (utils/propertyTitle.js). Short strings —
    # a few KB across the whole grid — and already public on the detail page.
    "address": 1,
    # Powers the "Listed N days ago" stamp and the Newest sort on /stays.
    # In a market where good listings go in hours, freshness is the single
    # most useful thing a card can say. ~25 bytes per row.
    "created_at": 1,
    "area": 1,
    "rental_type": 1,
    "property_type": 1,
    "bedrooms": 1,
    "bathrooms": 1,
    "square_meters": 1,
    "floor": 1,
    "porches": 1,
    "has_elevator": 1,
    "condition": 1,
    "furnished": 1,
    "amenities": 1,
    "monthly_price": 1,
    "nightly_price": 1,
    "currency": 1,
    "holiday_tags": 1,
    "holiday_lump_price": 1,
    "holiday_lump_currency": 1,
    "holiday_lump_is_per_night": 1,
    "available_from": 1,
    "available_to": 1,
    "videos": 1,
    "lat": 1,
    "lng": 1,
    "images": {"$slice": 1},
}

# Home.js tops the featured strip up with non-featured listings when the
# admin has curated fewer than this many — keep in sync with the
# `MIN_FILLER` constant in `frontend/src/pages/Home.js`.
FEATURED_MIN_FILLER = 6

# Public read endpoints are anonymous and identical for every caller, so a
# short shared-cache window is safe and removes most repeat round-trips.
# NEVER apply this to an authenticated / per-caller response.
PUBLIC_CACHE_CONTROL = "public, max-age=60"

# ── site_settings TTL cache ────────────────────────────────────────────
# `site_settings` (key='global') was read on EVERY list request and EVERY
# property-detail request just to stamp `is_featured` — a ~160ms Atlas
# round-trip for a single tiny document that changes only when an admin
# toggles a featured listing.
#
# Caveats, by design: this cache is PER PROCESS (each Railway replica /
# uvicorn worker holds its own copy) and there is no invalidation hook on
# the admin featured toggle, so an admin's change can take up to
# `_SETTINGS_TTL_SECONDS` to show up on the public site.
_SETTINGS_TTL_SECONDS = 60
_settings_cache: dict = {"at": None, "featured_ids": frozenset()}

# Strong references to fire-and-forget tasks. Without this the event loop
# only holds a weak reference and a background write can be garbage
# collected mid-flight.
_background_tasks: set = set()


def _spawn_background(coro: Coroutine[Any, Any, Any]) -> None:
    """Fire-and-forget a coroutine without letting it be GC'd or letting a
    failure bubble into the request that scheduled it."""
    try:
        task = asyncio.create_task(coro)
    except Exception:  # noqa: BLE001 — no running loop (sync test harness)
        coro.close()
        return
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def get_featured_property_ids() -> frozenset:
    """Featured-listing ids from `site_settings`, cached for up to
    `_SETTINGS_TTL_SECONDS` in this process. See the caveats above."""
    now = time.monotonic()
    cached_at = _settings_cache["at"]
    if cached_at is not None and (now - cached_at) < _SETTINGS_TTL_SECONDS:
        return _settings_cache["featured_ids"]
    settings = await db.site_settings.find_one(
        {"key": "global"}, {"_id": 0, "featured_property_ids": 1}
    )
    ids = frozenset((settings or {}).get("featured_property_ids") or [])
    _settings_cache["featured_ids"] = ids
    _settings_cache["at"] = now
    return ids


async def _bump_view_count(property_id: str) -> None:
    """Increment a listing's view counter off the request path. This is a
    WRITE that used to block a READ response by a full Atlas round-trip."""
    try:
        await db.properties.update_one({"id": property_id}, {"$inc": {"views": 1}})
    except Exception:  # noqa: BLE001
        pass


@api_router.get(
    "/properties",
    response_model=list[PropertyOut],
    # Without this FastAPI null-fills every field PropertyOut declares,
    # which would put all the keys the projection just dropped straight
    # back into the JSON as `null` and undo the payload win.
    response_model_exclude_unset=True,
)
async def get_properties(
    response: Response,
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
    sort: str | None = None,
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

    # Public feed hides admin-quarantined listings (e.g. flagged by the
    # pricing-audit auto-fix as needing owner review). ``is_hidden`` is
    # only set by admin tools — the field is absent on healthy docs, so
    # ``$ne: True`` matches everything without the flag.
    query['is_hidden'] = {"$ne": True}

    # The owner-scoped variant backs the owner dashboard, whose edit modal
    # hydrates its form straight from these rows — it needs the WHOLE
    # document. Everything else is a public card grid, which gets the lean
    # projection above.
    is_owner_scoped = owner_id is not None
    projection = {"_id": 0} if is_owner_scoped else LIST_PROJECTION
    properties = await db.properties.find(query, projection).to_list(1000)

    # Slim the list payload: the public listing grid renders only the
    # cover image per card, so shipping all 20-30 image URLs per
    # property is pure waste. A 100-property page with 25 imgs each
    # would otherwise carry 2500 URLs in the JSON response — trimming
    # to just the cover drops the response size 20-30x. The detail
    # endpoint still returns the full array.
    #
    # The public path already got a `$slice: 1` from Mongo, so this loop
    # is a no-op there; it still does the trimming for the owner-scoped
    # (full-document) path.
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
    # Served from the per-process TTL cache — see `get_featured_property_ids`.
    featured_ids = await get_featured_property_ids()
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
    
    # Sorting — before pagination, or page 2 would be sorted independently of
    # page 1 and the same listing could appear on both. Applied in Python for
    # the same reason pagination is: the price and date-overlap filters above
    # already run here, so a DB-level sort would order the wrong set.
    #
    # Unknown values fall through to the default (created_at desc, which is
    # how the documents already arrive) rather than erroring — a hand-edited
    # or stale `?sort=` in a shared link should degrade, not 422.
    if sort in ("price_asc", "price_desc"):
        # Live rate (1h cached, falls back to 3.65) — the same source the
        # cross-currency price *filter* above uses, so a listing can't pass
        # the filter and then sort as though it cost something else.
        sort_rate = await get_usd_ils_rate()

        def _price(p: dict) -> float:
            raw = p.get("nightly_price") if p.get("rental_type") == "vacation" else p.get("monthly_price")
            try:
                value = float(raw or 0)
            except (TypeError, ValueError):
                return 0.0
            # Mirrors utils/listingPrice.js — listings priced in USD are
            # normalised to ILS so a $2,000 flat doesn't sort below a ₪6,000
            # one. Listings with no currency are treated as ILS, matching how
            # they're displayed.
            if value and (p.get("currency") or "ILS") == "USD":
                value *= sort_rate
            return value

        # Unpriced listings sink to the bottom in BOTH directions: a
        # "cheapest first" page opening on a wall of price-on-request rows is
        # useless, and they aren't meaningfully "most expensive" either.
        properties.sort(
            key=lambda p: (_price(p) == 0, -_price(p) if sort == "price_desc" else _price(p)),
        )
    elif sort == "newest":
        # created_at is an ISO 8601 string, so lexicographic desc is
        # chronological desc. Missing values become "" — the smallest string —
        # so they land last under reverse, which is what we want: an undated
        # listing shouldn't lead a "newest first" page.
        properties.sort(key=lambda p: p.get("created_at") or "", reverse=True)

    # Pagination — applied AFTER all filters (price + date overlap filters
    # are post-query in Python, so DB-level skip/limit would slice the wrong
    # set). When `limit` is omitted, behavior is unchanged: return everything
    # (capped at the original 1000) so existing callers (Home, Dashboard,
    # admin tooling) don't break. The frontend infers "no more pages" when
    # the returned slice is shorter than `limit`.
    if limit is not None and limit > 0:
        start = max(0, (page - 1) * limit)
        properties = properties[start:start + limit]

    # Cache only the anonymous public feed. The `?owner_id=` variant backs
    # the owner dashboard (sent with an Authorization header and expected
    # to reflect an edit immediately), so it stays uncached.
    if not is_owner_scoped:
        response.headers["Cache-Control"] = PUBLIC_CACHE_CONTROL

    return properties


# ── Soft duplicate warning (pre-submit) ────────────────────────────────
# Called by AddPropertyModal as the host types their address, so we can
# nudge them BEFORE they submit if they already have an active listing
# at the same address + rental_type + bedroom count + floor. Purely
# advisory: the actual duplicate BLOCK still lives inside
# `crud.create_property` — this endpoint just surfaces the same
# information earlier in the flow.
#
# MUST be declared BEFORE `/properties/{property_id}` (below) so FastAPI
# matches the literal path first — otherwise `check-duplicate` would be
# swallowed as a property_id and 404.
@api_router.get("/properties/check-duplicate")
async def check_duplicate_listing(
    rental_type: str = Query(..., min_length=1, max_length=64),
    address: str | None = Query(None, max_length=500),
    bedrooms: int | None = Query(None, ge=0, le=50),
    floor: int | None = Query(None, ge=-5, le=200),
    area: str | None = Query(None, max_length=300),
    title: str | None = Query(None, max_length=500),
    exclude_property_id: str | None = Query(None),
    payload: dict = Depends(verify_token),
) -> dict:
    """Return `{ duplicate: {...} }` if the caller already has an active
    listing that would collide on the composite dedupe signature, else
    `{ duplicate: null }`. Never raises on bad address strings — the
    signature resolves to None and we simply report no match.

    `address` is optional because it's optional on the listing itself;
    when it's absent the signature falls back to area + title so this
    advisory check covers address-less listings too.
    """
    dup = await find_duplicate(
        db,
        owner_id=payload["user_id"],
        address=address,
        rental_type=rental_type,
        bedrooms=bedrooms,
        floor=floor,
        area=area,
        title=title,
        exclude_property_id=exclude_property_id,
    )
    if not dup:
        return {"duplicate": None}
    return {
        "duplicate": {
            "id": dup.get("id"),
            "title": dup.get("title") or "Untitled listing",
            "address": dup.get("address"),
            "rental_type": dup.get("rental_type"),
            "bedrooms": dup.get("bedrooms"),
            "floor": dup.get("floor"),
        },
    }


# ── Home page featured strip ───────────────────────────────────────────
# Home.js used to fetch the ENTIRE catalog with no query params and filter
# it down to ~8 cards in the browser. This endpoint does the same selection
# server-side against the same `site_settings.featured_property_ids`, so the
# home page downloads 8 lean rows instead of ~315 fat ones.
#
# MUST be declared BEFORE `/properties/{property_id}` (below) for the same
# reason `check-duplicate` is — otherwise FastAPI matches the literal
# "featured" as a property_id and the route 404s.
@api_router.get(
    "/properties/featured",
    response_model=list[PropertyOut],
    response_model_exclude_unset=True,
)
async def get_featured_properties(response: Response) -> list[dict]:
    """Admin-curated featured listings, topped up with other live listings
    when fewer than `FEATURED_MIN_FILLER` have been curated (so the strip is
    never near-empty on a fresh install).

    Mirrors the client-side selection `Home.js#fetchFeaturedProperties` used
    to do. One caveat: the featured block comes back in whatever order Mongo
    resolves the `id: {$in: ...}` lookup, which may differ from the natural
    collection order the old full-catalog scan happened to produce. The SET
    of listings is the same; only the order within the strip can shift.
    """
    featured_ids = await get_featured_property_ids()
    # Same public-feed visibility rule the list endpoint applies.
    visible = {"is_hidden": {"$ne": True}}

    properties: list[dict] = []
    if featured_ids:
        properties = await db.properties.find(
            {**visible, "id": {"$in": list(featured_ids)}}, LIST_PROJECTION
        ).to_list(1000)
    for p in properties:
        p["is_featured"] = True

    # Top-up: fill the remaining slots with non-featured live listings, in
    # the same natural collection order the old client-side `others.slice()`
    # picked from.
    shortfall = FEATURED_MIN_FILLER - len(properties)
    if shortfall > 0:
        fillers = await db.properties.find(
            {**visible, "id": {"$nin": list(featured_ids)}}, LIST_PROJECTION
        ).to_list(shortfall)
        for p in fillers:
            p["is_featured"] = False
        properties.extend(fillers)

    # Anonymous, identical for every caller — safe to cache.
    response.headers["Cache-Control"] = PUBLIC_CACHE_CONTROL
    return properties


# ── Owner-facing performance (L5 of docs/leads-and-views-spec.md) ─────────
#
# The property half of what services already report. Two gaps closed here:
# property WhatsApp taps were never recorded at all (the button linked
# straight to wa.me), and property views were only ever visible to an admin.
#
# Declared ABOVE `/properties/{property_id}` for readability; it does not
# actually collide, since that route matches a single path segment and these
# have two.

_PROP_PERIOD_DAYS = 30


def _referrer_host(referer: object) -> str:
    """Host portion of a Referer header, or ''. Never the full URL.

    Same rule as the services redirect: a query string on our own pages
    carries filter state and sometimes a searched address, so only the host
    is kept. Enough to tell "found us on Google" from "clicked a listing",
    with no new personal data.
    """
    if not referer:
        return ""
    try:
        return (urlparse(str(referer)).hostname or "")[:100]
    except Exception:  # noqa: BLE001
        return ""


@api_router.get("/properties/{property_id}/contact")
async def contact_property_on_whatsapp(
    property_id: str,
    request: Request,
    text: str = Query("", max_length=1000),
) -> RedirectResponse:
    """Redirect to the owner's WhatsApp, counting the tap on the way.

    The number is resolved server-side and never returned to the caller —
    the same rule as the services redirect, which exists because that
    endpoint was once serving every provider's number to anyone who asked.
    """
    prop = await db.properties.find_one({"id": property_id}, {"owner_id": 1, "title": 1})
    frontend = os.environ.get("FRONTEND_URL", "https://myisraelrental.com").rstrip("/")
    if not prop:
        return RedirectResponse(f"{frontend}/property/{property_id}", status_code=302)

    owner = await db.users.find_one(
        {"id": prop.get("owner_id")}, {"_id": 0, **WHATSAPP_PROJECTION},
    )
    target = build_whatsapp_link(user_whatsapp(owner or {}), text)
    if not target:
        # No dialable number. Send them back to the listing, which still has
        # the on-site message button, rather than showing a raw API error.
        return RedirectResponse(f"{frontend}/property/{property_id}", status_code=302)

    try:
        await db.lead_events.insert_one({
            "_id": str(uuid.uuid4()),
            "type": "whatsapp_click",
            # `source` distinguishes these from gig taps, which carry a
            # gig_id instead. Both live in one collection so an owner who
            # lists a flat AND runs a business sees one consistent number.
            "source": "property",
            "property_id": property_id,
            "owner_id": prop.get("owner_id"),
            "created_at": datetime.now(UTC).isoformat(),
            "referrer_host": _referrer_host(request.headers.get("referer")),
        })
    except Exception:  # noqa: BLE001 — the lead matters more than the metric
        logger.exception("lead_events insert failed for property %s", property_id)

    return RedirectResponse(target, status_code=302)


@api_router.get("/properties/performance/summary")
async def property_performance_summary(user=Depends(verify_token)) -> dict:
    """Visitors and contact taps for the caller's own properties.

    Same shape as /marketplace/leads/summary so one panel renders both.
    """
    owner_id = user["user_id"]

    # Which properties are theirs. Needed for the view scope, and it is also
    # how the tap rows get their titles.
    owned = await db.properties.find(
        {"owner_id": owner_id}, {"id": 1, "title": 1, "_id": 0},
    ).to_list(None)
    titles = {p["id"]: (p.get("title") or "") for p in owned}
    prop_ids = list(titles)

    # NOTE `created_at` here is an ISO **string** (see the insert above), so
    # the cutoff must be one too. A datetime cutoff silently matches nothing.
    base = {"type": "whatsapp_click", "owner_id": owner_id, "source": "property"}
    total = await db.lead_events.count_documents(base)

    since = None
    first = await db.lead_events.find(base, {"created_at": 1}).sort(
        "created_at", 1,
    ).limit(1).to_list(1)
    if first:
        since = view_tracking.il_day_of_iso(first[0].get("created_at"))

    cutoff_dt, day_keys = view_tracking.il_day_window(_PROP_PERIOD_DAYS)
    buckets = {k: 0 for k in day_keys}
    per_prop: dict[str, int] = {}
    period_total = 0
    async for ev in db.lead_events.find(
        {**base, "created_at": {"$gte": cutoff_dt.isoformat()}},
        {"created_at": 1, "property_id": 1},
    ):
        day = view_tracking.il_day_of_iso(ev.get("created_at"))
        if day not in buckets:
            continue
        buckets[day] += 1
        period_total += 1
        pid = ev.get("property_id")
        if pid:
            per_prop[pid] = per_prop.get(pid, 0) + 1

    by_listing = sorted(
        (
            {"id": pid, "title": titles.get(pid, ""), "count": n}
            for pid, n in per_prop.items()
            # A tap against a since-deleted listing still counts in the
            # total; it just has no row to show, because there is nothing
            # left to name.
            if pid in titles
        ),
        key=lambda r: (-r["count"], r["title"]),
    )

    views = await view_tracking.view_summary(owner_id, _PROP_PERIOD_DAYS, prop_ids)

    return {
        "total": total,
        "period_days": _PROP_PERIOD_DAYS,
        "period_total": period_total,
        "daily": [{"date": k, "count": buckets[k]} for k in day_keys],
        "since": since,
        "by_listing": by_listing,
        "views": {
            "total": views["total"],
            "period_total": views["period_total"],
            "daily": views["daily"],
            "since": views["since"],
        },
    }


@api_router.get("/properties/{property_id}", response_model=PropertyOut)
async def get_property(
    property_id: str,
    response: Response,
    request: Request,
    viewer=Depends(optional_user),
) -> dict:
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")

    # Background the counter bump: it's a WRITE that was blocking a READ
    # response by a full Atlas round-trip (~160ms) on every page view. The
    # optimistic +1 below keeps the rendered count identical to before.
    _spawn_background(_bump_view_count(property_id))
    property_data['views'] = property_data.get('views', 0) + 1
    # Fire-and-forget timestamped view event — drives the Smart Pricing
    # demand signal (rolling 14d). Never blocks the page render.
    try:
        from routes.smart_pricing import record_view_event
        _spawn_background(record_view_event(property_id))
    except Exception:  # noqa: BLE001
        pass
    # L5 — the OWNER-facing view, which is a different question from the
    # Smart Pricing one above and so is recorded separately. That stream
    # deliberately counts every refresh as demand; this one is deduped to
    # one visitor per day and skips the owner's own visits, so a property
    # reports the same way a service does. Neither can be derived from the
    # other, which is why both are written.
    view_tracking.spawn(view_tracking.record_view(
        view_tracking.ENTITY_PROPERTY, property_id,
        owner_id=property_data.get("owner_id"),
        viewer_id=(viewer or {}).get("user_id"),
        visitor=request.headers.get("X-Visitor-Id"),
    ))

    owner = await db.users.find_one(
        {"id": property_data.get("owner_id")},
        {"_id": 0, "name": 1, "email": 1, **WHATSAPP_PROJECTION},
    )
    if owner:
        property_data['owner_name'] = owner.get('name', '')
        property_data['owner_email'] = owner.get('email', '')
        # Powers the WhatsApp "contact the lister" button. Exposed only on
        # this per-property detail endpoint (same as owner_email), never on
        # the list endpoints, so the whole lister phonebook can't be
        # harvested in one request. Empty/absent means the frontend falls
        # back to the in-app chat instead.
        #
        # Resolved through utils.user_contact rather than a field name: this
        # read `whatsapp_number` directly, which nothing ever writes, so the
        # button was dead for all 47 owners and all 204 listings.
        property_data['owner_whatsapp'] = user_whatsapp(owner)

    # Stamp is_featured the same way the list endpoint does, so the property
    # detail page can render the "Featured" badge consistently. Served from
    # the per-process TTL cache instead of a per-request Atlas round-trip.
    featured_ids = await get_featured_property_ids()
    property_data['is_featured'] = property_id in featured_ids

    # Public, anonymous, identical for every caller (owner_name/email/
    # whatsapp are listing contact details shown to everyone, not
    # caller-specific), so a short shared-cache window is safe.
    response.headers["Cache-Control"] = PUBLIC_CACHE_CONTROL

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




# ── Trust line counts (B1) ─────────────────────────────────────────────
# Thumbtack and Plum Guide both put a proof line under the search control.
# The brief was explicit: real numbers from the database, and drop any
# clause whose number isn't available rather than estimating one. So this
# returns only what can be counted, and the UI hides whatever is missing.
#
# Two things learned from the live data that shaped this:
#
#   1. `area` is a NEIGHBOURHOOD, not a city. Every live listing is in
#      Jerusalem — Geula, Nachlaot, Rehavia, Baka and so on — so a "cities
#      covered" clause of the kind the research suggested would have been
#      false on the first render. This counts neighbourhoods and the copy
#      says Jerusalem.
#   2. The same neighbourhood arrives spelled several ways: with and
#      without a ", Jerusalem" suffix, "Sanhedria Murhevet" vs
#      "Murchevet", "Arzei HaBirah" vs "Arzei Habira", and pairs joined by
#      a slash. Counting raw distinct values gave 40; after folding the
#      variants it is 28. The larger number was the flattering one, which
#      is exactly why it needed checking.
#
# The bare value "Jerusalem" is excluded: it is the generic fallback tag,
# not a neighbourhood, and counting it would inflate by one.
_TRUST_CACHE: dict[str, Any] = {"at": 0.0, "data": None}
_TRUST_TTL_SECONDS = 300


def _fold_area(raw: Any) -> list[str]:
    """Normalise one `area` value into zero or more neighbourhood keys."""
    head = str(raw or "").split(" - ")[0].strip()
    if not head:
        return []
    out = []
    for part in head.split("/"):
        key = part.strip().lower()
        key = key.removesuffix(", jerusalem").strip()
        key = " ".join(key.split())
        key = key.replace("murhevet", "murchevet").replace("arzei habirah", "arzei habira")
        if key and key != "jerusalem":
            out.append(key)
    return out


@api_router.get("/properties/stats/trust")
async def get_trust_stats(response: Response) -> dict:
    """Counts for the proof line under the Stays search panel.

    Cached for five minutes: it is two reads per call and the numbers move
    slowly, but the endpoint sits under the most-visited control on the site.
    """
    now = time.time()
    if _TRUST_CACHE["data"] is not None and now - _TRUST_CACHE["at"] < _TRUST_TTL_SECONDS:
        response.headers["Cache-Control"] = PUBLIC_CACHE_CONTROL
        return _TRUST_CACHE["data"]

    # Same visibility rule as the public feed, so the number always matches
    # what a visitor can actually browse.
    visible = {"is_hidden": {"$ne": True}}
    listings = await db.properties.count_documents(visible)
    areas = await db.properties.distinct("area", visible)

    folded: set[str] = set()
    for raw in areas:
        folded.update(_fold_area(raw))

    data = {"listings": int(listings), "neighborhoods": len(folded)}
    _TRUST_CACHE["at"] = now
    _TRUST_CACHE["data"] = data
    response.headers["Cache-Control"] = PUBLIC_CACHE_CONTROL
    return data

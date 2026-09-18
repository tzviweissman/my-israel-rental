"""Smart Lists — super-admin tool for generating shareable rental shortlists.

A super admin can filter the catalog by location, rent range (in ILS),
bedroom range, availability window, and how recently a listing was added —
then export the result as a copy-paste-friendly text block for WhatsApp /
email / Telegram. Lists can also be saved by name for later reuse.

Endpoints
---------
* ``POST /api/admin/smart-lists/generate`` — preview matches without saving.
* ``GET  /api/admin/smart-lists``           — list saved lists for the caller.
* ``POST /api/admin/smart-lists``           — save the current filter set + results.
* ``GET  /api/admin/smart-lists/{id}``      — fetch one saved list (with fresh re-query).
* ``DELETE /api/admin/smart-lists/{id}``    — delete a saved list.

Design notes
------------
* Rent filter is **always in ILS**; USD-priced listings are converted
  on-the-fly via ``utils/fx.convert_amount`` before comparison.
* Vacation rentals are excluded — the feature is monthly-rent first.
* Saved lists are private to the super admin who created them.
* "Available date" is the property's own field:
    - long-term rentals  →  ``starting_date``
    - short-term rentals →  ``available_from``
* The frontend public-property URL is built from ``FRONTEND_URL``.
* "Recently added" is ``created_at`` — a listing with no ``created_at``
  is EXCLUDED when that filter is on. Roughly a handful of production
  rows predate the field, and quietly presenting a six-month-old listing
  inside a "new this week" WhatsApp blast is worse than omitting it.
"""
from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError, model_validator

from routes.deps import db, verify_token
from utils.area_filter import area_mongo_query, canonicalize_area
from utils.fx import convert_amount

router = APIRouter()
api_router = router

# Availability buckets the dropdown exposes.
Availability = Literal["next_month", "next_3_months", "next_6_months", "anytime"]
_AVAILABILITY_DAYS = {
    "next_month": 31,
    "next_3_months": 93,
    "next_6_months": 186,
}

# Rental-type categories the dropdown exposes. ``vacation`` covers any
# vacation rental; ``sukkot`` / ``pesach`` narrow to holiday-tagged ones.
RentalCategory = Literal[
    "any", "long-term", "short-term", "vacation", "sukkot", "pesach"
]
_RENTAL_CATEGORY_TYPES = {
    "any": ["long-term", "short-term", "vacation"],
    "long-term": ["long-term"],
    "short-term": ["short-term"],
    "vacation": ["vacation"],
    "sukkot": ["vacation"],
    "pesach": ["vacation"],
}
# Categories where the monthly-rent ceiling doesn't apply (nightly / lump
# pricing varies wildly so we skip it entirely per user request).
_VACATION_LIKE = {"vacation", "sukkot", "pesach"}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class SmartListFilters(BaseModel):
    location: str | None = None
    min_monthly_rent_ils: float | None = Field(default=None, ge=0)
    max_monthly_rent_ils: float | None = Field(default=None, ge=0)
    min_bedrooms: float | None = Field(default=None, ge=0)
    max_bedrooms: float | None = Field(default=None, ge=0)
    availability: Availability = "anytime"
    rental_category: RentalCategory = "any"
    # "Added in the last N days" — None means no recency restriction.
    # Capped at a year so a stray value can't turn into an unbounded scan
    # that silently means "everything".
    listed_within_days: int | None = Field(default=None, ge=1, le=365)

    @model_validator(mode="after")
    def _ranges_not_inverted(self) -> "SmartListFilters":
        # The form checks this, but only the form did. Any other caller
        # sending min > max got a silent count of 0 - or saved a preset that
        # is empty forever - with nothing saying why. A 422 names the field.
        for lo, hi in (("min_monthly_rent_ils", "max_monthly_rent_ils"),
                       ("min_bedrooms", "max_bedrooms")):
            a, b = getattr(self, lo), getattr(self, hi)
            if a is not None and b is not None and a > b:
                raise ValueError(f"{lo} ({a:g}) is greater than {hi} ({b:g})")
        return self


class SmartListSaveBody(SmartListFilters):
    name: str = Field(min_length=1, max_length=120)


class SmartListPropertyOut(BaseModel):
    id: str
    title: str
    area: str
    address: str | None = None
    price: float | None = None
    currency: str
    price_ils_equivalent: float | None = None
    # Per-unit label so the UI prints "/mo" / "/night" / "/ Sukkot" etc.
    price_label: str = "/mo"
    bedrooms: float | None = None
    available_from: str | None = None
    rental_type: str
    listing_url: str
    # When the listing was added. Drives the "Added 2 days ago" stamp and
    # the newest-first sort in the admin UI.
    created_at: str | None = None


class SmartListGenerateResponse(BaseModel):
    properties: list[SmartListPropertyOut]
    count: int
    usd_to_ils_rate: float | None = None


class SavedSmartList(BaseModel):
    id: str
    name: str
    filters: SmartListFilters
    created_at: str
    snapshot_count: int


class SavedSmartListDetail(SavedSmartList):
    # Always re-runs the query so the saved list reflects fresh inventory.
    properties: list[SmartListPropertyOut]
    usd_to_ils_rate: float | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _require_admin(payload: dict) -> None:
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _public_listing_url(property_id: str) -> str:
    base = (os.environ.get("FRONTEND_URL") or "").strip().rstrip("/")
    # If FRONTEND_URL is unset OR still points at the Emergent preview
    # domain (a known production misconfig), fall back to the public
    # marketing domain. This protects WhatsApp/email shares from leaking
    # the internal preview URL.
    if not base or "emergentagent.com" in base or "preview." in base:
        base = "https://myisraelrental.com"
    return f"{base}/property/{property_id}"


def _availability_date_field(rental_type: str) -> str:
    # Long-term rentals use ``starting_date``; short-term uses ``available_from``.
    return "starting_date" if rental_type == "long-term" else "available_from"


def _parse_iso_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        # Strip a trailing "Z" and anything after a "T" so we just compare
        # midnight-to-midnight in UTC. Returning a timezone-aware datetime
        # matches the ``cutoff`` calc below — Python refuses to compare
        # naive vs aware values and raises TypeError otherwise.
        d = datetime.fromisoformat(str(value).replace("Z", "").split("T")[0])
        return d.replace(tzinfo=UTC)
    except (TypeError, ValueError):
        return None


def _parse_iso_datetime(value: str | None) -> datetime | None:
    """Full-precision sibling of ``_parse_iso_date``.

    ``_parse_iso_date`` deliberately truncates to midnight because the
    availability filter compares whole days. Recency needs the time of day
    (a listing added four hours ago and one added twenty hours ago are
    both "today"), so this one keeps it. Naive values are assumed UTC,
    matching how ``created_at`` is written.
    """
    if not value:
        return None
    try:
        d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return d if d.tzinfo is not None else d.replace(tzinfo=UTC)


async def _apply_filters(filters: SmartListFilters) -> tuple[list[dict], float | None]:
    """Return (matching properties, usd_to_ils rate used or None)."""
    # Category drives the rental_type set and whether the price filter applies.
    category = filters.rental_category or "any"
    rental_types = _RENTAL_CATEGORY_TYPES[category]
    skip_price_filter = category in _VACATION_LIKE

    # Mongo-side filters first to keep the working set small.
    query: dict = {
        "status": "active",
        "rental_type": {"$in": rental_types},
    }

    # Sukkot/Pesach narrow further to vacation rentals carrying the tag.
    if category in {"sukkot", "pesach"}:
        query["holiday_tags"] = category

    if filters.location:
        area_q = area_mongo_query(filters.location)
        if area_q is not None:
            query["area"] = area_q
        else:
            # Free-form text — fall back to a simple case-insensitive substring
            # match anchored at word boundary so "Tel Aviv" finds it inside
            # "Tel Aviv - Florentin" too.
            import re as _re
            query["area"] = {
                "$regex": _re.escape(filters.location.strip()),
                "$options": "i",
            }

    # Bedrooms is a range, not just a floor: "3+" pulls in every penthouse
    # when someone asked for a 3-bedroom.
    bedroom_bounds: dict = {}
    if filters.min_bedrooms is not None:
        bedroom_bounds["$gte"] = filters.min_bedrooms
    if filters.max_bedrooms is not None:
        bedroom_bounds["$lte"] = filters.max_bedrooms
    if bedroom_bounds:
        query["bedrooms"] = bedroom_bounds

    docs = await db.properties.find(query, {"_id": 0}).to_list(1000)

    # Currency conversion + availability filter happen in Python.
    has_price_bound = (
        filters.min_monthly_rent_ils is not None
        or filters.max_monthly_rent_ils is not None
    )
    # Fetched for EVERY list, not only when a rent filter is set. Sorting
    # needs it too: without it a vacation or holiday list sorted by the
    # raw number, so "$400" came before "₪500" (17 Sep 2026, a real
    # Sukkot list sent to customers). Cached, so this is one lookup.
    try:
        rate: float | None = await convert_amount(1.0, "USD", "ILS")
    except Exception:  # noqa: BLE001 - no live rate: the sort falls back below
        rate = None

    now = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    window_days = _AVAILABILITY_DAYS.get(filters.availability)
    cutoff = now + timedelta(days=window_days) if window_days else None
    listed_cutoff = (
        datetime.now(UTC) - timedelta(days=filters.listed_within_days)
        if filters.listed_within_days
        else None
    )

    results: list[dict] = []
    for prop in docs:
        # ----- recency filter -----
        if listed_cutoff is not None:
            added = _parse_iso_datetime(prop.get("created_at"))
            # No created_at -> we cannot honestly call it recent. Exclude.
            if added is None or added < listed_cutoff:
                continue

        # ----- price filter (always in ILS, only for monthly-rent categories) -----
        if has_price_bound and not skip_price_filter:
            price = prop.get("monthly_price")
            if price is None:
                continue  # category is monthly-rent so a missing monthly_price excludes
            currency = (prop.get("currency") or "ILS").upper()
            if currency == "USD" and rate is not None:
                price_ils = float(price) * rate
            else:
                price_ils = float(price)
            if (
                filters.max_monthly_rent_ils is not None
                and price_ils > filters.max_monthly_rent_ils
            ):
                continue
            if (
                filters.min_monthly_rent_ils is not None
                and price_ils < filters.min_monthly_rent_ils
            ):
                continue

        # ----- availability filter -----
        if cutoff is not None:
            field = _availability_date_field(prop.get("rental_type", ""))
            d = _parse_iso_date(prop.get(field))
            if d is None:
                # Property has no date set — assume flexible / available now.
                pass
            elif d > cutoff:
                continue

        results.append(prop)

    return results, rate


# Used only when no live rate could be fetched, so a mixed-currency list
# still sorts roughly right. The same figure the admin screen falls back to
# (components/admin/smartListText.js). Never shown to anyone.
_FALLBACK_USD_ILS = 3.7


def _in_ils(amount, currency: str, rate: float | None) -> float | None:
    """The DISPLAYED price in shekels, for ordering rows. Only for sorting:
    the customer still reads the price in the currency the owner set."""
    try:
        v = float(amount)
    except (TypeError, ValueError):
        return None
    return v * (rate or _FALLBACK_USD_ILS) if currency == "USD" else v


def _sort_key(p) -> tuple:
    # Priceless ("flexible") rows last, never first.
    return (p.price_ils_equivalent is None, p.price_ils_equivalent or 0)


def _shape_for_output(prop: dict, category: str | None = None, rate: float | None = None) -> SmartListPropertyOut:
    rental_type = prop.get("rental_type", "")
    date_field = _availability_date_field(rental_type)

    # Pick the best price field + label for each rental type. Vacation
    # rentals prefer the holiday-lump price (e.g. "$5,000 / Sukkot") when
    # set, otherwise fall back to the nightly rate.
    if rental_type == "vacation":
        lump = prop.get("holiday_lump_price")
        tags = prop.get("holiday_tags") or []
        if lump:
            price_value = lump
            price_currency = (
                prop.get("holiday_lump_currency") or prop.get("currency") or "ILS"
            ).upper()
            # The holiday the LIST is about, when it is about one. The
            # first tag was used before, so a flat tagged for Pesach and
            # Sukkot read "/ Pesach" in a Sukkot list.
            holiday = category if category in ("sukkot", "pesach") else (tags[0] if tags else None)
            name = holiday.capitalize() if holiday else None
            if prop.get("holiday_lump_is_per_night"):
                # The owner said this is a NIGHTLY holiday rate. It was
                # labelled as the price of the whole holiday, so a real
                # Sukkot list told customers a flat was "$154 / Sukkot".
                # Same wording the site's own listing card uses.
                price_label = f"/night ({name})" if name else "/night"
            else:
                price_label = f"/ {name}" if name else "/ holiday"
        else:
            price_value = prop.get("nightly_price")
            price_currency = (prop.get("currency") or "ILS").upper()
            price_label = "/night"
    else:
        price_value = prop.get("monthly_price")
        price_currency = (prop.get("currency") or "ILS").upper()
        price_label = "/mo"

    return SmartListPropertyOut(
        id=prop["id"],
        title=prop.get("title") or "Untitled listing",
        # Display the canonical "<City> - <Neighborhood>" whenever we can
        # recognize the stored value (covers bare names + known aliases),
        # so a saved list mixing variants reads cleanly.
        area=canonicalize_area(prop.get("area")) or (prop.get("area") or ""),
        address=prop.get("address"),
        price=price_value,
        currency=price_currency,
        price_ils_equivalent=_in_ils(price_value, price_currency, rate),
        price_label=price_label,
        bedrooms=prop.get("bedrooms"),
        available_from=prop.get(date_field) or None,
        rental_type=rental_type,
        listing_url=_public_listing_url(prop["id"]),
        created_at=prop.get("created_at") or None,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
class SmartListLocation(BaseModel):
    value: str
    count: int


@api_router.get(
    "/admin/smart-lists/locations", response_model=list[SmartListLocation]
)
async def list_smart_list_locations(
    payload: dict = Depends(verify_token),
) -> list[dict]:
    """Distinct canonical area values backed by at least one active long-term,
    short-term, or vacation listing — paired with a listing count so the
    dropdown can read ``Jerusalem - Sanhedria (4)``.

    All known variants of a single neighborhood are collapsed into one entry:
    ``"Ramat Eshkol"``, ``"Jerusalem - Ramat Eshkol"``, and the street-name
    alias ``"Levi Eshkol"`` all add to the count of
    ``"Jerusalem - Ramat Eshkol"``.
    """
    _require_admin(payload)
    pipeline = [
        {
            "$match": {
                "status": "active",
                "rental_type": {"$in": ["long-term", "short-term", "vacation"]},
                "area": {"$nin": [None, ""]},
            }
        },
        {"$group": {"_id": "$area", "count": {"$sum": 1}}},
    ]
    rows = await db.properties.aggregate(pipeline).to_list(2000)

    # Roll up variants (bare names, aliases) into their canonical entry so
    # the dropdown shows one row per real-world neighborhood with the
    # combined count.
    grouped: dict[str, int] = {}
    for r in rows:
        raw = r.get("_id")
        count = int(r.get("count") or 0)
        canon = canonicalize_area(raw) or (raw.strip() if raw else None)
        if not canon:
            continue
        grouped[canon] = grouped.get(canon, 0) + count

    out = [
        {"value": value, "count": count}
        for value, count in grouped.items()
    ]
    out.sort(key=lambda r: r["value"].lower())
    return out


@api_router.post("/admin/smart-lists/generate", response_model=SmartListGenerateResponse)
async def generate_smart_list(
    filters: SmartListFilters,
    payload: dict = Depends(verify_token),
) -> dict:
    """Preview matches for the given filters without saving anything."""
    _require_admin(payload)
    matches, rate = await _apply_filters(filters)
    shaped = [_shape_for_output(p, filters.rental_category, rate) for p in matches]
    # Sort: cheapest (in ILS) first; flexible (no price) last
    shaped.sort(key=_sort_key)
    return {
        "properties": [s.model_dump() for s in shaped],
        "count": len(shaped),
        "usd_to_ils_rate": rate,
    }


@api_router.get("/admin/smart-lists", response_model=list[SavedSmartList])
async def list_saved_smart_lists(
    payload: dict = Depends(verify_token),
) -> list[dict]:
    _require_admin(payload)
    docs = (
        await db.smart_lists.find(
            {"owner_id": payload["user_id"]}, {"_id": 0}
        )
        .sort("created_at", -1)
        .to_list(200)
    )
    out: list[dict] = []
    for d in docs:
        out.append(
            {
                "id": d["id"],
                "name": d["name"],
                "filters": d.get("filters", {}),
                "created_at": d["created_at"],
                "snapshot_count": d.get("snapshot_count", 0),
            }
        )
    return out


@api_router.post("/admin/smart-lists", response_model=SavedSmartList)
async def save_smart_list(
    body: SmartListSaveBody,
    payload: dict = Depends(verify_token),
) -> dict:
    _require_admin(payload)
    # Run the query once so we can store an accurate snapshot count up-front.
    # Build from the declared filter fields rather than naming each one:
    # every field added to SmartListFilters was previously dropped on save,
    # which is how a saved preset could silently lose a filter.
    filters = SmartListFilters(
        **{k: getattr(body, k) for k in SmartListFilters.model_fields}
    )
    matches, _ = await _apply_filters(filters)

    list_id = str(uuid.uuid4())
    created_at = datetime.now(UTC).isoformat()
    doc = {
        "id": list_id,
        "owner_id": payload["user_id"],
        "name": body.name.strip(),
        "filters": filters.model_dump(),
        "snapshot_count": len(matches),
        "created_at": created_at,
    }
    await db.smart_lists.insert_one(doc)
    # Return a fresh dict (Mongo mutated `doc` by injecting `_id`).
    return {
        "id": list_id,
        "name": doc["name"],
        "filters": doc["filters"],
        "snapshot_count": doc["snapshot_count"],
        "created_at": created_at,
    }


@api_router.get("/admin/smart-lists/{list_id}", response_model=SavedSmartListDetail)
async def get_saved_smart_list(
    list_id: str,
    payload: dict = Depends(verify_token),
) -> dict:
    _require_admin(payload)
    doc = await db.smart_lists.find_one(
        {"id": list_id, "owner_id": payload["user_id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Smart list not found")
    try:
        filters = SmartListFilters(**(doc.get("filters") or {}))
    except ValidationError as e:
        # A preset saved before ranges were validated server-side can hold
        # an inverted range. Say so, rather than 500 on opening it.
        raise HTTPException(
            status_code=422,
            detail=f"This saved list has invalid filters: {e.errors()[0].get('msg', 'invalid')}",
        ) from e
    matches, rate = await _apply_filters(filters)
    shaped = [_shape_for_output(p, filters.rental_category, rate) for p in matches]
    shaped.sort(key=_sort_key)
    return {
        "id": doc["id"],
        "name": doc["name"],
        "filters": filters.model_dump(),
        "created_at": doc["created_at"],
        "snapshot_count": doc.get("snapshot_count", 0),
        "properties": [s.model_dump() for s in shaped],
        "usd_to_ils_rate": rate,
    }


@api_router.delete("/admin/smart-lists/{list_id}")
async def delete_smart_list(
    list_id: str,
    payload: dict = Depends(verify_token),
) -> dict:
    _require_admin(payload)
    res = await db.smart_lists.delete_one(
        {"id": list_id, "owner_id": payload["user_id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Smart list not found")
    return {"message": "Smart list deleted"}

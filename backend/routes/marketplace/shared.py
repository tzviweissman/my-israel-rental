"""Services Marketplace — shared helpers, constants, and Pydantic
models used by every sub-module of the ``routes.marketplace`` package.

Extracted from the monolithic ``marketplace.py`` in the 2026-07 refactor.
Nothing behavioural changed — the router itself now lives in each
sub-module and gets aggregated by ``__init__.py``.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, logger

UTC = timezone.utc

# ---- Subscription plan constants -------------------------------------------
SUBSCRIPTION_PRICE = 25.00
SUBSCRIPTION_CURRENCY = "USD"
SUBSCRIPTION_INTERVAL = "MONTH"
PLAN_NAME = "MyIsraelRental Pro (monthly)"
PLAN_DESCRIPTION = "Publish unlimited gigs on the MyIsraelRental Services Marketplace."
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://myisraelrental.com").rstrip("/")


async def auto_translate_gig_inline(
    title: str | None, description: str | None,
) -> dict[str, str]:
    """Translate English gig copy to Hebrew inline (synchronously, in the
    request path). Returns just the ``title_he`` / ``description_he``
    dict for the caller to persist — this function itself is DB-free so
    ``create_gig`` can merge the result into the in-memory doc before
    the first Mongo write, avoiding a second update round-trip.

    Adds ~3-6 s per missing field to the response latency but ensures
    Hebrew renters see native copy immediately when the gig goes live.
    LLM failures are logged and the empty dict is returned — provider's
    publish still succeeds, English copy still serves.
    """
    from utils.translate import translate_marketing_to_hebrew

    updates: dict[str, str] = {}
    try:
        if (title or "").strip():
            updates["title_he"] = await translate_marketing_to_hebrew(title)
        if (description or "").strip():
            updates["description_he"] = await translate_marketing_to_hebrew(description)
    except Exception as e:  # noqa: BLE001 — top-level around a network call
        logger.warning("[auto-translate-inline] failed: %s", e)
        return {}
    return updates


async def auto_translate_gig_bg(gig_id: str, title: str | None, description: str | None) -> None:
    """Fire-and-forget: translate the English title / description to
    Hebrew and cache the results on the gig doc so Hebrew-locale renters
    see native copy on the very next request.

    Called by ``create_gig`` after insert, and by ``patch_gig`` whenever
    the English text changes. Kept out of the request path so provider
    saves stay snappy (LLM call takes 1-3 s). If translation fails, the
    English text still serves — no user-visible regression.
    """
    from utils.translate import translate_marketing_to_hebrew

    updates: dict[str, str] = {}
    try:
        if (title or "").strip():
            updates["title_he"] = await translate_marketing_to_hebrew(title)
        if (description or "").strip():
            updates["description_he"] = await translate_marketing_to_hebrew(description)
    except Exception as e:  # noqa: BLE001 — top-level around a network call
        logger.warning("[auto-translate] gig=%s failed: %s", gig_id, e)
        return
    if updates:
        await db.marketplace_gigs.update_one({"_id": gig_id}, {"$set": updates})
        logger.info("[auto-translate] gig=%s wrote %s", gig_id, list(updates))

# 12 seed categories per user's Phase 1 scope (2026-07-01).
CATEGORIES = [
    {"slug": "tours-activities",     "label": "Tours & Activities",       "icon": "map"},
    {"slug": "music-entertainment",  "label": "Music & Entertainment",    "icon": "music"},
    {"slug": "real-estate-services", "label": "Real Estate Services",     "icon": "home"},
    {"slug": "health-fitness",       "label": "Health & Fitness",         "icon": "dumbbell"},
    {"slug": "transportation",       "label": "Transportation",           "icon": "car"},
    {"slug": "home-organizers",      "label": "Home and Living",          "icon": "boxes"},
    {"slug": "hotels-travel",        "label": "Hotels / Travel Agencies", "icon": "plane"},
    {"slug": "home-repair",          "label": "Home Service / Repair",    "icon": "wrench"},
    {"slug": "womens-spa",           "label": "Personal Care",            "icon": "scissors"},
    {"slug": "bookkeeping",          "label": "Bookkeeping",              "icon": "book"},
    {"slug": "photography",          "label": "Photography",              "icon": "camera"},
    {"slug": "graphic-design",       "label": "Graphic Design",           "icon": "palette"},
]
_CATEGORY_SLUGS = {c["slug"] for c in CATEGORIES}

# Curated Israeli cities most likely to host marketplace providers. The
# `label` is the matcher — a case-insensitive substring against the gig's
# `area` field. `slug` is only used for the URL query param.
LOCATIONS = [
    {"slug": "jerusalem",    "label": "Jerusalem",     "lat": 31.784, "lng": 35.217},
    {"slug": "tel-aviv",     "label": "Tel Aviv",      "lat": 32.084, "lng": 34.782},
    {"slug": "bet-shemesh",  "label": "Bet Shemesh",   "lat": 31.744, "lng": 34.986},
    {"slug": "modiin",       "label": "Modiin",        "lat": 31.899, "lng": 35.010},
    {"slug": "netanya",      "label": "Netanya",       "lat": 32.328, "lng": 34.856},
    {"slug": "haifa",        "label": "Haifa",         "lat": 32.794, "lng": 34.989},
    {"slug": "ashdod",       "label": "Ashdod",        "lat": 31.802, "lng": 34.643},
    {"slug": "beersheba",    "label": "Beersheba",     "lat": 31.252, "lng": 34.791},
    {"slug": "herzliya",     "label": "Herzliya",      "lat": 32.166, "lng": 34.844},
    {"slug": "raanana",      "label": "Ra'anana",      "lat": 32.185, "lng": 34.870},
    {"slug": "rishon",       "label": "Rishon LeZion", "lat": 31.973, "lng": 34.789},
    {"slug": "petah-tikva",  "label": "Petah Tikva",   "lat": 32.088, "lng": 34.886},
]
_LOCATION_BY_SLUG = {loc["slug"]: loc for loc in LOCATIONS}
# label → coords fallback so gigs whose `area` is a free-text city name
# (e.g. "Tel Aviv, Florentin") still resolve without a slug rewrite.
_LOCATION_BY_LABEL = {loc["label"].lower(): loc for loc in LOCATIONS}


def _resolve_gig_coords(gig: dict[str, Any]) -> Optional[tuple[float, float]]:
    """Best-effort lat/lng for a gig. Prefers an explicit `lat`/`lng` on
    the gig doc (future-proof for providers who set precise coordinates),
    falls back to city-center coords parsed from `area`."""
    lat = gig.get("lat")
    lng = gig.get("lng")
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        return (float(lat), float(lng))
    area = (gig.get("area") or "").strip()
    if not area:
        return None
    head = area.split(",", 1)[0].strip().lower()
    loc = _LOCATION_BY_LABEL.get(head)
    if loc:
        return (loc["lat"], loc["lng"])
    return None


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance between two lat/lng pairs in kilometers.
    Cheap enough to run on the whole gig list — even a full Israel-wide
    catalog is only a few hundred docs post-filter."""
    from math import radians, sin, cos, asin, sqrt
    lat1, lon1 = a
    lat2, lon2 = b
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    h = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return round(2 * 6371.0088 * asin(sqrt(h)), 2)



# Supported provider languages for the "spoken languages" filter/facet.
# Ordered by relevance in Israel — English + Hebrew are the two most common
# so they render first in multi-selects. Kept as a top-level constant so
# tests and the frontend can import the same list.
SUPPORTED_LANGUAGES = [
    "English", "Hebrew", "Russian", "French",
    "Arabic", "Spanish", "Amharic", "Yiddish",
]
_LANGUAGE_SET = set(SUPPORTED_LANGUAGES)

# Response-time badge thresholds. Providers with fewer than
# MIN_RESPONSES_FOR_BADGE recorded responses show no badge (statistical
# floor — one lucky quick reply shouldn't earn "Replies in 1h" forever).
MIN_RESPONSES_FOR_BADGE = 3
RESPONSE_FAST_HOURS = 1.0
RESPONSE_MED_HOURS = 24.0

# Top-Rated thresholds — mirrors the values shown in the plan doc.
TOP_RATED_MIN_AVG = 4.7
TOP_RATED_MIN_COUNT = 10


# --------------------------- Models --------------------------- #

class PricingTier(BaseModel):
    name: str = "Basic"            # Barber "Haircut" / logo "Basic package"
    price: float                   # ILS by default
    currency: str = "ILS"
    # `delivery_days` is used by Deliverable gigs (logo design, translation,
    # cleaning). `duration_minutes` is used by Appointment gigs (barber,
    # massage, coaching) so the calendar knows how long each slot is.
    # Only one applies per gig — enforced client-side by the wizard.
    delivery_days: Optional[int] = None
    duration_minutes: Optional[int] = None
    description: str = ""
    features: list[str] = Field(default_factory=list)
    # Optional per-tier image gallery. Lets a tour guide with two very
    # different offerings (Jerusalem walking tour vs. Tel Aviv beach
    # tour) attach photos specific to each option instead of dumping
    # everything into the gig-wide gallery.
    images: list[str] = Field(default_factory=list)


class ProductItem(BaseModel):
    """One product row on a Store-type gig.

    Stores don't do slot booking or turnaround — they showcase products
    and let the buyer message the seller. Kept lean on purpose so the
    onboarding stays fast.
    """
    name: str
    price: float
    currency: str = "ILS"
    description: str = ""
    image: Optional[str] = None      # single URL — thumbnail
    in_stock: bool = True


class WeeklyWindow(BaseModel):
    """One open window in the weekly availability grid used by
    Appointment gigs. Times are 24h ``HH:MM`` strings.
    """
    start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    end: str = Field(..., pattern=r"^\d{2}:\d{2}$")


# Empty windows list per day = closed. Providers only fill days they work.
_DEFAULT_WEEKLY: dict[str, list[WeeklyWindow]] = {
    "mon": [], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": [],
}


class GigIn(BaseModel):
    title: str
    category: str
    description: str = ""
    title_he: Optional[str] = None
    description_he: Optional[str] = None
    # Gig shape drives which fields apply. Defaults to `deliverable` so
    # any legacy client hitting the API without the new field keeps its
    # current behaviour (tiers + optional days-to-complete).
    gig_type: str = Field("deliverable", pattern="^(store|deliverable|appointment)$")
    tiers: list[PricingTier] = Field(default_factory=list)
    products: list[ProductItem] = Field(default_factory=list)         # Store only
    # Appointment-only: weekly recurring hours + slot duration. `weekly_availability`
    # is a dict keyed by weekday abbreviation → list of open windows.
    weekly_availability: Optional[dict[str, list[WeeklyWindow]]] = None
    slot_duration_minutes: Optional[int] = 30
    # Deliverable-only optional toggle: when true, buyer picks the target
    # service date on the booking form (cleaner arrives on Tuesday, etc.).
    enable_date_booking: bool = False
    gallery: list[str] = Field(default_factory=list)
    booking_mode: str = "whatsapp"
    whatsapp: Optional[str] = None
    area: Optional[str] = None
    faqs: list[dict[str, str]] = Field(default_factory=list)


class GigPatch(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    title_he: Optional[str] = None
    description_he: Optional[str] = None
    gig_type: Optional[str] = Field(None, pattern="^(store|deliverable|appointment)$")
    tiers: Optional[list[PricingTier]] = None
    products: Optional[list[ProductItem]] = None
    weekly_availability: Optional[dict[str, list[WeeklyWindow]]] = None
    slot_duration_minutes: Optional[int] = None
    enable_date_booking: Optional[bool] = None
    gallery: Optional[list[str]] = None
    booking_mode: Optional[str] = None
    whatsapp: Optional[str] = None
    area: Optional[str] = None
    faqs: Optional[list[dict[str, str]]] = None
    status: Optional[str] = None      # "draft" | "published" | "paused"


class CredentialDoc(BaseModel):
    url: str
    label: str = ""


class ProviderPatch(BaseModel):
    bio: Optional[str] = None
    whatsapp: Optional[str] = None
    avatar: Optional[str] = None
    tagline: Optional[str] = None
    # Trust & Discovery extensions — all optional, no admin review.
    languages: Optional[list[str]] = None
    credentials: Optional[str] = None
    credential_docs: Optional[list[CredentialDoc]] = None


class BookingIn(BaseModel):
    tier_name: str
    message: str = ""
    contact_email: str
    contact_phone: Optional[str] = None
    preferred_date: Optional[str] = None                  # ISO YYYY-MM-DD
    # Appointment-only. Provider-side time slot chosen by the buyer.
    # Format: ``HH:MM`` in the provider's local time (Israel).
    time_slot: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")


class BookingPatch(BaseModel):
    # Provider action on an in-platform booking. Transitions from `pending`
    # feed the response-time EMA on the provider record.
    status: str = Field(..., pattern="^(accepted|declined|completed|cancelled)$")
    reply: str = ""


class ReviewIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    # Cap at 1000 chars so an attacker can't post 10 MB of text to the
    # public reviews collection (bandwidth + storage DoS).
    comment: str = Field("", max_length=1000)


# --------------------------- Helpers --------------------------- #

def _validate_category(cat: str) -> None:
    if cat not in _CATEGORY_SLUGS:
        raise HTTPException(status_code=400, detail=f"Unknown category '{cat}'")


async def _ensure_provider_record(user_id: str) -> dict[str, Any]:
    """Create the marketplace_providers row on first gig create. Every
    provider starts with a 30-day trial — after that their gigs stop
    showing publicly until subscription_status flips to 'active'."""
    prov = await db.marketplace_providers.find_one({"user_id": user_id})
    if prov:
        return prov
    now = datetime.now(UTC)
    prov = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "bio": "",
        "tagline": "",
        "avatar": None,
        "whatsapp": None,
        "subscription_status": "trial",
        "trial_ends_at": (now + timedelta(days=30)).isoformat(),
        "subscribed_until": None,
        "created_at": now.isoformat(),
        # Trust & Discovery defaults — all optional/empty. Populated via
        # PATCH /providers/me + the booking status EMA hook below.
        "languages": [],
        "credentials": "",
        "credential_docs": [],
        "avg_response_hours": None,
        "response_count": 0,
    }
    await db.marketplace_providers.insert_one(prov)
    return prov


def _response_bucket(prov: dict[str, Any]) -> Optional[str]:
    """Bucket the provider's rolling response-time EMA into one of the
    UI badge tiers. Returns None below the statistical floor so we never
    show a badge from a single lucky reply."""
    count = prov.get("response_count") or 0
    avg = prov.get("avg_response_hours")
    if count < MIN_RESPONSES_FOR_BADGE or avg is None:
        return None
    if avg <= RESPONSE_FAST_HOURS:
        return "1h"
    if avg <= RESPONSE_MED_HOURS:
        return "24h"
    return None


def _member_since_year(user: Optional[dict[str, Any]], prov: Optional[dict[str, Any]]) -> Optional[int]:
    """Parse the ISO created_at from either the user or provider record.
    Prefer the user's account age (more meaningful) with the provider
    record as a fallback for legacy rows."""
    for source in (user, prov):
        if not source:
            continue
        created = source.get("created_at")
        if isinstance(created, str) and len(created) >= 4:
            try:
                return int(created[:4])
            except ValueError:
                continue
    return None


def _cheapest_tier_price(gig: dict[str, Any]) -> Optional[float]:
    """Lowest price on a gig, coerced to a float. Used by the price
    filter + price_asc sort. Store gigs use the cheapest product; other
    types use the cheapest tier — whichever list applies is scanned."""
    rows: list[dict[str, Any]] = []
    if (gig.get("gig_type") or "deliverable") == "store":
        rows = gig.get("products") or []
    else:
        rows = gig.get("tiers") or []
    prices: list[float] = []
    for t in rows:
        p = t.get("price") if isinstance(t, dict) else None
        try:
            prices.append(float(p))
        except (TypeError, ValueError):
            continue
    return min(prices) if prices else None


async def _update_response_ema(provider_user_id: str, elapsed_hours: float) -> None:
    """Update the provider's rolling response-time on a booking status
    transition out of 'pending'. Uses a simple EMA with alpha=0.4 so
    recent replies weigh a bit more than the historical average — new
    behavior (getting faster/slower) shows up in ~3-4 responses."""
    if elapsed_hours < 0:
        return
    prov = await db.marketplace_providers.find_one({"user_id": provider_user_id})
    if not prov:
        return
    prev_avg = prov.get("avg_response_hours")
    prev_count = prov.get("response_count") or 0
    if prev_avg is None or prev_count == 0:
        new_avg = elapsed_hours
    else:
        alpha = 0.4
        new_avg = alpha * elapsed_hours + (1 - alpha) * float(prev_avg)
    await db.marketplace_providers.update_one(
        {"user_id": provider_user_id},
        {"$set": {"avg_response_hours": round(new_avg, 2), "response_count": prev_count + 1}},
    )


def _provider_is_active(prov: dict[str, Any]) -> bool:
    """True while the provider can still publish new/active gigs."""
    if prov.get("subscription_status") == "active":
        return True
    trial_end = prov.get("trial_ends_at")
    if not trial_end:
        return False
    try:
        return datetime.fromisoformat(trial_end) > datetime.now(UTC)
    except (ValueError, TypeError):
        return False


def _clean_gig(gig: dict[str, Any]) -> dict[str, Any]:
    """Strip Mongo internals + rename `_id` → `id` for the API surface."""
    gig["id"] = gig.pop("_id", gig.get("id"))
    return gig


async def _rating_aggregate(gig_id: str) -> dict[str, Any]:
    """Compute {rating_avg, rating_count} for one gig. Small scale — a
    single `$group` over the reviews collection. `rating_avg` is rounded
    to 1 decimal so the UI can render '4.7' without runtime math."""
    pipeline = [
        {"$match": {"gig_id": gig_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    async for row in db.marketplace_reviews.aggregate(pipeline):
        return {
            "rating_avg": round(row["avg"], 1) if row.get("avg") is not None else None,
            "rating_count": row.get("count", 0),
        }
    return {"rating_avg": None, "rating_count": 0}


async def _batch_rating_aggregate(gig_ids: list[str]) -> dict[str, dict[str, Any]]:
    """Batched version — single aggregation across many gigs at once so
    the public browse route doesn't fire N+1 review queries."""
    if not gig_ids:
        return {}
    pipeline = [
        {"$match": {"gig_id": {"$in": gig_ids}}},
        {"$group": {"_id": "$gig_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    result: dict[str, dict[str, Any]] = {}
    async for row in db.marketplace_reviews.aggregate(pipeline):
        result[row["_id"]] = {
            "rating_avg": round(row["avg"], 1) if row.get("avg") is not None else None,
            "rating_count": row.get("count", 0),
        }
    return result


"""Services Marketplace — Phase 1a MVP.

Fee model: monthly subscription for providers (30-day trial on first gig,
`subscription_status` gates public visibility once the trial ends). Real
payment wiring lands in Phase 1b — for now the "Upgrade to Pro" flow
just flips the flag server-side.

Booking: each gig picks one of two modes at creation time —
  * `whatsapp` — clients see a WhatsApp deep-link on the gig detail
  * `in_platform` — clients submit a booking request, which stores a
    row and (Phase 1b) fires notifications to the provider.

Endpoints:
  GET  /api/marketplace/categories                — 12 seed categories
  GET  /api/marketplace/gigs                      — public browse, ?category, ?q
  POST /api/marketplace/gigs                      — auth: create a gig
  GET  /api/marketplace/gigs/{id}                 — public detail
  PATCH /api/marketplace/gigs/{id}                — auth: owner update
  DELETE /api/marketplace/gigs/{id}               — auth: owner delete
  POST /api/marketplace/gigs/{id}/book            — auth: in-platform booking
  GET  /api/marketplace/providers/{user_id}       — public provider profile
  PATCH /api/marketplace/providers/me             — auth: update own profile
  POST /api/marketplace/subscription/upgrade      — auth: flip subscription flag
  GET  /api/marketplace/my-gigs                   — auth: gigs I own
"""
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from routes.deps import db, logger, verify_token
from utils import paypal

UTC = timezone.utc

# ---- Subscription plan constants -------------------------------------------
SUBSCRIPTION_PRICE = 25.00
SUBSCRIPTION_CURRENCY = "USD"
SUBSCRIPTION_INTERVAL = "MONTH"
PLAN_NAME = "MyIsraelRental Pro (monthly)"
PLAN_DESCRIPTION = "Publish unlimited gigs on the MyIsraelRental Services Marketplace."
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://myisraelrental.com").rstrip("/")

# 12 seed categories per user's Phase 1 scope (2026-07-01).
CATEGORIES = [
    {"slug": "tours-activities",     "label": "Tours & Activities",       "icon": "map"},
    {"slug": "music-entertainment",  "label": "Music & Entertainment",    "icon": "music"},
    {"slug": "real-estate-services", "label": "Real Estate Services",     "icon": "home"},
    {"slug": "health-fitness",       "label": "Health & Fitness",         "icon": "dumbbell"},
    {"slug": "transportation",       "label": "Transportation",           "icon": "car"},
    {"slug": "home-organizers",      "label": "Home Organizers",          "icon": "boxes"},
    {"slug": "hotels-travel",        "label": "Hotels / Travel Agencies", "icon": "plane"},
    {"slug": "home-repair",          "label": "Home Service / Repair",    "icon": "wrench"},
    {"slug": "womens-spa",           "label": "Women's Spa / Care",       "icon": "flower"},
    {"slug": "bookkeeping",          "label": "Bookkeeping",              "icon": "book"},
    {"slug": "photography",          "label": "Photography",              "icon": "camera"},
    {"slug": "graphic-design",       "label": "Graphic Design",           "icon": "palette"},
]
_CATEGORY_SLUGS = {c["slug"] for c in CATEGORIES}

# Curated Israeli cities most likely to host marketplace providers. The
# `label` is the matcher — a case-insensitive substring against the gig's
# `area` field. `slug` is only used for the URL query param.
LOCATIONS = [
    {"slug": "jerusalem",    "label": "Jerusalem"},
    {"slug": "tel-aviv",     "label": "Tel Aviv"},
    {"slug": "bet-shemesh",  "label": "Bet Shemesh"},
    {"slug": "modiin",       "label": "Modiin"},
    {"slug": "netanya",      "label": "Netanya"},
    {"slug": "haifa",        "label": "Haifa"},
    {"slug": "ashdod",       "label": "Ashdod"},
    {"slug": "beersheba",    "label": "Beersheba"},
    {"slug": "herzliya",     "label": "Herzliya"},
    {"slug": "raanana",      "label": "Ra'anana"},
    {"slug": "rishon",       "label": "Rishon LeZion"},
    {"slug": "petah-tikva",  "label": "Petah Tikva"},
]
_LOCATION_BY_SLUG = {loc["slug"]: loc for loc in LOCATIONS}

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

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
    name: str = "Basic"            # Basic / Standard / Premium (free-form)
    price: float                   # ILS by default
    currency: str = "ILS"
    delivery_days: Optional[int] = None
    description: str = ""
    features: list[str] = Field(default_factory=list)


class GigIn(BaseModel):
    title: str
    category: str
    description: str = ""
    title_he: Optional[str] = None
    description_he: Optional[str] = None
    tiers: list[PricingTier] = Field(default_factory=list)
    gallery: list[str] = Field(default_factory=list)      # image URLs
    booking_mode: str = "whatsapp"                        # "whatsapp" | "in_platform"
    whatsapp: Optional[str] = None                        # required if booking_mode = whatsapp
    area: Optional[str] = None                            # Tel Aviv / Jerusalem / etc.
    faqs: list[dict[str, str]] = Field(default_factory=list)  # [{q, a}]


class GigPatch(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    title_he: Optional[str] = None
    description_he: Optional[str] = None
    tiers: Optional[list[PricingTier]] = None
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
    """Lowest tier price on a gig, coerced to a float. Used by the price
    filter + price_asc sort."""
    tiers = gig.get("tiers") or []
    prices: list[float] = []
    for t in tiers:
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


async def _get_or_create_billing_plan() -> str:
    """Return the PayPal plan_id for our Pro subscription. Caches the id
    (plus the parent product_id) in the `marketplace_settings` singleton
    doc so repeated deploys don't create duplicate plans on PayPal."""
    settings = await db.marketplace_settings.find_one({"_id": "paypal_plan"})
    if settings and settings.get("plan_id"):
        return settings["plan_id"]

    # Idempotent bootstrap: create the product first, then the plan.
    product = await paypal.create_product(name=PLAN_NAME, description=PLAN_DESCRIPTION)
    product_id = product["id"]
    plan = await paypal.create_plan(
        product_id=product_id,
        name=PLAN_NAME,
        amount=SUBSCRIPTION_PRICE,
        currency=SUBSCRIPTION_CURRENCY,
        interval_unit=SUBSCRIPTION_INTERVAL,
        interval_count=1,
    )
    plan_id = plan["id"]
    await db.marketplace_settings.update_one(
        {"_id": "paypal_plan"},
        {"$set": {
            "product_id": product_id,
            "plan_id": plan_id,
            "amount": SUBSCRIPTION_PRICE,
            "currency": SUBSCRIPTION_CURRENCY,
            "created_at": datetime.now(UTC).isoformat(),
        }},
        upsert=True,
    )
    logger.info("[marketplace] Created PayPal product=%s plan=%s", product_id, plan_id)
    return plan_id


# --------------------------- Routes --------------------------- #

@router.get("/categories")
async def list_categories():
    return CATEGORIES


@router.get("/locations")
async def list_locations():
    """Return curated locations with a live count of published gigs
    matching each city (case-insensitive `area` substring). Cities with
    zero listings still ship so providers can see them as valid targets."""
    counts: dict[str, int] = {loc["slug"]: 0 for loc in LOCATIONS}
    # One aggregation across all published gigs — filter to active
    # providers inline so the counts match what the browse page shows.
    active_ids = {
        p["user_id"] async for p in db.marketplace_providers.find({}, {"user_id": 1, "subscription_status": 1, "trial_ends_at": 1, "active": 1})
        if _provider_is_active(p)
    }
    async for gig in db.marketplace_gigs.find(
        {"status": "published", "provider_user_id": {"$in": list(active_ids)}},
        {"area": 1},
    ):
        area = (gig.get("area") or "").lower()
        if not area:
            continue
        for loc in LOCATIONS:
            if loc["label"].lower() in area:
                counts[loc["slug"]] += 1
                break
    return [{**loc, "count": counts[loc["slug"]]} for loc in LOCATIONS]


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
    sort: Optional[str] = Query("match", pattern="^(match|rating|reviews|newest|price_asc)$"),
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


@router.get("/languages")
async def list_languages():
    """Return the closed set of provider-language options — the frontend
    filter modal + edit-profile chips read from this to guarantee they
    stay in sync with the backend allowlist."""
    return SUPPORTED_LANGUAGES


@router.get("/providers/{user_id}")
async def public_provider(user_id: str):
    prov = await db.marketplace_providers.find_one({"user_id": user_id})
    if not prov:
        raise HTTPException(status_code=404, detail="Provider not found")
    user = await db.users.find_one({"_id": user_id}) or await db.users.find_one({"id": user_id})
    cursor = db.marketplace_gigs.find({"provider_user_id": user_id, "status": "published"}).sort("created_at", -1)
    raw = [g async for g in cursor]
    ratings = await _batch_rating_aggregate([g["_id"] for g in raw])
    for g in raw:
        agg = ratings.get(g["_id"], {"rating_avg": None, "rating_count": 0})
        g["rating_avg"] = agg["rating_avg"]
        g["rating_count"] = agg["rating_count"]
        g["cheapest_price"] = _cheapest_tier_price(g)
        g["is_top_rated"] = (
            agg["rating_avg"] is not None
            and agg["rating_avg"] >= TOP_RATED_MIN_AVG
            and agg["rating_count"] >= TOP_RATED_MIN_COUNT
        )
    gigs = [_clean_gig(g) for g in raw]
    return {
        "user_id": user_id,
        "name": (user or {}).get("name", "Provider"),
        "bio": prov.get("bio", ""),
        "tagline": prov.get("tagline", ""),
        "avatar": prov.get("avatar"),
        "active": _provider_is_active(prov),
        "gigs": gigs,
        # Trust & Discovery
        "languages": prov.get("languages") or [],
        "credentials": prov.get("credentials", ""),
        "credential_docs": prov.get("credential_docs") or [],
        "response_bucket": _response_bucket(prov),
        "member_since_year": _member_since_year(user, prov),
    }


@router.patch("/providers/me")
async def update_provider(payload: ProviderPatch, user=Depends(verify_token)):
    await _ensure_provider_record(user["user_id"])
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "languages" in update:
        # Drop unknown language strings silently so a stale UI can't 400.
        update["languages"] = [lang for lang in update["languages"] if lang in _LANGUAGE_SET]
    if "credentials" in update:
        # Match the ReviewIn cap philosophy — cheap DoS protection on a
        # free-text field that renders publicly.
        update["credentials"] = update["credentials"][:2000]
    if "credential_docs" in update:
        # Coerce Pydantic → dict for Mongo, and cap at 8 docs so nobody
        # can dump their whole Google Drive here.
        update["credential_docs"] = [
            d if isinstance(d, dict) else d.model_dump()
            for d in update["credential_docs"][:8]
        ]
    await db.marketplace_providers.update_one({"user_id": user["user_id"]}, {"$set": update})
    prov = await db.marketplace_providers.find_one({"user_id": user["user_id"]})
    prov["id"] = prov.pop("_id")
    return prov


@router.post("/subscription/upgrade")
async def upgrade_subscription(user=Depends(verify_token)):
    """Start a real PayPal subscription flow. Returns an `approval_url`
    the client must redirect the provider to. PayPal will redirect the
    user back to `{FRONTEND_URL}/payment/success?subscription_id=I-XXX`
    (see `/subscription/activate` for the completion step)."""
    # Ensure the provider row exists (creates a fresh trial on first call).
    await _ensure_provider_record(user["user_id"])
    plan_id = await _get_or_create_billing_plan()

    # Look up provider email for a smoother PayPal checkout prefill.
    u = await db.users.find_one({"_id": user["user_id"]}) or await db.users.find_one({"id": user["user_id"]})
    email = (u or {}).get("email")

    return_url = f"{FRONTEND_URL}/payment/success?flow=marketplace-subscription"
    cancel_url = f"{FRONTEND_URL}/payment/cancel?flow=marketplace-subscription"
    try:
        sub = await paypal.create_subscription(
            plan_id=plan_id,
            custom_id=user["user_id"],
            return_url=return_url,
            cancel_url=cancel_url,
            subscriber_email=email,
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("PayPal create_subscription error")
        raise HTTPException(status_code=502, detail=f"PayPal error: {e}") from e

    approval_url = next(
        (link["href"] for link in sub.get("links", []) if link.get("rel") == "approve"),
        None,
    )
    if not approval_url:
        raise HTTPException(status_code=502, detail="PayPal did not return an approval URL")

    # Record the pending subscription so the webhook + activate flow can
    # look it up. Status is intentionally 'pending' until PayPal confirms.
    await db.marketplace_providers.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "paypal_subscription_id": sub["id"],
            "paypal_subscription_status": sub.get("status", "APPROVAL_PENDING"),
            "pending_since": datetime.now(UTC).isoformat(),
        }},
    )
    return {
        "ok": True,
        "subscription_id": sub["id"],
        "approval_url": approval_url,
        "amount": SUBSCRIPTION_PRICE,
        "currency": SUBSCRIPTION_CURRENCY,
    }


@router.post("/subscription/activate")
async def activate_subscription(user=Depends(verify_token)):
    """Called by the frontend after PayPal redirects the provider back
    to /payment/success. Re-fetches the subscription from PayPal to
    confirm its status is ACTIVE (or APPROVED — some flows land here
    first). Flips the provider row to `subscription_status='active'`
    and stores the next_billing_time so the UI can show it."""
    prov = await db.marketplace_providers.find_one({"user_id": user["user_id"]})
    if not prov or not prov.get("paypal_subscription_id"):
        raise HTTPException(status_code=400, detail="No pending subscription to activate")

    sub_id = prov["paypal_subscription_id"]
    try:
        sub = await paypal.get_subscription(sub_id)
    except Exception as e:  # noqa: BLE001
        logger.exception("PayPal get_subscription error during activate")
        raise HTTPException(status_code=502, detail=f"PayPal error: {e}") from e

    status = sub.get("status", "").upper()
    if status not in ("ACTIVE", "APPROVED"):
        return {
            "ok": False,
            "status": status,
            "message": f"Subscription is {status}; try again in a moment.",
        }

    next_billing = (sub.get("billing_info") or {}).get("next_billing_time")
    await db.marketplace_providers.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "subscription_status": "active",
            "paypal_subscription_status": status,
            "subscribed_until": next_billing,
            "activated_at": datetime.now(UTC).isoformat(),
        }, "$unset": {"pending_since": ""}},
    )
    return {"ok": True, "status": status, "subscribed_until": next_billing}


@router.post("/subscription/cancel")
async def cancel_subscription_route(user=Depends(verify_token)):
    """Cancel the caller's active PayPal subscription. The provider
    keeps access until the current period ends (paypal_subscription_status
    flips to CANCELLED but subscribed_until stays the same until the
    webhook fires BILLING.SUBSCRIPTION.EXPIRED)."""
    prov = await db.marketplace_providers.find_one({"user_id": user["user_id"]})
    if not prov or not prov.get("paypal_subscription_id"):
        raise HTTPException(status_code=400, detail="No active subscription")
    try:
        await paypal.cancel_subscription(prov["paypal_subscription_id"])
    except Exception as e:  # noqa: BLE001
        # PayPal returns 404 for subscriptions that are still APPROVAL_PENDING
        # (never approved) or already cancelled/expired. In both cases the
        # provider's intent is clear — mark it cancelled locally and move on.
        msg = str(e)
        if "404" not in msg and "RESOURCE_NOT_FOUND" not in msg:
            logger.exception("PayPal cancel_subscription error")
            raise HTTPException(status_code=502, detail=f"PayPal error: {e}") from e
        logger.info("PayPal cancel: subscription already gone (%s); marking cancelled locally", prov["paypal_subscription_id"])

    await db.marketplace_providers.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "paypal_subscription_status": "CANCELLED",
            "cancelled_at": datetime.now(UTC).isoformat(),
        }},
    )
    return {"ok": True, "message": "Subscription cancelled. Access continues until the current period ends."}


# --------------------------- Webhook side-effect helper --------------------- #

async def handle_subscription_webhook_event(event: dict[str, Any]) -> None:
    """Called by the shared PayPal webhook handler in routes/payments.py
    for any BILLING.SUBSCRIPTION.* or PAYMENT.SALE.* event that references
    a subscription in `resource.billing_agreement_id` or `resource.id`.
    Idempotent: safe to call twice on the same event."""
    event_type = event.get("event_type", "")
    resource = event.get("resource") or {}
    # Subscription-scoped events carry resource.id = subscription id.
    # Payment/sale events carry resource.billing_agreement_id = subscription id.
    sub_id = resource.get("id") if event_type.startswith("BILLING.SUBSCRIPTION.") else resource.get("billing_agreement_id")
    if not sub_id:
        return

    prov = await db.marketplace_providers.find_one({"paypal_subscription_id": sub_id})
    if not prov:
        logger.info("[marketplace] webhook %s: no provider matches subscription %s", event_type, sub_id)
        return

    now = datetime.now(UTC).isoformat()
    if event_type in ("BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.RE_ACTIVATED"):
        try:
            sub = await paypal.get_subscription(sub_id)
            next_billing = (sub.get("billing_info") or {}).get("next_billing_time")
        except Exception:  # noqa: BLE001
            next_billing = None
        await db.marketplace_providers.update_one(
            {"user_id": prov["user_id"]},
            {"$set": {
                "subscription_status": "active",
                "paypal_subscription_status": "ACTIVE",
                "subscribed_until": next_billing,
                "activated_at": now,
            }, "$unset": {"pending_since": ""}},
        )
    elif event_type == "PAYMENT.SALE.COMPLETED":
        # Auto-renewal succeeded — refresh the subscribed_until.
        try:
            sub = await paypal.get_subscription(sub_id)
            next_billing = (sub.get("billing_info") or {}).get("next_billing_time")
        except Exception:  # noqa: BLE001
            next_billing = None
        await db.marketplace_providers.update_one(
            {"user_id": prov["user_id"]},
            {"$set": {
                "subscription_status": "active",
                "paypal_subscription_status": "ACTIVE",
                "subscribed_until": next_billing,
                "last_renewal_at": now,
            }},
        )
    elif event_type in ("BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.SUSPENDED"):
        await db.marketplace_providers.update_one(
            {"user_id": prov["user_id"]},
            {"$set": {
                "paypal_subscription_status": event_type.split(".")[-1],
                "cancelled_at": now,
            }},
        )
    elif event_type in ("BILLING.SUBSCRIPTION.EXPIRED", "BILLING.SUBSCRIPTION.PAYMENT.FAILED"):
        await db.marketplace_providers.update_one(
            {"user_id": prov["user_id"]},
            {"$set": {
                "subscription_status": "expired",
                "paypal_subscription_status": "EXPIRED",
                "expired_at": now,
            }},
        )
    else:
        logger.info("[marketplace] webhook %s: no side-effect mapping for %s", event_type, sub_id)


# --------------------------- Reviews --------------------------- #

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

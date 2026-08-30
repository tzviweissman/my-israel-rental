"""Services Marketplace — shared helpers, constants, and Pydantic
models used by every sub-module of the ``routes.marketplace`` package.

Extracted from the monolithic ``marketplace.py`` in the 2026-07 refactor.
Nothing behavioural changed — the router itself now lives in each
sub-module and gets aggregated by ``__init__.py``.
"""
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, logger

UTC = timezone.utc

# ---- Subscription plan constants -------------------------------------------
SUBSCRIPTION_CURRENCY = "USD"
SUBSCRIPTION_INTERVAL = "MONTH"
PLAN_NAME = "MyIsraelRental Pro (monthly)"
PLAN_DESCRIPTION = "Publish unlimited gigs on the MyIsraelRental Services Marketplace."

# Commitment ladder. Longer term, lower monthly rate — the shape providers
# already expect, priced under the main competitor at every tier (they charge
# 3mo $45 / 6mo $40 / 12mo $35).
#
# Prices stay in USD because the provider base is heavily American. The UI
# renders an approximate shekel figure beside each using the LIVE rate from
# utils.helpers.get_usd_ils_rate — never a hardcoded one — and labels it
# "approx.", because the amount PayPal actually charges is the USD one.
#
# `key` is stable and ends up in the DB and in PayPal plan names. Don't
# rename one without a migration: existing subscribers are matched by it.
SUBSCRIPTION_PLANS: list[dict] = [
    {
        "key": "12mo",
        "months": 12,
        "monthly_price": 25.00,
        "headline": True,   # "Best value" badge + preselected in the UI
    },
    {
        "key": "6mo",
        "months": 6,
        "monthly_price": 30.00,
        "headline": False,
    },
    {
        "key": "3mo",
        "months": 3,
        "monthly_price": 35.00,
        "headline": False,
    },
]

SUBSCRIPTION_PLANS_BY_KEY: dict[str, dict] = {p["key"]: p for p in SUBSCRIPTION_PLANS}

# The plan a caller gets when it doesn't name one. Also what pre-ladder
# clients (and anything still posting no plan_key) fall back to.
DEFAULT_PLAN_KEY = "12mo"

# Retained so existing imports and the old single-plan billing rows keep
# resolving. Equal to the headline plan's rate.
SUBSCRIPTION_PRICE = SUBSCRIPTION_PLANS_BY_KEY[DEFAULT_PLAN_KEY]["monthly_price"]


def plan_for(key: str | None) -> dict:
    """Resolve a plan key to its definition, falling back to the default.

    Unknown keys fall back rather than raising: a stale client or a
    hand-edited request should land on a real plan, not a 500.
    """
    return SUBSCRIPTION_PLANS_BY_KEY.get(key or "", SUBSCRIPTION_PLANS_BY_KEY[DEFAULT_PLAN_KEY])


# TODO(pricing): a free/starter tier and the Verified badge are a separate,
# larger effort — they change what a provider gets, not just what they pay.
# This module only sets the paid ladder.
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
    from utils.translate import detect_lang, translate_marketing

    # Spec 1.4 — fill whichever side is MISSING, not always Hebrew. A gig
    # written in Hebrew used to be run through an English->Hebrew prompt,
    # yielding Hebrew-from-Hebrew and no English at all, so an English
    # speaker browsing services saw copy they could not read.
    source = detect_lang(title, description)
    target = "en" if source == "he" else "he"
    updates: dict[str, str] = {"source_lang": source}
    try:
        if (title or "").strip():
            updates[f"title_{target}"] = await translate_marketing(title, target)
        if (description or "").strip():
            updates[f"description_{target}"] = await translate_marketing(description, target)
    except Exception as e:  # noqa: BLE001 — top-level around a network call
        logger.warning("[auto-translate-inline] failed: %s", e)
        # source_lang is still worth keeping: it costs nothing, needed no
        # API call, and lets the UI label the original even when the
        # translation did not land.
        return {"source_lang": source}
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
    from utils.translate import detect_lang, translate_marketing

    # Same rule as the inline twin above: fill the missing side.
    source = detect_lang(title, description)
    target = "en" if source == "he" else "he"
    updates: dict[str, str] = {"source_lang": source}
    try:
        if (title or "").strip():
            updates[f"title_{target}"] = await translate_marketing(title, target)
        if (description or "").strip():
            updates[f"description_{target}"] = await translate_marketing(description, target)
    except Exception as e:  # noqa: BLE001 — top-level around a network call
        logger.warning("[auto-translate] gig=%s failed: %s", gig_id, e)
        # Record the language even on failure — free, and the retry path
        # below reads it.
        await db.marketplace_gigs.update_one({"_id": gig_id}, {"$set": {"source_lang": source}})
        return
    if updates:
        await db.marketplace_gigs.update_one({"_id": gig_id}, {"$set": updates})
        logger.info("[auto-translate] gig=%s wrote %s", gig_id, list(updates))

# 15 top-level categories (2026-07-15 restructure). Aligned to how
# renters actually search — home services and travel each consolidated
# into single broad buckets so a poster looking for "someone to fix
# my sink" doesn't have to guess between "Home Repair" and "Home &
# Living". Sub-buckets on the broader categories are captured via the
# optional `subcategory` field on gigs/jobs (see SUBCATEGORIES below).
# A listing has a photo if it has one ANYWHERE — the gig gallery, a
# product, or a tier. The wizard sends an empty `gallery` for a store and
# hangs the photos off each product, and a tiered service hangs them off
# each tier, so testing `gallery` alone reports a shop that photographed
# every item as having none.
#
# This is the Mongo form of `_has_any_photo()` in gigs.py, which is the
# test the app applies when it REFUSES to publish. It lives here because
# it was written out by hand in two other files and one of them got it
# wrong: the admin dashboard counted 18 "published services with no
# photo" when 2 were genuinely photoless (Tzvi, 28 Aug 2026). Anything
# asking "does this listing have a picture" must use this.
HAS_ANY_PHOTO = [
    {"gallery.0": {"$exists": True}},
    {"products.images.0": {"$exists": True}},
    {"products.image": {"$nin": [None, ""]}},
    {"tiers.images.0": {"$exists": True}},
]

CATEGORIES = [
    # --- Kept as-is ---
    {"slug": "real-estate-services", "label": "Real Estate Services",       "icon": "home"},
    {"slug": "health-fitness",       "label": "Health & Fitness",           "icon": "dumbbell"},
    {"slug": "personal-care",        "label": "Personal Care",              "icon": "scissors"},
    {"slug": "transportation",       "label": "Transportation",             "icon": "car"},
    # --- Merged/renamed ---
    # home-services-repair = former "home-organizers" ∪ "home-repair"
    {"slug": "home-services-repair", "label": "Home Services & Repair",     "icon": "wrench"},
    # travel-tourism = former "tours-activities" ∪ "hotels-travel"
    {"slug": "travel-tourism",       "label": "Travel & Tourism",           "icon": "plane"},
    # creative-design = former "photography" ∪ "graphic-design" (+ new videography/web-design as subs)
    {"slug": "creative-design",      "label": "Creative & Design Services", "icon": "palette"},
    # business-financial = former "bookkeeping" (broadened to include accounting/tax/legal/consulting)
    {"slug": "business-financial",   "label": "Business & Financial Services", "icon": "briefcase"},
    # --- New ---
    {"slug": "moving-relocation",    "label": "Moving & Relocation",        "icon": "truck"},
    {"slug": "cleaning-services",    "label": "Cleaning Services",          "icon": "spray-can"},
    {"slug": "it-tech-support",      "label": "IT & Tech Support",          "icon": "monitor"},
    {"slug": "education-tutoring",   "label": "Education & Tutoring",       "icon": "graduation-cap"},
    {"slug": "childcare-babysitting","label": "Childcare & Babysitting",    "icon": "baby"},
    {"slug": "pet-services",         "label": "Pet Services",               "icon": "paw-print"},
    # events-catering absorbs the entertainment/music slice of the former "music-entertainment"
    {"slug": "events-catering",      "label": "Events, Music & Catering",   "icon": "party-popper"},
    # Added 2026-08-19: a clothing business had nowhere to list. Every
    # category above sells LABOUR; this one sells GOODS, which the
    # marketplace has always supported mechanically (gig_type "store" with
    # products) while the taxonomy quietly offered no home for it. Broad on
    # purpose — clothing, homeware, gifts, food producers — because the
    # alternative is a new slug per trade and a list nobody can scan.
    {"slug": "shops-products",       "label": "Shops & Products",           "icon": "shopping-bag"},
    # --- 2026-08-28: the category expansion (docs/categories-expansion-spec.md).
    # Tzvi's ruling 2 makes these TOP-LEVEL rather than subcategories,
    # which overrides the "a list nobody can scan" note above. The answer
    # to that note is the grouped picker in
    # frontend/src/lib/categoryGroups.js — if the picker is ever
    # un-grouped, these should not stay top-level.
    #
    # Chosen for one audience — English-speaking residents, olim and
    # visitors — because a category nobody in that group searches for is a
    # page that stays empty forever.
    # buy-sell is NOT here, deliberately. It was, for a few hours on 28
    # Aug, and that was a mistake: the N1 table lists it, but N4 — the
    # item it points at — says a person selling one sofa is not a
    # service, has no repeat supply, no meaningful review, and needs a
    # `sold` state the gig model does not have. It belongs on the
    # Requests board as `request_type: "item"`, where the 30-day expire/
    # renew lifecycle already exists, and N4 says in as many words: "Do
    # not put items in the services grid."
    #
    # As a CATEGORY in this list it did the opposite — it put a door in
    # the Businesses picker leading someone to publish their sofa as a
    # service listing with no way to mark it sold. Add it back when N4
    # ships, as a category on the Requests board.
    # religious-services was here for a few hours on 28 Aug and was pulled
    # by Tzvi before it reached anyone. Removing a slug is normally
    # forbidden — they are permanent once live, because a printed QR or a
    # shared link encodes them — but this one never had a listing, was
    # never indexed, and only ever existed on preview. Deleting it now is
    # cheap; in a week it would not have been.
    {"slug": "insurance",            "label": "Insurance",                  "icon": "shield"},
    # Services a CAR needs — mechanics, testing, licence conversion, hire.
    # Not "somewhere to buy one": person-to-person sale lives on the
    # requests board (N4), and pairing this with transport put a
    # maintenance trade in front of travellers (Tzvi, 28 Aug).
    {"slug": "vehicles",             "label": "Vehicle Services",           "icon": "car-front"},
    # Released 2026-08-28 on Tzvi's instruction, after the regulatory note
    # below was raised with him. Currency service providers in Israel are
    # licensed and supervised, so two things travel with this category and
    # must not be dropped:
    #   1. We list licensed businesses. We never handle, hold, convert or
    #      transfer money, and no surface may imply otherwise — the
    #      disclaimer on a money-exchange listing is load-bearing, not
    #      decoration.
    #   2. A licence number is shown when the business supplies one.
    # Not legal advice.
    {"slug": "money-exchange",       "label": "Money Exchange & Transfers", "icon": "banknote"},
]

# Categories where we state plainly that we are a directory and nothing
# more. Consumed by the frontend via /marketplace/categories so the rule
# lives with the taxonomy rather than being re-derived per page.
CATEGORIES_WITH_DISCLAIMER = {"money-exchange"}

# Two more categories from the same spec are written here but NOT
# served, because each carries a question that is not a programming
# question:
#
#   immigration-documents Highest-intent category on the list, and the
#                         one closest to the discontinued government
#                         "paid services" (CLAUDE.md). A directory of
#                         OTHER people's businesses is a different thing
#                         from us providing those services — but this is
#                         exactly where that line gets crossed by
#                         accident, so it opens deliberately or not at
#                         all.
#   medical-health        A directory, not a health service. Public
#                         reviews of individual clinicians carry a
#                         defamation exposure that a review of a plumber
#                         does not.
#
# The spec asks for a lawyer's five minutes on all three. They are kept
# here rather than in a branch so they are one env var away once that
# happens, and so the reason is attached to the code rather than lost in
# a commit message. Not legal advice; confirm before flipping this.
# tests/test_category_expansion.py asserts they stay off.
# money-exchange was here until 2026-08-28 and is now live (see above).
CATEGORIES_PENDING_REVIEW = [
    {"slug": "immigration-documents", "label": "Immigration & Documents",    "icon": "stamp"},
    {"slug": "medical-health",        "label": "Medical & Health",           "icon": "stethoscope"},
]

# Off by default and deliberately not in .env.example as an enabled
# value — turning this on is a decision, not configuration drift.
if os.environ.get("CATEGORIES_PENDING_REVIEW_ENABLED", "").lower() in ("1", "true", "yes"):
    CATEGORIES.extend(CATEGORIES_PENDING_REVIEW)

_CATEGORY_SLUGS = {c["slug"] for c in CATEGORIES}

# Optional subcategory tags for categories that were merged. Kept as
# a soft-typed list — the field is validated for membership but the
# frontend can also accept free-text (rare edge cases like "solar
# panel installation" under home-services-repair). Filtering stays
# precise even though the top-level list is broader.
SUBCATEGORIES: dict[str, list[dict[str, str]]] = {
    "home-services-repair": [
        {"slug": "plumbing",        "label": "Plumbing"},
        {"slug": "electrical",      "label": "Electrical"},
        {"slug": "handyman",        "label": "Handyman"},
        {"slug": "appliance-repair","label": "Appliance Repair"},
        {"slug": "interior-design", "label": "Interior Design"},
    ],
    "travel-tourism": [
        {"slug": "tour-guide",     "label": "Tour Guide"},
        {"slug": "tour-operator",  "label": "Tour Operator"},
        {"slug": "hotel",          "label": "Hotel / Lodging"},
        {"slug": "travel-agency",  "label": "Travel Agency"},
    ],
    "creative-design": [
        {"slug": "photography",    "label": "Photography"},
        {"slug": "videography",    "label": "Videography"},
        {"slug": "graphic-design", "label": "Graphic Design"},
        {"slug": "web-design",     "label": "Web Design"},
    ],
    "business-financial": [
        {"slug": "bookkeeping",    "label": "Bookkeeping"},
        {"slug": "accounting",     "label": "Accounting"},
        {"slug": "tax-prep",       "label": "Tax Preparation"},
        {"slug": "legal",          "label": "Legal"},
        {"slug": "consulting",     "label": "Consulting"},
    ],
}

# Migration map from the pre-2026-07-15 category slugs to the new
# top-level slugs. Consumed by scripts/migrate_categories.py and
# also by _normalize_category() below so any leftover data (or an
# old cached bookmark URL like /services?category=photography) still
# resolves to the right modern category at read-time.
CATEGORY_MIGRATION: dict[str, str] = {
    "womens-spa":          "personal-care",
    "home-organizers":     "home-services-repair",
    "home-repair":         "home-services-repair",
    "tours-activities":    "travel-tourism",
    "hotels-travel":       "travel-tourism",
    "photography":         "creative-design",
    "graphic-design":      "creative-design",
    "bookkeeping":         "business-financial",
    "music-entertainment": "events-catering",
}

# If a legacy slug is passed at read-time (bookmarks, saved searches
# not yet migrated), transparently upgrade it. Write paths still
# validate strictly against _CATEGORY_SLUGS.
def _normalize_category(slug: str | None) -> str | None:
    if slug and slug in CATEGORY_MIGRATION:
        return CATEGORY_MIGRATION[slug]
    return slug

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

# How many curated cities a business may list before "several places" has
# quietly become "everywhere". Someone who really does cover the whole
# country has `serves_nationwide` for that, and it says so honestly on
# their page instead of listing twelve cities and meaning all of them.
MAX_SERVICE_AREAS = 6


def normalize_service_areas(values: list[str] | None) -> list[str]:
    """Coerce a list of city inputs to canonical LOCATION SLUGS.

    `businesses.areas` predates this function and was never validated, so
    it holds whatever a client sent — slugs, display labels, and free text
    from before there was a picker. Search compares against slugs, so
    anything else in there is invisible: a business that says "Tel Aviv"
    where the catalogue says "tel-aviv" simply never matches the Tel Aviv
    filter, and nothing reports the mismatch.

    Accepts either form, stores the slug. Unknown values are DROPPED
    rather than raising: a stale client sending one retired city should
    not cost the owner the rest of their save, and the alternative —
    storing it — recreates the invisible-value bug this exists to end.

    Order is preserved and duplicates removed, so the first city an owner
    picked stays first (their page lists them in that order).
    """
    out: list[str] = []
    for raw in values or []:
        if not isinstance(raw, str):
            continue
        key = raw.strip().lower()
        if not key:
            continue
        loc = _LOCATION_BY_SLUG.get(key) or _LOCATION_BY_LABEL.get(key)
        if loc and loc["slug"] not in out:
            out.append(loc["slug"])
    return out[:MAX_SERVICE_AREAS]


def service_area_labels(slugs: list[str] | None) -> list[str]:
    """Slugs -> display labels, for matching legacy free-text gig areas."""
    return [
        _LOCATION_BY_SLUG[s]["label"]
        for s in (slugs or [])
        if s in _LOCATION_BY_SLUG
    ]


def service_area_slugs_in_text(text: str | None) -> list[str]:
    """Which catalogue cities a free-text area names.

    Jobs and gigs store area as typed — "Tel Aviv, Florentin", "near
    Jerusalem" — while service areas are slugs. This is the bridge, and
    it deliberately uses the SAME case-insensitive substring rule the
    location filter has always used, so a job is placed in exactly the
    cities a customer browsing that city would have found it in.

    Returns [] when the text names no catalogue city. Callers must treat
    that as "cannot place this", not as "matches nothing" — the
    difference decides whether a provider in an unlisted town keeps
    getting work.
    """
    lowered = (text or "").lower()
    if not lowered:
        return []
    return [loc["slug"] for loc in LOCATIONS if loc["label"].lower() in lowered]


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
    # `image` is the ORIGINAL single thumbnail and stays readable for the
    # records already stored with it. `images` is the real gallery.
    #
    # One photo per product is why a real bakery listed "Custom box of 4"
    # twice at the same price: they had a second photo of the same item
    # and creating the product again was the only way to attach it. The
    # duplicate was their doing, but the shape of the form is what left
    # them no alternative.
    image: Optional[str] = None
    images: list[str] = Field(default_factory=list)
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
    # Which of the caller's businesses this listing belongs to. Optional
    # for the one-business case and for older clients; when absent the
    # create endpoint falls back to the first active business, which is
    # what it always did. Validated server-side — see create_gig — because
    # a business id from a request is a claim, not a permission.
    business_id: Optional[str] = None
    # Optional sub-bucket for merged categories (home-services-repair,
    # travel-tourism, creative-design, business-financial). Providers
    # who set this get tighter match precision when posters filter by
    # the same value. See SUBCATEGORIES for the suggested list.
    subcategory: Optional[str] = None
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
    # How buyers may reach this provider. `booking_mode` is kept because
    # the browse filter and older gigs use it, but it is no longer the
    # whole story: it names the PREFERRED channel, not the only one.
    booking_mode: str = "whatsapp"
    whatsapp: Optional[str] = None
    # Opt-in, per gig, and both deliberately so.
    #
    # whatsapp_confirmed: a number in the right SHAPE is not a number on
    # WhatsApp — landlines and non-WhatsApp mobiles normalise perfectly and
    # then dead-end on wa.me. Providers had been entering exactly those, so
    # the button is only offered when the provider states it is a WhatsApp
    # number.
    #
    # contact_email: never taken from the account automatically. The site
    # has always kept email private and routed contact through chat;
    # publishing someone's login address because they listed a service
    # would be a privacy regression, so it is a field they fill in.
    whatsapp_confirmed: bool = False
    contact_email: Optional[str] = None
    area: Optional[str] = None
    faqs: list[dict[str, str]] = Field(default_factory=list)


class GigPatch(BaseModel):
    whatsapp_confirmed: Optional[bool] = None
    contact_email: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
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
    # How long a pending request holds its slot before it is released.
    # Validated against the offered set in the handler rather than by a
    # pattern here, so a stale client sending 36 gets the default instead
    # of a 422 on an unrelated profile save.
    booking_hold_hours: Optional[int] = None


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


def _validate_subcategory(cat: str, sub: str | None) -> None:
    """Optional subcategory field on gigs/jobs. Empty/None is always
    valid — subcategories are advisory tags, not required.  If set,
    the value must either be a known slug from SUBCATEGORIES[cat] OR
    a short free-text string (max 40 chars) so we can still handle
    long-tail specializations we haven't formally listed yet (e.g.
    "solar panel installation" under home-services-repair).
    """
    if not sub:
        return
    if len(sub) > 40:
        raise HTTPException(status_code=400, detail="Subcategory too long")
    known = {s["slug"] for s in SUBCATEGORIES.get(cat, [])}
    if known and sub in known:
        return
    # Long-tail free-text: only allow simple slug-shape strings so we
    # don't accidentally accept HTML or URL fragments here.
    if not all(c.isalnum() or c in "-_ " for c in sub):
        raise HTTPException(status_code=400, detail="Subcategory has invalid characters")


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


# The marketplace is free. Listing a service costs nothing, so nothing
# about a provider's billing decides whether their gigs are visible.
#
# Flip this to False to bring paid plans back — the subscription routes,
# the PayPal helpers and the webhook handler are all still here and still
# mounted, deliberately dormant rather than deleted.
MARKETPLACE_IS_FREE = True


def _provider_is_active(prov: dict[str, Any]) -> bool:
    """True while the provider can still publish new/active gigs.

    While ``MARKETPLACE_IS_FREE`` every provider is active. This is the one
    gate the whole marketplace reads — browse, search, gig detail and the
    provider directory all funnel through it — so making it unconditional
    is what actually makes the site free. Hiding the pricing UI alone would
    have left providers whose trial had quietly expired invisible, with no
    screen left anywhere to explain why.
    """
    if MARKETPLACE_IS_FREE:
        return True
    if prov.get("subscription_status") == "active":
        return True
    trial_end = prov.get("trial_ends_at")
    if not trial_end:
        return False
    try:
        return datetime.fromisoformat(trial_end) > datetime.now(UTC)
    except (ValueError, TypeError):
        return False


def contact_channels(gig: dict[str, Any]) -> list[str]:
    """Which ways a buyer may reach this provider, in offer order.

    On-site messaging is ALWAYS present and always last-resort-proof: it
    needs no external account, cannot be mistyped, and reaches someone who
    has already signed in. Every other channel is opt-in and can be absent.

    WhatsApp requires the provider to have CONFIRMED the number is on
    WhatsApp, not merely to have typed digits. A landline normalises to a
    perfectly valid-looking number and then dead-ends on wa.me — which is
    what providers had been unknowingly publishing.

    Old gigs predate the confirmation flag: they opted into WhatsApp by
    setting booking_mode, so that intent is honoured rather than silently
    revoked, and they keep the channel they chose.
    """
    out: list[str] = []
    number = (gig.get("whatsapp") or "").strip()
    legacy_whatsapp = gig.get("booking_mode") == "whatsapp"
    if number and (gig.get("whatsapp_confirmed") or legacy_whatsapp):
        out.append("whatsapp")
    if (gig.get("contact_email") or "").strip():
        out.append("email")
    out.append("in_platform")
    return out


def _clean_gig(gig: dict[str, Any]) -> dict[str, Any]:
    """Strip Mongo internals + rename `_id` → `id` for the API surface."""
    gig["id"] = gig.pop("_id", gig.get("id"))
    # Computed, never stored: storing it would let the list drift out of
    # step with the fields it is derived from.
    gig["contact_channels"] = contact_channels(gig)
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


# ---------------- Free-text search ----------------

# Numbers get written both ways, and a search must not care which. Someone
# posts "Three bedroom apartment"; someone else searches "3 bedroom" and
# finds nothing. Both directions are covered.
_NUMBER_WORDS = {
    "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
    "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten",
}
_WORD_NUMBERS = {v: k for k, v in _NUMBER_WORDS.items()}

# Words for the same thing. Kept deliberately short: every entry here is a
# way for a search to return something surprising, so it earns its place
# only if people actually type it.
_SYNONYMS = {
    "bedroom": ["bedrooms", "bed", "beds", "br", "bdr", "bd"],
    "bedrooms": ["bedroom", "bed", "beds", "br", "bdr", "bd"],
    "bed": ["bedroom", "bedrooms", "br", "bd"],
    "br": ["bedroom", "bedrooms", "bed"],
    "bd": ["bedroom", "bedrooms", "bed"],
    "apartment": ["apt", "flat"],
    "apt": ["apartment", "flat"],
    "flat": ["apartment", "apt"],
    "furnished": ["furniture"],
    "lift": ["elevator"],
    "elevator": ["lift"],
}


def _token_alternatives(token: str) -> list[str]:
    """Every spelling of one search word that should count as a match."""
    alts = {token}
    if token in _NUMBER_WORDS:
        alts.add(_NUMBER_WORDS[token])
    if token in _WORD_NUMBERS:
        alts.add(_WORD_NUMBERS[token])
    for extra in _SYNONYMS.get(token, []):
        alts.add(extra)
    return sorted(alts)


def _search_clauses(q: str) -> list[dict[str, Any]]:
    """Turn a search box into Mongo clauses.

    Each WORD is matched independently and all of them must appear, in the
    title or the description. That one decision fixes most of what was
    broken, because the old code matched the whole query as a single
    substring:

      * "2 bedroom" found nothing, while "2-bedroom near the Old City" sat
        on the board — the hyphen alone was enough to miss;
      * "three bedroom" and "3 bedroom" were different searches;
      * any word order but the poster's own returned nothing.

    Tokens are matched as substrings rather than whole words on purpose, so
    "bed" still finds "bedroom". The cost is that "3" also matches "13";
    requiring every token narrows that back down in practice.
    """
    # Split on anything that is not a letter, digit or Hebrew character.
    # ֐-׿ is the Hebrew block; without it a Hebrew query would be
    # shredded into single letters by \w on some builds.
    # Cap the raw query before tokenising. gigs.py capped at 80 before this
    # helper existed and that cap must not be lost: this runs on an
    # unauthenticated endpoint, and length is the cheap half of stopping a
    # pathological query from building a pathological pipeline.
    tokens = [t for t in re.split(r"[^\w\u0590-\u05FF]+", q.strip()[:80].lower()) if t]
    # A pathological query should not build a hundred-clause pipeline.
    tokens = tokens[:8]
    clauses: list[dict[str, Any]] = []
    for token in tokens:
        alts = "|".join(re.escape(a) for a in _token_alternatives(token))
        rx = {"$regex": f"({alts})", "$options": "i"}
        clauses.append({"$or": [
            {"title": rx}, {"description": rx},
            # Both translated sides. _he was already here; _en arrived with
            # spec 1.2 and without it a Hebrew-authored post stays invisible
            # to an English search even though its English text exists.
            {"title_he": rx}, {"description_he": rx},
            {"title_en": rx}, {"description_en": rx},
        ]})
    return clauses

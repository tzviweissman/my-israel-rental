"""Housing & Services Requests — the demand board.

The mirror image of the rest of the site. Instead of owners listing
properties and providers listing gigs, a signed-in seeker posts what they
are *looking for* — "3-bed in Nachlaot from September, up to 8,000" or "I
need a mover on the 14th" — and owners or providers come to them.

Deliberately a separate module and collection rather than an extension of
``marketplace_jobs``. Jobs use an apply/bid contact model with quoted
prices and an applications list; requests are chat-only. Overloading one
collection with two contact models is how both end up half-implemented.

Privacy rules, enforced here rather than trusted to the frontend. The
line is between IDENTITY and CONTACT, and it is drawn deliberately:

  * identity IS public — a shortened display name ("Rivka L."), a verified
    flag and a joined year. An owner deciding whether to answer needs to
    know a real person is asking, and a two-sided board lives on response
    rate. See ``_poster_identity``;
  * contact is NEVER public — no phone, no email, no full surname, no
    avatar, in any endpoint, in any shape. Chat is the only channel, and
    ``poster_user_id`` resolves to no contact route outside it;
  * contacting requires auth, so a scraper cannot harvest the board;
  * posting requires auth, is capped per user, and is rate-limited.

Lifecycle: a request lives 30 days. It soft-expires — a daily loop flips
``open`` → ``expired`` once ``expires_at`` passes — rather than using a
Mongo TTL index, because the seeker must be able to renew, and a TTL index
deletes the document outright. Expired requests stay readable and
renewable; they simply leave the board.

SINGLE-REPLICA ASSUMPTION: ``requests_lifecycle_daily_loop`` runs
in-process, like the other daily loops in this app. Two replicas would run
it twice — harmless for the expiry flip (idempotent) but would double-send
the pre-expiry reminder email. If this service is ever scaled beyond one
replica, move these loops to a single scheduled worker.
"""
from __future__ import annotations

import asyncio
import re
import uuid
from datetime import datetime, timedelta
from html import escape as html_escape
from typing import Any, Optional

import jwt
import os
from urllib.parse import urlparse

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from routes.deps import db, logger, verify_token
from utils.auth import JWT_SECRET
from utils.email import send_email
from utils.notification_tokens import (
    NotificationTokenError,
    verify_notification_token,
)
from utils.area_filter import resolve_area_id
from utils.bg_tasks import spawn
from utils.translate import detect_lang, translate_marketing
from utils.whatsapp_link import build_whatsapp_link, normalize_whatsapp_number

from .shared import UTC, FRONTEND_URL, _search_clauses, _validate_category, _validate_subcategory


router = APIRouter(prefix="/marketplace", tags=["marketplace"])


# ---------------- Tunables ----------------

# A seeker with twenty open requests is either a business or a spammer;
# either way the board stops being useful to everyone else.
MAX_OPEN_REQUESTS_PER_USER = 5

# Minimum gap between two creates by the same user. Cheap in-DB rate
# limit — no extra store, and it survives a restart, unlike an in-memory
# counter.
#
# Deliberately short. MAX_OPEN_REQUESTS_PER_USER is what actually bounds
# spam volume; this only exists to stop a script hammering the endpoint.
# It was 60s, which blocked a real and very common flow: someone moving
# posts "looking for a 3-bed" and then "need a mover" in the same sitting,
# and got an error for it.
CREATE_COOLDOWN_SECONDS = 20

REQUEST_TTL_DAYS = 30

# Reports needed before a request auto-hides. Low enough to react fast on
# a small board, high enough that one angry competitor cannot silence a
# legitimate seeker on their own.
REPORT_HIDE_THRESHOLD = 3

RENTAL_KINDS = ("long-term", "short-term", "vacation")

# --- Items (N4) -----------------------------------------------------------
#
# Person-to-person selling lives HERE, on the requests board, and not in
# the marketplace: one person selling one sofa has no repeat supply, no
# meaningful review, and needs a `sold` state the gig model does not have.
# What it does need — a post that dies after 30 days unless renewed — is
# exactly what this board already does, which is why there is no third
# product.
ITEM_CONDITIONS = ("new", "like-new", "good", "used")
ITEM_STATUSES = ("available", "sold")
MAX_ITEM_PHOTOS = 8

# --- Rate limits (N6) -----------------------------------------------------
#
# "Classifieds bring scams. Build for that from day one." The open-post cap
# and the 20-second cooldown above are about tidiness; these are about
# spam, and they are per DAY because that is the unit a spammer works in.
#
# A brand-new account gets a lower ceiling. Not to punish new users — the
# limit is above what a real person does on their first day — but because a
# throwaway account posting twenty items in an hour is the actual attack,
# and an account that has been around a week has usually cost somebody
# something.
MAX_ITEMS_PER_DAY = 10
MAX_ITEMS_PER_DAY_NEW_ACCOUNT = 3
NEW_ACCOUNT_DAYS = 7

# Categories where a fraudulent post does the most damage. New items here
# are flagged for a human to look at — they stay VISIBLE (hiding a
# legitimate seller's post on suspicion is its own harm) but they surface
# in the moderation queue without waiting for a report.
MANUAL_REVIEW_CATEGORIES = {"money-exchange"}


# ---------------- Pydantic models ----------------

class RequestIn(BaseModel):
    request_type: str = Field(..., pattern="^(rental|service|item)$")

    # Which SIDE of the market this post is on, which is a separate question
    # from what it is about:
    #   want — "I'm looking for a 3-bed in Ramat Eshkol"   (a seeker)
    #   have — "I have a 3-bed free from September"        (an owner or pro)
    #
    # The board was demand-only. Making it two-way means an owner with a
    # place coming free can say so without building a full listing - no
    # photos, no price, no contract - which is a different, much lighter
    # commitment than /stays asks for. Full listings still belong on Stays;
    # this is the "ask around first" path.
    #
    # Defaults to "want" so every request posted before this field existed
    # keeps its original meaning.
    post_kind: str = Field("want", pattern="^(want|have)$")

    # Optional link from a "have" post to the poster's OWN listing, for an
    # owner who has both: the light post to ask around, and the full listing
    # for anyone who wants photos and a price.
    #
    # An id, deliberately, not a URL. A free-text link field on a public
    # board is a phishing vector — anyone could post "I have a 3-bed" and
    # point it wherever they liked, wearing our chrome. This resolves to
    # /property/{id} on our own site and is checked server-side to belong to
    # the poster, so it can only ever point at something they own here.
    listing_id: Optional[str] = Field(None, max_length=64)

    # OPT-IN WhatsApp number. The board's default is chat-only and no
    # contact detail of any kind is public — see the module docstring. This
    # is the one deliberate exception, and it is the poster's own decision:
    # they type their own number, for their own post, knowing it becomes a
    # way to reach them. Nobody else can add it and it is never inherited
    # from their account without them entering it here.
    #
    # It is NEVER returned by the public API even when set (see _public).
    # The board exposes only a boolean, and the number lives behind the
    # tracked redirect — so a scraper gets nothing, and the poster still
    # gets their WhatsApp messages.
    whatsapp: Optional[str] = Field(None, max_length=40)
    title: str = Field(..., min_length=6, max_length=140)
    description: str = Field(..., min_length=10, max_length=4000)
    area: str = Field(..., min_length=2, max_length=120)

    budget_type: str = Field("open", pattern="^(fixed|open)$")
    budget_amount: Optional[float] = None
    budget_currency: str = Field("ILS", pattern="^(ILS|USD)$")

    # How to read the date on this request (C3). Applies to both variants:
    # `move_in_date` on rentals, `preferred_date` on services.
    #   on       — that specific day
    #   before   — any time up to and including it
    #   flexible — no date; the seeker will work around whoever replies
    # Defaults to "on" so every request written before this field existed
    # keeps meaning exactly what it meant. "flexible" is the common case for
    # rentals but it must be CHOSEN, never inferred from a blank date - a
    # blank date is just as likely to mean the form was abandoned.
    date_mode: str = Field("on", pattern="^(on|before|flexible)$")

    # --- service variant ---
    category: Optional[str] = None
    subcategory: Optional[str] = None
    preferred_date: Optional[str] = None

    # --- rental variant ---
    rental_kind: Optional[str] = None
    bedrooms_min: Optional[int] = Field(None, ge=0, le=20)
    move_in_date: Optional[str] = None
    lease_months: Optional[int] = Field(None, ge=1, le=120)
    furnished: Optional[bool] = None
    amenities: Optional[list[str]] = None

    # --- item variant (N4) ---
    #
    # The PRICE reuses budget_amount/budget_currency rather than adding a
    # field. "₪400" and "up to ₪8,000" are the same shape of data, and one
    # price field means the board's filters, its cards and its search work
    # for items without a second code path.
    condition: Optional[str] = None
    # Where to collect it, which is not always where the seller lives —
    # "Katamon, near the shuk" is the useful answer and `area` is the
    # searchable one, so both exist.
    pickup_area: Optional[str] = Field(None, max_length=120)
    photos: Optional[list[str]] = Field(None, max_length=MAX_ITEM_PHOTOS)


class RequestPatch(BaseModel):
    title: Optional[str] = Field(None, min_length=6, max_length=140)
    description: Optional[str] = Field(None, min_length=10, max_length=4000)
    area: Optional[str] = Field(None, min_length=2, max_length=120)
    budget_type: Optional[str] = Field(None, pattern="^(fixed|open)$")
    budget_amount: Optional[float] = None
    budget_currency: Optional[str] = Field(None, pattern="^(ILS|USD)$")
    date_mode: Optional[str] = Field(None, pattern="^(on|before|flexible)$")
    post_kind: Optional[str] = Field(None, pattern="^(want|have)$")
    listing_id: Optional[str] = Field(None, max_length=64)
    whatsapp: Optional[str] = Field(None, max_length=40)
    preferred_date: Optional[str] = None
    bedrooms_min: Optional[int] = Field(None, ge=0, le=20)
    move_in_date: Optional[str] = None
    lease_months: Optional[int] = Field(None, ge=1, le=120)
    furnished: Optional[bool] = None
    amenities: Optional[list[str]] = None
    condition: Optional[str] = None
    pickup_area: Optional[str] = Field(None, max_length=120)
    photos: Optional[list[str]] = Field(None, max_length=MAX_ITEM_PHOTOS)


class ReportIn(BaseModel):
    reason: str = Field(..., min_length=3, max_length=400)


# ---------------- Helpers ----------------

async def _validated_listing_id(listing_id: str | None, user_id: str) -> str | None:
    """Return the id only if this user owns that property, else raise.

    The check is here rather than in the UI because the UI only ever offers
    the user their own properties — which means anything else arriving in
    this field came from someone bypassing it, and that is exactly the case
    worth rejecting. Silently dropping it would be worse than a 400: the
    poster would think their listing was linked when it was not.
    """
    listing_id = (listing_id or "").strip()
    if not listing_id:
        return None
    prop = await db.properties.find_one({"id": listing_id}, {"owner_id": 1})
    if not prop:
        raise HTTPException(status_code=400, detail="That listing no longer exists")
    if prop.get("owner_id") != user_id:
        raise HTTPException(status_code=403, detail="You can only link your own listing")
    return listing_id


def _display_name(full_name: str | None) -> str:
    """"Rivka Levy" -> "Rivka L." — enough to address a human, not enough
    to look them up. Derived here rather than client-side so the full
    surname never crosses the wire in the first place."""
    parts = (full_name or "").strip().split()
    if not parts:
        return "Someone"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}."


async def _poster_identity(user_ids: list[str]) -> dict[str, dict[str, Any]]:
    """Display identity for a batch of posters, keyed by user id.

    IDENTITY, NOT CONTACT. Three fields only — a shortened name, whether
    the account is verified, and a joined year. An owner deciding whether
    to answer a request needs to know a real person is asking; a two-sided
    board lives on response rate. None of it is a way to reach anyone:
    chat remains the only channel.

    Never returns email, phone, full surname, or the avatar. `picture`
    exists on Google accounts but is only used today in the self-facing
    "Continue as" banner, so it is not an already-public avatar and is not
    surfaced here.

    Batched deliberately — the board returns up to 200 requests, and a
    per-row lookup would be 200 round-trips to Atlas.
    """
    if not user_ids:
        return {}
    out: dict[str, dict[str, Any]] = {}
    cursor = db.users.find(
        {"id": {"$in": list(set(user_ids))}},
        # Projection is the enforcement: fields not named here cannot leak
        # by accident when someone later adds one to the user document.
        {"_id": 0, "id": 1, "name": 1, "created_at": 1, "google_linked": 1},
    )
    async for u in cursor:
        year = None
        try:
            year = datetime.fromisoformat(u["created_at"]).year if u.get("created_at") else None
        except (ValueError, TypeError):
            year = None
        out[u["id"]] = {
            "poster_display_name": _display_name(u.get("name")),
            # Bound to `google_linked`, NOT `email_verified`.
            #
            # email_verified is set True for EVERY signup — verification was
            # rolled back in 2026-06 (see routes/auth.py) — so a badge built
            # on it would appear on every account including one typed with a
            # fake address. A badge everyone has carries no information and
            # actively misleads the owner it is meant to reassure.
            #
            # google_linked means Google asserted the address and the login
            # path rejects unverified Google emails, so this badge is true
            # only when something was actually verified.
            "poster_verified": bool(u.get("google_linked")),
            "poster_member_since": year,
        }
    return out


def _public(doc: dict[str, Any], identity: dict[str, Any] | None = None) -> dict[str, Any]:
    """API-safe shape.

    Strips Mongo's ``_id`` into ``id`` and drops the moderation fields — a
    seeker should not see their own report count and start guessing who
    filed them, and nobody else needs it.

    ``poster_user_id`` survives because the contact flow needs it to open a
    chat. It is an opaque uuid that resolves to no contact route outside
    that flow.

    Display identity is merged in by the caller via ``_poster_identity``.
    Contact details are never included, in any shape, ever.
    """
    out = {
        k: v for k, v in doc.items()
        # `needs_review` is a moderation flag and belongs with the others:
        # telling a seller their post is under review teaches whoever is
        # actually committing fraud which categories we watch. This
        # function excludes rather than whitelists, so a new field is
        # PUBLIC by default — which is the trap this list exists for.
        if k not in ("_id", "report_count", "reported_by", "hidden_by_admin",
                     "whatsapp", "needs_review")
    }
    out["id"] = doc.get("_id")
    # The NUMBER never leaves the server; only the fact that there is one.
    # This function whitelists by exclusion, so a field added to the document
    # is public by default — which is exactly how a phone number would have
    # ended up in a public JSON feed without anyone deciding to put it there.
    out["whatsapp_available"] = bool(doc.get("whatsapp"))
    if identity:
        out.update(identity)
    return out


async def _translate_bg(request_id: str, title: str, description: str) -> None:
    """Fill in whichever language is missing, in the background (spec 1.4).

    Bilingual reach is the whole point of this board: a Hebrew-speaking
    landlord scanning demand has to be able to read an English speaker's
    request, and the reverse.

    This used to translate ONE WAY. It called an English->Hebrew prompt on
    whatever was typed, so a Hebrew post had its Hebrew fed through an
    English->Hebrew translator — producing a `title_he` that was just the
    original again, and no English version at all. An English-speaking owner
    scanning the board saw Hebrew and moved on. Now the source language is
    detected first and the OTHER side is filled.

    Title and description are judged together, since they are one post in
    one language; judging separately would give a record two source
    languages and translate the wrong half.

    Runs as a background task rather than inline so an Anthropic outage can
    never delay or block someone from posting: the request is already saved
    and live before this starts. A failure leaves it published in the
    language it was written in, and the next edit re-runs this (spec 1.5,
    behaviour preserved exactly).

    Fires on create and on edit only, never on read.
    """
    try:
        source = detect_lang(title, description)
        target = "en" if source == "he" else "he"
        suffix = target  # 'he' -> title_he, 'en' -> title_en

        new_title = await translate_marketing(title, target) if title else None
        new_desc = await translate_marketing(description, target) if description else None

        updates: dict[str, Any] = {"source_lang": source}
        if new_title:
            updates[f"title_{suffix}"] = new_title
        if new_desc:
            updates[f"description_{suffix}"] = new_desc
        await db.requests.update_one({"_id": request_id}, {"$set": updates})
    except Exception as e:  # noqa: BLE001
        # Swallowed on purpose. The post is already live; the next edit
        # re-runs this, so a transient outage self-heals.
        logger.warning("[requests] translation failed for %s: %s", request_id, e)


async def _request_or_404(request_id: str) -> dict[str, Any]:
    doc = await db.requests.find_one({"_id": request_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")
    return doc


def _require_owner(doc: dict[str, Any], user: dict) -> None:
    """Authorise on the relationship, never on role.

    Same rule the bookings code learned the hard way: an admin is not the
    poster, and a 'renter' role is not what makes this request yours.
    """
    if doc.get("poster_user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your request")


async def _enforce_item_daily_limit(user: dict[str, Any]) -> None:
    """Items per user per day, lower for a brand-new account (N6).

    The lower tier is not a punishment — it sits above what a real person
    posts on their first day. It exists because a throwaway account
    posting twenty items in an hour is the actual attack, and an account
    a week old has usually cost somebody something.

    Counts by `created_at` rather than a rolling window, so the number a
    person is told matches the number they can count on the board.
    """
    since = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    posted = await db.requests.count_documents({
        "poster_user_id": user["user_id"],
        "request_type": "item",
        "created_at": {"$gte": since},
    })

    limit = MAX_ITEMS_PER_DAY
    # BOTH keys. `auth.py` writes the user document with `id`, while other
    # collections use `_id`, and the rest of this codebase already looks
    # up users with the same `or` (see gigs.py:479). Querying `_id` alone
    # found nothing, fell through to the higher limit, and the new-account
    # tier silently did not exist — the failure mode of a rate limit that
    # is written, called, and answers "fine" every time.
    account = (
        await db.users.find_one({"_id": user["user_id"]}, {"created_at": 1})
        or await db.users.find_one({"id": user["user_id"]}, {"created_at": 1})
    )
    created = (account or {}).get("created_at")
    if created:
        try:
            age_days = (datetime.now(UTC) - datetime.fromisoformat(created)).days
            if age_days < NEW_ACCOUNT_DAYS:
                limit = MAX_ITEMS_PER_DAY_NEW_ACCOUNT
        except (ValueError, TypeError):
            # An unreadable join date must not lock somebody out — fall
            # back to the ordinary limit rather than the strict one.
            pass

    if posted >= limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"That is {limit} items in a day, which is the limit. "
                "Try again tomorrow, or edit one you have already posted."
            ),
        )


def _validate_variant(payload: RequestIn) -> None:
    """Per-type required fields.

    A service request without a category cannot be matched to providers,
    and a rental request without a kind cannot be matched to properties —
    so each is required for its own type and ignored for the other.
    """
    if payload.request_type == "item":
        # An item needs a condition — it is the first thing a buyer asks
        # and the one fact a photo cannot settle.
        if payload.condition not in ITEM_CONDITIONS:
            raise HTTPException(
                status_code=400,
                detail=f"An item needs a condition: one of {', '.join(ITEM_CONDITIONS)}",
            )
        # A category is OPTIONAL on items and required on services. A
        # seeker looking for a plumber has to say so or nobody can be
        # matched to them; somebody selling a sofa has already described
        # it in the title, and forcing a taxonomy choice on a classified
        # ad is how the wrong category gets picked at random.
        if payload.category:
            _validate_category(payload.category)
        # Selling something and naming no price is not a listing, it is a
        # conversation. `budget_type: open` is still allowed — "offers" is
        # a real answer — but it must be chosen.
    elif payload.request_type == "service":
        if not payload.category:
            raise HTTPException(status_code=400, detail="A service request needs a category")
        _validate_category(payload.category)
        _validate_subcategory(payload.category, payload.subcategory)
    else:
        if payload.rental_kind not in RENTAL_KINDS:
            raise HTTPException(
                status_code=400,
                detail=f"A rental request needs rental_kind: one of {', '.join(RENTAL_KINDS)}",
            )
    if payload.budget_type == "fixed" and not (payload.budget_amount and payload.budget_amount > 0):
        raise HTTPException(status_code=400, detail="Fixed budget needs an amount greater than 0")


# ---------------- Endpoints ----------------

@router.get("/requests")
async def list_requests(
    request_type: Optional[str] = Query(None, pattern="^(rental|service|item)$"),
    post_kind: Optional[str] = Query(None, pattern="^(want|have)$"),
    category: Optional[str] = None,
    rental_kind: Optional[str] = None,
    area: Optional[str] = None,
    q: Optional[str] = None,
    # --- item filters (N4) ---
    condition: Optional[str] = Query(None, pattern="^(new|like-new|good|used)$"),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    # Sold items are hidden by default and reachable on request. "A board
    # full of sold items is how classifieds sites die" — but a buyer who
    # followed a link deserves to see they were too late rather than a
    # 404, which is why the post survives and only leaves the DEFAULT view.
    include_sold: bool = False,
    limit: int = Query(60, ge=1, le=200),
):
    """Public board. Only open, un-hidden requests are ever returned."""
    query: dict[str, Any] = {"status": "open", "hidden_by_admin": {"$ne": True}}
    if request_type:
        query["request_type"] = request_type

    if condition:
        query["condition"] = condition
    if not include_sold:
        # Anything that is not an item has no item_status, so `$ne: "sold"`
        # keeps rentals and services on the board rather than filtering
        # out the entire rest of the site.
        query["item_status"] = {"$ne": "sold"}
    if min_price is not None or max_price is not None:
        price: dict[str, Any] = {}
        if min_price is not None:
            price["$gte"] = min_price
        if max_price is not None:
            price["$lte"] = max_price
        # Only posts that NAMED a price can be compared. An "open to
        # offers" post has no number, and silently treating that as 0
        # would put every one of them at the top of a cheapest-first
        # filter.
        query["budget_amount"] = price
    if post_kind:
        # Documents written before post_kind existed have no such field, and
        # they are all demand-side. Treat a missing field as "want" so the
        # filter does not quietly hide the entire back catalogue.
        query["post_kind"] = {"$in": ["want", None]} if post_kind == "want" else "have"

    if category:
        _validate_category(category)
        query["category"] = category
    if rental_kind:
        query["rental_kind"] = rental_kind
    if area:
        # Resolve the SEARCH term the same way the stored value was
        # resolved, and match ids. This is what makes "רמת אשכול" find a
        # post written as "Ramat Eshkol" — a case-insensitive regex on the
        # raw text matches neither against the other.
        wanted_id = resolve_area_id(area)
        if wanted_id:
            query["$or"] = [
                {"area_id": wanted_id},
                # Records written before area_id existed, and any area the
                # catalogue does not know, still match on their text.
                {"area": {"$regex": re.escape(area.strip()), "$options": "i"}},
            ]
        else:
            query["area"] = {"$regex": re.escape(area.strip()), "$options": "i"}
    if q:
        clauses = _search_clauses(q)
        if clauses:
            # $and, not $or: every word must appear. $or on tokens would
            # make a two-word search WIDER than a one-word search, which is
            # the opposite of what typing more words means.
            query["$and"] = query.get("$and", []) + clauses
    docs = await db.requests.find(query).sort("created_at", -1).to_list(limit)
    identities = await _poster_identity([d.get("poster_user_id") for d in docs if d.get("poster_user_id")])
    return [_public(d, identities.get(d.get("poster_user_id"))) for d in docs]


@router.get("/requests/{request_id}")
async def get_request(request_id: str):
    doc = await _request_or_404(request_id)
    if doc.get("hidden_by_admin"):
        # Indistinguishable from "never existed" on purpose — confirming a
        # hidden request exists tells a reporter their report landed and
        # tells a spammer which posts got caught.
        raise HTTPException(status_code=404, detail="Request not found")
    identities = await _poster_identity([doc.get("poster_user_id")])
    return _public(doc, identities.get(doc.get("poster_user_id")))


@router.post("/requests")
async def create_request(payload: RequestIn, user=Depends(verify_token)):
    _validate_variant(payload)

    open_count = await db.requests.count_documents({
        "poster_user_id": user["user_id"],
        "status": "open",
    })
    if open_count >= MAX_OPEN_REQUESTS_PER_USER:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Only {MAX_OPEN_REQUESTS_PER_USER} open requests at a time — "
                "mark one as found or close it first"
            ),
        )

    # N6 — the per-DAY cap, which is the unit a spammer works in. The open
    # cap above limits how much is on the board at once; this limits how
    # fast it can be filled, which is a different attack.
    if payload.request_type == "item":
        await _enforce_item_daily_limit(user)

    last = await db.requests.find_one(
        {"poster_user_id": user["user_id"]},
        sort=[("created_at", -1)],
    )
    if last and last.get("created_at"):
        try:
            age = (datetime.now(UTC) - datetime.fromisoformat(last["created_at"])).total_seconds()
            if age < CREATE_COOLDOWN_SECONDS:
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {int(CREATE_COOLDOWN_SECONDS - age)}s before posting again",
                )
        except (ValueError, TypeError):
            # An unparseable timestamp must not lock a user out of posting.
            pass

    now = datetime.now(UTC)
    is_service = payload.request_type == "service"
    is_item = payload.request_type == "item"
    doc = {
        "_id": str(uuid.uuid4()),
        "request_type": payload.request_type,
        "poster_user_id": user["user_id"],
        "title": payload.title.strip(),
        "title_he": None,
        # Spec 1.2. Present from creation rather than appearing only once
        # the background task has run, so a reader never has to treat
        # "absent" as a third state alongside null and filled.
        "title_en": None,
        "description": payload.description.strip(),
        "description_he": None,
        "description_en": None,
        # Judged by the background task; labels the original on the UI.
        "source_lang": None,
        "area": payload.area.strip(),
        # Spec 2.2 — one id per place, whatever spelling was typed, in
        # either language. The raw text is kept for display; this is what
        # search matches on.
        "area_id": resolve_area_id(payload.area),
        "budget_type": payload.budget_type,
        "budget_amount": payload.budget_amount if payload.budget_type == "fixed" else None,
        "budget_currency": payload.budget_currency,
        # Service variant — null on rentals so filters can key on presence.
        # Items may carry one and are not required to; see _validate_variant.
        "category": payload.category if (is_service or is_item) else None,
        "subcategory": ((payload.subcategory or "").strip() or None) if is_service else None,
        # A flexible request stores NO date, whatever arrived in the payload.
        # Otherwise a seeker who fills a date, then switches to flexible,
        # leaves a date behind that the board would go on displaying.
        "post_kind": payload.post_kind,
        # Normalised on the way in, so an unusable number is stored as None
        # rather than lingering as a WhatsApp button that goes nowhere.
        "whatsapp": normalize_whatsapp_number(payload.whatsapp),
        # Only meaningful on a supply-side post; a seeker has nothing to link.
        "listing_id": (await _validated_listing_id(payload.listing_id, user["user_id"]) if payload.post_kind == "have" else None),
        "date_mode": payload.date_mode,
        "preferred_date": (payload.preferred_date if is_service and payload.date_mode != "flexible" else None),
        # Rental variant — null on services, same reason.
        "rental_kind": payload.rental_kind if not is_service else None,
        "bedrooms_min": payload.bedrooms_min if not is_service else None,
        "move_in_date": (payload.move_in_date if not is_service and payload.date_mode != "flexible" else None),
        "lease_months": payload.lease_months if not is_service else None,
        "furnished": payload.furnished if not is_service else None,
        "amenities": (payload.amenities or []) if not is_service else [],
        # Item variant (N4) — null elsewhere, so a filter can key on
        # presence the same way the other two variants do.
        "condition": payload.condition if is_item else None,
        "pickup_area": ((payload.pickup_area or "").strip() or None) if is_item else None,
        "photos": (payload.photos or [])[:MAX_ITEM_PHOTOS] if is_item else [],
        # SEPARATE from `status`. `status` is the post's lifecycle
        # (open/expired/found) and is shared by all three variants;
        # item_status is about the object. A sofa can be sold while its
        # post is still open, and conflating them would mean marking
        # something sold also removed it from the board — which is how a
        # buyer loses the ability to see they were too late.
        "item_status": "available" if is_item else None,
        "sold_at": None,
        # N6 — fraud-prone categories surface to a moderator without
        # waiting for a report. Flagged, never hidden: hiding a legitimate
        # seller's post on suspicion is its own harm.
        "needs_review": bool(is_item and payload.category in MANUAL_REVIEW_CATEGORIES),
        # Lifecycle
        "status": "open",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "expires_at": (now + timedelta(days=REQUEST_TTL_DAYS)).isoformat(),
        "renewed_count": 0,
        "reminder_sent_at": None,
        "found_at": None,
        "contact_count": 0,
        # Moderation — never returned by _public().
        "hidden_by_admin": False,
        "report_count": 0,
        "reported_by": [],
    }
    await db.requests.insert_one(doc)
    # Plot it on the map (C5). Background, because Nominatim is rate
    # limited to one call a second and that must not sit between the
    # poster and their confirmation.
    from utils.geocode import geocode_area_into
    asyncio.create_task(geocode_area_into("requests", doc["_id"], doc["area"]))
    logger.info("[requests] created %s (%s) by %s", doc["_id"], doc["request_type"], user["user_id"])
    # After the insert, so the request is live whatever the LLM does.
    spawn(_translate_bg(doc["_id"], doc["title"], doc["description"]))
    return _public(doc)


@router.patch("/requests/{request_id}")
async def patch_request(request_id: str, payload: RequestPatch, user=Depends(verify_token)):
    doc = await _request_or_404(request_id)
    _require_owner(doc, user)
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    for key in ("title", "description", "area"):
        if key in update and isinstance(update[key], str):
            update[key] = update[key].strip()
    if update.get("budget_type") == "fixed":
        amount = update.get("budget_amount", doc.get("budget_amount"))
        if not (amount and amount > 0):
            raise HTTPException(status_code=400, detail="Fixed budget needs an amount greater than 0")
    if update.get("budget_type") == "open":
        update["budget_amount"] = None
    # Same rule as create: switching an existing request to flexible clears
    # whatever date it was carrying, so the board can't keep showing a date
    # the seeker has just said no longer applies. Both variants' date fields
    # are cleared because only one of them is ever set.
    if "whatsapp" in update:
        # An explicit empty string is how a poster withdraws their number,
        # so it must survive as None rather than being dropped as falsy.
        update["whatsapp"] = normalize_whatsapp_number(update["whatsapp"])
    if "listing_id" in update:
        update["listing_id"] = await _validated_listing_id(update["listing_id"], user["user_id"])
    if update.get("date_mode") == "flexible":
        update["move_in_date"] = None
        update["preferred_date"] = None
    update["updated_at"] = datetime.now(UTC).isoformat()
    if "area" in update:
        update["area_id"] = resolve_area_id(update["area"])
    if update.get("area") and update["area"] != doc.get("area"):
        # Area changed, so the old pin is now wrong. Re-geocode rather than
        # leave it sitting at the previous neighbourhood.
        from utils.geocode import geocode_area_into
        asyncio.create_task(geocode_area_into("requests", request_id, update["area"]))
    await db.requests.update_one({"_id": request_id}, {"$set": update})
    fresh = await db.requests.find_one({"_id": request_id})

    # Re-translate when the English actually changed — which doubles as the
    # retry path when the create-time call failed and the Hebrew is still
    # empty. Skipped when neither field moved, so editing only a budget
    # doesn't spend an API call.
    title_changed = "title" in update and update["title"] != doc.get("title")
    desc_changed = "description" in update and update["description"] != doc.get("description")
    # Whichever side this post needs. Checking only `_he` was correct when
    # translation ran one way; on a Hebrew-authored post the missing side is
    # ENGLISH, and a `_he`-only check would report it complete forever.
    source = fresh.get("source_lang") or detect_lang(fresh.get("title"), fresh.get("description"))
    other = "en" if source == "he" else "he"
    missing_translation = (
        not fresh.get(f"title_{other}") or not fresh.get(f"description_{other}")
    )
    if title_changed or desc_changed or missing_translation:
        spawn(_translate_bg(request_id, fresh["title"], fresh["description"]))

    return _public(fresh)


@router.delete("/requests/{request_id}")
async def delete_request(request_id: str, user=Depends(verify_token)):
    doc = await _request_or_404(request_id)
    _require_owner(doc, user)
    await db.requests.delete_one({"_id": request_id})
    return {"ok": True}


@router.post("/requests/{request_id}/found")
async def mark_found(request_id: str, user=Depends(verify_token)):
    """"I found what I was looking for." Leaves the board, stays readable."""
    doc = await _request_or_404(request_id)
    _require_owner(doc, user)
    now = datetime.now(UTC).isoformat()
    await db.requests.update_one(
        {"_id": request_id},
        {"$set": {"status": "found", "found_at": now, "updated_at": now}},
    )
    return _public(await db.requests.find_one({"_id": request_id}))


class SoldIn(BaseModel):
    sold: bool = True


@router.post("/requests/{request_id}/sold")
async def mark_sold(request_id: str, payload: SoldIn, user=Depends(verify_token)):
    """One tap: sold, or back on sale (N4).

    A separate flag from `status`, and reversible. Both matter:

    `status` is the POST's lifecycle and is shared with rentals and
    services; `item_status` is about the object. Marking a sofa sold must
    not remove the post, because a buyer who followed a link is better
    served by "sold" than by a 404 — and because the seller who marked it
    sold in error would otherwise have to write it out again.

    Reversible because the sale falls through. A classifieds board where
    "sold" is one-way teaches sellers not to press it, and a board full of
    sold items is how classifieds sites die.
    """
    doc = await _request_or_404(request_id)
    _require_owner(doc, user)
    if doc.get("request_type") != "item":
        raise HTTPException(status_code=400, detail="Only an item can be marked sold")

    now = datetime.now(UTC).isoformat()
    await db.requests.update_one(
        {"_id": request_id},
        {"$set": {
            "item_status": "sold" if payload.sold else "available",
            "sold_at": now if payload.sold else None,
            "updated_at": now,
        }},
    )
    return _public(await db.requests.find_one({"_id": request_id}))


@router.post("/requests/{request_id}/renew")
async def renew_request(request_id: str, user=Depends(verify_token)):
    """Another 30 days from now.

    Works on an expired request too — that is the whole reason expiry is a
    status flip and not a TTL delete.
    """
    doc = await _request_or_404(request_id)
    _require_owner(doc, user)
    if doc.get("status") == "found":
        raise HTTPException(status_code=400, detail="This request is already marked as found")
    now = datetime.now(UTC)
    await db.requests.update_one(
        {"_id": request_id},
        {
            "$set": {
                "status": "open",
                "expires_at": (now + timedelta(days=REQUEST_TTL_DAYS)).isoformat(),
                "reminder_sent_at": None,
                "updated_at": now.isoformat(),
            },
            "$inc": {"renewed_count": 1},
        },
    )
    return _public(await db.requests.find_one({"_id": request_id}))


@router.post("/requests/{request_id}/contact")
async def contact_seeker(request_id: str, user=Depends(verify_token)):
    """The only way to reach a seeker: on-platform chat.

    Returns the chat deeplink rather than any contact detail. Requires
    auth so the board cannot be harvested anonymously, and counts the
    contact so the seeker can see interest even before anyone writes.
    """
    doc = await _request_or_404(request_id)
    if doc.get("hidden_by_admin"):
        raise HTTPException(status_code=404, detail="Request not found")
    if doc["poster_user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="This is your own request")
    await db.requests.update_one({"_id": request_id}, {"$inc": {"contact_count": 1}})
    return {
        "chat_url": f"/chat/{request_id}?with={doc['poster_user_id']}",
        "poster_user_id": doc["poster_user_id"],
    }


@router.post("/requests/{request_id}/report")
async def report_request(request_id: str, payload: ReportIn, user=Depends(verify_token)):
    """One-tap report, one per user, auto-hide at the threshold."""
    doc = await _request_or_404(request_id)
    if user["user_id"] in (doc.get("reported_by") or []):
        # Idempotent rather than an error: the user's intent is already
        # recorded, and telling them "already reported" invites retries.
        return {"ok": True, "already_reported": True}
    new_count = (doc.get("report_count") or 0) + 1
    update: dict[str, Any] = {
        "$inc": {"report_count": 1},
        "$push": {"reported_by": user["user_id"]},
        "$set": {"updated_at": datetime.now(UTC).isoformat()},
    }
    if new_count >= REPORT_HIDE_THRESHOLD:
        update["$set"]["hidden_by_admin"] = True
        logger.warning("[requests] auto-hid %s after %d reports", request_id, new_count)
    await db.requests.update_one({"_id": request_id}, update)
    await db.request_reports.insert_one({
        "_id": str(uuid.uuid4()),
        "request_id": request_id,
        "reporter_user_id": user["user_id"],
        "reason": payload.reason.strip(),
        "created_at": datetime.now(UTC).isoformat(),
    })
    return {"ok": True}


def _referrer_host(referer: Optional[str]) -> str:
    """Host portion of a Referer header, or '' — never the full URL.

    Our own query strings carry filter state (an area someone searched, for
    instance), so only the host is kept. Same rule as the gigs redirect.
    """
    if not referer:
        return ""
    try:
        return (urlparse(referer).hostname or "")[:100]
    except Exception:  # noqa: BLE001
        return ""


@router.get("/requests/{request_id}/contact-whatsapp")
async def contact_request_on_whatsapp(
    request_id: str,
    request: Request,
    text: str = Query("", max_length=1000),
) -> RedirectResponse:
    """Count the click, then hand the visitor to WhatsApp.

    The twin of the gigs redirect, and deliberately the same shape:

    * a REDIRECT rather than a POST-then-open, because a popup blocker kills
      a window opened after an await and a failed beacon loses the lead
      silently. The click and the measurement are one action;
    * logging NEVER blocks the hand-off — every failure path still
      redirects. A broken metric must not cost a poster a reply;
    * the wa.me URL is built here from the stored number, never taken from
      the caller, or this becomes an open redirect;
    * and the number reaches the browser only as a Location header on a
      click, not as a field in a public list. Someone scraping the board
      gets nothing.

    No auth. Requiring a login here would defeat the point — the poster
    opted in precisely so people can reach them without ceremony — and the
    number is not returned, only followed.
    """
    doc = await db.requests.find_one({"_id": request_id})
    frontend = os.environ.get("FRONTEND_URL", FRONTEND_URL).rstrip("/")
    if not doc or doc.get("hidden_by_admin"):
        # Same 404-shaped answer a hidden request gives everywhere else.
        return RedirectResponse(f"{frontend}/requests", status_code=302)

    target = build_whatsapp_link(doc.get("whatsapp"), text)
    if not target:
        # Opted out, or never opted in. Send them to the post, where the
        # in-platform chat button is.
        return RedirectResponse(f"{frontend}/requests/{request_id}", status_code=302)

    try:
        await db.lead_events.insert_one({
            "_id": str(uuid.uuid4()),
            "type": "whatsapp_click",
            # Namespaced so board clicks can be told apart from gig clicks
            # in the same collection rather than silently mixed together.
            "source": "request",
            "request_id": request_id,
            "poster_id": doc.get("poster_user_id"),
            "post_kind": doc.get("post_kind") or "want",
            "created_at": datetime.now(UTC).isoformat(),
            "referrer_host": _referrer_host(request.headers.get("referer")),
        })
    except Exception:  # noqa: BLE001 — the lead matters more than the metric
        logger.exception("lead_events insert failed for request %s", request_id)

    return RedirectResponse(target, status_code=302)


@router.get("/my-requests")
async def my_requests(user=Depends(verify_token)):
    """The seeker's own requests, every status, newest first.

    Uses the raw docs rather than ``_public`` for nothing extra — the
    poster still does not need their own report count.
    """
    docs = await db.requests.find(
        {"poster_user_id": user["user_id"]},
    ).sort("created_at", -1).to_list(200)
    # No identity lookup here — it is the caller's own name.
    return [_public(d) for d in docs]


# ---------------- Lifecycle ----------------

async def _expire_due_requests() -> int:
    """Flip open→expired for everything past its date. Idempotent."""
    now_iso = datetime.now(UTC).isoformat()
    res = await db.requests.update_many(
        {"status": "open", "expires_at": {"$lt": now_iso}},
        {"$set": {"status": "expired", "updated_at": now_iso}},
    )
    if res.modified_count:
        logger.info("[requests] expired %d request(s)", res.modified_count)
    return res.modified_count


async def requests_lifecycle_daily_loop() -> None:
    """Every 24h at 05:00 UTC, pegged to wall-clock so a restart doesn't
    shift the schedule — same shape as availability_reminders_daily_loop.

    See the module docstring: this assumes a single replica.
    """
    while True:
        now = datetime.now(UTC)
        next_run = now.replace(hour=5, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        await asyncio.sleep((next_run - now).total_seconds())
        try:
            await _expire_due_requests()
        except Exception as e:  # noqa: BLE001
            # A crash here must not kill the loop — tomorrow's pass would
            # never run, and requests would stay open forever.
            logger.warning("[requests] lifecycle loop crashed: %s", e)


# ---------------- Matching digest ----------------
#
# The board only works if demand reaches supply. An owner or tradesperson
# does not check a requests page daily, so a request they could answer
# goes unseen and the seeker concludes nobody is here. This closes that
# loop: once a day, anyone who already has something on the platform that
# fits a new request gets one email saying someone is looking for it.
#
# Three rules, each load-bearing:
#
#   1. ONE EMAIL PER PERSON PER DAY, grouped — not one per request. A
#      per-post ping is what trains people to filter us out; the jobs
#      board already learned this, which is why `digest` is the default
#      mode in notification_prefs.py.
#
#   2. MATCH NARROWLY. Someone hears about a request only if they already
#      have a published gig in that category, or a property in that area.
#      Anything looser turns a signal into a mailing list.
#
#   3. ALWAYS OFFER A WAY OUT. Every one of these carries a one-click
#      "stop these emails" link that needs no login.
#
# Idempotency is a ``digest_sent`` flag on the request document, not a
# "created in the last 24h" window. A window looks equivalent and is not:
# if the process restarts near the send hour the loop runs twice and every
# recipient gets the same email twice.

# Stored on the shared prefs doc rather than in a new collection — this is
# the same "how should we email you about the marketplace" question the
# jobs board already asks, and a second preferences store would mean two
# places to check and one of them eventually forgotten.
REQUESTS_OPT_OUT_FIELD = "requests_emails_off"
OPT_OUT_PURPOSE = "requests_optout"
OPT_OUT_TTL_DAYS = 90

# Most days this is one or two items. The cap exists for the FIRST run
# after deploy, when nothing carries the ``digest_sent`` flag yet and the
# pass therefore covers every open request on the board at once. A
# fifty-item email reads as spam no matter how relevant it is; the rest
# are summarised as a "and N more" line pointing at the board.
MAX_REQUESTS_PER_EMAIL = 8


def create_requests_optout_token(user_id: str) -> str:
    """Signed token behind the "stop these emails" link.

    Long TTL on purpose: someone who ignored the email for two months and
    then decides they have had enough must still be able to act on it. A
    link that expires quietly turns an unsubscribe into a dead end.
    """
    return jwt.encode(
        {
            "purpose": OPT_OUT_PURPOSE,
            "user_id": user_id,
            "exp": datetime.now(UTC) + timedelta(days=OPT_OUT_TTL_DAYS),
        },
        JWT_SECRET,
        algorithm="HS256",
    )


@router.post("/requests/emails/opt-out")
async def requests_optout_from_email(payload: dict = Body(...)):
    """Public. Auth is the signed token itself, so the link works straight
    from an email client without logging in — the point of an unsubscribe.
    """
    try:
        claims = verify_notification_token(payload.get("token") or "", OPT_OUT_PURPOSE)
    except NotificationTokenError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.job_notification_preferences.update_one(
        {"user_id": claims["user_id"]},
        {"$set": {REQUESTS_OPT_OUT_FIELD: True, "updated_at": datetime.now(UTC).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


async def _match_recipients(pending: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Map recipient user_id -> the new requests that concern them.

    A SERVICE request reaches providers with a published gig in the same
    category. A RENTAL request reaches owners with a property in the same
    area. Nobody is matched to their own request.

    DEMAND-SIDE POSTS ONLY. Now that the board carries supply-side posts too
    (``post_kind == "have"``), matching every post to this audience would
    email owners about other owners' spare flats and providers about rival
    providers' free slots — an inbox of competitors, which is the fastest
    way to make people turn the emails off.

    The mirror digest, telling seekers about matching "have" posts, is not
    built yet. It needs a different audience query (people with an open
    request in that area, rather than people with a property there) and it
    should not be bolted on by loosening the filter below.
    """
    out: dict[str, list[dict[str, Any]]] = {}

    for req in pending:
        if (req.get("post_kind") or "want") != "want":
            continue
        if req.get("request_type") == "service" and req.get("category"):
            ids = await db.marketplace_gigs.distinct(
                "provider_user_id",
                {"category": req["category"], "status": "published"},
            )
        elif req.get("request_type") == "rental" and (req.get("area") or "").strip():
            # Match on the first comma-separated part so a request for
            # "Ramat Eshkol" still reaches an owner whose property area
            # reads "Jerusalem, Ramat Eshkol". re.escape because area is
            # free text — a stray "(" would otherwise raise mid-loop.
            needle = re.escape(req["area"].split(",")[0].strip())
            if not needle:
                continue
            ids = await db.properties.distinct(
                "owner_id",
                {
                    "area": {"$regex": needle, "$options": "i"},
                    "status": {"$ne": "archived"},
                },
            )
        else:
            continue

        for uid in ids:
            if uid and uid != req.get("poster_user_id"):
                out.setdefault(uid, []).append(req)

    return out


def _esc(value: Any) -> str:
    """Request text is user-written and goes straight into an HTML email,
    so escaping is not optional here."""
    return html_escape(str(value or ""))


def _digest_email(name: str, reqs: list[dict[str, Any]], optout_url: str) -> tuple[str, str]:
    """(subject, html). Short and plain — a nudge, not a newsletter."""
    n = len(reqs)
    subject = (
        "Someone is looking for what you offer"
        if n == 1
        else f"{n} people are looking for what you offer"
    )

    shown = reqs[:MAX_REQUESTS_PER_EMAIL]
    overflow = n - len(shown)

    rows = []
    for r in shown:
        bits = []
        if r.get("area"):
            bits.append(_esc(r["area"]))
        if r.get("bedrooms_min"):
            bits.append(f"{int(r['bedrooms_min'])}+ bedrooms")
        if r.get("budget_type") == "fixed" and r.get("budget_amount"):
            sym = "₪" if (r.get("budget_currency") or "ILS") == "ILS" else "$"
            bits.append(f"up to {sym}{int(r['budget_amount']):,}")
        rows.append(
            f'<li style="margin:0 0 14px">'
            f'<a href="{FRONTEND_URL}/requests/{_esc(r["_id"])}" '
            f'style="color:#1E6A6A;font-weight:700;text-decoration:none;font-size:15px">'
            f'{_esc(r.get("title") or "A request")}</a>'
            f'<div style="color:#777;font-size:13px;margin-top:3px">{" · ".join(bits)}</div>'
            f'</li>'
        )

    if overflow:
        rows.append(
            f'<li style="margin:0 0 14px;color:#777;font-size:14px">'
            f'and {overflow} more on the board</li>'
        )

    lead = (
        "Someone has posted on the MyIsraelRental requests board looking for "
        "something you may be able to help with."
        if n == 1
        else "People have posted on the MyIsraelRental requests board looking "
             "for things you may be able to help with."
    )
    settings_url = f"{FRONTEND_URL}/dashboard/settings?section=notifications"
    html = f"""
      <p>Hi {_esc(name) or 'there'},</p>
      <p>{lead}</p>
      <ul style="padding-left:18px;margin:18px 0">{''.join(rows)}</ul>
      <p style="margin:24px 0">
        <a href="{FRONTEND_URL}/requests" style="display:inline-block;padding:12px 22px;background:#1E6A6A;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">See the board</a>
      </p>
      <p style="color:#666;font-size:12px;margin-top:28px;line-height:1.6">
        You are getting this because you have a listing that matches. Replies
        happen in chat on MyIsraelRental — nobody gets your phone number or
        email address.<br>
        <a href="{optout_url}" style="color:#1E6A6A">Stop these emails</a>
        &nbsp;·&nbsp; <a href="{settings_url}" style="color:#1E6A6A">Notification settings</a>
      </p>
    """
    return subject, html


async def _send_matching_digest() -> int:
    """One pass. Returns the number of emails sent."""
    pending = await db.requests.find({
        "status": "open",
        "hidden_by_admin": {"$ne": True},
        "digest_sent": {"$ne": True},
    }).to_list(500)
    if not pending:
        return 0

    by_user = await _match_recipients(pending)

    sent = 0
    if by_user:
        now_iso = datetime.now(UTC).isoformat()
        prefs = {
            p["user_id"]: p
            async for p in db.job_notification_preferences.find(
                {"user_id": {"$in": list(by_user)}},
            )
        }
        users = {
            u["id"]: u
            async for u in db.users.find(
                {"id": {"$in": list(by_user)}},
                {"_id": 0, "id": 1, "name": 1, "email": 1},
            )
        }

        for uid, reqs in by_user.items():
            pref = prefs.get(uid, {})
            if pref.get(REQUESTS_OPT_OUT_FIELD):
                continue

            # A provider who snoozed a category on the jobs board doesn't
            # want request emails about that category either — from their
            # side it is the same "not right now, thanks".
            snoozed = {
                s.get("category")
                for s in (pref.get("snoozed_categories") or [])
                if (s.get("until") or "") > now_iso
            }
            visible = [r for r in reqs if r.get("category") not in snoozed]
            if not visible:
                continue

            user = users.get(uid)
            if not user or not user.get("email"):
                continue

            subject, body = _digest_email(
                user.get("name") or "",
                visible,
                f"{FRONTEND_URL}/requests-emails-off?t={create_requests_optout_token(uid)}",
            )
            try:
                await send_email(user["email"], subject, body, tag="requests-digest")
                sent += 1
            except Exception as e:  # noqa: BLE001
                # One bad address must not abort the rest of the run.
                logger.warning("[requests] digest email failed for %s: %s", uid, e)

    # Mark everything this pass considered — including requests that
    # matched nobody — so none is reconsidered tomorrow. Done after the
    # sends: if the process dies mid-pass the worst case is a repeat,
    # which beats a request that silently never goes out at all.
    await db.requests.update_many(
        {"_id": {"$in": [r["_id"] for r in pending]}},
        {"$set": {"digest_sent": True}},
    )
    logger.info(
        "[requests] matching digest: %d email(s) for %d new request(s)",
        sent, len(pending),
    )
    return sent


async def requests_digest_daily_loop() -> None:
    """Daily at 09:00 UTC — the same hour the jobs digest goes out, and
    the same single-replica caveat as the lifecycle loop above."""
    while True:
        now = datetime.now(UTC)
        next_run = now.replace(hour=9, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        await asyncio.sleep((next_run - now).total_seconds())
        try:
            await _send_matching_digest()
        except Exception as e:  # noqa: BLE001
            logger.warning("[requests] digest loop crashed: %s", e)

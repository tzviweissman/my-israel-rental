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
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from routes.deps import db, logger, verify_token
from utils.translate import translate_marketing_to_hebrew

from .shared import UTC, _validate_category, _validate_subcategory


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


# ---------------- Pydantic models ----------------

class RequestIn(BaseModel):
    request_type: str = Field(..., pattern="^(rental|service)$")
    title: str = Field(..., min_length=6, max_length=140)
    description: str = Field(..., min_length=10, max_length=4000)
    area: str = Field(..., min_length=2, max_length=120)

    budget_type: str = Field("open", pattern="^(fixed|open)$")
    budget_amount: Optional[float] = None
    budget_currency: str = Field("ILS", pattern="^(ILS|USD)$")

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


class RequestPatch(BaseModel):
    title: Optional[str] = Field(None, min_length=6, max_length=140)
    description: Optional[str] = Field(None, min_length=10, max_length=4000)
    area: Optional[str] = Field(None, min_length=2, max_length=120)
    budget_type: Optional[str] = Field(None, pattern="^(fixed|open)$")
    budget_amount: Optional[float] = None
    budget_currency: Optional[str] = Field(None, pattern="^(ILS|USD)$")
    preferred_date: Optional[str] = None
    bedrooms_min: Optional[int] = Field(None, ge=0, le=20)
    move_in_date: Optional[str] = None
    lease_months: Optional[int] = Field(None, ge=1, le=120)
    furnished: Optional[bool] = None
    amenities: Optional[list[str]] = None


class ReportIn(BaseModel):
    reason: str = Field(..., min_length=3, max_length=400)


# ---------------- Helpers ----------------

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
    out = {k: v for k, v in doc.items() if k not in ("_id", "report_count", "reported_by", "hidden_by_admin")}
    out["id"] = doc.get("_id")
    if identity:
        out.update(identity)
    return out


async def _translate_bg(request_id: str, title: str, description: str) -> None:
    """Fill title_he / description_he in the background.

    Bilingual reach is the whole point of this board: a Hebrew-speaking
    landlord scanning demand has to be able to read an English speaker's
    request, and the reverse.

    Same helper, model and config as gigs and jobs — deliberately no new
    spend pattern. Runs as a background task rather than inline so an
    Anthropic outage can never delay or block someone from posting: the
    request is already saved and live before this starts, and a failure
    here leaves it published in the language it was written in.

    Fires on create and on edit only, never on read.
    """
    try:
        title_he = await translate_marketing_to_hebrew(title) if title else None
        desc_he = await translate_marketing_to_hebrew(description) if description else None
        updates: dict[str, Any] = {}
        if title_he:
            updates["title_he"] = title_he
        if desc_he:
            updates["description_he"] = desc_he
        if updates:
            await db.requests.update_one({"_id": request_id}, {"$set": updates})
    except Exception as e:  # noqa: BLE001
        # Swallowed on purpose. The post is already live; the next edit
        # re-runs this, so a transient outage self-heals.
        logger.warning("[requests] Hebrew translation failed for %s: %s", request_id, e)


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


def _validate_variant(payload: RequestIn) -> None:
    """Per-type required fields.

    A service request without a category cannot be matched to providers,
    and a rental request without a kind cannot be matched to properties —
    so each is required for its own type and ignored for the other.
    """
    if payload.request_type == "service":
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
    request_type: Optional[str] = Query(None, pattern="^(rental|service)$"),
    category: Optional[str] = None,
    rental_kind: Optional[str] = None,
    area: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(60, ge=1, le=200),
):
    """Public board. Only open, un-hidden requests are ever returned."""
    query: dict[str, Any] = {"status": "open", "hidden_by_admin": {"$ne": True}}
    if request_type:
        query["request_type"] = request_type
    if category:
        _validate_category(category)
        query["category"] = category
    if rental_kind:
        query["rental_kind"] = rental_kind
    if area:
        # Prefix-ish match so "Tel Aviv" finds "Tel Aviv, Florentin".
        query["area"] = {"$regex": area.strip(), "$options": "i"}
    if q:
        query["$or"] = [
            {"title": {"$regex": q.strip(), "$options": "i"}},
            {"description": {"$regex": q.strip(), "$options": "i"}},
        ]
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
    doc = {
        "_id": str(uuid.uuid4()),
        "request_type": payload.request_type,
        "poster_user_id": user["user_id"],
        "title": payload.title.strip(),
        "title_he": None,
        "description": payload.description.strip(),
        "description_he": None,
        "area": payload.area.strip(),
        "budget_type": payload.budget_type,
        "budget_amount": payload.budget_amount if payload.budget_type == "fixed" else None,
        "budget_currency": payload.budget_currency,
        # Service variant — null on rentals so filters can key on presence.
        "category": payload.category if is_service else None,
        "subcategory": ((payload.subcategory or "").strip() or None) if is_service else None,
        "preferred_date": payload.preferred_date if is_service else None,
        # Rental variant — null on services, same reason.
        "rental_kind": payload.rental_kind if not is_service else None,
        "bedrooms_min": payload.bedrooms_min if not is_service else None,
        "move_in_date": payload.move_in_date if not is_service else None,
        "lease_months": payload.lease_months if not is_service else None,
        "furnished": payload.furnished if not is_service else None,
        "amenities": (payload.amenities or []) if not is_service else [],
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
    logger.info("[requests] created %s (%s) by %s", doc["_id"], doc["request_type"], user["user_id"])
    # After the insert, so the request is live whatever the LLM does.
    asyncio.create_task(_translate_bg(doc["_id"], doc["title"], doc["description"]))
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
    update["updated_at"] = datetime.now(UTC).isoformat()
    await db.requests.update_one({"_id": request_id}, {"$set": update})
    fresh = await db.requests.find_one({"_id": request_id})

    # Re-translate when the English actually changed — which doubles as the
    # retry path when the create-time call failed and the Hebrew is still
    # empty. Skipped when neither field moved, so editing only a budget
    # doesn't spend an API call.
    title_changed = "title" in update and update["title"] != doc.get("title")
    desc_changed = "description" in update and update["description"] != doc.get("description")
    missing_he = not fresh.get("title_he") or not fresh.get("description_he")
    if title_changed or desc_changed or missing_he:
        asyncio.create_task(_translate_bg(request_id, fresh["title"], fresh["description"]))

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

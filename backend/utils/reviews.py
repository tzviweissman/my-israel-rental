"""Verified reviews (spec: Build: Verified Reviews System, 23 Sep 2026).

Two sources only, and nothing a business can type in:
  native  written by a guest after a completed booking on the site
  google  imported, all or nothing, from the business's own Google profile

Every function takes `db` so the tests can run against a scratch database.
The rules that matter legally (FTC 16 CFR Part 465) are enforced here, not
in the UI: a review is removed only for a reason in REMOVAL_REASONS, the
owner can respond and report but never edit, hide or remove, and imported
text and ratings are read-only to everyone.

Decisions (Tzvi, 23 Sep 2026):
  * A stay has earned a review when the owner confirmed it, it was not
    cancelled and the checkout date has passed. Bookings carry no payment
    or "completed" state (payment happens off the site).
  * Service bookings count once the business marks them completed.
    Store orders do not: the customer there has no account to check.
  * Old unchecked service reviews: those whose writer has a completed
    booking with that service become verified; the rest are left in
    marketplace_reviews and simply not read (scripts/migrate_reviews.py).
"""
from __future__ import annotations

import os
import re
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import jwt

ISRAEL = ZoneInfo("Asia/Jerusalem")

SOURCES = ("native", "google")
STATUSES = ("published", "under_review", "removed")
# Shown to visitors. A report does not hide a review; an admin decides.
VISIBLE = ("published", "under_review")

# The ONLY reasons a review may be removed. "negative" is never one of
# them, and anything not in this tuple is refused in remove_review().
REMOVAL_REASONS = (
    "spam", "hate_or_harassment", "personal_information", "off_topic",
    "conflict_of_interest", "illegal_content", "deleted_at_source",
)
# deleted_at_source is set by the Google sync alone; an admin cannot pick it.
ADMIN_REMOVAL_REASONS = tuple(r for r in REMOVAL_REASONS if r != "deleted_at_source")
REPORT_REASONS = ADMIN_REMOVAL_REASONS + ("other",)

SUB_RATINGS = ("cleanliness", "accuracy", "communication", "location", "value")
TEXT_MIN, TEXT_MAX = 20, 2000
EDIT_HOURS = 48
REQUEST_TOKEN_DAYS = 30

# Webmail domains say nothing about who someone works for.
_PUBLIC_MAIL = {
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.il", "hotmail.com", "outlook.com",
    "live.com", "msn.com", "icloud.com", "me.com", "aol.com", "walla.co.il", "walla.com",
    "protonmail.com", "proton.me", "gmx.com", "mail.com", "012.net.il", "netvision.net.il",
    "bezeqint.net", "zahav.net.il",
}


class ReviewError(Exception):
    """A refusal with an HTTP status and a machine-readable code."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def native_enabled() -> bool:
    return os.environ.get("REVIEWS_NATIVE_ENABLED", "").strip() == "1"


def google_enabled() -> bool:
    return os.environ.get("REVIEWS_GOOGLE_IMPORT_ENABLED", "").strip() == "1"


def window_days() -> int:
    try:
        return max(1, int(os.environ.get("REVIEW_WINDOW_DAYS", "30")))
    except ValueError:
        return 30


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def today_il() -> date:
    return datetime.now(ISRAEL).date()


def _day(value: Any) -> date | None:
    """A stored date or timestamp as an Israel calendar day."""
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        s = str(value)
        if len(s) == 10:
            try:
                return date.fromisoformat(s)
            except ValueError:
                return None
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(ISRAEL).date()


def clean_text(text: Any) -> str:
    """Plain text only: tags and control characters out, whitespace tidied,
    capped. Output is escaped again wherever it is rendered."""
    s = re.sub(r"<[^>]*>", "", str(text or ""))
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()[:TEXT_MAX]


def display_name(full_name: str | None) -> str:
    """First name and last initial: "Sara Levi" -> "Sara L."."""
    parts = [p for p in (full_name or "").split() if p]
    if not parts:
        return "Guest"
    first = parts[0][:1].upper() + parts[0][1:]
    return f"{first} {parts[-1][0].upper()}." if len(parts) > 1 else first


def _domain(email: str | None) -> str:
    return (email or "").rsplit("@", 1)[-1].strip().lower() if "@" in (email or "") else ""


# ---------------------------------------------------------------- bookings

async def load_booking(db, booking_id: str) -> dict | None:
    """The booking behind a review, from either kind, in one shape:
    {kind, id, guest_id, status, start, end, done_on, listing_id,
     listing_kind, listing_title, owner_ids, business_id}."""
    b = await db.bookings.find_one({"id": booking_id})
    if b:
        prop = await db.properties.find_one({"id": b.get("property_id")}, {"_id": 0, "id": 1, "title": 1, "owner_id": 1}) or {}
        owner = prop.get("owner_id") or b.get("owner_id")
        biz = await db.businesses.find_one({"owner_user_id": owner}, {"_id": 1}) if owner else None
        return {
            "kind": "stay", "id": b["id"], "guest_id": b.get("renter_id"), "status": b.get("status"),
            "start": b.get("start_date"), "end": b.get("end_date"), "done_on": _day(b.get("end_date")),
            "listing_id": b.get("property_id"), "listing_kind": "property", "listing_title": prop.get("title") or "",
            "owner_ids": {x for x in (owner, b.get("owner_id")) if x}, "business_id": (biz or {}).get("_id"),
        }
    b = await db.marketplace_bookings.find_one({"_id": booking_id})
    if b:
        gig = await db.marketplace_gigs.find_one({"_id": b.get("gig_id")}, {"title": 1, "provider_user_id": 1, "business_id": 1}) or {}
        biz = await db.businesses.find_one({"_id": gig.get("business_id")}, {"owner_user_id": 1}) if gig.get("business_id") else None
        done = b.get("completed_at") or (b.get("updated_at") if b.get("status") == "completed" else None)
        return {
            "kind": "service", "id": b["_id"], "guest_id": b.get("client_user_id"), "status": b.get("status"),
            "start": b.get("preferred_date"), "end": b.get("preferred_date"), "done_on": _day(done),
            "listing_id": b.get("gig_id"), "listing_kind": "gig", "listing_title": gig.get("title") or "",
            "owner_ids": {x for x in (gig.get("provider_user_id"), b.get("provider_user_id"), (biz or {}).get("owner_user_id")) if x},
            "business_id": gig.get("business_id"),
        }
    return None


async def check_eligibility(db, booking: dict | None, user_id: str | None, *, today: date | None = None) -> dict:
    """Why this person may or may not review this booking. Never raises;
    returns {eligible, reason}. Reasons: not_found, not_yours, not_completed,
    cancelled, too_early, window_closed, already_reviewed, own_listing."""
    today = today or today_il()
    if not booking:
        return {"eligible": False, "reason": "not_found"}
    if not user_id or booking["guest_id"] != user_id:
        return {"eligible": False, "reason": "not_yours"}
    if user_id in booking["owner_ids"]:
        return {"eligible": False, "reason": "own_listing"}
    guest = await db.users.find_one({"id": user_id}, {"email": 1}) or {}
    dom = _domain(guest.get("email"))
    if dom and dom not in _PUBLIC_MAIL:
        async for o in db.users.find({"id": {"$in": list(booking["owner_ids"])}}, {"email": 1}):
            if _domain(o.get("email")) == dom:
                return {"eligible": False, "reason": "own_listing"}
    status = booking["status"]
    if status in ("cancelled", "cancellation_requested", "declined", "expired"):
        return {"eligible": False, "reason": "cancelled"}
    if booking["kind"] == "stay":
        if status != "confirmed":
            return {"eligible": False, "reason": "not_completed"}
        if not booking["done_on"] or booking["done_on"] >= today:
            return {"eligible": False, "reason": "too_early"}
    elif status != "completed" or not booking["done_on"]:
        return {"eligible": False, "reason": "not_completed"}
    if today > booking["done_on"] + timedelta(days=window_days()):
        return {"eligible": False, "reason": "window_closed"}
    if await db.reviews.find_one({"booking_id": booking["id"]}, {"_id": 1}):
        return {"eligible": False, "reason": "already_reviewed"}
    return {"eligible": True, "reason": None}


# ---------------------------------------------------------------- tokens

def _secret() -> str:
    return os.environ["JWT_SECRET"]


async def mint_request_token(db, booking_id: str, *, days: int = REQUEST_TOKEN_DAYS) -> str:
    """A signed, expiring, single-use link token. The JWT proves we issued
    it; the row in review_tokens is what makes it single-use."""
    jti = uuid.uuid4().hex
    exp = datetime.now(UTC) + timedelta(days=days)
    await db.review_tokens.insert_one({"_id": jti, "booking_id": booking_id, "used_at": None, "expires_at": exp.isoformat()})
    return jwt.encode({"kind": "review_request", "booking_id": booking_id, "jti": jti, "exp": exp}, _secret(), algorithm="HS256")


async def read_request_token(db, token: str) -> dict:
    """{booking_id, jti} for a live, unused token, else ReviewError."""
    try:
        claims = jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise ReviewError(410, "link_expired", "This review link has expired.")
    except jwt.InvalidTokenError:
        raise ReviewError(400, "link_invalid", "This review link is not valid.")
    if claims.get("kind") != "review_request":
        raise ReviewError(400, "link_invalid", "This review link is not valid.")
    row = await db.review_tokens.find_one({"_id": claims.get("jti")})
    if not row or row.get("booking_id") != claims.get("booking_id"):
        raise ReviewError(400, "link_invalid", "This review link is not valid.")
    if row.get("used_at"):
        raise ReviewError(410, "link_used", "This review link has already been used.")
    return {"booking_id": row["booking_id"], "jti": row["_id"]}


# ---------------------------------------------------------------- audit

async def audit(db, review_id: str, action: str, actor_id: str | None, before: dict | None, after: dict | None) -> None:
    keep = ("status", "removal_reason", "rating", "sub_ratings", "text", "owner_response", "source_connected")
    trim = lambda d: {k: d.get(k) for k in keep if k in d} if d else None  # noqa: E731
    await db.review_audit_log.insert_one({
        "_id": uuid.uuid4().hex, "review_id": review_id, "action": action, "actor_id": actor_id,
        "before": trim(before), "after": trim(after), "timestamp": now_iso(),
    })


# ---------------------------------------------------------------- native

def _validate_body(rating: Any, sub_ratings: Any, text: Any, *, stay: bool) -> tuple[int, dict | None, str]:
    if not isinstance(rating, int) or isinstance(rating, bool) or not 1 <= rating <= 5:
        raise ReviewError(422, "bad_rating", "Choose between 1 and 5 stars.")
    subs = None
    if sub_ratings:
        if not stay or not isinstance(sub_ratings, dict):
            raise ReviewError(422, "bad_sub_ratings", "Detailed ratings are for stays only.")
        subs = {}
        for k, v in sub_ratings.items():
            if k not in SUB_RATINGS or not isinstance(v, int) or isinstance(v, bool) or not 1 <= v <= 5:
                raise ReviewError(422, "bad_sub_ratings", "Detailed ratings must be 1 to 5.")
            subs[k] = v
    body = clean_text(text)
    if len(body) < TEXT_MIN:
        raise ReviewError(422, "text_too_short", f"Write at least {TEXT_MIN} characters.")
    return rating, subs or None, body


async def create_native(db, *, booking_id: str, user_id: str, rating: Any, text: Any,
                        sub_ratings: Any = None, token_jti: str | None = None, today: date | None = None) -> dict:
    booking = await load_booking(db, booking_id)
    verdict = await check_eligibility(db, booking, user_id, today=today)
    if not verdict["eligible"]:
        raise ReviewError(403 if verdict["reason"] in ("not_yours", "own_listing") else 409 if verdict["reason"] == "already_reviewed" else 422,
                          verdict["reason"], "This booking can't be reviewed.")
    rating, subs, body = _validate_body(rating, sub_ratings, text, stay=booking["kind"] == "stay")
    if token_jti:
        # Spend the link first: two tabs submitting at once get one review.
        spent = await db.review_tokens.find_one_and_update(
            {"_id": token_jti, "used_at": None}, {"$set": {"used_at": now_iso()}})
        if not spent:
            raise ReviewError(410, "link_used", "This review link has already been used.")
    author = await db.users.find_one({"id": user_id}, {"name": 1}) or {}
    now = now_iso()
    doc = {
        "_id": uuid.uuid4().hex, "listing_id": booking["listing_id"], "listing_kind": booking["listing_kind"],
        "business_id": booking["business_id"], "owner_user_ids": sorted(booking["owner_ids"]),
        "source": "native", "verified": True, "booking_id": booking["id"], "booking_kind": booking["kind"],
        "author_user_id": user_id, "author_display_name": display_name(author.get("name")),
        "rating": rating, "sub_ratings": subs, "text": body,
        "stay_start": booking["start"], "stay_end": booking["end"],
        "external_id": None, "external_url": None, "source_created_at": now, "source_updated_at": now,
        "status": "published", "removal_reason": None, "owner_response": None, "incentivized": False,
        "source_connected": True, "created_at": now, "updated_at": now,
    }
    try:
        await db.reviews.insert_one(doc)
    except Exception as e:  # the unique booking_id index: a double submit
        if "duplicate key" in str(e).lower():
            raise ReviewError(409, "already_reviewed", "This booking already has a review.")
        raise
    await audit(db, doc["_id"], "create", user_id, None, doc)
    return doc


async def edit_native(db, review_id: str, user_id: str, *, rating: Any = None, text: Any = None, sub_ratings: Any = None) -> dict:
    r = await db.reviews.find_one({"_id": review_id})
    if not r:
        raise ReviewError(404, "not_found", "Review not found.")
    if r["source"] != "native" or r.get("author_user_id") != user_id:
        raise ReviewError(403, "not_author", "Only the person who wrote this review can change it.")
    if datetime.now(UTC) - datetime.fromisoformat(r["created_at"]) > timedelta(hours=EDIT_HOURS):
        raise ReviewError(403, "locked", "Reviews can be changed for 48 hours after they're posted.")
    if r["status"] == "removed":
        raise ReviewError(403, "locked", "This review was removed.")
    new_rating, subs, body = _validate_body(
        r["rating"] if rating is None else rating,
        r.get("sub_ratings") if sub_ratings is None else sub_ratings,
        r["text"] if text is None else text, stay=r.get("booking_kind") == "stay")
    patch = {"rating": new_rating, "sub_ratings": subs, "text": body, "source_updated_at": now_iso(), "updated_at": now_iso()}
    await db.reviews.update_one({"_id": review_id}, {"$set": patch})
    after = {**r, **patch}
    await audit(db, review_id, "edit", user_id, r, after)
    return after


async def respond(db, review_id: str, user_id: str, text: Any) -> dict:
    """The owner's one public response, editable. Native reviews only:
    a Google review's reply lives on Google and comes in with the sync."""
    r = await db.reviews.find_one({"_id": review_id})
    if not r:
        raise ReviewError(404, "not_found", "Review not found.")
    if user_id not in (r.get("owner_user_ids") or []):
        raise ReviewError(403, "not_owner", "Only the listing's owner can respond.")
    if r["source"] != "native":
        raise ReviewError(403, "reply_on_google", "Reply to Google reviews on Google.")
    body = clean_text(text)
    if not body:
        raise ReviewError(422, "empty", "Write a response.")
    now = now_iso()
    prev = r.get("owner_response") or {}
    resp = {"text": body, "created_at": prev.get("created_at") or now, "updated_at": now}
    await db.reviews.update_one({"_id": review_id}, {"$set": {"owner_response": resp, "updated_at": now}})
    await audit(db, review_id, "respond" if not prev else "respond_edit", user_id, r, {**r, "owner_response": resp})
    return {**r, "owner_response": resp}


async def report(db, review_id: str, user_id: str, reason: Any, note: Any = None) -> dict:
    """Any signed-in person, owners included. The review stays visible
    under_review until an admin decides."""
    if reason not in REPORT_REASONS:
        raise ReviewError(422, "bad_reason", "Choose a reason.")
    r = await db.reviews.find_one({"_id": review_id})
    if not r or r["status"] == "removed":
        raise ReviewError(404, "not_found", "Review not found.")
    if await db.review_reports.find_one({"review_id": review_id, "reporter_user_id": user_id}, {"_id": 1}):
        return {"status": r["status"], "already": True}
    await db.review_reports.insert_one({
        "_id": uuid.uuid4().hex, "review_id": review_id, "reporter_user_id": user_id,
        "reason": reason, "note": clean_text(note)[:500] or None, "created_at": now_iso(), "resolved": False,
    })
    if r["status"] == "published":
        await db.reviews.update_one({"_id": review_id}, {"$set": {"status": "under_review", "updated_at": now_iso()}})
        await audit(db, review_id, "report", user_id, r, {**r, "status": "under_review"})
    return {"status": "under_review", "already": False}


async def remove_review(db, review_id: str, actor_id: str | None, reason: Any, *, system: bool = False) -> dict:
    """The one way a review leaves the page. Refuses any reason outside
    REMOVAL_REASONS (so "negative", or anything else, never works) and
    keeps deleted_at_source for the Google sync."""
    allowed = REMOVAL_REASONS if system else ADMIN_REMOVAL_REASONS
    if reason not in allowed:
        raise ReviewError(422, "bad_reason", "That is not a reason a review can be removed for.")
    r = await db.reviews.find_one({"_id": review_id})
    if not r:
        raise ReviewError(404, "not_found", "Review not found.")
    patch = {"status": "removed", "removal_reason": reason, "updated_at": now_iso()}
    await db.reviews.update_one({"_id": review_id}, {"$set": patch})
    await db.review_reports.update_many({"review_id": review_id}, {"$set": {"resolved": True}})
    await audit(db, review_id, "remove", actor_id, r, {**r, **patch})
    return {**r, **patch}


async def approve_review(db, review_id: str, actor_id: str) -> dict:
    """An admin keeps a reported review: back to published."""
    r = await db.reviews.find_one({"_id": review_id})
    if not r:
        raise ReviewError(404, "not_found", "Review not found.")
    patch = {"status": "published", "removal_reason": None, "updated_at": now_iso()}
    await db.reviews.update_one({"_id": review_id}, {"$set": patch})
    await db.review_reports.update_many({"review_id": review_id}, {"$set": {"resolved": True}})
    await audit(db, review_id, "approve", actor_id, r, {**r, **patch})
    return {**r, **patch}


# ---------------------------------------------------------------- reading

def visible_query(extra: dict) -> dict:
    return {**extra, "status": {"$in": list(VISIBLE)}, "source_connected": {"$ne": False}}


async def summary(db, match: dict) -> dict:
    """Averages kept apart by source, from the database:
    {"native": {"avg": 4.8, "count": 23}, "google": {...}}. A source with no
    reviews is absent."""
    out: dict[str, dict] = {}
    async for row in db.reviews.aggregate([
        {"$match": visible_query(match)},
        {"$group": {"_id": "$source", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]):
        out[row["_id"]] = {"avg": round(row["avg"], 1), "count": row["count"]}
    return out


SORTS = {
    "newest": [("source_created_at", -1)],
    "highest": [("rating", -1), ("source_created_at", -1)],
    "lowest": [("rating", 1), ("source_created_at", -1)],
}
PAGE_SIZE = 10


def public_review(r: dict) -> dict:
    """What a visitor sees. No author ids or emails."""
    return {
        "id": r["_id"], "source": r["source"], "verified": r.get("verified", False),
        "booking_kind": r.get("booking_kind"), "author_display_name": r.get("author_display_name") or "",
        "rating": r["rating"], "sub_ratings": r.get("sub_ratings"), "text": r.get("text") or "",
        "stay_start": r.get("stay_start"), "stay_end": r.get("stay_end"),
        "external_url": r.get("external_url"), "date": r.get("source_created_at"),
        "edited": (r.get("source_updated_at") or "") > (r.get("source_created_at") or ""),
        "status": r["status"], "owner_response": r.get("owner_response"), "incentivized": r.get("incentivized", False),
    }


async def list_reviews(db, match: dict, *, source: str | None, sort: str, page: int) -> dict:
    q = visible_query(match)
    if source in SOURCES:
        q["source"] = source
    page = max(1, page)
    cursor = db.reviews.find(q).sort(SORTS.get(sort, SORTS["newest"])).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE + 1)
    rows = await cursor.to_list(PAGE_SIZE + 1)
    return {"reviews": [public_review(r) for r in rows[:PAGE_SIZE]], "has_more": len(rows) > PAGE_SIZE, "page": page}


async def ensure_indexes(db) -> None:
    await db.reviews.create_index([("listing_id", 1), ("status", 1), ("source_created_at", -1)])
    await db.reviews.create_index([("business_id", 1), ("status", 1), ("source_created_at", -1)])
    await db.reviews.create_index([("source", 1), ("external_id", 1)], unique=True,
                                  partialFilterExpression={"external_id": {"$type": "string"}})
    await db.reviews.create_index("booking_id", unique=True, partialFilterExpression={"booking_id": {"$type": "string"}})
    await db.reviews.create_index("status")
    await db.review_audit_log.create_index([("review_id", 1), ("timestamp", -1)])
    await db.review_reports.create_index([("review_id", 1), ("reporter_user_id", 1)])
    await db.review_requests.create_index("last_sent_at")

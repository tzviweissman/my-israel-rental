"""Verified reviews: HTTP endpoints and the two daily jobs.

The rules live in utils/reviews.py and utils/google_reviews.py; this file
checks who is asking and hands over. Everything is behind two flags, both
off by default:
  REVIEWS_NATIVE_ENABLED=1         guest reviews after a completed booking
  REVIEWS_GOOGLE_IMPORT_ENABLED=1  importing a business's Google reviews
With both off, every endpoint here answers "off" and the old service
reviews (routes/marketplace/gigs.py) carry on exactly as before.
"""
from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime, timedelta

import httpx
import jwt
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from routes.deps import db, logger, optional_user, verify_token
from utils import google_reviews as g
from utils import reviews as rv
from utils.rate_limit import check_rate

router = APIRouter()
FRONTEND_URL = (os.environ.get("FRONTEND_URL") or "https://myisraelrental.com").rstrip("/")


def _raise(e: rv.ReviewError) -> None:
    raise HTTPException(status_code=e.status, detail={"code": e.code, "message": e.message})


def _need_native() -> None:
    if not rv.native_enabled():
        raise HTTPException(status_code=404, detail="Reviews are switched off")


def _need_google() -> None:
    if not rv.google_enabled():
        raise HTTPException(status_code=404, detail="Google reviews are switched off")


def _need_admin(user: dict) -> None:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")


def _sources() -> list[str]:
    return [s for s, on in (("native", rv.native_enabled()), ("google", rv.google_enabled())) if on]


@router.get("/reviews/config")
async def reviews_config() -> dict:
    """Which parts are on, so the pages know what to draw."""
    return {"native": rv.native_enabled(), "google": rv.google_enabled()}


# ---------------------------------------------------------------- native

async def _booking_view(booking: dict | None, verdict: dict) -> dict:
    b = booking or {}
    return {
        **verdict, "booking_id": b.get("id"), "kind": b.get("kind"), "listing_title": b.get("listing_title"),
        "listing_id": b.get("listing_id"), "listing_kind": b.get("listing_kind"),
        "stay_start": b.get("start"), "stay_end": b.get("end"), "sub_ratings": list(rv.SUB_RATINGS) if b.get("kind") == "stay" else [],
    }


@router.get("/reviews/eligibility/{booking_id}")
async def eligibility(booking_id: str, user=Depends(verify_token)) -> dict:
    _need_native()
    booking = await rv.load_booking(db, booking_id)
    verdict = await rv.check_eligibility(db, booking, user["user_id"])
    if verdict["reason"] in ("not_found", "not_yours"):
        booking = None  # say nothing about someone else's booking
    return await _booking_view(booking, verdict)


@router.get("/reviews/request/{token}")
async def request_link(token: str) -> dict:
    """The emailed link, before the form is filled in. No sign-in needed:
    the signed, single-use token is the proof."""
    _need_native()
    try:
        t = await rv.read_request_token(db, token)
    except rv.ReviewError as e:
        return {"eligible": False, "reason": e.code}
    booking = await rv.load_booking(db, t["booking_id"])
    verdict = await rv.check_eligibility(db, booking, (booking or {}).get("guest_id"))
    return await _booking_view(booking, verdict)


@router.post("/reviews")
async def create_review(request: Request, payload: dict = Body(...), viewer=Depends(optional_user)) -> dict:
    """Signed in with a booking_id, or from the emailed link with a token."""
    _need_native()
    check_rate(request, bucket="review-submit-ip", limit=20, window_seconds=3600)
    jti = None
    if payload.get("token"):
        try:
            t = await rv.read_request_token(db, str(payload["token"]))
        except rv.ReviewError as e:
            _raise(e)
        booking_id = t["booking_id"]
        jti = t["jti"]
        booking = await rv.load_booking(db, booking_id)
        user_id = (booking or {}).get("guest_id")
    else:
        if not viewer:
            raise HTTPException(status_code=401, detail="Sign in to write a review")
        booking_id, user_id = str(payload.get("booking_id") or ""), viewer["user_id"]
    check_rate(request, bucket="review-submit-user", limit=10, window_seconds=3600, key_extra=str(user_id), ip_agnostic=True)
    try:
        doc = await rv.create_native(db, booking_id=booking_id, user_id=user_id, rating=payload.get("rating"),
                                     text=payload.get("text"), sub_ratings=payload.get("sub_ratings"), token_jti=jti)
    except rv.ReviewError as e:
        _raise(e)
    return rv.public_review(doc)


@router.patch("/reviews/{review_id}")
async def edit_review(review_id: str, payload: dict = Body(...), user=Depends(verify_token)) -> dict:
    _need_native()
    try:
        doc = await rv.edit_native(db, review_id, user["user_id"], rating=payload.get("rating"),
                                   text=payload.get("text"), sub_ratings=payload.get("sub_ratings"))
    except rv.ReviewError as e:
        _raise(e)
    return rv.public_review(doc)


@router.post("/reviews/{review_id}/response")
async def respond_to_review(review_id: str, payload: dict = Body(...), user=Depends(verify_token)) -> dict:
    _need_native()
    try:
        doc = await rv.respond(db, review_id, user["user_id"], payload.get("text"))
    except rv.ReviewError as e:
        _raise(e)
    return rv.public_review(doc)


@router.post("/reviews/{review_id}/report")
async def report_review(review_id: str, request: Request, payload: dict = Body(...), user=Depends(verify_token)) -> dict:
    if not _sources():
        raise HTTPException(status_code=404, detail="Reviews are switched off")
    check_rate(request, bucket="review-report-ip", limit=50, window_seconds=86400)
    check_rate(request, bucket="review-report-user", limit=20, window_seconds=86400, key_extra=user["user_id"], ip_agnostic=True)
    try:
        return await rv.report(db, review_id, user["user_id"], payload.get("reason"), payload.get("note"))
    except rv.ReviewError as e:
        _raise(e)


# ---------------------------------------------------------------- reading

async def _page(match: dict, source: str | None, sort: str, page: int, viewer: dict | None) -> dict:
    sources = _sources()
    if not sources:
        return {"enabled": False}
    match = {**match, "source": {"$in": sources}}
    source = source if source in sources else None
    out = await rv.list_reviews(db, match, source=source, sort=sort, page=page)
    me = (viewer or {}).get("user_id")
    if me:
        rows = {r["_id"]: r async for r in db.reviews.find({"_id": {"$in": [x["id"] for x in out["reviews"]]}},
                                                           {"owner_user_ids": 1, "author_user_id": 1, "created_at": 1})}
        cutoff = (datetime.now(UTC) - timedelta(hours=rv.EDIT_HOURS)).isoformat()
        for x in out["reviews"]:
            r = rows.get(x["id"]) or {}
            x["can_respond"] = x["source"] == "native" and me in (r.get("owner_user_ids") or [])
            x["can_edit"] = r.get("author_user_id") == me and (r.get("created_at") or "") > cutoff
    return {"enabled": True, "sources": sources, "summary": await rv.summary(db, match), **out}


@router.get("/listings/{listing_id}/reviews")
async def listing_reviews(listing_id: str, source: str | None = None, sort: str = "newest",
                          page: int = Query(1, ge=1, le=500), viewer=Depends(optional_user)) -> dict:
    return await _page({"listing_id": listing_id}, source, sort, page, viewer)


@router.get("/businesses/{business_id}/reviews")
async def business_reviews(business_id: str, source: str | None = None, sort: str = "newest",
                           page: int = Query(1, ge=1, le=500), viewer=Depends(optional_user)) -> dict:
    return await _page({"business_id": business_id}, source, sort, page, viewer)


# ---------------------------------------------------------------- admin

@router.get("/admin/reviews/queue")
async def moderation_queue(user=Depends(verify_token)) -> dict:
    _need_admin(user)
    items = []
    async for r in db.reviews.find({"status": "under_review"}).sort("updated_at", 1).limit(200):
        reports = await db.review_reports.find({"review_id": r["_id"], "resolved": False},
                                               {"_id": 0, "reason": 1, "note": 1, "created_at": 1}).to_list(50)
        items.append({**rv.public_review(r), "listing_id": r.get("listing_id"), "listing_kind": r.get("listing_kind"),
                      "business_id": r.get("business_id"), "reports": reports})
    return {"items": items, "reasons": list(rv.ADMIN_REMOVAL_REASONS)}


@router.post("/admin/reviews/{review_id}/approve")
async def admin_approve(review_id: str, user=Depends(verify_token)) -> dict:
    _need_admin(user)
    try:
        return rv.public_review(await rv.approve_review(db, review_id, user["user_id"]))
    except rv.ReviewError as e:
        _raise(e)


@router.post("/admin/reviews/{review_id}/remove")
async def admin_remove(review_id: str, payload: dict = Body(...), user=Depends(verify_token)) -> dict:
    _need_admin(user)
    try:
        return rv.public_review(await rv.remove_review(db, review_id, user["user_id"], payload.get("reason")))
    except rv.ReviewError as e:
        _raise(e)


# ---------------------------------------------------------------- Google

async def _my_targets(user_id: str) -> list[dict]:
    """What an owner may map a Google location to: their own listings and
    businesses, nothing else."""
    out = [{"kind": "business", "id": b["_id"], "title": b.get("name") or ""}
           async for b in db.businesses.find({"owner_user_id": user_id}, {"name": 1})]
    out += [{"kind": "property", "id": p["id"], "title": p.get("title") or ""}
            async for p in db.properties.find({"owner_id": user_id}, {"_id": 0, "id": 1, "title": 1})]
    out += [{"kind": "gig", "id": x["_id"], "title": x.get("title") or "", "business_id": x.get("business_id")}
            async for x in db.marketplace_gigs.find({"provider_user_id": user_id}, {"title": 1, "business_id": 1})]
    return out


@router.get("/reviews/google/status")
async def google_status(user=Depends(verify_token)) -> dict:
    if not rv.google_enabled():
        return {"enabled": False}
    conn = await db.google_review_connections.find_one({"_id": user["user_id"]}, {"refresh_token_enc": 0})
    return {"enabled": True, "configured": g.configured(), "connected": bool(conn),
            "mappings": (conn or {}).get("mappings") or [], "last_synced_at": (conn or {}).get("last_synced_at"),
            "last_error": (conn or {}).get("last_error")}


@router.get("/reviews/google/connect")
async def google_connect(user=Depends(verify_token)) -> dict:
    _need_google()
    if not g.configured():
        raise HTTPException(status_code=503, detail="Google reviews are not set up on this server")
    state = jwt.encode({"kind": "google_reviews_state", "user_id": user["user_id"],
                        "exp": datetime.now(UTC) + timedelta(minutes=10)}, os.environ["JWT_SECRET"], algorithm="HS256")
    return {"url": g.auth_url(state)}


@router.get("/reviews/google/callback")
async def google_callback(code: str = "", state: str = "", error: str = "") -> RedirectResponse:
    back = f"{FRONTEND_URL}/dashboard?tab=business"
    if not rv.google_enabled() or error or not code:
        return RedirectResponse(f"{back}&google_reviews=cancelled")
    try:
        claims = jwt.decode(state, os.environ["JWT_SECRET"], algorithms=["HS256"])
        if claims.get("kind") != "google_reviews_state":
            raise jwt.InvalidTokenError()
    except jwt.InvalidTokenError:
        return RedirectResponse(f"{back}&google_reviews=failed")
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            tokens = await g.exchange_code(http, code)
    except (g.GoogleError, httpx.HTTPError) as e:
        logger.warning(f"google reviews: code exchange failed: {type(e).__name__}")
        return RedirectResponse(f"{back}&google_reviews=failed")
    if not tokens.get("refresh_token"):
        return RedirectResponse(f"{back}&google_reviews=failed")
    uid = claims["user_id"]
    await db.google_review_connections.update_one(
        {"_id": uid},
        {"$set": {"user_id": uid, "refresh_token_enc": g.encrypt(tokens["refresh_token"]), "connected_at": rv.now_iso(), "last_error": None},
         "$setOnInsert": {"mappings": []}},
        upsert=True)
    await g.set_connected(db, uid, True, uid)
    return RedirectResponse(f"{back}&google_reviews=connected")


async def _connection(user_id: str) -> dict:
    conn = await db.google_review_connections.find_one({"_id": user_id})
    if not conn:
        raise HTTPException(status_code=404, detail="Google is not connected")
    return conn


@router.get("/reviews/google/locations")
async def google_locations(user=Depends(verify_token)) -> dict:
    _need_google()
    conn = await _connection(user["user_id"])
    try:
        async with httpx.AsyncClient(timeout=20.0) as http:
            token = await g.access_token(http, g.decrypt(conn["refresh_token_enc"]))
            locations = await g.list_locations(http, token)
    except (g.GoogleError, httpx.HTTPError) as e:
        raise HTTPException(status_code=502, detail=f"Google did not answer: {e}")
    return {"locations": locations, "targets": await _my_targets(user["user_id"]), "mappings": conn.get("mappings") or []}


@router.put("/reviews/google/mappings")
async def google_mappings(payload: dict = Body(...), user=Depends(verify_token)) -> dict:
    """Each Google location to one of the owner's listings or businesses.
    All of a mapped location's reviews come in; there is no picking."""
    _need_google()
    conn = await _connection(user["user_id"])
    targets = {(t["kind"], t["id"]): t for t in await _my_targets(user["user_id"])}
    mappings, seen = [], set()
    for m in payload.get("mappings") or []:
        loc, kind, tid = str(m.get("location") or ""), m.get("target_kind"), m.get("target_id")
        if not loc.startswith("accounts/") or "/locations/" not in loc or loc in seen:
            raise HTTPException(status_code=422, detail="Bad location")
        t = targets.get((kind, tid))
        if not t:
            raise HTTPException(status_code=403, detail="You can only map to your own listings")
        seen.add(loc)
        business_id = t.get("business_id")
        if kind == "property":
            b = await db.businesses.find_one({"owner_user_id": user["user_id"]}, {"_id": 1})
            business_id = (b or {}).get("_id")
        mappings.append({"location": loc, "title": str(m.get("title") or "")[:200],
                         "maps_uri": m.get("maps_uri") if str(m.get("maps_uri") or "").startswith("https://") else None,
                         **g.listing_target(kind, tid, business_id)})
    await db.google_review_connections.update_one({"_id": conn["_id"]}, {"$set": {"mappings": mappings}})
    asyncio.create_task(_sync_one({**conn, "mappings": mappings}))
    return {"mappings": mappings}


@router.delete("/reviews/google/connection")
async def google_disconnect(user=Depends(verify_token)) -> dict:
    """Stops syncing, revokes our access at Google, and takes every
    imported review off the page together (Tzvi, 23 Sep 2026)."""
    conn = await db.google_review_connections.find_one({"_id": user["user_id"]})
    if conn:
        try:
            async with httpx.AsyncClient(timeout=10.0) as http:
                await g.revoke(http, g.decrypt(conn["refresh_token_enc"]))
        except g.GoogleError:
            pass
        await db.google_review_connections.delete_one({"_id": conn["_id"]})
    hidden = await g.set_connected(db, user["user_id"], False, user["user_id"])
    return {"connected": False, "hidden": hidden}


async def _sync_one(conn: dict) -> None:
    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            res = await g.sync_connection(db, http, conn)
        logger.info(f"google reviews: synced {conn['_id']}: {res}")
    except Exception as e:  # noqa: BLE001 - one owner's failure must not stop the others
        logger.warning(f"google reviews: sync failed for {conn['_id']}: {type(e).__name__}")
        await db.google_review_connections.update_one({"_id": conn["_id"]}, {"$set": {"last_error": type(e).__name__}})


async def _sleep_until(hour_utc: int) -> None:
    now = datetime.now(UTC)
    nxt = now.replace(hour=hour_utc, minute=0, second=0, microsecond=0)
    if nxt <= now:
        nxt += timedelta(days=1)
    await asyncio.sleep((nxt - now).total_seconds())


async def google_reviews_daily_loop() -> None:
    """New, edited and deleted Google reviews, once a day at 02:00 UTC."""
    while True:
        await _sleep_until(2)
        if not rv.google_enabled() or not g.configured():
            continue
        async for conn in db.google_review_connections.find({}):
            await _sync_one(conn)


# ---------------------------------------------------------------- request emails

async def send_review_requests(today=None) -> dict:
    """The day after checkout (or completion), one email; one reminder a
    week later if there is still no review. Never more than two. Looks
    back over the whole review window, so a day the server was down only
    delays an email."""
    from utils.email import send_review_request_email

    today = today or rv.today_il()
    since = today - timedelta(days=rv.window_days() + 2)
    candidates = [b["id"] async for b in db.bookings.find(
        {"status": "confirmed", "end_date": {"$gte": since.isoformat(), "$lt": today.isoformat()}}, {"id": 1})]
    candidates += [b["_id"] async for b in db.marketplace_bookings.find(
        {"status": "completed", "client_user_id": {"$ne": None},
         "$or": [{"completed_at": {"$gte": since.isoformat()}}, {"completed_at": None, "updated_at": {"$gte": since.isoformat()}}]},
        {"_id": 1})]
    sent = 0
    for booking_id in candidates:
        booking = await rv.load_booking(db, booking_id)
        if not booking or not (await rv.check_eligibility(db, booking, booking["guest_id"], today=today))["eligible"]:
            continue
        row = await db.review_requests.find_one({"_id": booking_id}) or {"emails_sent": 0}
        n = row.get("emails_sent", 0)
        if n >= 2:
            continue
        if n == 1:
            last = rv._day(row.get("last_sent_on"))
            if (today - booking["done_on"]).days < 7 or not last or (today - last).days < 6:
                continue
        # Claim before sending, so two runs can't both send.
        try:
            claimed = await db.review_requests.find_one_and_update(
                {"_id": booking_id, "emails_sent": n} if n else {"_id": booking_id, "emails_sent": {"$in": [None, 0]}},
                {"$set": {"emails_sent": n + 1, "last_sent_at": rv.now_iso(), "last_sent_on": today.isoformat(),
                          "booking_kind": booking["kind"]}},
                upsert=not n)
        except Exception:  # noqa: BLE001 - duplicate key: another run claimed it first
            continue
        if claimed is None and n:
            continue
        guest = await db.users.find_one({"id": booking["guest_id"]}, {"email": 1, "name": 1}) or {}
        if not guest.get("email"):
            continue
        token = await rv.mint_request_token(db, booking_id)
        await send_review_request_email(guest["email"], (guest.get("name") or "").split(" ")[0], booking["listing_title"],
                                        f"{FRONTEND_URL}/review/{token}", kind=booking["kind"], reminder=bool(n))
        sent += 1
    return {"candidates": len(candidates), "sent": sent}


async def review_requests_daily_loop() -> None:
    while True:
        await _sleep_until(7)  # 09:00 or 10:00 in Israel
        if not rv.native_enabled():
            continue
        try:
            res = await send_review_requests()
            logger.info(f"review requests: {res}")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"review requests loop crashed: {e}")


"""Availability-expiry reminders for fixed-window listings.

Hosts who set ``available_to`` on a property (e.g. "only renting July 1-8
while I'm in London") get a friendly nudge 5 days before that cap rolls
past, with two one-tap actions in the email:

  1. **Extend by +1 month** — token-signed URL, hits ``/availability/extend``
     and bumps the cap forward. No login required because the JWT we mint
     is property+action-scoped and single-use-ish (deduped via
     ``last_extended_at``).

  2. **Open dashboard** — deep link into the property's edit modal so the
     host can do anything else (set a new explicit window, clear the cap,
     pause the listing, etc.).

The cron runs once a day at 06:00 UTC (≈ 09:00 Israel). It dedupes via
``availability_expiry_alerted_at`` on the property doc — we don't email
the same host twice in any 14-day window even if they ignore the first
ping. The window is 4-6 days out (3-day slack) so a transient backend
outage doesn't make us miss a property entirely.

Token spec
----------
JWT signed with the platform's ``JWT_SECRET``, claims::

    {
        "kind": "avail_extend",
        "property_id": "<uuid>",
        "owner_id": "<uuid>",
        "exp": <unix>,        # 30 days
    }

That's intentional — the link stays valid for a month so the host can
click it at their leisure. The endpoint additionally checks that the
property still belongs to the claimed owner, so a leaked token can't
target someone else's listing.
"""
from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from routes.deps import db, logger

router = APIRouter()
api_router = router

_JWT_SECRET = os.environ["JWT_SECRET"]
_FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://myisraelrental.com")


# ---------------------------------------------------------------------------
# Token signing / verification
# ---------------------------------------------------------------------------

def mint_extend_token(property_id: str, owner_id: str, ttl_days: int = 30) -> str:
    """One-tap extension token. 30-day TTL so a host who reads the email
    on day 10 still has 20 days to click. Single-use enforcement is done
    by ``last_extended_at`` (a same-day re-click is a no-op, not an error).
    """
    payload = {
        "kind": "avail_extend",
        "property_id": property_id,
        "owner_id": owner_id,
        "exp": datetime.now(UTC) + timedelta(days=ttl_days),
    }
    return jwt.encode(payload, _JWT_SECRET, algorithm="HS256")


def _decode_token(token: str, expected_kind: str) -> dict[str, Any]:
    try:
        claims = jwt.decode(token, _JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=400, detail="This link has expired. Please update the window from your dashboard.") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=400, detail="Invalid link.") from exc
    if claims.get("kind") != expected_kind:
        raise HTTPException(status_code=400, detail="Invalid link.")
    return claims


# ---------------------------------------------------------------------------
# One-tap "extend by N days" endpoint
# ---------------------------------------------------------------------------

@api_router.get("/properties/availability/extend")
async def extend_availability(
    token: str = Query(...),
    days: int = Query(30, ge=1, le=365),
):
    """Hit from the email's "Extend by 1 month" button. Verifies the token,
    bumps ``available_to`` by ``days`` from its current value (NOT from
    today — so a host renting July 1-8 who extends gets July 1 → Aug 7,
    not July 1 → today+30), then redirects to a small confirmation page
    on the frontend.

    Implemented as GET (not POST) because email clients can only follow
    GET on a click without prompting; CSRF risk is bounded by the JWT
    scoping.
    """
    claims = _decode_token(token, "avail_extend")
    pid = claims["property_id"]
    owner_id = claims["owner_id"]

    prop = await db.properties.find_one(
        {"id": pid, "owner_id": owner_id},
        {"_id": 0, "available_to": 1, "title": 1, "last_extended_at": 1},
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found or no longer yours.")

    # Idempotency — if the host already clicked within the last 60 seconds,
    # treat this as a noop. Stops accidental double-clicks from compounding
    # extensions on flaky inbox connections.
    last = prop.get("last_extended_at")
    if last:
        try:
            last_dt = datetime.fromisoformat(last)
            if datetime.now(UTC) - last_dt < timedelta(seconds=60):
                return RedirectResponse(
                    url=f"{_FRONTEND_URL}/availability-extended?id={pid}&already=1",
                    status_code=302,
                )
        except Exception:  # noqa: BLE001
            pass

    current = prop.get("available_to")
    if not current:
        # The host already cleared the cap → nothing to extend, just
        # confirm. Don't 400 because the email may be stale.
        return RedirectResponse(
            url=f"{_FRONTEND_URL}/availability-extended?id={pid}&already=1",
            status_code=302,
        )

    try:
        # Anchor extension on whichever is later: the current cap OR today.
        # If the cap already passed, we extend from today so the host gets
        # a forward-looking window.
        current_date = datetime.fromisoformat(current).date()
        today = datetime.now(UTC).date()
        anchor = max(current_date, today)
        new_to = anchor + timedelta(days=days)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Property has an invalid availability date.") from exc

    await db.properties.update_one(
        {"id": pid},
        {"$set": {
            "available_to": new_to.isoformat(),
            "last_extended_at": datetime.now(UTC).isoformat(),
        }},
    )
    return RedirectResponse(
        url=f"{_FRONTEND_URL}/availability-extended?id={pid}&new_to={new_to.isoformat()}",
        status_code=302,
    )


# ---------------------------------------------------------------------------
# Daily cron — scans for expiring windows and sends the nudge
# ---------------------------------------------------------------------------

EXPIRY_LOOKAHEAD_DAYS_MIN = 4  # email when expiry is between
EXPIRY_LOOKAHEAD_DAYS_MAX = 6  # 4 and 6 days out
RE_ALERT_COOLDOWN_DAYS = 14  # don't nudge the same listing more than once a fortnight


async def _scan_and_send() -> int:
    """One pass over all properties with an upcoming expiry window. Returns
    the number of emails actually sent (after dedup + opt-out)."""
    today = datetime.now(UTC).date()
    window_start = (today + timedelta(days=EXPIRY_LOOKAHEAD_DAYS_MIN)).isoformat()
    window_end = (today + timedelta(days=EXPIRY_LOOKAHEAD_DAYS_MAX)).isoformat()
    cooldown_cutoff = (datetime.now(UTC) - timedelta(days=RE_ALERT_COOLDOWN_DAYS)).isoformat()

    cursor = db.properties.find(
        {
            "rental_type": {"$in": ["vacation", "short-term"]},
            "available_to": {"$gte": window_start, "$lte": window_end},
            # Dedup: skip properties we alerted within the cooldown
            "$or": [
                {"availability_expiry_alerted_at": {"$exists": False}},
                {"availability_expiry_alerted_at": {"$lt": cooldown_cutoff}},
            ],
        },
        {"_id": 0, "id": 1, "title": 1, "owner_id": 1, "available_to": 1, "currency": 1},
    )
    sent = 0
    async for prop in cursor:
        try:
            ok = await _send_expiry_nudge(prop)
            if ok:
                sent += 1
        except Exception as e:  # noqa: BLE001
            logger.warning(f"availability_reminder send failed for {prop.get('id')}: {e}")
    if sent:
        logger.info(f"availability reminders: {sent} sent")
    return sent


async def _send_expiry_nudge(prop: dict[str, Any]) -> bool:
    """Send the email for one property and mark it as alerted on success."""
    owner = await db.users.find_one(
        {"id": prop["owner_id"]},
        {"_id": 0, "id": 1, "email": 1, "name": 1, "availability_reminders_optout": 1, "email_suppressed": 1},
    )
    if not owner or not owner.get("email"):
        return False
    if owner.get("availability_reminders_optout") or owner.get("email_suppressed"):
        return False

    extend_token = mint_extend_token(prop["id"], owner["id"])
    # API URL → we redirect after applying. Email client follows the GET.
    # The router prefix is /api (see server.py include_router(prefix='/api')).
    extend_url = (
        f"{os.environ.get('PUBLIC_API_URL', _FRONTEND_URL)}"
        f"/api/properties/availability/extend?token={extend_token}&days=30"
    )
    dashboard_url = f"{_FRONTEND_URL}/dashboard?edit={prop['id']}"

    from utils.email import send_availability_expiring_email
    ok = await send_availability_expiring_email(
        to_email=owner["email"],
        owner_name=owner.get("name", ""),
        property_title=prop.get("title", "your listing"),
        available_to=prop["available_to"],
        extend_url=extend_url,
        dashboard_url=dashboard_url,
    )
    if ok:
        await db.properties.update_one(
            {"id": prop["id"]},
            {"$set": {"availability_expiry_alerted_at": datetime.now(UTC).isoformat()}},
        )
    return ok


async def availability_reminders_daily_loop() -> None:
    """Every 24h at 06:00 UTC. Self-correcting wakeup pegged to wall-clock
    so a restart doesn't shift the schedule. No-op when nothing is expiring."""
    while True:
        now = datetime.now(UTC)
        next_run = now.replace(hour=6, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        await asyncio.sleep((next_run - now).total_seconds())
        try:
            await _scan_and_send()
        except Exception as e:  # noqa: BLE001
            logger.warning(f"availability_reminders loop crashed: {e}")

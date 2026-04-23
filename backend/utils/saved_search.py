"""Saved-search alert matching.

A user can save their search criteria; we notify them (bell + email) whenever
a new or refreshed property matches.

Triggered from:
  * property create                   (server.py create_property)
  * property update (status/price)    (server.py update_property)
  * booking cancelled / rejected      (server.py cancel/reject handlers)

Keep this module free of HTTP imports so it's easy to call from anywhere.
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)


# ----------------------------- matching ------------------------------------
def _date_from_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        # accept 'YYYY-MM-DD' or ISO timestamps
        return datetime.fromisoformat(str(s).replace("Z", "").split("T")[0])
    except Exception:
        return None


def _property_available_for(
    prop: dict,
    start: datetime,
    end: datetime,
    bookings: list[dict],
    fuzziness_days: int,
) -> bool:
    """Return True if the property has NO confirmed booking overlapping the
    user's [start-fuzz, end+fuzz] window."""
    if not start or not end:
        return True  # no date filter — automatic pass

    fuzz = timedelta(days=fuzziness_days)
    user_start = start - fuzz
    user_end = end + fuzz

    for b in bookings:
        if b.get("status") not in ("confirmed", "pending"):
            continue
        if b.get("property_id") != prop["id"]:
            continue
        bs = _date_from_iso(b.get("start_date"))
        be = _date_from_iso(b.get("end_date"))
        if not bs or not be:
            continue
        # Overlap check
        if bs <= user_end and be >= user_start:
            return False
    return True


def _price_matches(prop: dict, search: dict) -> bool:
    max_price = search.get("max_price")
    if max_price is None:
        return True
    # Prefer nightly for vacation / short-term, monthly otherwise
    rt = prop.get("rental_type")
    if rt == "vacation":
        candidate = prop.get("nightly_price")
    else:
        candidate = prop.get("monthly_price")
    if candidate is None:
        return True  # no price listed — don't block
    try:
        return float(candidate) <= float(max_price)
    except (TypeError, ValueError):
        return True


def _text_matches(prop_val: str | None, search_val: str | None) -> bool:
    if not search_val:
        return True
    return (prop_val or "").lower().find(str(search_val).lower()) != -1


def property_matches_search(prop: dict, search: dict, bookings: list[dict]) -> bool:
    """Pure predicate — no I/O. Used by match_property_against_searches."""
    if prop.get("status") and prop["status"] not in ("active", "available"):
        return False

    filters = search.get("filters", {})

    # Rental type
    if filters.get("rental_type") and prop.get("rental_type") != filters["rental_type"]:
        return False

    # Area (substring, case-insensitive)
    if not _text_matches(prop.get("area") or prop.get("location"), filters.get("area")):
        return False

    # Min bedrooms
    min_beds = filters.get("bedrooms_min")
    if min_beds is not None:
        try:
            if int(prop.get("bedrooms") or 0) < int(min_beds):
                return False
        except (TypeError, ValueError):
            pass

    # Max price
    if not _price_matches(prop, filters):
        return False

    # Date availability
    start = _date_from_iso(filters.get("start_date"))
    end = _date_from_iso(filters.get("end_date"))
    fuzz = int(search.get("date_fuzziness_days") or 30)
    if start and end and not _property_available_for(prop, start, end, bookings, fuzz):
        return False

    return True


# --------------------------- persistence + dispatch -----------------------
async def match_property_against_searches(
    db: Any,
    property_id: str,
    *,
    reason: str = "new_listing",
    send_email_fn: Any = None,
) -> int:
    """Check a property against every active saved search and fire alerts
    for each match. Returns the number of alerts sent."""
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        return 0

    now = datetime.now(timezone.utc)
    searches = await db.saved_searches.find(
        {"active": True, "expires_at": {"$gt": now.isoformat()}},
        {"_id": 0},
    ).to_list(1000)
    if not searches:
        return 0

    # Fetch all relevant bookings once
    bookings = await db.bookings.find(
        {"property_id": property_id, "status": {"$in": ["confirmed", "pending"]}},
        {"_id": 0},
    ).to_list(500)

    fired = 0
    for s in searches:
        # Throttle: don't re-alert the same (search × property) combo within 7 days
        if s["user_id"] == prop.get("owner_id"):
            continue  # don't notify owner about their own listing
        already = await db.saved_search_alerts.find_one({
            "search_id": s["id"],
            "property_id": property_id,
            "sent_at": {"$gt": (now - timedelta(days=7)).isoformat()},
        })
        if already:
            continue

        if not property_matches_search(prop, s, bookings):
            continue

        # Record alert
        await db.saved_search_alerts.insert_one({
            "id": str(uuid.uuid4()),
            "search_id": s["id"],
            "user_id": s["user_id"],
            "property_id": property_id,
            "reason": reason,
            "sent_at": now.isoformat(),
        })

        # In-app notification
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": s["user_id"],
            "type": "saved_search_match",
            "property_id": property_id,
            "message": f"A property matching your saved search \"{s.get('name', 'alert')}\" is now available: {prop.get('title', '')}",
            "read": False,
            "created_at": now.isoformat(),
        })

        # Email via Postmark (injected to avoid circular imports)
        if send_email_fn and s.get("email"):
            frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
            link = f"{frontend}/property/{property_id}" if frontend else f"/property/{property_id}"
            reason_label = {
                "new_listing": "just listed",
                "reactivated": "became available again",
                "price_drop": "dropped its price",
                "booking_freed": "freed up the dates you wanted",
            }.get(reason, "matches your saved search")
            html = f"""
            <p>Hi {s.get('user_name') or 'there'},</p>
            <p>A property {reason_label}:</p>
            <div style="background:#f7f7f4;border-left:4px solid #1E6A6A;padding:14px 18px;margin:14px 0;border-radius:6px;">
              <div style="font-weight:700;color:#1E6A6A;font-size:16px;">{prop.get('title', '')}</div>
              <div style="color:#777;font-size:13px;margin-top:4px;">{prop.get('area') or prop.get('location') or ''}</div>
            </div>
            <p><a href="{link}" style="background:#1E6A6A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">View the listing</a></p>
            <p style="color:#888;font-size:12px;">You saved this alert "{s.get('name', 'search')}". It expires on {s.get('expires_at', '')[:10]}. You can manage your alerts from your dashboard.</p>
            """
            try:
                asyncio.create_task(send_email_fn(
                    s["email"],
                    f"Match found — {prop.get('title', 'New property')} · MyIsraelRental",
                    html,
                    tag="saved-search-match",
                ))
            except Exception as e:
                logger.warning(f"saved-search email dispatch failed: {e}")

        fired += 1

    if fired:
        logger.info(f"saved-search: fired {fired} alert(s) for property {property_id} reason={reason}")
    return fired

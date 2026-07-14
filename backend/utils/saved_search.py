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
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from utils.area_filter import area_matches
from utils.fx import convert_amount

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


async def _price_matches(prop: dict, search: dict) -> bool:
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
        candidate_amount = float(candidate)
    except (TypeError, ValueError):
        return True

    target_currency = (search.get("max_price_currency") or "").upper() or None
    prop_currency = (prop.get("currency") or "ILS").upper()

    # If the renter pinned a target currency and the property is priced in a
    # different one, convert the property's price into the renter's currency
    # using the live USD↔ILS rate. This way "≤ $4,000" correctly catches a
    # ₪10,500 listing (≈ $2,800 at 3.75 ILS/USD).
    if target_currency and target_currency != prop_currency:
        candidate_amount = await convert_amount(candidate_amount, prop_currency, target_currency)

    return candidate_amount <= float(max_price)


def _text_matches(prop_val: str | None, search_val: str | None) -> bool:
    if not search_val:
        return True
    return (prop_val or "").lower().find(str(search_val).lower()) != -1


async def property_matches_search(prop: dict, search: dict, bookings: list[dict]) -> bool:
    """Async predicate — small FX I/O when comparing across currencies."""
    if prop.get("status") and prop["status"] not in ("active", "available"):
        return False

    filters = search.get("filters", {})

    # Rental type
    if filters.get("rental_type") and prop.get("rental_type") != filters["rental_type"]:
        return False

    # Area — city-scoped, prefix-anchored match (see utils/area_filter.py)
    if not area_matches(prop.get("area") or prop.get("location"), filters.get("area")):
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
    if not await _price_matches(prop, filters):
        return False

    # Date availability
    start = _date_from_iso(filters.get("start_date"))
    end = _date_from_iso(filters.get("end_date"))
    fuzz_raw = search.get("date_fuzziness_days")
    # Use 30 as default only when the value is missing/None — *not* when 0
    # (renter explicitly opted out of fuzzy matching for short-term/vacation).
    fuzz = int(fuzz_raw) if fuzz_raw is not None else 30
    if start and end and not _property_available_for(prop, start, end, bookings, fuzz):
        return False

    # When the renter only specified a move-in date (no end_date), match
    # against the property's own ``available_from`` within the fuzziness
    # window. e.g. for a long-term alert (30-day fuzz) starting Sep 1, a
    # property available from Aug 5 or Oct 15 still qualifies.
    # Properties with no ``available_from`` set are assumed flexible and
    # always pass.
    if start and not end:
        prop_available = _date_from_iso(
            prop.get("available_from") or prop.get("starting_date")
        )
        if prop_available is not None:
            fuzz_td = timedelta(days=fuzz)
            if not (start - fuzz_td <= prop_available <= start + fuzz_td):
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

    now = datetime.now(UTC)
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

        if not await property_matches_search(prop, s, bookings):
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
            # Reuse the canonical FRONTEND_URL from email.py — that module
            # already defaults to https://myisraelrental.com when the env
            # var is missing. Importing locally to avoid a circular import
            # at module load.
            from utils.email import FRONTEND_URL as _FE
            frontend = (_FE or "https://myisraelrental.com").rstrip("/")
            link = f"{frontend}/property/{property_id}"
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

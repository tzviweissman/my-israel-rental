"""Booking shared helpers — loaders, availability checks, notifications,
and the pricing engine (``_compute_booking_total``).

Extracted from ``bookings.py`` in the 2026-07 refactor. These are the
functions that multiple endpoints reach for; keeping them together
avoids circular imports between the CRUD, lifecycle, and contract
sub-modules.
"""
import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException

from models import BookingCreate
from routes.deps import db, logger
from utils.email import (
    send_booking_confirmation_email,
    send_booking_notification_email,
)
from utils.saved_search import match_property_against_searches


async def _load_property_and_sublease(
    booking_data: BookingCreate,
) -> tuple[dict, dict | None]:
    """Look up the target property and (if applicable) the sublease.
    For sublease bookings the property still loads, but downstream pricing
    + routing prefers the sublease's data over the property's."""
    property_data = await db.properties.find_one(
        {"id": booking_data.property_id}, {"_id": 0},
    )
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    sublease_data: dict | None = None
    if booking_data.sublease_id:
        sublease_data = await db.subleases.find_one(
            {"id": booking_data.sublease_id}, {"_id": 0},
        )
        if not sublease_data:
            raise HTTPException(status_code=404, detail="Sublease not found")
        if not sublease_data.get("active", True):
            raise HTTPException(
                status_code=400, detail="This sublease is no longer active",
            )
    return property_data, sublease_data


def _assert_within_availability_window(
    booking_data: BookingCreate,
    property_data: dict,
    sublease_data: dict | None,
) -> None:
    """Reject bookings that fall outside the lister's availability window.

    Two windows can apply:
      • ``property.available_from`` / ``property.available_to`` — the owner
        explicitly capped their listing's availability (e.g. "I'm only
        renting for one week while I travel"). Both ends inclusive.
      • ``sublease.available_from`` / ``sublease.available_to`` — the
        sublessor's stricter window for that specific sublease. Sublease
        bounds override the property's own window because the sublessor
        is the de-facto owner during that period.

    Past dates are NOT validated here — the calendar UI hides them and the
    overlap check would reject any meaningfully-conflicting historical
    booking anyway.
    """
    # Sublease window wins when the booking is sublease-scoped.
    if sublease_data:
        sub_from = sublease_data.get("available_from")
        sub_to = sublease_data.get("available_to")
        if sub_from and booking_data.start_date < sub_from:
            raise HTTPException(
                status_code=400,
                detail=f"This sublease is only available from {sub_from} onwards.",
            )
        if sub_to and booking_data.end_date > sub_to:
            raise HTTPException(
                status_code=400,
                detail=f"This sublease is only available until {sub_to}.",
            )
        return  # sublease window fully governs sublease bookings

    avail_from = property_data.get("available_from")
    avail_to = property_data.get("available_to")
    if avail_from and booking_data.start_date < avail_from:
        raise HTTPException(
            status_code=400,
            detail=f"This property is only available from {avail_from} onwards.",
        )
    if avail_to and booking_data.end_date > avail_to:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This property is only available until {avail_to}. "
                "Please pick checkout dates within the window."
            ),
        )

def _assert_not_in_holiday_window(
    booking_data: BookingCreate,
    property_data: dict,
    sublease_data: dict | None,
) -> None:
    """Owners can reserve a specific date window (typically Sukkot / Pesach)
    for their holiday lump-sum price. Bookings hitting that window under
    the primary monthly/nightly rate are rejected with an explicit steer
    to the holiday flow. Sublease bookings are exempt — the sublease
    already carries its own price + window."""
    if sublease_data:
        return
    hs = (property_data.get("holiday_start_date") or "").strip()
    he = (property_data.get("holiday_end_date") or "").strip()
    if not hs or not he:
        return
    # Booking end_date is checkout (exclusive); overlap iff
    # booking.start_date <= he AND booking.end_date > hs.
    if booking_data.start_date <= he and booking_data.end_date > hs:
        tags = property_data.get("holiday_tags") or []
        holiday_label = (
            " / ".join(t.capitalize() for t in tags) if tags else "the holiday period"
        )
        raise HTTPException(
            status_code=400,
            detail=(
                f"These dates fall inside the owner's {holiday_label} window "
                f"({hs} → {he}). Please book the holiday rate instead — "
                "see the holiday price card on the listing."
            ),
        )




async def _assert_no_booking_overlap(booking_data: BookingCreate) -> None:
    """Reject overlapping bookings up front so we never end up with two
    confirmed/pending bookings on the same property for the same dates.
    Same overlap rule used by /properties search: start < new_end AND end > new_start.
    For SUBLEASE bookings, we deliberately scope the overlap check to OTHER
    bookings on the SAME sublease — the sublessor's own underlying long-term
    booking covers the entire sublease window, so a global property-level
    check would always reject (defeating the whole sublease feature)."""
    if booking_data.sublease_id:
        overlap_filter: dict = {
            "sublease_id": booking_data.sublease_id,
            "status": {"$in": ["pending", "confirmed", "cancellation_requested"]},
            "start_date": {"$lt": booking_data.end_date},
            "end_date": {"$gt": booking_data.start_date},
        }
    else:
        overlap_filter = {
            "property_id": booking_data.property_id,
            # Ignore sublease-scoped bookings here — they live in a separate
            # logical calendar (the sublease window).
            "sublease_id": None,
            "status": {"$in": ["pending", "confirmed", "cancellation_requested"]},
            "start_date": {"$lt": booking_data.end_date},
            "end_date": {"$gt": booking_data.start_date},
        }
    overlap = await db.bookings.find_one(
        overlap_filter,
        {"_id": 0, "id": 1, "start_date": 1, "end_date": 1},
    )
    if overlap:
        raise HTTPException(
            status_code=409,
            detail=(
                "These dates overlap an existing booking "
                f"({overlap['start_date']} → {overlap['end_date']}). "
                "Please pick dates outside that window."
            ),
        )


def _build_booking_doc(
    *,
    booking_data: BookingCreate,
    property_data: dict,
    sublease_data: dict | None,
    renter_id: str,
) -> dict:
    """Assemble the booking document with id, owner routing, and the
    auto-confirm/pending status decision baked in.
    Auto-confirm only for vacation rentals (and never for sublease bookings,
    which always require sublessor accept/deny)."""
    is_instant_confirm = (
        property_data.get('rental_type') == 'vacation' and sublease_data is None
    )
    booking_doc = booking_data.model_dump()
    booking_doc.update({
        'id': str(uuid.uuid4()),
        'renter_id': renter_id,
        # Route owner_id: sublessor for sublease bookings, property owner otherwise
        'owner_id': (
            sublease_data['subleasor_id'] if sublease_data
            else property_data['owner_id']
        ),
        'status': 'confirmed' if is_instant_confirm else 'pending',
        'created_at': datetime.now(UTC).isoformat(),
    })
    return booking_doc


async def _send_booking_notifications(
    *,
    booking_doc: dict,
    booking_data: BookingCreate,
    property_data: dict,
    sublease_data: dict | None,
) -> None:
    """In-app notifications: confirmation to renter for instant-confirm
    bookings, plus a notification to the sublessor/owner in every case."""
    listing_title = (
        sublease_data.get('title') if sublease_data else property_data['title']
    )
    is_confirmed = booking_doc['status'] == 'confirmed'

    if is_confirmed:
        # Notify renter of the auto-confirmed booking
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": booking_doc['renter_id'],
            "type": "booking_confirmed",
            "property_id": booking_data.property_id,
            "booking_id": booking_doc['id'],
            "message": f"Your booking for {listing_title} is confirmed!",
            "read": False,
            "created_at": datetime.now(UTC).isoformat(),
        })

    # Always notify the sublessor (sublease) or property owner (regular)
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": booking_doc['owner_id'],
        "type": "booking_confirmed" if is_confirmed else "booking_request",
        "property_id": booking_data.property_id,
        "booking_id": booking_doc['id'],
        "message": (
            f"New booking for {listing_title}" if is_confirmed
            else f"New booking request for {listing_title}"
        ),
        "read": False,
        "created_at": datetime.now(UTC).isoformat(),
    })


async def _compute_booking_total(
    booking_data: BookingCreate,
    property_data: dict,
    sublease_data: dict | None,
) -> float | None:
    """Best-effort total for the confirmation email. Sublease pricing wins
    when set; otherwise vacation rentals get nightly × N — with per-date
    Smart Pricing overrides applied when present (the host can dynamically
    price specific nights via the Smart Pricing engine; each applied
    override REPLACES the base nightly rate for that night). Long-term/
    short-term rentals don't expose a single total, so we leave it as
    None."""
    try:
        start = datetime.fromisoformat(booking_data.start_date.replace('Z', ''))
        end = datetime.fromisoformat(booking_data.end_date.replace('Z', ''))
        nights = max(1, (end - start).days)
    except Exception:
        nights = 1
        start = None
        end = None
    if sublease_data:
        price = float(sublease_data.get('price', 0))
        return price * nights if sublease_data.get('price_type') == 'per_night' else price
    if property_data.get('rental_type') == 'vacation' and property_data.get('nightly_price'):
        base = float(property_data['nightly_price'])
        # Layer in any applied Smart-Pricing overrides for the night window.
        if start is not None and end is not None:
            try:
                overrides = await db.nightly_price_overrides.find(
                    {
                        "property_id": property_data.get('id'),
                        "applied": True,
                        "date": {
                            "$gte": start.date().isoformat(),
                            "$lt": end.date().isoformat(),
                        },
                    },
                    {"_id": 0, "date": 1, "price": 1},
                ).to_list(length=400)
            except Exception:  # noqa: BLE001
                overrides = []
            override_map = {o["date"]: float(o.get("price") or base) for o in overrides}
            total = 0.0
            d = start.date()
            for _ in range(nights):
                total += override_map.get(d.isoformat(), base)
                d += timedelta(days=1)
            return total
        return base * nights
    return None


def _queue_booking_emails(
    *,
    booking_doc: dict,
    booking_data: BookingCreate,
    property_data: dict,
    sublease_data: dict | None,
) -> None:
    """Fire-and-forget Postmark dispatch. Wrapped in try/except so an email
    outage never 500s a successful booking."""
    try:
        async def _send() -> None:
            renter = await db.users.find_one(
                {"id": booking_doc['renter_id']}, {"_id": 0, "email": 1, "name": 1},
            )
            owner = await db.users.find_one(
                {"id": booking_doc['owner_id']}, {"_id": 0, "email": 1, "name": 1},
            )
            currency = (
                sublease_data.get('currency', 'ILS') if sublease_data
                else property_data.get('currency', 'ILS')
            )
            listing_title = (
                sublease_data.get('title') if sublease_data else property_data['title']
            )
            listing_location = (
                sublease_data.get('area', '') if sublease_data
                else property_data.get('location', property_data.get('area', ''))
            )
            total_price = await _compute_booking_total(booking_data, property_data, sublease_data)

            if renter and renter.get('email'):
                await send_booking_confirmation_email(
                    to_email=renter['email'],
                    guest_name=renter.get('name', ''),
                    property_title=listing_title,
                    property_location=listing_location,
                    check_in=booking_data.start_date,
                    check_out=booking_data.end_date,
                    total_price=total_price,
                    currency=currency,
                    booking_id=booking_doc['id'],
                    status=booking_doc['status'],
                )
            if owner and owner.get('email'):
                await send_booking_notification_email(
                    to_email=owner['email'],
                    owner_name=owner.get('name', ''),
                    guest_name=(renter or {}).get('name', 'A guest'),
                    guest_email=(renter or {}).get('email', ''),
                    property_title=listing_title,
                    property_location=listing_location,
                    check_in=booking_data.start_date,
                    check_out=booking_data.end_date,
                    total_price=total_price,
                    currency=currency,
                    booking_id=booking_doc['id'],
                    is_pending=(booking_doc['status'] == 'pending'),
                )
        asyncio.create_task(_send())
    except Exception as e:
        logger.warning(f"Failed to queue booking emails for booking {booking_doc['id']}: {e}")



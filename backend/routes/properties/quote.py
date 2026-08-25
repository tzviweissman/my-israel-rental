"""What a stay would actually cost — the number the reserve button shows.

Why this endpoint exists at all, rather than a multiplication in the
sidebar: ``nightly_price × nights`` is the wrong answer whenever a host
uses Smart Pricing. Applied entries in ``nightly_price_overrides`` REPLACE
the base rate night by night, so a listing at ₪250 with two peak nights at
₪400 charges ₪1,300 for five nights, not ₪1,250.
``backend/tests/test_smart_pricing_extra.py`` asserts exactly that. A
frontend multiplication would print a price the API does not charge, and
the guest would find out at the booking confirmation.

So the total is computed here by ``_compute_booking_total`` — the same
function the booking pipeline and the confirmation email call, imported
rather than reimplemented. ``test_quote_matches_booking_total.py`` pins
the two together: any future edit that makes them disagree fails there
instead of on somebody's card.

``total: null`` is a real answer, not a missing one. Long-term and
short-term rentals have no single total (rent is monthly, and the stay's
length is not what the renter is agreeing to), and the pricing function
deliberately returns ``None`` for them. The caller shows its ordinary
label in that case — never ``₪0``, which would be a lie about a free stay
rather than an admission that there is no one number to give.
"""
from fastapi import APIRouter, HTTPException, Query

from models import BookingCreate
from routes.bookings import (
    _booking_window,
    _compute_booking_total,
    _load_property_and_sublease,
)

router = APIRouter()
api_router = router


@api_router.get("/properties/{property_id}/quote")
async def get_property_quote(
    property_id: str,
    start: str = Query(..., description="Check-in date, YYYY-MM-DD"),
    end: str = Query(..., description="Check-out date, YYYY-MM-DD"),
    sublease_id: str | None = Query(
        None, description="Quote the sublease's price rather than the property's",
    ),
) -> dict:
    """Price a date window without creating anything.

    Public on purpose: a renter compares prices before signing in, and
    requiring an account to see a total is the kind of friction that makes
    people leave. Nothing here is owner-private — the nightly rate and the
    overrides are already visible on the listing.
    """
    booking_data = BookingCreate(
        property_id=property_id,
        start_date=start,
        end_date=end,
        sublease_id=sublease_id,
    )

    # Strict here, lenient in the pricing function. `_booking_window` falls
    # back to one night on garbage input because a confirmation email is
    # better sent with an approximate total than not sent at all. A quote
    # has no such excuse: the caller is asking what to print on a button,
    # and a confident number derived from dates we could not read is worse
    # than an error.
    window_start, window_end, nights = _booking_window(booking_data)
    if window_start is None or window_end is None:
        raise HTTPException(status_code=400, detail="Invalid start or end date")
    if window_end <= window_start:
        raise HTTPException(status_code=400, detail="end must be after start")

    # Same loader the booking path uses, so a quote for a missing property
    # or a de-activated sublease fails the same way a booking would —
    # rather than quoting a stay that could never be booked.
    property_data, sublease_data = await _load_property_and_sublease(booking_data)

    total = await _compute_booking_total(booking_data, property_data, sublease_data)

    currency = (
        sublease_data.get("currency", "ILS") if sublease_data
        else property_data.get("currency", "ILS")
    )

    return {
        "total": total,
        "currency": currency,
        "nights": nights,
        # Only meaningful alongside a total. Rounded for display; the total
        # itself is never derived from this, so the rounding cannot leak
        # into what anyone is charged.
        "per_night_avg": round(total / nights, 2) if total is not None else None,
    }

"""Booking create + list endpoints — the two "front door" operations.

Extracted from ``bookings.py`` in the 2026-07 refactor.
"""

from fastapi import APIRouter, Depends

from models import BookingCreate
from models_response import BookingCreateResponse, BookingOut
from routes.deps import db, verify_token

from .shared import (
    _assert_no_booking_overlap,
    _assert_not_in_holiday_window,
    _assert_within_availability_window,
    _build_booking_doc,
    _load_property_and_sublease,
    _queue_booking_emails,
    _send_booking_notifications,
)

router = APIRouter()
api_router = router


@api_router.post("/bookings", response_model=BookingCreateResponse)
async def create_booking(booking_data: BookingCreate, payload: dict = Depends(verify_token)) -> dict:
    property_data, sublease_data = await _load_property_and_sublease(booking_data)
    _assert_within_availability_window(booking_data, property_data, sublease_data)
    _assert_not_in_holiday_window(booking_data, property_data, sublease_data)
    await _assert_no_booking_overlap(booking_data)

    booking_doc = _build_booking_doc(
        booking_data=booking_data,
        property_data=property_data,
        sublease_data=sublease_data,
        renter_id=payload['user_id'],
    )
    await db.bookings.insert_one(booking_doc)

    await _send_booking_notifications(
        booking_doc=booking_doc,
        booking_data=booking_data,
        property_data=property_data,
        sublease_data=sublease_data,
    )

    _queue_booking_emails(
        booking_doc=booking_doc,
        booking_data=booking_data,
        property_data=property_data,
        sublease_data=sublease_data,
    )

    return {
        "id": booking_doc['id'],
        "status": booking_doc['status'],
        "message": (
            "Booking confirmed!" if booking_doc['status'] == 'confirmed'
            else "Booking request sent successfully"
        ),
    }


# ---- create_booking helpers ----------------------------------------------


@api_router.get("/bookings", response_model=list[BookingOut])
async def get_bookings(payload: dict = Depends(verify_token)) -> list[dict]:
    query: dict = {}
    if payload['role'] == 'renter':
        # Renters see bookings where they are the guest OR where they're
        # the sublessor (owner_id on a sublease booking points to them).
        query['$or'] = [
            {'renter_id': payload['user_id']},
            {'owner_id': payload['user_id']},
        ]
    elif payload['role'] == 'owner' or payload['role'] == 'manager':
        query['owner_id'] = payload['user_id']
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)

    # Enrich bookings with property details (or sublease details when the
    # booking was for a sublease — sublessors should see the sublease title
    # in their dashboard, not the underlying property's).
    #
    # Batch-fetched via $in to avoid an N+1 query pattern that used to
    # trigger one Mongo round-trip per booking.
    property_ids = {b['property_id'] for b in bookings if b.get('property_id') and not b.get('sublease_id')}
    sublease_ids = {b['sublease_id'] for b in bookings if b.get('sublease_id')}

    prop_map: dict[str, dict] = {}
    if property_ids:
        prop_docs = await db.properties.find(
            {"id": {"$in": list(property_ids)}},
            {"_id": 0, "id": 1, "title": 1, "location": 1, "rental_type": 1},
        ).to_list(len(property_ids))
        prop_map = {p['id']: p for p in prop_docs}

    sub_map: dict[str, dict] = {}
    if sublease_ids:
        sub_docs = await db.subleases.find(
            {"id": {"$in": list(sublease_ids)}},
            {"_id": 0, "id": 1, "title": 1, "area": 1},
        ).to_list(len(sublease_ids))
        sub_map = {s['id']: s for s in sub_docs}

    for booking in bookings:
        if booking.get('sublease_id'):
            sub = sub_map.get(booking['sublease_id'])
            if sub:
                booking['property_title'] = sub.get('title', 'Sublease')
                booking['property_location'] = sub.get('area', '')
                booking['property_rental_type'] = 'sublease'
                continue

        property_data = prop_map.get(booking.get('property_id'))
        if property_data:
            booking['property_title'] = property_data.get('title', 'Unknown Property')
            booking['property_location'] = property_data.get('location', '')
            booking['property_rental_type'] = property_data.get('rental_type', '')

    return bookings

# Booking Cancellation Endpoints



"""Owner-facing property availability endpoint — returns the master
availability calendar aggregated across the owner's portfolio.

Extracted from ``properties.py`` in the 2026-07 refactor.
"""
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException

from routes.deps import db, verify_token

router = APIRouter()
api_router = router


@api_router.get("/owner/availability")
async def get_owner_availability(payload: dict = Depends(verify_token)) -> dict:
    """Per-property availability summary for the signed-in owner/manager.

    Returns one row per active listing with:
      - status:  'available' | 'booked' | 'upcoming'
      - current_until: ISO date the current booking ends (or null)
      - next_available: ISO date the property is next free
      - upcoming: list of confirmed/pending bookings in the next 365 days
      - vacant_days_next_90: integer count of vacant days in the next 90d
      - occupancy_pct_next_90: integer percentage 0–100

    The owner-facing UI uses this to spot soon-to-be-vacant units at a
    glance and plan re-listings / cleaning. Renters never hit this route.
    """
    if payload['role'] not in ('owner', 'manager', 'admin'):
        raise HTTPException(status_code=403, detail="Owners only")

    user_id = payload['user_id']
    today = datetime.now(UTC).date()
    horizon = today + timedelta(days=365)

    properties = await db.properties.find(
        {"owner_id": user_id, "status": {"$ne": "archived"}},
        {"_id": 0},
    ).to_list(2000)

    # One bulk query for all bookings on these properties; cheaper than
    # N round-trips when an owner has dozens of listings.
    prop_ids = [p['id'] for p in properties]
    bookings = await db.bookings.find(
        {
            "property_id": {"$in": prop_ids},
            "status": {"$in": ["pending", "confirmed"]},
            "end_date": {"$gte": today.isoformat()},
        },
        {"_id": 0, "property_id": 1, "start_date": 1, "end_date": 1,
         "status": 1, "renter_id": 1, "id": 1},
    ).to_list(5000)

    by_property: dict[str, list[dict]] = {}
    for b in bookings:
        by_property.setdefault(b['property_id'], []).append(b)

    rows: list[dict] = []
    for prop in properties:
        prop_bookings = sorted(
            by_property.get(prop['id'], []),
            key=lambda b: b['start_date'],
        )
        # Compute current status
        current = next(
            (b for b in prop_bookings
             if b['start_date'] <= today.isoformat() <= b['end_date']),
            None,
        )
        future = [b for b in prop_bookings if b['start_date'] > today.isoformat()]

        if current:
            status = 'booked'
            current_until = current['end_date']
            next_available = current['end_date']
            # If a back-to-back booking follows, push the first vacancy
            # past consecutive bookings.
            cursor = current['end_date']
            for fb in future:
                if fb['start_date'] <= cursor:
                    cursor = max(cursor, fb['end_date'])
                else:
                    break
            next_available = cursor
        elif future:
            status = 'upcoming'
            current_until = None
            next_available = today.isoformat()
        else:
            status = 'available'
            current_until = None
            next_available = today.isoformat()

        # 90-day occupancy slice — useful for planning resignaling
        window_end = today + timedelta(days=90)
        booked_days = 0
        for b in prop_bookings:
            try:
                bs = datetime.fromisoformat(b['start_date']).date()
                be = datetime.fromisoformat(b['end_date']).date()
            except (ValueError, TypeError):
                continue
            overlap_start = max(bs, today)
            overlap_end = min(be, window_end)
            if overlap_end >= overlap_start:
                booked_days += (overlap_end - overlap_start).days + 1
        booked_days = min(booked_days, 90)
        vacant_days = 90 - booked_days
        occupancy_pct = int(round(booked_days / 90 * 100))

        # Renter names for the upcoming list (lightweight enrichment)
        renter_ids = list({b['renter_id'] for b in prop_bookings if b.get('renter_id')})
        renters_map: dict[str, str] = {}
        if renter_ids:
            user_docs = await db.users.find(
                {"id": {"$in": renter_ids}},
                {"_id": 0, "id": 1, "name": 1, "email": 1},
            ).to_list(len(renter_ids))
            for u in user_docs:
                renters_map[u['id']] = u.get('name') or u.get('email') or 'Guest'

        upcoming = [
            {
                "id": b.get('id'),
                "start_date": b['start_date'],
                "end_date": b['end_date'],
                "status": b['status'],
                "renter_name": renters_map.get(b.get('renter_id', ''), 'Guest'),
            }
            for b in prop_bookings
            if b['end_date'] <= horizon.isoformat()
        ]

        rows.append({
            "property_id": prop['id'],
            "title": prop.get('title', ''),
            "area": prop.get('area', ''),
            "rental_type": prop.get('rental_type', ''),
            "bedrooms": prop.get('bedrooms'),
            "image": (prop.get('images') or [None])[0],
            "status": status,
            "current_until": current_until,
            "next_available": next_available,
            "upcoming": upcoming,
            "booked_days_next_90": booked_days,
            "vacant_days_next_90": vacant_days,
            "occupancy_pct_next_90": occupancy_pct,
        })

    return {"properties": rows, "total": len(rows)}

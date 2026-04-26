"""Auto-extracted from server.py during the 2026-04 refactor."""
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from icalendar import Calendar as iCalCalendar
from icalendar import Event as iCalEvent

from models import ICalUrlInput
from routes.deps import db, verify_token
from utils.helpers import parse_ical_feed, sync_property_ical

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/properties/{property_id}/ical")
async def add_ical_url(property_id: str, data: ICalUrlInput, payload: dict = Depends(verify_token)) -> dict:
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop.get("owner_id") != payload["user_id"] and payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    if prop.get("rental_type") != "vacation":
        raise HTTPException(status_code=400, detail="iCal sync is only available for vacation rentals")
    # Validate URL by trying to fetch it
    dates = await parse_ical_feed(data.url)
    ical_urls = prop.get("ical_urls", [])
    if data.url not in ical_urls:
        ical_urls.append(data.url)
    await db.properties.update_one({"id": property_id}, {"$set": {"ical_urls": ical_urls}})
    # Sync immediately
    await sync_property_ical(property_id)
    return {"message": "iCal feed added and synced", "blocked_dates": len(dates), "ical_urls": ical_urls}


@api_router.delete("/properties/{property_id}/ical")
async def remove_ical_url(property_id: str, data: ICalUrlInput, payload: dict = Depends(verify_token)) -> dict:
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop.get("owner_id") != payload["user_id"] and payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    ical_urls = prop.get("ical_urls", [])
    if data.url in ical_urls:
        ical_urls.remove(data.url)
    await db.properties.update_one({"id": property_id}, {"$set": {"ical_urls": ical_urls}})
    await db.external_bookings.delete_many({"property_id": property_id, "source_url": data.url})
    return {"message": "iCal feed removed", "ical_urls": ical_urls}


@api_router.get("/properties/{property_id}/ical-export")
async def export_ical(property_id: str) -> Response:
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "title": 1})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    bookings = await db.bookings.find(
        {"property_id": property_id, "status": {"$in": ["pending", "confirmed"]}},
        {"_id": 0}
    ).to_list(1000)
    cal = iCalCalendar()
    cal.add('prodid', '-//MyIsraelRental//EN')
    cal.add('version', '2.0')
    cal.add('calscale', 'GREGORIAN')
    cal.add('method', 'PUBLISH')
    cal.add('x-wr-calname', prop.get('title', 'Property Calendar'))
    for b in bookings:
        event = iCalEvent()
        event.add('summary', f'Booked - {prop.get("title", "")}')
        event.add('dtstart', datetime.strptime(b['start_date'], '%Y-%m-%d').date())
        event.add('dtend', datetime.strptime(b['end_date'], '%Y-%m-%d').date())
        event.add('uid', b.get('id', str(uuid.uuid4())))
        event.add('dtstamp', datetime.now(UTC))
        cal.add_component(event)
    return Response(content=cal.to_ical(), media_type="text/calendar", headers={"Content-Disposition": f"attachment; filename={property_id}.ics"})


@api_router.get("/properties/{property_id}/blocked-dates")
async def get_blocked_dates(property_id: str) -> dict:
    # Internal bookings
    bookings = await db.bookings.find(
        {"property_id": property_id, "status": {"$in": ["pending", "confirmed"]}},
        {"_id": 0, "start_date": 1, "end_date": 1}
    ).to_list(1000)
    # External iCal bookings
    external = await db.external_bookings.find(
        {"property_id": property_id},
        {"_id": 0, "start_date": 1, "end_date": 1, "summary": 1}
    ).to_list(1000)
    # Get last sync time
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "ical_last_synced": 1, "ical_urls": 1})
    return {
        "internal": bookings,
        "external": external,
        "ical_urls_count": len(prop.get("ical_urls", [])) if prop else 0,
        "last_synced": prop.get("ical_last_synced") if prop else None
    }


@api_router.post("/properties/{property_id}/ical-sync")
async def manual_ical_sync(property_id: str, payload: dict = Depends(verify_token)) -> dict:
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop.get("owner_id") != payload["user_id"] and payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    await sync_property_ical(property_id)
    return {"message": "Sync complete", "last_synced": datetime.now(UTC).isoformat()}

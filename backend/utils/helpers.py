"""Helper utilities for exchange rates and iCal sync.

These are the authoritative versions (previously also duplicated inside
server.py). Any router that needs iCal or USD/ILS pulls from here.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone

import httpx
from icalendar import Calendar as iCalCalendar

from routes.deps import db

logger = logging.getLogger("server")

# Exchange rate cache (module-level, 1-hour TTL)
_exchange_cache = {"rate": None, "fetched_at": None}


async def get_usd_ils_rate():
    """Get USD to ILS exchange rate with 1-hour caching. Falls back to 3.65."""
    now = datetime.now(timezone.utc)
    if (
        _exchange_cache["rate"]
        and _exchange_cache["fetched_at"]
        and (now - _exchange_cache["fetched_at"]).total_seconds() < 3600
    ):
        return _exchange_cache["rate"]
    try:
        async with httpx.AsyncClient(timeout=5) as client_http:
            resp = await client_http.get("https://api.exchangerate-api.com/v4/latest/USD")
            data = resp.json()
            rate = data["rates"]["ILS"]
            _exchange_cache["rate"] = rate
            _exchange_cache["fetched_at"] = now
            return rate
    except Exception:
        return _exchange_cache["rate"] or 3.65


async def parse_ical_feed(url: str):
    """Fetch and parse an iCal feed. Returns list of {start, end, summary}."""
    blocked = []
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as http:
            resp = await http.get(url)
            resp.raise_for_status()
            cal = iCalCalendar.from_ical(resp.text)
            for component in cal.walk():
                if component.name == "VEVENT":
                    dtstart = component.get("dtstart")
                    dtend = component.get("dtend")
                    summary = str(component.get("summary", "Blocked"))
                    if dtstart and dtend:
                        start = dtstart.dt
                        end = dtend.dt
                        if hasattr(start, "date"):
                            start = start.date()
                        if hasattr(end, "date"):
                            end = end.date()
                        blocked.append({"start": str(start), "end": str(end), "summary": summary})
    except Exception as e:
        logger.error(f"iCal fetch error for {url}: {e}")
    return blocked


async def sync_property_ical(property_id: str):
    """Sync all iCal feeds for a single property into the external_bookings collection."""
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "ical_urls": 1})
    if not prop or not prop.get("ical_urls"):
        return
    all_blocked = []
    for url_entry in prop["ical_urls"]:
        url = url_entry if isinstance(url_entry, str) else url_entry.get("url", "")
        if not url:
            continue
        dates = await parse_ical_feed(url)
        for d in dates:
            d["source_url"] = url
        all_blocked.extend(dates)
    # Replace all external bookings for this property atomically
    await db.external_bookings.delete_many({"property_id": property_id})
    if all_blocked:
        docs = [
            {
                "id": str(uuid.uuid4()),
                "property_id": property_id,
                "start_date": b["start"],
                "end_date": b["end"],
                "summary": b["summary"],
                "source_url": b["source_url"],
                "synced_at": datetime.now(timezone.utc).isoformat(),
            }
            for b in all_blocked
        ]
        await db.external_bookings.insert_many(docs)
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {"ical_last_synced": datetime.now(timezone.utc).isoformat()}},
    )


async def sync_all_ical_feeds():
    """Background task: sync every vacation property with iCal URLs every 5 min."""
    while True:
        try:
            props = await db.properties.find(
                {"rental_type": "vacation", "ical_urls": {"$exists": True, "$ne": []}},
                {"_id": 0, "id": 1},
            ).to_list(1000)
            for p in props:
                await sync_property_ical(p["id"])
            if props:
                logger.info(f"iCal sync complete: {len(props)} properties synced")
        except Exception as e:
            logger.error(f"iCal background sync error: {e}")
        await asyncio.sleep(300)  # 5 minutes

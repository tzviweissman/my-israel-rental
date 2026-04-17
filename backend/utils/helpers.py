"""Helper utilities for exchange rates and iCal sync"""
import httpx
import logging
from datetime import datetime, timezone
from icalendar import Calendar as iCalCalendar
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# Exchange rate cache
_exchange_cache = {"rate": None, "fetched_at": None}


async def get_usd_ils_rate():
    """Get USD to ILS exchange rate with 1-hour caching"""
    now = datetime.now(timezone.utc)
    if _exchange_cache["rate"] and _exchange_cache["fetched_at"] and (now - _exchange_cache["fetched_at"]).total_seconds() < 3600:
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
    """Fetch and parse an iCal feed, return list of {start, end, summary} date ranges."""
    blocked = []
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as http:
            resp = await http.get(url)
            resp.raise_for_status()
            cal = iCalCalendar.from_ical(resp.content)
            for component in cal.walk():
                if component.name == "VEVENT":
                    start = component.get('dtstart').dt
                    end = component.get('dtend').dt
                    summary = str(component.get('summary', ''))
                    if isinstance(start, datetime):
                        start = start.date()
                    if isinstance(end, datetime):
                        end = end.date()
                    blocked.append({
                        "start": start.isoformat(),
                        "end": end.isoformat(),
                        "summary": summary
                    })
        return blocked
    except Exception as e:
        logger.error(f"Failed to parse iCal feed {url}: {e}")
        return []


async def sync_property_ical(property_id: str, db: AsyncIOMotorDatabase):
    """Sync a single property's iCal feed"""
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        return False
    
    ical_urls = prop.get('ical_urls', [])
    if not ical_urls:
        return False
    
    all_blocked = []
    for url in ical_urls:
        blocked_dates = await parse_ical_feed(url)
        all_blocked.extend(blocked_dates)
    
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {
            "ical_blocked_dates": all_blocked,
            "ical_last_sync": datetime.now(timezone.utc).isoformat()
        }}
    )
    logger.info(f"Synced iCal for property {property_id}: {len(all_blocked)} blocked dates")
    return True


async def sync_all_ical_feeds(db: AsyncIOMotorDatabase):
    """Sync iCal feeds for all properties that have them"""
    properties = await db.properties.find(
        {"ical_urls": {"$exists": True, "$ne": []}},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    
    logger.info(f"Starting iCal sync for {len(properties)} properties")
    for prop in properties:
        await sync_property_ical(prop['id'], db)
    logger.info("iCal sync completed")

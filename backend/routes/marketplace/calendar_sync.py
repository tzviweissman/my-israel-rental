"""Calendar sync both ways (Tzvi, 19 Oct 2026: "fully run their business from
our site"; item 4 of that list).

OUT: a private calendar address per business, and one per appointment team
member, that Google, Apple or Outlook subscribe to. It lists appointments
(pending ones marked "to confirm"), class sessions, and orders due for pickup
or delivery. The address carries an unguessable token and is the only key;
"Reset links" replaces every token, so a link shared by mistake stops working.

IN: the owner pastes their own calendar's private address (Google's "Secret
address in iCal format", or a shared iCloud calendar). Every 15 minutes its
busy events become blocked time (`marketplace_blocks`, `source: "calendar"`),
which the booking page already refuses, so a dentist appointment in their
own calendar is a time nobody can book. Free events (TRANSP:TRANSPARENT,
which is how Google marks all-day events by default) block nothing.
Repeating events are expanded. Our own feed's events are skipped, so a
calendar that subscribes to us cannot block itself.

The pasted address is a secret (anyone holding it reads that calendar), so
it is stored for the sync and never sent back: the dashboard shows its host.
"""
from __future__ import annotations

import asyncio
import logging
import secrets
import uuid
from datetime import UTC, date, datetime, time, timedelta
from typing import Any, Optional
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from icalendar import Calendar, Event
from pydantic import BaseModel, Field

from routes.deps import db, verify_token
from utils.businesses import public_site_host
from utils.helpers import _is_public_ical_url
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
logger = logging.getLogger("calendar_sync")

IL = ZoneInfo("Asia/Jerusalem")
UID_DOMAIN = "myisraelrental.com"
PAST_DAYS = 30
AHEAD_DAYS = 120
IMPORT_AHEAD_DAYS = 90
SYNC_SECONDS = 15 * 60
MAX_IMPORTS = 5
MAX_BYTES = 5 * 1024 * 1024
MAX_BLOCKS = 3000

WORDS = {
    "en": {"confirm": "to confirm", "pickup": "Pickup", "delivery": "Delivery", "customer": "Customer",
           "phone": "Phone", "email": "Email", "with": "With", "note": "Note", "booked": "booked",
           "busy": "Busy (from your calendar)", "everyone": "Everything: appointments, classes and orders", "order": "Order"},
    "he": {"confirm": "ממתין לאישור", "pickup": "איסוף", "delivery": "משלוח", "customer": "לקוח",
           "phone": "טלפון", "email": "אימייל", "with": "עם", "note": "הערה", "booked": "רשומים",
           "busy": "תפוס (מהיומן שלך)", "everyone": "הכול: תורים, שיעורים והזמנות", "order": "הזמנה"},
}


def _lang(lng: Optional[str]) -> str:
    return "he" if (lng or "").lower().startswith("he") else "en"


def _local(day: str, hhmm: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(f"{day}T{hhmm or '00:00'}").replace(tzinfo=IL)
    except ValueError:
        return None


async def _owned_businesses(user_id: str) -> list[dict]:
    return [b async for b in db.businesses.find({"owner_user_id": user_id}, {"name": 1, "slug": 1})]


async def _team(business_id: str) -> list[dict]:
    """Appointment team members across the business's listings, once each."""
    seen: dict[str, str] = {}
    async for g in db.marketplace_gigs.find({"business_id": business_id, "team.0": {"$exists": True}}, {"team": 1}):
        for m in g.get("team") or []:
            if m.get("id") and m["id"] not in seen:
                seen[m["id"]] = m.get("name") or ""
    return [{"id": k, "name": v} for k, v in seen.items()]


async def _token_for(business_id: str, team_id: Optional[str]) -> str:
    row = await db.calendar_feeds.find_one({"business_id": business_id, "team_id": team_id})
    if row:
        return row["_id"]
    token = secrets.token_urlsafe(24)
    await db.calendar_feeds.insert_one({"_id": token, "business_id": business_id, "team_id": team_id,
                                        "created_at": datetime.now(UTC).isoformat()})
    return token


def feed_url(token: str, lang: str) -> str:
    return f"https://{public_site_host()}/api/marketplace/calendar/{token}.ics" + ("?lng=he" if lang == "he" else "")


def _mask(url: str) -> str:
    host = urlparse(url).hostname or ""
    return f"{host} …{url[-4:]}" if host else "…"


# ---------------------------------------------------------------- the feed

async def build_feed(business: dict, team_id: Optional[str], lang: str) -> bytes:
    w = WORDS[lang]
    cal = Calendar()
    cal.add("prodid", "-//MyIsraelRental//Calendar//EN")
    cal.add("version", "2.0")
    cal.add("x-wr-calname", business.get("name") or "MyIsraelRental")
    cal.add("x-wr-timezone", "Asia/Jerusalem")
    # Ask subscribers to come back often. Google sets its own pace; Apple and
    # Outlook honour this.
    cal.add("refresh-interval", timedelta(hours=1), parameters={"VALUE": "DURATION"})
    cal.add("x-published-ttl", "PT1H")

    today = datetime.now(IL).date()
    lo, hi = (today - timedelta(days=PAST_DAYS)).isoformat(), (today + timedelta(days=AHEAD_DAYS)).isoformat()
    stamp = datetime.now(UTC)
    gigs = {g["_id"]: g async for g in db.marketplace_gigs.find({"business_id": business["_id"]}, {"title": 1, "title_he": 1})}

    q: dict[str, Any] = {"gig_id": {"$in": list(gigs)}, "status": {"$in": ["pending", "accepted", "completed"]},
                         "preferred_date": {"$gte": lo, "$lte": hi}}
    if team_id:
        q["staff_id"] = team_id
    bookings = [b async for b in db.marketplace_bookings.find(q)]
    names = {u["id"]: u.get("name") async for u in db.users.find(
        {"id": {"$in": [b["client_user_id"] for b in bookings if b.get("client_user_id")]}}, {"id": 1, "name": 1})}
    for b in bookings:
        start = _local(b.get("preferred_date"), b.get("time_slot") or "")
        if start is None:
            continue
        gig = gigs.get(b.get("gig_id")) or {}
        what = b.get("tier_name") or (gig.get("title_he") if lang == "he" and gig.get("title_he") else gig.get("title")) or ""
        who = b.get("guest_name") or names.get(b.get("client_user_id")) or w["customer"]
        summary = f"{what}: {who}" if what else who
        if b.get("status") == "pending":
            summary += f" ({w['confirm']})"
        ev = Event()
        ev.add("uid", f"booking-{b['_id']}@{UID_DOMAIN}")
        ev.add("dtstamp", stamp)
        ev.add("dtstart", start.astimezone(UTC))
        ev.add("dtend", (start + timedelta(minutes=int(b.get("duration_minutes") or 30))).astimezone(UTC))
        ev.add("summary", summary)
        ev.add("status", "TENTATIVE" if b.get("status") == "pending" else "CONFIRMED")
        lines = [f"{w['phone']}: {b['contact_phone']}" if b.get("contact_phone") else "",
                 f"{w['email']}: {b['contact_email']}" if b.get("contact_email") else "",
                 f"{w['with']}: {b['staff_name']}" if b.get("staff_name") and not team_id else "",
                 f"{w['note']}: {b['message']}" if b.get("message") else "",
                 f"https://{public_site_host()}/dashboard?tab=appointments"]
        ev.add("description", "\n".join(x for x in lines if x))
        cal.add_component(ev)

    if not team_id:
        async for s in db.class_sessions.find({"business_id": business["_id"], "cancelled": {"$ne": True},
                                               "date": {"$gte": lo, "$lte": hi}}):
            start = _local(s.get("date"), s.get("start"))
            if start is None:
                continue
            ev = Event()
            ev.add("uid", f"class-{s['_id']}@{UID_DOMAIN}")
            ev.add("dtstamp", stamp)
            ev.add("dtstart", start.astimezone(UTC))
            ev.add("dtend", (start + timedelta(minutes=int(s.get("duration_min") or 60))).astimezone(UTC))
            ev.add("summary", f"{s.get('title') or ''} ({s.get('booked') or 0}/{s.get('capacity') or 0} {w['booked']})")
            if s.get("location"):
                ev.add("location", s["location"])
            cal.add_component(ev)

        async for o in db.store_orders.find({"business_id": business["_id"], "needed_by": {"$gte": lo, "$lte": hi + "T23:59"},
                                             "status": {"$nin": ["cancelled", "done", "failed"]}}):
            due = str(o.get("needed_by") or "")
            kind = w["delivery"] if o.get("fulfilment") == "delivery" else w["pickup"]
            ev = Event()
            ev.add("uid", f"order-{o['_id']}@{UID_DOMAIN}")
            ev.add("dtstamp", stamp)
            if "T" in due:
                start = _local(*due.split("T", 1)[:2])
                if start is None:
                    continue
                ev.add("dtstart", start.astimezone(UTC))
                ev.add("dtend", (start + timedelta(minutes=30)).astimezone(UTC))
            else:
                try:
                    d = date.fromisoformat(due)
                except ValueError:
                    continue
                ev.add("dtstart", d)
                ev.add("dtend", d + timedelta(days=1))
            ev.add("summary", f"{kind}: {o.get('customer_name') or w['order']}")
            items = o.get("items") or ", ".join(f"{ln.get('qty')}× {ln.get('name')}" for ln in o.get("lines") or [])
            lines = [str(items)[:500], f"{w['phone']}: {o['customer_phone']}" if o.get("customer_phone") else "",
                     o.get("address") or "", f"https://{public_site_host()}/dashboard?tab=orders"]
            ev.add("description", "\n".join(x for x in lines if x))
            cal.add_component(ev)
    return cal.to_ical()


@router.get("/calendar/{token}.ics")
async def calendar_feed(token: str, request: Request, lng: Optional[str] = None):
    check_rate(request, bucket="calendar_feed", limit=600, window_seconds=600)
    row = await db.calendar_feeds.find_one({"_id": token})
    business = row and await db.businesses.find_one({"_id": row["business_id"]}, {"name": 1})
    if not business:
        raise HTTPException(status_code=404, detail="Calendar not found")
    body = await build_feed(business, row.get("team_id"), _lang(lng))
    return Response(body, media_type="text/calendar; charset=utf-8",
                    headers={"Cache-Control": "no-cache", "X-Robots-Tag": "noindex"})


# ---------------------------------------------------------------- dashboard

class ImportIn(BaseModel):
    url: str = Field(..., min_length=10, max_length=1000)


@router.get("/calendar-sync")
async def my_calendar_sync(user=Depends(verify_token), lng: Optional[str] = None):
    """Feeds for each of my businesses, and the calendars I import."""
    lang = _lang(lng)
    out = []
    for b in await _owned_businesses(user["user_id"]):
        feeds = [{"label": WORDS[lang]["everyone"], "team_id": None, "url": feed_url(await _token_for(b["_id"], None), lang)}]
        for m in await _team(b["_id"]):
            feeds.append({"label": m["name"], "team_id": m["id"], "url": feed_url(await _token_for(b["_id"], m["id"]), lang)})
        out.append({"business_id": b["_id"], "name": b.get("name"), "feeds": feeds})
    imports = [{"id": i["_id"], "label": _mask(i["url"]), "last_synced_at": i.get("last_synced_at"),
                "busy_times": i.get("busy_times", 0), "error": i.get("error")}
               async for i in db.calendar_imports.find({"user_id": user["user_id"]})]
    return {"businesses": out, "imports": imports}


@router.post("/businesses/{business_id}/calendar/reset")
async def reset_links(business_id: str, user=Depends(verify_token)):
    biz = await db.businesses.find_one({"_id": business_id, "owner_user_id": user["user_id"]}, {"_id": 1})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    await db.calendar_feeds.delete_many({"business_id": business_id})
    return {"ok": True}


@router.post("/calendar-imports")
async def add_import(body: ImportIn, user=Depends(verify_token)):
    url = body.url.strip()
    if url.lower().startswith("webcal://"):
        url = "https://" + url[len("webcal://"):]
    if not url.lower().startswith("https://"):
        raise HTTPException(status_code=400, detail="Paste the calendar's address that starts with https:// or webcal://")
    if await db.calendar_imports.count_documents({"user_id": user["user_id"]}) >= MAX_IMPORTS:
        raise HTTPException(status_code=400, detail=f"Up to {MAX_IMPORTS} calendars")
    try:
        events = await busy_events(url)
    except CalendarError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    doc = {"_id": str(uuid.uuid4()), "user_id": user["user_id"], "url": url, "created_at": datetime.now(UTC).isoformat()}
    await db.calendar_imports.insert_one(doc)
    n = await _write_blocks(doc, events)
    return {"id": doc["_id"], "label": _mask(url), "busy_times": n}


@router.delete("/calendar-imports/{import_id}")
async def remove_import(import_id: str, user=Depends(verify_token)):
    res = await db.calendar_imports.delete_one({"_id": import_id, "user_id": user["user_id"]})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Not found")
    await db.marketplace_blocks.delete_many({"import_id": import_id})
    return {"ok": True}


# ---------------------------------------------------------------- import

class CalendarError(Exception):
    pass


async def _fetch(url: str) -> str:
    """GET with the SSRF guard on every hop (iCloud redirects between hosts)."""
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as http:
        for _ in range(4):
            if not _is_public_ical_url(url):
                raise CalendarError("That address cannot be read. Paste the calendar's private iCal address.")
            r = await http.get(url, headers={"user-agent": "MyIsraelRental calendar sync"})
            if r.status_code in (301, 302, 303, 307, 308) and r.headers.get("location"):
                url = urljoin(url, r.headers["location"])
                continue
            if r.status_code != 200:
                raise CalendarError(f"The calendar answered {r.status_code}. Check the address and that it is the private (secret) one.")
            if len(r.content) > MAX_BYTES:
                raise CalendarError("That calendar is too large to read.")
            return r.text
    raise CalendarError("That address kept redirecting.")


def _parse_busy(text: str, now: datetime) -> list[tuple[datetime, datetime]]:
    import recurring_ical_events
    try:
        cal = Calendar.from_ical(text)
    except Exception as e:  # noqa: BLE001
        raise CalendarError("That address is not a calendar (iCal) file.") from e
    out = []
    end_of_window = now + timedelta(days=IMPORT_AHEAD_DAYS)
    for ev in recurring_ical_events.of(cal).between(now, end_of_window):
        if str(ev.get("transp", "")).upper() == "TRANSPARENT" or str(ev.get("status", "")).upper() == "CANCELLED":
            continue
        if str(ev.get("uid", "")).endswith(f"@{UID_DOMAIN}"):
            continue
        s, e = ev.get("dtstart"), ev.get("dtend")
        if not s:
            continue
        s = s.dt
        e = e.dt if e else None
        if isinstance(s, datetime):
            s = (s if s.tzinfo else s.replace(tzinfo=IL)).astimezone(IL)
            e = (e if isinstance(e, datetime) else s + timedelta(hours=1))
            e = (e if e.tzinfo else e.replace(tzinfo=IL)).astimezone(IL)
        else:  # all-day: [s, e) in whole days
            e = e if isinstance(e, date) else s + timedelta(days=1)
            s = datetime.combine(s, time(0, 0), IL)
            e = datetime.combine(e, time(0, 0), IL)
        if e > s:
            out.append((s, e))
    return out


async def busy_events(url: str) -> list[tuple[datetime, datetime]]:
    text = await _fetch(url)
    return await asyncio.to_thread(_parse_busy, text, datetime.now(IL).replace(hour=0, minute=0, second=0, microsecond=0))


def split_into_days(s: datetime, e: datetime) -> list[tuple[str, str, str]]:
    """(date, start HH:MM, end HH:MM) per local day, the shape of a block."""
    rows = []
    day = s.date()
    while datetime.combine(day, time(0, 0), IL) < e:
        day_start = datetime.combine(day, time(0, 0), IL)
        a = max(s, day_start)
        b = min(e, day_start + timedelta(days=1))
        end = "23:59" if b >= day_start + timedelta(days=1) else b.strftime("%H:%M")
        if b > a:
            rows.append((day.isoformat(), a.strftime("%H:%M"), end))
        day += timedelta(days=1)
    return rows


async def _write_blocks(imp: dict, events: list[tuple[datetime, datetime]]) -> int:
    now = datetime.now(UTC).isoformat()
    rows = []
    for s, e in events:
        for d, a, b in split_into_days(s, e):
            rows.append({"_id": str(uuid.uuid4()), "provider_user_id": imp["user_id"], "date": d, "start_time": a,
                         "end_time": b, "note": "", "source": "calendar", "import_id": imp["_id"], "created_at": now})
    rows = rows[:MAX_BLOCKS]
    await db.marketplace_blocks.delete_many({"import_id": imp["_id"]})
    if rows:
        await db.marketplace_blocks.insert_many(rows)
    await db.calendar_imports.update_one({"_id": imp["_id"]}, {"$set": {
        "last_synced_at": now, "busy_times": len(rows), "error": None}})
    return len(rows)


async def sync_once() -> int:
    done = 0
    async for imp in db.calendar_imports.find({}):
        try:
            await _write_blocks(imp, await busy_events(imp["url"]))
            done += 1
        except CalendarError as e:
            # Keep the last busy times: a calendar that is briefly unreachable
            # should not open up every slot it was blocking.
            await db.calendar_imports.update_one({"_id": imp["_id"]}, {"$set": {"error": str(e)}})
        except Exception as e:  # noqa: BLE001
            logger.warning("[calendar] import %s failed: %s", imp["_id"], e)
    return done


async def calendar_sync_loop() -> None:
    await asyncio.sleep(120)
    while True:
        try:
            await sync_once()
        except Exception as e:  # noqa: BLE001
            logger.warning("[calendar] pass failed: %s", e)
        await asyncio.sleep(SYNC_SECONDS)


async def ensure_indexes() -> None:
    await db.calendar_feeds.create_index([("business_id", 1), ("team_id", 1)])
    await db.calendar_imports.create_index("user_id")
    await db.marketplace_blocks.create_index("import_id", sparse=True)

"""Calendar sync (calendar_sync.py) and walk-in sales (counter_sales.py).
Local dev database and the local API only."""
import os
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pymongo import MongoClient  # noqa: E402

API = os.environ.get("TEST_API", "http://localhost:8001/api")
LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
IL = ZoneInfo("Asia/Jerusalem")
M = "_calcounter_test"


# ---------------------------------------------------------------- pure

ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:test
BEGIN:VEVENT
UID:busy-1
DTSTART;TZID=Asia/Jerusalem:{d1}T100000
DTEND;TZID=Asia/Jerusalem:{d1}T113000
SUMMARY:Dentist
END:VEVENT
BEGIN:VEVENT
UID:free-1
DTSTART;TZID=Asia/Jerusalem:{d1}T140000
DTEND;TZID=Asia/Jerusalem:{d1}T150000
TRANSP:TRANSPARENT
SUMMARY:Maybe
END:VEVENT
BEGIN:VEVENT
UID:weekly-1
DTSTART;TZID=Asia/Jerusalem:{d1}T080000
DTEND;TZID=Asia/Jerusalem:{d1}T083000
RRULE:FREQ=WEEKLY;COUNT=3
SUMMARY:Gym
END:VEVENT
BEGIN:VEVENT
UID:booking-abc@myisraelrental.com
DTSTART:{d1}T120000Z
DTEND:{d1}T123000Z
SUMMARY:Our own booking
END:VEVENT
BEGIN:VEVENT
UID:late-1
DTSTART;TZID=Asia/Jerusalem:{d1}T230000
DTEND;TZID=Asia/Jerusalem:{d2}T010000
SUMMARY:Night shift
END:VEVENT
END:VCALENDAR
"""


def test_busy_events_skip_free_and_our_own_and_expand_repeats():
    from routes.marketplace.calendar_sync import _parse_busy, split_into_days
    now = datetime.now(IL).replace(hour=0, minute=0, second=0, microsecond=0)
    d1 = (now + timedelta(days=2)).strftime("%Y%m%d")
    d2 = (now + timedelta(days=3)).strftime("%Y%m%d")
    events = _parse_busy(ICS.format(d1=d1, d2=d2), now)
    starts = sorted(s.strftime("%m%d %H:%M") for s, _ in events)
    day1 = (now + timedelta(days=2)).strftime("%m%d")
    assert f"{day1} 10:00" in starts and f"{day1} 08:00" in starts and f"{day1} 23:00" in starts
    assert f"{day1} 14:00" not in starts           # marked free
    assert not any(s.strftime("%H:%M") == "15:00" for s, _ in events)  # our own booking (12:00Z = 15:00 IL)
    assert sum(1 for s in starts if s.endswith("08:00")) == 3  # weekly, three times
    night = next((s, e) for s, e in events if s.strftime("%H:%M") == "23:00")
    rows = split_into_days(*night)
    assert [r[1:] for r in rows] == [("23:00", "23:59"), ("00:00", "01:00")]


# ---------------------------------------------------------------- live

def _up():
    try:
        return requests.get(f"{API}/health", timeout=3).ok
    except requests.RequestException:
        return False


live = pytest.mark.skipif(not (LOCAL and _up()), reason="needs the local API and the local MongoDB")


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def shop():
    stamp = uuid.uuid4().hex[:10]
    r = requests.post(f"{API}/auth/register", json={"email": f"calc-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
                                                   "name": "Counter owner", "role": "owner"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    tok = r.json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    me = requests.get(f"{API}/auth/me", headers=h, timeout=30).json()
    b = requests.post(f"{API}/marketplace/businesses", json={"name": f"TEST_counter {stamp}"}, headers=h, timeout=30).json()
    db = _db()
    store, appt = f"{M}-store-{stamp}", f"{M}-appt-{stamp}"
    db.marketplace_gigs.insert_many([
        {"_id": store, "marker": M, "business_id": b["id"], "provider_user_id": me["id"], "gig_type": "store",
         "status": "published", "title": "Bakery",
         "products": [{"id": "challah", "name": "Challah", "price": 18, "stock": 5},
                      {"id": "cake", "name": "Cake", "price": 60,
                       "options": [{"id": "big", "name": "Big", "price": 90}]}]},
        {"_id": appt, "marker": M, "business_id": b["id"], "provider_user_id": me["id"], "gig_type": "appointment",
         "status": "published", "title": "Haircut", "team": [{"id": "t1", "name": "Dana"}]},
    ])
    day = (datetime.now(IL) + timedelta(days=3)).strftime("%Y-%m-%d")
    db.marketplace_bookings.insert_one({"_id": f"{M}-bk-{stamp}", "marker": M, "gig_id": appt, "provider_user_id": me["id"],
                                        "guest_name": "Rivka", "preferred_date": day, "time_slot": "11:00",
                                        "duration_minutes": 45, "status": "accepted", "staff_id": "t1", "staff_name": "Dana",
                                        "contact_phone": "050-1234567"})
    yield {"h": h, "biz": b["id"], "store": store, "user": me["id"]}
    for col in ("marketplace_gigs", "marketplace_bookings"):
        db[col].delete_many({"marker": M})
    db.store_orders.delete_many({"business_id": b["id"]})
    db.calendar_feeds.delete_many({"business_id": b["id"]})
    db.businesses.delete_one({"_id": b["id"]})


@live
def test_counter_sale_counts_takes_stock_and_can_be_undone(shop):
    h, biz = shop["h"], shop["biz"]
    cat = requests.get(f"{API}/marketplace/businesses/{biz}/counter", headers=h, timeout=30).json()
    assert cat["stores"][0]["id"] == shop["store"]
    r = requests.post(f"{API}/marketplace/businesses/{biz}/counter-sales", headers=h, timeout=30, json={
        "gig_id": shop["store"], "method": "card",
        "lines": [{"product_id": "challah", "qty": 2}, {"product_id": "cake", "option_id": "big", "qty": 1},
                  {"name": "Candles", "price": 5.5, "qty": 2}]})
    assert r.status_code == 200, r.text
    sale = r.json()
    assert sale["status"] == "done" and sale["source"] == "counter"
    assert sale["total"] == 18 * 2 + 90 + 11 and sale["payment"]["method"] == "card"
    stock = lambda: next(p["stock"] for p in _db().marketplace_gigs.find_one({"_id": shop["store"]})["products"] if p["id"] == "challah")  # noqa: E731
    assert stock() == 3
    # Counted in the summary.
    summ = requests.get(f"{API}/marketplace/businesses/{biz}/summary?days=7", headers=h, timeout=30)
    assert summ.status_code == 200 and "137" in summ.text.replace(".0", "")
    # More than is left is refused, and takes nothing.
    r = requests.post(f"{API}/marketplace/businesses/{biz}/counter-sales", headers=h, timeout=30,
                      json={"gig_id": shop["store"], "method": "cash", "lines": [{"product_id": "challah", "qty": 9}]})
    assert r.status_code == 409 and stock() == 3
    # Undo puts the stock back.
    r = requests.post(f"{API}/marketplace/orders/{sale['id']}/cancel-sale", headers=h, timeout=30)
    assert r.status_code == 200 and r.json()["status"] == "cancelled" and stock() == 5


@live
def test_counter_sale_needs_a_way_of_paying(shop):
    r = requests.post(f"{API}/marketplace/businesses/{shop['biz']}/counter-sales", headers=shop["h"], timeout=30,
                      json={"lines": [{"name": "Tip", "price": 10}], "method": "cheque"})
    assert r.status_code == 422


@live
def test_calendar_feeds_list_bookings_and_team_feed_only_theirs(shop):
    h = shop["h"]
    data = requests.get(f"{API}/marketplace/calendar-sync", headers=h, timeout=30).json()
    mine = next(b for b in data["businesses"] if b["business_id"] == shop["biz"])
    everyone, dana = mine["feeds"][0], next(f for f in mine["feeds"] if f["label"] == "Dana")
    token = everyone["url"].rsplit("/", 1)[1].split(".ics")[0]
    feed = requests.get(f"{API}/marketplace/calendar/{token}.ics", timeout=30)
    assert feed.status_code == 200 and feed.headers["content-type"].startswith("text/calendar")
    assert "Rivka" in feed.text and "050-1234567" in feed.text and "With: Dana" in feed.text
    dtoken = dana["url"].rsplit("/", 1)[1].split(".ics")[0]
    assert "Rivka" in requests.get(f"{API}/marketplace/calendar/{dtoken}.ics", timeout=30).text
    # Reset: the old link stops working.
    requests.post(f"{API}/marketplace/businesses/{shop['biz']}/calendar/reset", headers=h, timeout=30)
    assert requests.get(f"{API}/marketplace/calendar/{token}.ics", timeout=30).status_code == 404


@live
def test_imported_busy_times_block_booking_and_stay_off_the_manual_list(shop):
    import asyncio
    from routes.marketplace import calendar_sync as cs
    imp = {"_id": f"{M}-imp", "user_id": shop["user"]}
    s = datetime.now(IL).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=4, hours=9)
    n = asyncio.get_event_loop().run_until_complete(cs._write_blocks(imp, [(s, s + timedelta(hours=2))]))
    try:
        assert n == 1
        day = s.strftime("%Y-%m-%d")
        taken = requests.get(f"{API}/marketplace/gigs/{M}-appt-{shop['store'].split('-')[-1]}/taken-slots",
                             params={"date": day}, timeout=30)
        assert taken.status_code == 200 and "09:" in taken.text
        manual = requests.get(f"{API}/marketplace/blocks", headers=shop["h"], timeout=30).json()
        assert not any(b.get("source") == "calendar" for b in manual)
    finally:
        _db().marketplace_blocks.delete_many({"import_id": imp["_id"]})
        _db().calendar_imports.delete_many({"_id": imp["_id"]})

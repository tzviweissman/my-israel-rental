"""Appointment reminders and cancel/change from the customer's link
(routes/marketplace/appointment_reminders.py).

Talks to the local API on :8001 and writes marked test gigs into the local
dev database (never Atlas); everything is removed afterwards. The reminder
pass is run directly with a chosen "now"; no email leaves a test machine,
the once-only log is what is checked.
"""
import asyncio
import os
import sys
from datetime import UTC, date, datetime, timedelta
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
MARKER = "_appt_reminder_test"
IL = ZoneInfo("Asia/Jerusalem")
DAY = (date.today() + timedelta(days=9)).isoformat()


def _api_up():
    try:
        return requests.get(f"{API}/health", timeout=3).ok
    except requests.RequestException:
        return False


pytestmark = pytest.mark.skipif(not (LOCAL and _api_up()), reason="needs the local API and the local MongoDB")


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@pytest.fixture(scope="module", autouse=True)
def gig():
    db = _db()
    week = {d: [{"start": "09:00", "end": "17:00"}] for d in ("sun", "mon", "tue", "wed", "thu", "fri", "sat")}
    db.businesses.insert_one({"_id": f"{MARKER}-biz", "slug": "appt-reminder-test-salon", "name": "Reminder Salon", "owner_user_id": f"{MARKER}-pro", "marker": MARKER})
    db.marketplace_gigs.insert_one({
        "_id": f"{MARKER}-appt", "marker": MARKER, "provider_user_id": f"{MARKER}-pro", "business_id": f"{MARKER}-biz",
        "status": "published", "booking_mode": "in_platform", "gig_type": "appointment", "title": "Haircut",
        "tiers": [{"name": "Basic", "price": 100, "currency": "ILS", "duration_minutes": 60}],
        "weekly_availability": week, "slot_duration_minutes": 60})
    yield
    db.marketplace_gigs.delete_many({"marker": MARKER})
    db.businesses.delete_many({"marker": MARKER})
    ids = [b["_id"] for b in db.marketplace_bookings.find({"gig_id": f"{MARKER}-appt"}, {"_id": 1})]
    db.marketplace_bookings.delete_many({"gig_id": f"{MARKER}-appt"})
    db.appointment_reminder_log.delete_many({"_id": {"$in": ids}})


def _book(slot, day=DAY, email="dana@example.com"):
    r = requests.post(f"{API}/marketplace/gigs/{MARKER}-appt/book", json={
        "tier_name": "Basic", "guest_name": "Dana", "contact_email": email, "preferred_date": day, "time_slot": slot, "lang": "he"}, timeout=10)
    assert r.status_code == 200, r.text
    token = r.json()["track_path"].rsplit("/", 1)[1]
    b = _db().marketplace_bookings.find_one({"track_token": token})
    return b, token


def test_reminder_once_inside_the_window_only():
    from routes.marketplace.appointment_reminders import run_once
    b, _ = _book("10:00")
    assert b["lang"] == "he"
    _db().marketplace_bookings.update_one({"_id": b["_id"]}, {"$set": {"status": "accepted"}})
    start = datetime.fromisoformat(f"{DAY}T10:00").replace(tzinfo=IL)
    log = lambda: _db().appointment_reminder_log.count_documents({"_id": b["_id"]})  # noqa: E731
    _run(run_once(now=(start - timedelta(hours=40)).astimezone(UTC)))
    assert log() == 0                                     # too early (24h window)
    at = (start - timedelta(hours=20)).astimezone(UTC)    # 14:00 the day before
    _run(run_once(now=at))
    _run(run_once(now=at + timedelta(minutes=15)))
    assert log() == 1
    # Switched off: nothing for a second appointment.
    _db().businesses.update_one({"_id": f"{MARKER}-biz"}, {"$set": {"appointment_reminders": {"on": False, "hours": 24}}})
    b2, _ = _book("13:00")
    _db().marketplace_bookings.update_one({"_id": b2["_id"]}, {"$set": {"status": "accepted"}})
    _run(run_once(now=at))
    assert _db().appointment_reminder_log.count_documents({"_id": b2["_id"]}) == 0
    _db().businesses.update_one({"_id": f"{MARKER}-biz"}, {"$unset": {"appointment_reminders": ""}})


def test_customer_moves_then_cancels_from_the_link():
    b, token = _book("11:00")
    track = requests.get(f"{API}/marketplace/bookings/track/{token}", timeout=10).json()
    assert track["can_change"] and track["gig_id"] == f"{MARKER}-appt" and track["weekly_availability"]
    _db().marketplace_bookings.update_one({"_id": b["_id"]}, {"$set": {"status": "accepted"}})

    url = f"{API}/marketplace/bookings/track/{token}"
    assert requests.post(f"{url}/move", json={"date": DAY, "time": "18:00"}, timeout=10).status_code == 400   # after hours
    other, _ = _book("15:00")
    assert requests.post(f"{url}/move", json={"date": DAY, "time": "15:00"}, timeout=10).status_code == 409   # taken
    r = requests.post(f"{url}/move", json={"date": DAY, "time": "11:30"}, timeout=10)                          # overlaps only itself
    assert r.status_code == 200, r.text
    after = _db().marketplace_bookings.find_one({"_id": b["_id"]})
    assert after["status"] == "pending" and after["time_slot"] == "11:30" and after["moved_from"]["time"] == "11:00"

    assert requests.post(f"{url}/cancel", timeout=10).json()["status"] == "cancelled"
    assert requests.post(f"{url}/cancel", timeout=10).status_code == 409
    # The freed time can be booked again.
    _book("11:30", email="next@example.com")

"""Booking without an account (Tzvi, 7 Oct 2026: nobody signs in to book).

A guest gives a name and an email or a phone, gets a status link, and the
calendar is still enforced: a taken time is refused to the second guest.

Talks to the local API on :8001 over HTTP and writes its test gigs into the
local dev database (never Atlas). Everything written carries MARKER and is
removed afterwards.
    DISABLE_RATE_LIMIT=1 .venv/Scripts/python -m pytest -q tests/test_guest_booking.py
"""
import asyncio
import os
from datetime import date, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

API = os.environ.get("TEST_API", "http://localhost:8001/api")
LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
MARKER = "_guest_booking_test"
DAY = (date.today() + timedelta(days=9)).isoformat()


def _api_up():
    try:
        return requests.get(f"{API}/health", timeout=3).ok
    except requests.RequestException:
        return False


pytestmark = pytest.mark.skipif(not (LOCAL and _api_up()), reason="needs the local API and the local MongoDB")


def _db(fn):
    async def go():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        try:
            return await fn(client[os.environ["DB_NAME"]])
        finally:
            client.close()
    return asyncio.run(go())


@pytest.fixture(scope="module", autouse=True)
def gigs():
    week = {d: [{"start": "09:00", "end": "17:00"}] for d in ("sun", "mon", "tue", "wed", "thu", "fri", "sat")}
    base = {"marker": MARKER, "provider_user_id": f"{MARKER}-pro", "status": "published", "booking_mode": "in_platform",
            "tiers": [{"name": "Basic", "price": 100, "currency": "ILS", "duration_minutes": 60}], "title": "Guest test"}
    _db(lambda db: db.marketplace_gigs.insert_many([
        {**base, "_id": f"{MARKER}-del", "gig_type": "deliverable"},
        {**base, "_id": f"{MARKER}-appt", "gig_type": "appointment", "weekly_availability": week, "slot_duration_minutes": 60},
    ]))
    yield
    async def clean(db):
        await db.marketplace_gigs.delete_many({"marker": MARKER})
        await db.marketplace_bookings.delete_many({"gig_id": {"$in": [f"{MARKER}-del", f"{MARKER}-appt"]}})
    _db(clean)


def book(gig, **body):
    return requests.post(f"{API}/marketplace/gigs/{MARKER}-{gig}/book", json={"tier_name": "Basic", **body}, timeout=10)


def test_guest_must_say_who_and_how_to_reach():
    assert book("del").status_code == 400                                   # no name
    assert book("del", guest_name="Ruth").status_code == 400                # no email or phone
    assert book("del", guest_name="Ruth", contact_email="nope").status_code == 400


def test_guest_books_and_gets_a_status_link_without_contact_details():
    r = book("del", guest_name="Ruth Adler", contact_phone="0501234567", message="Tuesday please")
    assert r.status_code == 200, r.text
    path = r.json()["track_path"]
    t = requests.get(f"{API}/marketplace{path}", timeout=10)
    assert t.status_code == 200 and t.json()["status"] == "pending"
    body = t.text
    assert "0501234567" not in body and "Ruth" not in body       # nothing about the person
    b = _db(lambda db: db.marketplace_bookings.find_one({"_id": r.json()["booking_id"]}))
    assert b["client_user_id"] is None and b["guest_name"] == "Ruth Adler"
    assert requests.get(f"{API}/marketplace/bookings/track/short", timeout=10).status_code == 404


def test_a_taken_time_is_refused_to_the_second_guest():
    first = book("appt", guest_name="Avi", contact_email="avi@example.com", preferred_date=DAY, time_slot="10:00")
    assert first.status_code == 200, first.text
    second = book("appt", guest_name="Bat", contact_email="bat@example.com", preferred_date=DAY, time_slot="10:00")
    assert second.status_code == 409
    assert book("appt", guest_name="Bat", contact_email="bat@example.com").status_code == 400   # no time picked


def test_a_time_that_has_passed_is_refused():
    from datetime import date as _d
    yesterday = (_d.today() - timedelta(days=1)).isoformat()
    r = book("appt", guest_name="Avi", contact_email="avi@example.com", preferred_date=yesterday, time_slot="10:00")
    assert r.status_code == 400 and "passed" in r.text

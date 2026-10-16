"""Automatic messages to guests of a stay (routes/guest_messages.py):
settings are the host's own, each message goes once in its window and
only on a confirmed booking of a stay, and the check-in instructions go
in the day-before message.

Writes marked test documents into the local dev database (never Atlas)
and removes them afterwards; the pass is run directly with a chosen "now".
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
MARKER = "_guest_msg_test"
IL = ZoneInfo("Asia/Jerusalem")
ARRIVE = date.today() + timedelta(days=20)
LEAVE = ARRIVE + timedelta(days=3)


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


def _owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{API}/auth/register", json={
        "email": f"host-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": "Host", "role": "owner"}, timeout=30).json()
    return r["token"], r["user"]["id"]


@pytest.fixture(scope="module")
def stay():
    token, owner_id = _owner()
    db = _db()
    db.users.insert_one({"id": f"{MARKER}-guest", "email": "guest@example.com", "name": "Noa Levi", "preferred_language": "he", "marker": MARKER})
    db.properties.insert_many([
        {"id": f"{MARKER}-stay", "owner_id": owner_id, "title": "Sea View Flat", "address": "1 Herzl St", "rental_type": "vacation",
         "checkin_time": "15:00", "checkout_time": "11:00", "marker": MARKER},
        {"id": f"{MARKER}-long", "owner_id": owner_id, "title": "Long Let", "rental_type": "long-term", "marker": MARKER},
    ])
    base = {"renter_id": f"{MARKER}-guest", "owner_id": owner_id, "start_date": ARRIVE.isoformat(), "end_date": LEAVE.isoformat(),
            "sublease_id": None, "marker": MARKER}
    db.bookings.insert_many([
        {**base, "id": f"{MARKER}-b1", "property_id": f"{MARKER}-stay", "status": "confirmed"},
        {**base, "id": f"{MARKER}-b2", "property_id": f"{MARKER}-stay", "status": "pending"},
        {**base, "id": f"{MARKER}-b3", "property_id": f"{MARKER}-long", "status": "confirmed"},
    ])
    yield token
    db.users.delete_many({"marker": MARKER})
    db.properties.delete_many({"marker": MARKER})
    db.bookings.delete_many({"marker": MARKER})
    db.guest_message_log.delete_many({"booking_id": {"$regex": f"^{MARKER}"}})


def _sent(booking):
    return sorted(r["trigger"] for r in _db().guest_message_log.find({"booking_id": f"{MARKER}-{booking}"}))


def _at(d, hh, mm=0):
    return datetime(d.year, d.month, d.day, hh, mm, tzinfo=IL).astimezone(UTC)


def test_settings_are_the_hosts(stay):
    url = f"{API}/properties/{MARKER}-stay/guest-messages"
    s = requests.get(url, params={"lang": "he"}, headers={"Authorization": f"Bearer {stay}"}, timeout=10).json()
    assert s["before"]["on"] and s["is_stay"] and "{address}" in s["before"]["default_text"]
    r = requests.put(url, json={"instructions": "Key box code 4321", "evening": {"on": False}},
                     headers={"Authorization": f"Bearer {stay}"}, timeout=10)
    assert r.status_code == 200, r.text
    other, _ = _owner()
    assert requests.get(url, headers={"Authorization": f"Bearer {other}"}, timeout=10).status_code == 403


def test_each_message_once_in_its_window(stay):
    from routes.guest_messages import compose, run_once
    day_before = ARRIVE - timedelta(days=1)
    _run(run_once(now=_at(day_before, 9)))                 # before 10:00
    assert _sent("b1") == []
    _run(run_once(now=_at(day_before, 11)))
    _run(run_once(now=_at(day_before, 11, 15)))
    assert _sent("b1") == ["before"]
    _run(run_once(now=_at(ARRIVE, 20)))                    # evening was switched off
    assert _sent("b1") == ["before"]
    _run(run_once(now=_at(LEAVE, 12)))                     # past checkout: too late
    assert _sent("b1") == ["before"]
    _run(run_once(now=_at(LEAVE, 8, 30)))
    assert _sent("b1") == ["before", "checkout"]
    assert _sent("b2") == [] and _sent("b3") == []         # pending; long-term let

    prop = _db().properties.find_one({"id": f"{MARKER}-stay"})
    subject, body = compose("before", prop, {"name": "Noa Levi"}, "he")
    assert "Sea View Flat" in subject and "1 Herzl St" in body and "4321" in body and "15:00" in body and "Noa" in body

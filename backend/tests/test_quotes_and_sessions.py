"""Quote requests (quotes.py) and dates with limited places (sessions.py).

Talks to the local API on :8001 and writes marked test documents into the
local dev database (never Atlas); everything is removed afterwards.
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
IL = ZoneInfo("Asia/Jerusalem")
DAY = (date.today() + timedelta(days=12)).isoformat()


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


@pytest.fixture(scope="module")
def owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{API}/auth/register", json={"email": f"qs-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
                                                    "name": "QS Owner", "role": "owner"}, timeout=30).json()
    h = {"Authorization": f"Bearer {r['token']}"}
    g = requests.post(f"{API}/marketplace/gigs", json={
        "title": "TEST_qs movers", "description": "moving and tours", "category": "home-services-repair", "area": "Jerusalem",
        "gig_type": "deliverable", "booking_mode": "in_platform", "gallery": ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
        "tiers": [{"name": "Small move", "price": 900, "currency": "ILS"}]}, headers=h, timeout=30)
    assert g.status_code in (200, 201), g.text
    gid = g.json()["id"]
    yield {"h": h, "gig": gid}
    db = _db()
    db.marketplace_gigs.delete_one({"_id": gid})
    db.quote_requests.delete_many({"gig_id": gid})
    db.session_reservations.delete_many({"gig_id": gid})
    db.session_seats.delete_many({"_id": {"$regex": f"^{gid}:"}})
    db.session_waitlist.delete_many({"gig_id": gid})


def test_quote_request_round_trip(owner):
    url = f"{API}/marketplace/gigs/{owner['gig']}/quote-requests"
    bad = requests.post(url, json={"description": "Move a 3-room flat", "name": "Dana"}, timeout=10)
    assert bad.status_code == 400                                         # no way to reach them
    evil = requests.post(url, json={"description": "Move a 3-room flat to Haifa", "name": "Dana", "email": "dana@example.com",
                                    "photos": ["https://evil.example/x.jpg"]}, timeout=10)
    assert evil.status_code == 400
    r = requests.post(url, json={"description": "Move a 3-room flat to Haifa", "name": "Dana", "email": "dana@example.com",
                                 "preferred_date": DAY, "area": "Jerusalem", "lang": "he"}, timeout=10)
    assert r.status_code == 200, r.text
    token = r.json()["track_path"].rsplit("/", 1)[1]
    mine = requests.get(f"{API}/marketplace/quote-requests", headers=owner["h"], timeout=10).json()
    q = next(x for x in mine["quotes"] if x["name"] == "Dana")
    assert q["status"] == "new" and q["email"] == "dana@example.com" and mine["new"] >= 1

    track = f"{API}/marketplace/quotes/track/{token}"
    assert requests.post(f"{track}/answer", json={"answer": "accept"}, timeout=10).status_code == 409   # no price yet
    rep = requests.post(f"{API}/marketplace/quote-requests/{q['id']}/reply", json={"action": "quote", "price": 2400, "note": "Two movers, half a day"},
                        headers=owner["h"], timeout=10)
    assert rep.status_code == 200 and rep.json()["quote"]["price"] == 2400
    t = requests.get(track, timeout=10).json()
    assert t["status"] == "quoted" and t["quote"]["price"] == 2400 and "email" not in t
    assert requests.post(f"{track}/answer", json={"answer": "accept"}, timeout=10).json()["status"] == "accepted"
    assert requests.post(f"{track}/answer", json={"answer": "decline"}, timeout=10).status_code == 409
    stranger = requests.post(f"{API}/marketplace/quote-requests/{q['id']}/reply", json={"action": "decline"}, timeout=10)
    assert stranger.status_code in (401, 403)


def test_places_are_counted_and_freed(owner):
    sessions = [{"id": "tour1", "date": DAY, "time": "10:00", "places": 3, "note": "Old City"}]
    p = requests.patch(f"{API}/marketplace/gigs/{owner['gig']}", json={"sessions": sessions}, headers=owner["h"], timeout=10)
    assert p.status_code == 200, p.text
    pub = requests.get(f"{API}/marketplace/gigs/{owner['gig']}/sessions", timeout=10).json()
    assert pub[0]["left"] == 3
    res = f"{API}/marketplace/gigs/{owner['gig']}/sessions/tour1/reserve"
    a = requests.post(res, json={"seats": 2, "name": "Noa", "email": "noa@example.com"}, timeout=10)
    assert a.status_code == 200 and a.json()["left"] == 1
    assert requests.post(res, json={"seats": 2, "name": "Eli", "email": "eli@example.com"}, timeout=10).status_code == 409
    assert requests.post(res, json={"seats": 1, "name": "Eli", "email": "eli@example.com"}, timeout=10).status_code == 200
    assert requests.post(res, json={"seats": 1, "name": "Late", "email": "late@example.com"}, timeout=10).status_code == 409   # full
    w = requests.post(f"{API}/marketplace/gigs/{owner['gig']}/sessions/tour1/waitlist", json={"name": "Waiting", "email": "wait@example.com"}, timeout=10)
    assert w.status_code == 200
    token = a.json()["track_path"].rsplit("/", 1)[1]
    assert requests.get(f"{API}/marketplace/reservations/{token}", timeout=10).json()["can_cancel"]
    assert requests.post(f"{API}/marketplace/reservations/{token}/cancel", timeout=10).json()["status"] == "cancelled"
    assert requests.get(f"{API}/marketplace/gigs/{owner['gig']}/sessions", timeout=10).json()[0]["left"] == 2
    assert _db().session_waitlist.find_one({"email": "wait@example.com"})["notified_at"]
    mine = requests.get(f"{API}/marketplace/session-reservations", headers=owner["h"], timeout=10).json()
    row = next(x for x in mine if x["id"] == "tour1")
    assert row["taken"] == 1 and [p["name"] for p in row["people"]] == ["Eli"]

    from routes.marketplace.sessions import run_reminders_once
    day_before = datetime.fromisoformat(DAY).replace(tzinfo=IL) - timedelta(days=1) + timedelta(hours=12)
    _run(run_reminders_once(now=day_before.astimezone(UTC)))
    _run(run_reminders_once(now=day_before.astimezone(UTC)))
    eli = _db().session_reservations.find_one({"gig_id": owner["gig"], "name": "Eli"})
    assert _db().session_reminder_log.count_documents({"_id": eli["_id"]}) == 1
    _db().session_reminder_log.delete_many({"_id": eli["_id"]})

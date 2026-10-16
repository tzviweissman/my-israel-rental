"""Choose who does it, the waiting list, and "time to book again"
(TeamMember in shared.py, gigs.py booking, appointment_extras.py).

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
MARKER = "_appt_team_test"
IL = ZoneInfo("Asia/Jerusalem")
DAY = (date.today() + timedelta(days=10)).isoformat()
GIG = f"{MARKER}-appt"


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
    db.businesses.insert_one({"_id": f"{MARKER}-biz", "slug": "appt-team-test-barber", "name": "Team Barber", "owner_user_id": f"{MARKER}-pro", "marker": MARKER})
    db.marketplace_gigs.insert_one({
        "_id": GIG, "marker": MARKER, "provider_user_id": f"{MARKER}-pro", "business_id": f"{MARKER}-biz",
        "status": "published", "booking_mode": "in_platform", "gig_type": "appointment", "title": "Haircut",
        "tiers": [{"name": "Basic", "price": 80, "currency": "ILS", "duration_minutes": 30}],
        "weekly_availability": week, "slot_duration_minutes": 30, "rebook_after_weeks": 4,
        "team": [{"id": "avi", "name": "Avi"}, {"id": "dana", "name": "Dana"}]})
    yield
    db.marketplace_gigs.delete_many({"marker": MARKER})
    db.businesses.delete_many({"marker": MARKER})
    ids = [b["_id"] for b in db.marketplace_bookings.find({"gig_id": GIG}, {"_id": 1})]
    db.marketplace_bookings.delete_many({"gig_id": GIG})
    db.rebook_log.delete_many({"_id": {"$in": ids}})
    db.appointment_waitlist.delete_many({"gig_id": GIG})


def _book(slot, staff=None, email="c@example.com", day=DAY):
    return requests.post(f"{API}/marketplace/gigs/{GIG}/book", json={
        "tier_name": "Basic", "guest_name": "Customer", "contact_email": email, "preferred_date": day,
        "time_slot": slot, "staff_id": staff}, timeout=10)


def test_each_person_has_their_own_calendar():
    a = _book("10:00", "avi")
    assert a.status_code == 200, a.text
    d = _book("10:00", "dana")
    assert d.status_code == 200, d.text
    assert _book("10:00", "avi").status_code == 409            # Avi is taken
    assert _book("10:00").status_code == 409                   # anyone: nobody free
    any_ = _book("11:00")                                      # anyone: first free
    assert any_.status_code == 200
    names = {b["time_slot"] + b["staff_id"] for b in _db().marketplace_bookings.find({"gig_id": GIG})}
    assert {"10:00avi", "10:00dana", "11:00avi"} <= names
    taken = requests.get(f"{API}/marketplace/gigs/{GIG}/taken-slots", timeout=10).json()
    assert "10:00" in taken[DAY] and "11:00" not in taken[DAY]   # only 10:00 is gone for everyone
    assert "11:00" in taken["_staff"]["avi"][DAY] and "11:00" not in taken["_staff"]["dana"][DAY]
    assert _book("12:00", "nobody").status_code == 400


def test_waiting_list_hears_when_a_time_frees():
    r = requests.post(f"{API}/marketplace/gigs/{GIG}/waitlist", json={"date": DAY, "name": "Waiting Wendy", "email": "WENDY@example.com"}, timeout=10)
    assert r.status_code == 200, r.text
    assert requests.post(f"{API}/marketplace/gigs/{GIG}/waitlist", json={"date": DAY, "name": "x", "email": "bad"}, timeout=10).status_code == 422
    b = _book("14:00", "dana", email="leaving@example.com")
    token = b.json()["track_path"].rsplit("/", 1)[1]
    assert requests.post(f"{API}/marketplace/bookings/track/{token}/cancel", timeout=10).status_code == 200
    w = _db().appointment_waitlist.find_one({"gig_id": GIG, "email": "wendy@example.com"})
    assert w["notified_at"]                                       # told once
    # The freed 14:00 with Dana can be booked again.
    assert _book("14:00", "dana", email="next@example.com").status_code == 200


def test_book_again_once_after_the_weeks():
    from routes.marketplace.appointment_extras import run_rebook_once
    db = _db()
    old = (date.today() - timedelta(weeks=4, days=2)).isoformat()
    ins = db.marketplace_bookings.insert_many([
        {"_id": f"{MARKER}-done1", "gig_id": GIG, "status": "completed", "preferred_date": old, "time_slot": "10:00",
         "contact_email": "regular@example.com", "guest_name": "Rina", "staff_id": "avi"},
        {"_id": f"{MARKER}-done2", "gig_id": GIG, "status": "completed", "preferred_date": old, "time_slot": "11:00",
         "contact_email": "already@example.com", "guest_name": "Moshe", "staff_id": "avi"},
        {"_id": f"{MARKER}-next2", "gig_id": GIG, "status": "accepted", "preferred_date": DAY, "time_slot": "15:00",
         "contact_email": "Already@example.com", "guest_name": "Moshe", "staff_id": "avi"},
    ])
    assert ins.inserted_ids
    noon = datetime.now(IL).replace(hour=12, minute=0).astimezone(UTC)
    _run(run_rebook_once(now=noon))
    _run(run_rebook_once(now=noon))
    sent = {r["_id"] for r in db.rebook_log.find({"_id": {"$in": [f"{MARKER}-done1", f"{MARKER}-done2"]}})}
    assert sent == {f"{MARKER}-done1"}            # once; not to someone already booked again


def test_owner_sets_team_and_book_again():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{API}/auth/register", json={"email": f"teamowner-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
                                                    "name": "Team Owner", "role": "owner"}, timeout=30).json()
    h = {"Authorization": f"Bearer {r['token']}"}
    week = {d: [{"start": "09:00", "end": "17:00"}] for d in ("sun", "mon")}
    g = requests.post(f"{API}/marketplace/gigs", json={
        "title": "TEST_team salon", "description": "for the team", "category": "home-services-repair", "area": "Jerusalem",
        "gig_type": "appointment", "booking_mode": "in_platform", "gallery": ["https://res.cloudinary.com/demo/image/upload/sample.jpg"], "weekly_availability": week,
        "tiers": [{"name": "Cut", "price": 80, "currency": "ILS", "duration_minutes": 30}],
        "team": [{"id": "p1", "name": "Rivka"}], "rebook_after_weeks": 4}, headers=h, timeout=30)
    assert g.status_code in (200, 201), g.text
    gid = g.json()["id"]
    p = requests.patch(f"{API}/marketplace/gigs/{gid}", json={"team": [{"id": "p1", "name": "Rivka"}, {"id": "p2", "name": "Moshe"}],
                                                             "rebook_after_weeks": None}, headers=h, timeout=30)
    assert p.status_code == 200, p.text
    doc = _db().marketplace_gigs.find_one({"_id": gid})
    assert [m["name"] for m in doc["team"]] == ["Rivka", "Moshe"] and doc["rebook_after_weeks"] is None
    dup = requests.patch(f"{API}/marketplace/gigs/{gid}", json={"team": [{"id": "p1", "name": "A"}, {"id": "p1", "name": "B"}]}, headers=h, timeout=30)
    assert dup.status_code == 422
    _db().marketplace_gigs.delete_one({"_id": gid})

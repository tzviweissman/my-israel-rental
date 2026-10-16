"""Private feedback after a visit (routes/marketplace/feedback.py) and the
Google Calendar link in emails (utils/calendar_link.py).

Writes marked records into the local dev database (never Atlas) and
removes them afterwards. The day-after pass is run directly with a chosen
"now"; no email leaves a test machine.
"""
import asyncio
import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pymongo import MongoClient  # noqa: E402

API = os.environ.get("TEST_API", "http://localhost:8001/api")
LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
MARKER = "_feedback_test"
IL = ZoneInfo("Asia/Jerusalem")


def _api_up():
    try:
        return requests.get(f"{API}/health", timeout=3).ok
    except requests.RequestException:
        return False


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def test_google_calendar_link_is_israel_time_in_utc():
    from utils.calendar_link import google_calendar_url
    # 10:00 in Israel summer time (UTC+3) is 07:00 UTC; 45 minutes long.
    q = parse_qs(urlparse(google_calendar_url("Haircut", "2026-07-14", "10:00", 45)).query)
    assert q["dates"] == ["20260714T070000Z/20260714T074500Z"]
    assert q["text"] == ["Haircut"]
    # Winter time is UTC+2.
    q = parse_qs(urlparse(google_calendar_url("Haircut", "2026-12-14", "10:00", 60)).query)
    assert q["dates"] == ["20261214T080000Z/20261214T090000Z"]
    assert google_calendar_url("x", "not-a-date", "10:00") is None


live = pytest.mark.skipif(not (LOCAL and _api_up()), reason="needs the local API and the local MongoDB")


@pytest.fixture()
def visit():
    db = _db()
    db.businesses.insert_one({"_id": f"{MARKER}-biz", "slug": "feedback-test-salon", "name": "Feedback Salon",
                              "owner_user_id": f"{MARKER}-pro", "marker": MARKER})
    db.marketplace_gigs.insert_one({"_id": f"{MARKER}-gig", "marker": MARKER, "business_id": f"{MARKER}-biz",
                                    "provider_user_id": f"{MARKER}-pro", "title": "Haircut", "status": "published"})
    now = datetime(2026, 10, 14, 9, 0, tzinfo=UTC)  # 12:00 in Israel
    done = (now - timedelta(hours=26)).isoformat()
    db.marketplace_bookings.insert_many([
        {"_id": f"{MARKER}-b1", "gig_id": f"{MARKER}-gig", "status": "completed", "completed_at": done,
         "contact_email": "Dana@Example.com", "guest_name": "Dana", "track_token": f"{MARKER}-track-b1-xxxxxxxx", "lang": "en"},
        # Too recent: finished an hour ago, asked tomorrow.
        {"_id": f"{MARKER}-b2", "gig_id": f"{MARKER}-gig", "status": "completed",
         "completed_at": (now - timedelta(hours=1)).isoformat(), "contact_email": "eli@example.com", "guest_name": "Eli"},
        # No email: nothing to send.
        {"_id": f"{MARKER}-b3", "gig_id": f"{MARKER}-gig", "status": "completed", "completed_at": done, "guest_name": "Noa"},
    ])
    yield now
    db.marketplace_bookings.delete_many({"gig_id": f"{MARKER}-gig"})
    db.marketplace_gigs.delete_many({"marker": MARKER})
    db.businesses.delete_many({"marker": MARKER})
    db.feedback_requests.delete_many({"business_id": f"{MARKER}-biz"})


@live
def test_day_after_asks_once_and_only_who_it_should(visit):
    from routes.marketplace.feedback import run_once
    db = _db()
    # Outside 10:00-20:00 Israel time nothing goes out.
    assert _run(run_once(now=visit.replace(hour=20))) == 0
    _run(run_once(now=visit))
    _run(run_once(now=visit + timedelta(minutes=30)))
    rows = list(db.feedback_requests.find({"business_id": f"{MARKER}-biz"}))
    assert [r["ref"] for r in rows] == [f"{MARKER}-b1"]
    assert rows[0]["email"] == "dana@example.com"


@live
def test_switched_off_business_is_not_asked(visit):
    from routes.marketplace.feedback import run_once
    db = _db()
    db.businesses.update_one({"_id": f"{MARKER}-biz"}, {"$set": {"feedback_on": False}})
    _run(run_once(now=visit))
    assert db.feedback_requests.count_documents({"business_id": f"{MARKER}-biz"}) == 0


@live
def test_customer_answers_privately_and_public_review_is_offered_for_any_score(visit):
    from routes.marketplace.feedback import run_once
    db = _db()
    _run(run_once(now=visit))
    tok = db.feedback_requests.find_one({"business_id": f"{MARKER}-biz"})["token"]
    page = requests.get(f"{API}/marketplace/feedback/{tok}", timeout=10).json()
    assert page["business"]["name"] == "Feedback Salon" and page["what"] == "Haircut"
    # A low score still gets the public review offered: no gating.
    assert page["review_track_token"] == f"{MARKER}-track-b1-xxxxxxxx"

    # The star from the email is saved at once, without telling the business yet.
    r = requests.post(f"{API}/marketplace/feedback/{tok}", json={"rating": 2, "final": False}, timeout=10)
    assert r.status_code == 200
    f = db.feedback_requests.find_one({"token": tok})
    assert f["rating"] == 2 and not f.get("told_at")
    # Send tells the business once.
    requests.post(f"{API}/marketplace/feedback/{tok}", json={"rating": 2, "comment": "Waited 20 minutes"}, timeout=10)
    f = db.feedback_requests.find_one({"token": tok})
    assert f["comment"] == "Waited 20 minutes" and f.get("told_at")

    assert requests.post(f"{API}/marketplace/feedback/{tok}", json={"rating": 9}, timeout=10).status_code == 422
    assert requests.get(f"{API}/marketplace/feedback/not-a-real-token-at-all", timeout=10).status_code == 404

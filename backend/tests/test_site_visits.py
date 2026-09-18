"""The whole-site visitor counter.

Everything else on the admin overview counts one slice of the site -
listings, services, business pages. This counts people who came at all,
and pages they opened (Tzvi, 18 Sep 2026). What it must get right:

  * the same browser on the same day is one visitor, however many pages;
  * the same browser on two days is still ONE visitor for the week;
  * crawlers and admins are not visitors;
  * nothing about the page is stored, because some paths carry a
    credential (/sign/<token>, /orders/track/<token>).

Needs the live local API and the local Mongo (see backend/tests/.env.test).
"""
from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from pymongo import MongoClient  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
ADMIN = {"email": "admin@rental.com", "password": "Admin1234!"}
BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{BASE}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def visitor(db):
    vid = f"test-{uuid.uuid4()}"
    yield vid
    db.site_visits.delete_many({"visitor": vid})


def _visit(vid, ua=BROWSER, token=None):
    h = {"User-Agent": ua, "X-Visitor-Id": vid}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{BASE}/site/visit", headers=h, timeout=30)


def _today(admin):
    return requests.get(f"{BASE}/admin/metrics", params={"range": "today"},
                        headers=admin, timeout=30).json()["flow"]


def test_one_browser_opening_three_pages_is_one_visitor_and_three_pages(admin, visitor):
    before = _today(admin)
    for _ in range(3):
        assert _visit(visitor).status_code == 204
    after = _today(admin)
    assert after["site_visitors"] == before["site_visitors"] + 1
    assert after["site_pageviews"] == before["site_pageviews"] + 3


def test_a_returning_visitor_is_one_person_across_the_week(admin, db, visitor):
    """Someone who came yesterday and today is one visitor for the week,
    not two - the number is people, not person-days."""
    yesterday = (datetime.now(UTC) - timedelta(days=1)).strftime("%Y-%m-%d")
    db.site_visits.insert_one({"day": yesterday, "visitor": visitor,
                               "first_at": datetime.now(UTC), "pageviews": 2})
    week = lambda: requests.get(f"{BASE}/admin/metrics", params={"range": "7d"},  # noqa: E731
                                headers=admin, timeout=30).json()["flow"]
    before = week()
    _visit(visitor)
    after = week()
    assert after["site_visitors"] == before["site_visitors"], "the same browser must not count twice in a week"
    assert after["site_pageviews"] == before["site_pageviews"] + 1


@pytest.mark.parametrize("ua", [
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "facebookexternalhit/1.1",
    "WhatsApp/2.23",
    "Mozilla/5.0 HeadlessChrome/128.0",
    "",
])
def test_crawlers_are_not_visitors(admin, db, visitor, ua):
    assert _visit(visitor, ua=ua).status_code == 204
    assert db.site_visits.find_one({"visitor": visitor}) is None


def test_the_admin_browsing_their_own_site_is_not_counted(admin, db, visitor):
    token = admin["Authorization"].split(" ", 1)[1]
    assert _visit(visitor, token=token).status_code == 204
    assert db.site_visits.find_one({"visitor": visitor}) is None


def test_nothing_about_the_page_is_stored(db, visitor):
    _visit(visitor)
    row = db.site_visits.find_one({"visitor": visitor}, {"_id": 0})
    assert set(row) == {"day", "visitor", "first_at", "pageviews"}, (
        f"only the day, the anonymous id, a time and a count may be kept: {sorted(row)}"
    )


def test_lifetime_says_when_counting_began(admin, visitor):
    _visit(visitor)
    body = requests.get(f"{BASE}/admin/metrics", params={"range": "all"},
                        headers=admin, timeout=30).json()
    assert body["site_since"], "an all-time number needs a start date beside it"

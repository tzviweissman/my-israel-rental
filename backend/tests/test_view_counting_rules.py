"""Who counts toward a listing's views, and who toward the site's traffic.

Two different numbers, kept separate on purpose:
  * site-wide traffic (routes/site_visits.py) counts every visit, listers
    browsing the site included;
  * a listing's own views count other people only.

  a visitor on a listing       -> listing +1, site +1
  the owner on their own       -> listing +0, site +1
  an owner on someone else's   -> that listing +1
  a bot                        -> neither

Checked for all three kinds of listing, since they record through three
routes. Needs the local API and Mongo (backend/tests/.env.test).
"""
from __future__ import annotations

import os
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from pymongo import MongoClient  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36"
BOT = "facebookexternalhit/1.1"


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"views-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Views {tag}", "role": "owner"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"], r.json()["user"]["id"]


@pytest.fixture(scope="module")
def world(db):
    """Owner A with a business, a service and a property; owner B."""
    a_tok, a_id = _account("a")
    b_tok, _ = _account("b")
    h = {"Authorization": f"Bearer {a_tok}"}
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST_views {uuid.uuid4().hex[:6]}"},
                        headers=h, timeout=30).json()
    gig = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_views gig", "description": "x", "category": "home-services-repair", "area": "Tel Aviv",
        "gig_type": "deliverable", "booking_mode": "whatsapp", "whatsapp": "+972501234567",
        "gallery": ["https://example.com/p.jpg"], "business_id": biz["id"],
        "tiers": [{"name": "Basic", "price": 100, "currency": "ILS"}]}, headers=h, timeout=30).json()
    pid = f"TEST_views_prop_{uuid.uuid4().hex[:8]}"
    db.properties.insert_one({"id": pid, "owner_id": a_id, "title": "TEST_views flat", "area": "Jerusalem",
                              "rental_type": "long-term", "property_type": "apartment", "status": "active", "monthly_price": 5000})
    listings = {
        "property": (f"{BASE}/properties/{pid}", pid),
        "gig": (f"{BASE}/marketplace/gigs/{gig['id']}", gig["id"]),
        "business": (f"{BASE}/marketplace/business/{biz['slug']}", biz["id"]),
    }
    yield {"a": a_tok, "b": b_tok, "listings": listings}
    db.properties.delete_one({"id": pid})
    db.marketplace_gigs.delete_one({"_id": gig["id"]})
    db.marketplace_view_events.delete_many({"entity_id": {"$in": [pid, gig["id"], biz["id"]]}})


def _visit(url, *, token=None, visitor, ua=BROWSER):
    h = {"User-Agent": ua, "X-Visitor-Id": visitor}
    if token:
        h["Authorization"] = f"Bearer {token}"
    assert requests.get(url, headers=h, timeout=30).status_code == 200, url
    # The site-wide counter is the page's own beacon, sent on every page.
    assert requests.post(f"{BASE}/site/visit", headers=h, timeout=30).status_code == 204


def _listing_views(db, entity_id, visitor):
    time.sleep(0.6)   # the listing count is written in the background
    return db.marketplace_view_events.count_documents({"entity_id": entity_id, "visitor": visitor})


def _site_pageviews(db, visitor):
    return sum(d.get("pageviews", 0) for d in db.site_visits.find({"visitor": visitor}))


@pytest.mark.parametrize("kind", ["property", "gig", "business"])
def test_who_counts(world, db, kind):
    url, eid = world["listings"][kind]

    v = f"test-visitor-{uuid.uuid4().hex[:10]}"
    _visit(url, visitor=v)
    assert _listing_views(db, eid, v) == 1, "a visitor adds 1 to the listing"
    assert _site_pageviews(db, v) == 1, "and 1 to the site"

    o = f"test-owner-{uuid.uuid4().hex[:10]}"
    _visit(url, token=world["a"], visitor=o)
    assert _listing_views(db, eid, o) == 0, "the owner on their own listing adds 0 to it"
    assert _site_pageviews(db, o) == 1, "but still 1 to the site"

    other = f"test-other-{uuid.uuid4().hex[:10]}"
    _visit(url, token=world["b"], visitor=other)
    assert _listing_views(db, eid, other) == 1, "an owner on someone else's listing counts for that listing"

    bot = f"test-bot-{uuid.uuid4().hex[:10]}"
    _visit(url, visitor=bot, ua=BOT)
    assert _listing_views(db, eid, bot) == 0, "a bot is not a visitor to the listing"
    assert _site_pageviews(db, bot) == 0, "nor to the site"

    for vid in (v, o, other, bot):
        db.site_visits.delete_many({"visitor": vid})

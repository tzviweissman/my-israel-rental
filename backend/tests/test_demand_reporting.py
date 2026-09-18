"""Demand, reported per person to the admin and per listing to the owner.

Asked for by Tzvi on 18 Sep 2026: "see the amount of clicks per user", and
"allow users to see the amount of views and clicks on their business or
listing". Every event was already recorded; what these pin down is that
they now REACH both screens, and that the two screens agree.

Three things are easy to get wrong and are each held here:

  * A tap's owner is stored under a different name per source - owner_id
    for a property, provider_id for a service, poster_id for a Requests
    post. The per-person report must coalesce all three.
  * The visitor stream carries properties as well as services. The admin
    "service & business views" card counted both until 18 Sep.
  * A listing people looked at without tapping is the one an owner most
    needs to see, and the old per-listing rows (taps only) hid it.

Needs the live local API and the local Mongo (see backend/tests/.env.test).
"""
from __future__ import annotations

import os
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
ADMIN = {"email": "admin@rental.com", "password": "Admin1234!"}


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{BASE}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def owner(db):
    """A registered owner with two properties: one looked at AND tapped,
    one looked at and never tapped. Plus a tap on a service and a Requests
    post, filed under the other two owner field names."""
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    email = f"demand-{stamp}@example.com"
    r = requests.post(f"{BASE}/auth/register", json={
        "email": email, "password": f"Pw-{stamp}-ok1", "name": "Demand Owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    token = r.json()["token"]
    uid = db.users.find_one({"email": email}, {"id": 1})["id"]
    now = datetime.now(UTC)

    tapped, viewed_only = f"{stamp}-tapped", f"{stamp}-viewed"
    for pid, title in ((tapped, "TEST_demand tapped"), (viewed_only, "TEST_demand viewed only")):
        db.properties.insert_one({"id": pid, "owner_id": uid, "title": title,
                                  "area": "Jerusalem", "rental_type": "long-term", "status": "active"})
    for pid, n in ((tapped, 3), (viewed_only, 5)):
        for i in range(n):
            db.marketplace_view_events.insert_one({
                "entity_type": "property", "entity_id": pid, "owner_id": uid,
                "at": now, "day": now.strftime("%Y-%m-%d"), "visitor": f"{stamp}-v{pid}-{i}",
            })
    # One gig view, so the services card has something of this owner's to count.
    db.marketplace_view_events.insert_one({
        "entity_type": "gig", "entity_id": f"{stamp}-gig", "owner_id": uid,
        "at": now, "day": now.strftime("%Y-%m-%d"), "visitor": f"{stamp}-g",
    })
    iso = now.isoformat()
    lead_rows = [
        {"source": "property", "property_id": tapped, "owner_id": uid},
        {"source": "property", "property_id": tapped, "owner_id": uid},
        {"gig_id": f"{stamp}-gig", "provider_id": uid},        # a service tap
        {"source": "request", "request_id": f"{stamp}-req", "poster_id": uid},  # a Requests tap
    ]
    for row in lead_rows:
        db.lead_events.insert_one({"_id": str(uuid.uuid4()), "type": "whatsapp_click",
                                   "created_at": iso, **row})

    yield {"uid": uid, "email": email, "token": token, "tapped": tapped, "viewed_only": viewed_only, "stamp": stamp}

    db.properties.delete_many({"id": {"$in": [tapped, viewed_only]}})
    db.marketplace_view_events.delete_many({"owner_id": uid})
    db.lead_events.delete_many({"$or": [{"owner_id": uid}, {"provider_id": uid}, {"poster_id": uid}]})
    db.users.delete_one({"id": uid})


def _by_user(admin, rng="all"):
    r = requests.get(f"{BASE}/admin/metrics/by-user", params={"range": rng}, headers=admin, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_the_admin_sees_every_tap_whatever_the_source_calls_its_owner(admin, owner):
    rows = _by_user(admin)["rows"]
    mine = next((r for r in rows if r["user_id"] == owner["uid"]), None)
    assert mine, "the seeded owner has no row"
    # 2 property taps + 1 service tap + 1 Requests tap, filed under three
    # different field names.
    assert mine["whatsapp_clicks"] == 4, mine
    assert mine["visitors"] == 9, mine  # 3 + 5 property visitors + 1 service visitor
    assert mine["email"] == owner["email"]


def test_the_range_applies_to_the_per_person_numbers(admin, owner):
    today = next(r for r in _by_user(admin, "today")["rows"] if r["user_id"] == owner["uid"])
    assert today["whatsapp_clicks"] == 4 and today["visitors"] == 9


def test_a_deleted_accounts_demand_is_still_counted(admin, db, owner):
    """Its taps happened; dropping them would make the per-person total
    disagree with the site-wide card above the table."""
    db.users.update_one({"id": owner["uid"]}, {"$set": {"id": f"gone-{owner['uid']}"}})
    try:
        row = next(r for r in _by_user(admin)["rows"] if r["user_id"] == owner["uid"])
        assert row["name"] is None and row["whatsapp_clicks"] == 4
    finally:
        db.users.update_one({"id": f"gone-{owner['uid']}"}, {"$set": {"id": owner["uid"]}})


def test_only_an_admin_can_read_it(owner):
    r = requests.get(f"{BASE}/admin/metrics/by-user",
                     headers={"Authorization": f"Bearer {owner['token']}"}, timeout=30)
    assert r.status_code == 403


def test_the_services_card_does_not_count_property_visitors(admin, db, owner):
    """The visitor stream carries properties too; the card is labelled
    services and business pages. This owner adds 8 property visitors and 1
    gig visitor, so the card must move by exactly 1."""
    flow = requests.get(f"{BASE}/admin/metrics", params={"range": "all"}, headers=admin, timeout=30).json()["flow"]
    expected = db.marketplace_view_events.count_documents({"entity_type": {"$in": ["gig", "business"]}})
    assert flow["service_views"] == expected


def test_the_owner_sees_visitors_and_taps_on_each_listing(owner):
    r = requests.get(f"{BASE}/properties/performance/summary",
                     headers={"Authorization": f"Bearer {owner['token']}"}, timeout=30)
    assert r.status_code == 200, r.text
    rows = {row["id"]: row for row in r.json()["by_listing"]}

    assert rows[owner["tapped"]]["views"] == 3
    assert rows[owner["tapped"]]["count"] == 2

    # The listing people looked at and never messaged about. It had no row
    # at all before, which hid exactly the listing most worth rewriting.
    assert owner["viewed_only"] in rows, "a viewed-but-never-tapped listing must still get a row"
    assert rows[owner["viewed_only"]]["views"] == 5
    assert rows[owner["viewed_only"]]["count"] == 0


def test_the_business_owner_sees_each_service_and_the_business_page(db, owner):
    """Services have the same gap properties had, plus one of their own: a
    visit to the storefront is a visit to no single service, so it gets its
    own row rather than vanishing from the breakdown."""
    uid, s = owner["uid"], owner["stamp"]
    biz_id, quiet_gig = f"{s}-biz", f"{s}-quiet"
    now = datetime.now(UTC)
    db.businesses.insert_one({"_id": biz_id, "owner_user_id": uid, "slug": f"t-{s}", "name": "TEST_demand", "active": True})
    db.marketplace_gigs.insert_many([
        {"_id": f"{s}-gig", "provider_user_id": uid, "business_id": biz_id, "title": "TEST_demand tapped gig"},
        {"_id": quiet_gig, "provider_user_id": uid, "business_id": biz_id, "title": "TEST_demand quiet gig"},
    ])
    for eid, n, etype in ((quiet_gig, 4, "gig"), (biz_id, 2, "business")):
        for i in range(n):
            db.marketplace_view_events.insert_one({
                "entity_type": etype, "entity_id": eid, "owner_id": uid,
                "at": now, "day": now.strftime("%Y-%m-%d"), "visitor": f"{s}-{eid}-{i}",
            })
    try:
        H = {"Authorization": f"Bearer {owner['token']}"}
        for scope in ({"business_id": biz_id}, {}):
            r = requests.get(f"{BASE}/marketplace/leads/summary", params=scope, headers=H, timeout=30)
            assert r.status_code == 200, r.text
            body = r.json()
            rows = {row["gig_id"]: row for row in body["by_gig"]}
            assert rows[f"{s}-gig"]["count"] == 1 and rows[f"{s}-gig"]["views"] == 1, rows
            assert rows[quiet_gig]["views"] == 4 and rows[quiet_gig]["count"] == 0, (
                "a service people looked at and never tapped must still get a row"
            )
            assert body["page_views"] == 2, f"business page visitors missing ({scope or 'all businesses'})"
    finally:
        db.businesses.delete_one({"_id": biz_id})
        db.marketplace_gigs.delete_many({"_id": {"$in": [f"{s}-gig", quiet_gig]}})

"""Price alerts and cheaper-option tips (routes/marketplace/price_watch.py).

Tzvi, 22 Sep 2026: tell a business when a supplier its automations order
from changes price, and point it at a cheaper business nearby.

Two halves, tested from both sides:
  * an alert goes to whoever ORDERS from the seller, names each line
    that moved, and goes to nobody else;
  * a tip compares like with like only (same category, same place,
    starting price), is never sent twice for one listing, can be
    switched off, and never silences the alerts.

The pure part (what counts as a price change) needs nothing; the rest
needs the local API and Mongo (backend/tests/.env.test).
"""
from __future__ import annotations

import os
import sys
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from pymongo import MongoClient  # noqa: E402

from routes.marketplace.price_watch import changes, starting_price  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
M = f"{BASE}/marketplace"


# --- pure -------------------------------------------------------------------

def test_a_price_change_is_a_moved_price_not_a_new_line():
    old = {"tiers": [{"name": "Basic", "price": 100}], "products": [{"id": "p1", "name": "Challah", "price": 12}]}
    new = {"tiers": [{"name": "Basic", "price": 100}, {"name": "Deluxe", "price": 300}],
           "products": [{"id": "p1", "name": "Challah (large)", "price": 14}]}
    assert changes(old, new) == [{"name": "Challah (large)", "old": 12.0, "new": 14.0}], \
        "a renamed product is the same line; an added tier is not a price change"
    assert starting_price(new) == 14.0
    assert starting_price({"tiers": [{"name": "Quote", "price": 0}]}) is None, "no price is not zero"


# --- live ---------------------------------------------------------------------

@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"pw-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"PW {tag}", "role": "owner"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]["id"]


def _business(h, name):
    r = requests.post(f"{M}/businesses", json={"name": f"TEST_pw {name} {uuid.uuid4().hex[:6]}"}, headers=h, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _gig(h, biz, price, *, area="Tel Aviv", category="home-services-repair"):
    r = requests.post(f"{M}/gigs", json={
        "title": f"TEST_pw clean {uuid.uuid4().hex[:4]}", "description": "cleaning", "category": category,
        "area": area, "gig_type": "deliverable", "booking_mode": "whatsapp", "whatsapp": "+972501234567",
        "gallery": ["https://example.com/p.jpg"], "business_id": biz,
        "tiers": [{"name": "Standard clean", "price": price, "currency": "ILS"}]}, headers=h, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


@pytest.fixture()
def w(db):
    """A host who orders cleaning from a cleaner through an automation, and
    a second cleaner in the same city who is connected to nobody."""
    (host_h, host_uid), (cl_h, cl_uid), (rival_h, _) = _account("host"), _account("cleaner"), _account("rival")
    host, cleaner, rival = _business(host_h, "host"), _business(cl_h, "cleaner"), _business(rival_h, "rival")
    c = requests.post(f"{M}/businesses/{host}/connections", json={"target_business_id": cleaner}, headers=host_h, timeout=30).json()
    assert requests.post(f"{M}/connections/{c['id']}/accept", headers=cl_h, timeout=30).status_code == 200
    gig = _gig(cl_h, cleaner, 200)
    r = requests.post(f"{M}/businesses/{host}/automations", json={
        "partner_business_id": cleaner, "name": "Weekly clean",
        "trigger": {"type": "schedule", "schedule": {"weekdays": [6], "time": "09:00"}},
        "template": {"items": "Standard clean", "fulfilment": "pickup", "total": 200}}, headers=host_h, timeout=30)
    assert r.status_code == 200, r.text
    time.sleep(1)   # let the cleaner's own "new listing" check finish first
    db.notifications.delete_many({"user_id": host_uid, "type": {"$in": ["price_tip", "price_change"]}})
    yield {"host": host, "host_h": host_h, "host_uid": host_uid, "cleaner": cleaner, "cl_h": cl_h,
           "cl_uid": cl_uid, "gig": gig, "rival": rival, "rival_h": rival_h}
    ids = [host, cleaner, rival]
    db.business_connections.delete_many({"$or": [{"a_id": {"$in": ids}}, {"b_id": {"$in": ids}}]})
    db.business_automations.delete_many({"business_id": {"$in": ids}})
    db.marketplace_gigs.delete_many({"business_id": {"$in": ids}})
    db.price_tips.delete_many({"business_id": {"$in": ids}})
    db.price_changes.delete_many({"business_ids": {"$in": ids}})


def _bells(db, uid, type_, want=1, tries=30):
    for _ in range(tries):
        rows = list(db.notifications.find({"user_id": uid, "type": type_}))
        if len(rows) >= want:
            return rows
        time.sleep(0.2)
    return list(db.notifications.find({"user_id": uid, "type": type_}))


def test_a_supplier_raising_a_price_alerts_whoever_orders_from_them(w, db):
    r = requests.patch(f"{M}/gigs/{w['gig']}", json={"tiers": [{"name": "Standard clean", "price": 240, "currency": "ILS"}]},
                       headers=w["cl_h"], timeout=30)
    assert r.status_code == 200, r.text
    bells = _bells(db, w["host_uid"], "price_change")
    assert len(bells) == 1
    assert "raised prices" in bells[0]["message"] and "200 → " in bells[0]["message"] and "(+20%)" in bells[0]["message"]
    assert _bells(db, w["cl_uid"], "price_change", tries=5) == [], "the seller is not told about their own change"


def test_a_cheaper_new_business_nearby_is_suggested_once(w, db):
    gid = _gig(w["rival_h"], w["rival"], 150)          # cheaper, same city, same category
    tips = _bells(db, w["host_uid"], "price_tip")
    assert len(tips) == 1
    assert "from ₪150, where you order from ₪200" in tips[0]["message"]
    # The same listing saved again (a typo fix) does not tip twice.
    requests.patch(f"{M}/gigs/{gid}", json={"description": "cleaning, typo fixed"}, headers=w["rival_h"], timeout=30)
    time.sleep(1.5)
    assert len(_bells(db, w["host_uid"], "price_tip", tries=3)) == 1


def test_no_tip_for_a_dearer_business_or_another_city(w, db):
    _gig(w["rival_h"], w["rival"], 260)                 # dearer
    _gig(w["rival_h"], w["rival"], 90, area="Haifa")     # cheaper, but elsewhere
    time.sleep(2)
    assert _bells(db, w["host_uid"], "price_tip", tries=3) == []


def test_a_deal_is_a_reason_on_its_own(w, db):
    gid = _gig(w["rival_h"], w["rival"], 220)            # dearer: no tip yet
    time.sleep(1.5)
    assert _bells(db, w["host_uid"], "price_tip", tries=3) == []
    r = requests.patch(f"{M}/gigs/{gid}", json={"discount": {"percent": 25, "label": "First clean"}},
                       headers=w["rival_h"], timeout=30)
    assert r.status_code == 200, r.text
    tips = _bells(db, w["host_uid"], "price_tip")
    assert len(tips) == 1 and "25% off" in tips[0]["message"]


def test_tips_can_be_switched_off_but_alerts_cannot(w, db):
    r = requests.put(f"{M}/businesses/{w['host']}/price-tips", json={"enabled": False}, headers=w["host_h"], timeout=30)
    assert r.status_code == 200
    _gig(w["rival_h"], w["rival"], 120)
    time.sleep(2)
    assert _bells(db, w["host_uid"], "price_tip", tries=3) == []
    requests.patch(f"{M}/gigs/{w['gig']}", json={"tiers": [{"name": "Standard clean", "price": 180, "currency": "ILS"}]},
                   headers=w["cl_h"], timeout=30)
    assert "lowered prices" in _bells(db, w["host_uid"], "price_change")[0]["message"]


# --- the sign-up nudge (22 Sep 2026) -----------------------------------------

def test_a_new_business_is_asked_to_set_up_an_automation_until_it_has_one(db):
    h, _ = _account("newbiz")
    biz = _business(h, "newbiz")
    try:
        items = {i["id"]: i for lst in requests.get(f"{BASE}/onboarding/state", headers=h, timeout=30).json()["checklists"]
                 if lst["role"] == "business" for i in lst["items"]}
        assert "biz.automation" in items and items["biz.automation"]["done"] is False
        assert items["biz.automation"]["href"] == "/dashboard?tab=network&view=automations"
        r = requests.post(f"{M}/businesses/{biz}/automations", json={
            "name": "Tell me", "trigger": {"type": "lead.received"}, "action": {"type": "notify_me"}}, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        items = {i["id"]: i for lst in requests.get(f"{BASE}/onboarding/state", headers=h, timeout=30).json()["checklists"]
                 if lst["role"] == "business" for i in lst["items"]}
        assert items["biz.automation"]["done"] is True, "any rule counts, even one that only notifies"
    finally:
        db.business_automations.delete_many({"business_id": biz})

"""Store orders, phase 5 (spec O8): cutoffs and standing orders.

  * cutoffs save one per weekday and come back on the public business
    page; `past_cutoff` is pure and answers the only question the form
    asks;
  * "repeat weekly" makes a standing order from an order, and the next
    occurrence appears on the board within the week, exactly once,
    however many times the board is read;
  * pausing stops generation; deleting stops it without touching
    orders already made.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
IL = ZoneInfo("Asia/Jerusalem")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"standing-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": "Standing Owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def business(owner):
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_standing bakery"},
                      headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()


def _orders(owner, biz_id, **params):
    return requests.get(f"{BASE}/marketplace/businesses/{biz_id}/orders", params=params,
                        headers=_auth(owner), timeout=30).json()["orders"]


# ---------------------------------------------------------------------------
# cutoffs
# ---------------------------------------------------------------------------

def test_cutoffs_save_and_show_publicly(owner, business):
    bid = business["id"]
    r = requests.put(f"{BASE}/marketplace/businesses/{bid}/orders/settings",
                     json={"cutoffs": [{"for_day": 5, "closes_day": 4, "closes_time": "14:00"}]},
                     headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["cutoffs"][0]["for_day"] == 5
    # Two for the same day is refused.
    r = requests.put(f"{BASE}/marketplace/businesses/{bid}/orders/settings",
                     json={"cutoffs": [{"for_day": 5, "closes_day": 4, "closes_time": "14:00"},
                                       {"for_day": 5, "closes_day": 3, "closes_time": "10:00"}]},
                     headers=_auth(owner), timeout=30)
    assert r.status_code == 422
    assert requests.put(f"{BASE}/marketplace/businesses/{bid}/orders/settings",
                        json={"cutoffs": [{"for_day": 5, "closes_day": 4, "closes_time": "25:00"}]},
                        headers=_auth(owner), timeout=30).status_code == 422
    # The public page exists once the business has a published listing.
    r = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_standing challot", "description": "for the cutoff row", "category": "shops-products",
        "area": "Jerusalem", "gig_type": "store", "budget_currency": "ILS", "booking_mode": "whatsapp",
        "whatsapp": "+972501234567", "gallery": [],
        "products": [{"name": "Challah", "price": 18, "currency": "ILS", "images": ["https://example.com/c.jpg"]}],
    }, headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    pub = requests.get(f"{BASE}/marketplace/business/{business['slug'] or bid}", timeout=30)
    assert pub.status_code == 200, pub.text
    assert pub.json()["order_cutoffs"] == [{"for_day": 5, "closes_day": 4, "closes_time": "14:00"}]


def test_past_cutoff_is_pure_and_right():
    from routes.marketplace.orders import past_cutoff
    cutoffs = [{"for_day": 5, "closes_day": 4, "closes_time": "14:00"}]
    # 2031-05-09 is a Friday; Thursday 14:00 is the cutoff.
    thu_13 = datetime(2031, 5, 8, 13, 0, tzinfo=IL)
    thu_15 = datetime(2031, 5, 8, 15, 0, tzinfo=IL)
    assert past_cutoff("2031-05-09T12:00", cutoffs, thu_13) is None
    hit = past_cutoff("2031-05-09T12:00", cutoffs, thu_15)
    assert hit and hit["closed_at"].startswith("2031-05-08T14:00")
    # A Sunday order has no cutoff configured.
    assert past_cutoff("2031-05-11", cutoffs, thu_15) is None
    # A cutoff on the same day: for Friday, closes Friday 09:00.
    same = [{"for_day": 5, "closes_day": 5, "closes_time": "09:00"}]
    assert past_cutoff("2031-05-09", same, datetime(2031, 5, 9, 8, 0, tzinfo=IL)) is None
    assert past_cutoff("2031-05-09", same, datetime(2031, 5, 9, 9, 1, tzinfo=IL)) is not None


# ---------------------------------------------------------------------------
# standing orders
# ---------------------------------------------------------------------------

def test_repeat_weekly_generates_next_week_once(owner, business):
    bid = business["id"]
    today = datetime.now(IL).date()
    # An order for TODAY, so "next week" is inside the 7-day horizon.
    r = requests.post(f"{BASE}/marketplace/businesses/{bid}/orders", json={
        "customer_name": "Weekly Rivka", "customer_phone": "052-9998877", "items": "2 challahs",
        "needed_by": f"{today.isoformat()}T11:00", "fulfilment": "pickup", "total": 36,
    }, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    o = r.json()

    r = requests.post(f"{BASE}/marketplace/orders/{o['id']}/repeat-weekly", headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    sd = r.json()
    assert sd["active"] is True
    assert sd["weekday"] == (today.weekday() + 1) % 7
    assert sd["time"] == "11:00"
    # Idempotent: repeating the same order again returns the same standing order.
    again = requests.post(f"{BASE}/marketplace/orders/{o['id']}/repeat-weekly", headers=_auth(owner), timeout=30).json()
    assert again["id"] == sd["id"]

    next_week = (today + timedelta(days=7)).isoformat()
    window = dict(**{"from": next_week, "to": next_week})
    # Read the board three times; exactly one generated order.
    for _ in range(3):
        rows = _orders(owner, bid, **window)
    gen = [x for x in rows if x.get("standing_id") == sd["id"]]
    assert len(gen) == 1, rows
    assert gen[0]["source"] == "standing"
    assert gen[0]["needed_by"] == f"{next_week}T11:00"
    assert gen[0]["customer_name"] == "Weekly Rivka"
    assert gen[0]["total"] == 36
    assert len(gen[0]["track_token"]) >= 16
    # The source order was NOT duplicated for this week.
    this_week = _orders(owner, bid, **{"from": today.isoformat(), "to": today.isoformat()})
    assert len([x for x in this_week if x.get("customer_name") == "Weekly Rivka"]) == 1

    lst = requests.get(f"{BASE}/marketplace/businesses/{bid}/standing-orders", headers=_auth(owner), timeout=30).json()
    assert [x["id"] for x in lst] == [sd["id"]]


def test_pause_and_delete(owner, business):
    bid = business["id"]
    today = datetime.now(IL).date()
    r = requests.post(f"{BASE}/marketplace/businesses/{bid}/orders", json={
        "customer_name": "Pause Me", "items": "1 rye", "needed_by": today.isoformat(), "fulfilment": "pickup",
    }, headers=_auth(owner), timeout=30)
    o = r.json()
    sd = requests.post(f"{BASE}/marketplace/orders/{o['id']}/repeat-weekly", headers=_auth(owner), timeout=30).json()
    next_week = (today + timedelta(days=7)).isoformat()
    gen = [x for x in _orders(owner, bid, **{"from": next_week, "to": next_week}) if x.get("standing_id") == sd["id"]]
    assert len(gen) == 1

    r = requests.patch(f"{BASE}/marketplace/standing-orders/{sd['id']}", json={"active": False}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200 and r.json()["active"] is False

    other_stamp = datetime.now(UTC).strftime("%H%M%S%f")
    other = requests.post(f"{BASE}/auth/register", json={
        "email": f"standing-other-{other_stamp}@example.com", "password": f"Pw-{other_stamp}-ok1",
        "name": "Other", "role": "owner"}, timeout=30).json()["token"]
    assert requests.delete(f"{BASE}/marketplace/standing-orders/{sd['id']}", headers=_auth(other), timeout=30).status_code == 403

    assert requests.delete(f"{BASE}/marketplace/standing-orders/{sd['id']}", headers=_auth(owner), timeout=30).status_code == 200
    # The generated order is still there - it is a real order now.
    gen = [x for x in _orders(owner, bid, **{"from": next_week, "to": next_week}) if x.get("standing_id") == sd["id"]]
    assert len(gen) == 1
    lst = requests.get(f"{BASE}/marketplace/businesses/{bid}/standing-orders", headers=_auth(owner), timeout=30).json()
    assert sd["id"] not in [x["id"] for x in lst]

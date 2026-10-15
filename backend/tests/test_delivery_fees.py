"""Delivery fees by city and free delivery over an amount (orders.py
delivery_fee_for): the city's own fee if set, else the store's; free once
the goods (after a discount) reach free_over; fees only for served cities.

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


def _owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"fees-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": "Fees owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def store():
    owner = _owner()
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_fees bakery"}, headers=_auth(owner), timeout=30).json()
    requests.patch(f"{BASE}/marketplace/businesses/{biz['id']}", json={"areas": ["jerusalem", "bet-shemesh"]}, headers=_auth(owner), timeout=30)
    gig = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_fees challot", "description": "for fees", "category": "shops-products", "area": "Jerusalem",
        "gig_type": "store", "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567", "gallery": [],
        "products": [{"name": "Challah", "price": 20, "currency": "ILS", "images": ["https://example.com/c.jpg"]}],
    }, headers=_auth(owner), timeout=30).json()
    st = requests.put(f"{BASE}/marketplace/businesses/{biz['id']}/orders/settings", json={
        "delivery_on": True, "cutoffs": [], "pickup_windows": [], "delivery_windows": [],
        "delivery_fee": 15, "min_order": None, "free_over": 100,
        "area_fees": {"bet-shemesh": 30, "tel-aviv": 50},
    }, headers=_auth(owner), timeout=30)
    assert st.status_code == 200, st.text
    assert st.json()["area_fees"] == {"bet-shemesh": 30}     # a city it does not serve is dropped
    form = requests.get(f"{BASE}/marketplace/order-form/{gig['id']}", timeout=30).json()
    return {"gig": gig["id"], "prod": form["products"][0]["id"], "form": form}


def _order(store, qty, city):
    day = (datetime.now(IL).date() + timedelta(days=3)).isoformat()
    return requests.post(f"{BASE}/marketplace/order-form/{store['gig']}/orders", json={
        "lines": [{"product_id": store["prod"], "qty": qty}], "fulfilment": "delivery", "date": day,
        "city": city, "address": "Herzl 1", "customer_name": "Rina", "customer_phone": "0541112233"}, timeout=30)


def test_form_shows_the_rules(store):
    s = store["form"]["settings"]
    assert s["free_over"] == 100 and s["area_fees"] == {"bet-shemesh": 30}


def test_fee_by_city_and_free_over(store):
    r = _order(store, 1, "jerusalem")
    assert r.status_code == 200, r.text
    assert r.json()["delivery_fee"] == 15 and r.json()["total"] == 35
    r = _order(store, 1, "bet-shemesh")
    assert r.json()["delivery_fee"] == 30 and r.json()["total"] == 50
    r = _order(store, 5, "bet-shemesh")
    assert r.json()["delivery_fee"] == 0 and r.json()["total"] == 100

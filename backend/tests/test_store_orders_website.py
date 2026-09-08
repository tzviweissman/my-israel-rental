"""Store orders: a customer orders on the website (Tzvi, 2026-09-08).

  * the order form lists the store's products with ids, its windows, fee,
    minimum, areas and cutoffs;
  * an order is priced from the STORE's prices, not the client's, gets the
    delivery fee, refuses closed days, unserved cities, orders below the
    minimum, and windows the store does not offer;
  * it lands on the board as `new` with the lines, goes to the default
    courier, and hands the customer a status link;
  * a signed-in customer sees it under /orders/mine.

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


def _account(tag, role="owner"):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"web-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": f"Web {tag}", "role": role,
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner():
    return _account("owner")


@pytest.fixture(scope="module")
def store(owner):
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_web bakery"}, headers=_auth(owner), timeout=30).json()
    requests.patch(f"{BASE}/marketplace/businesses/{biz['id']}", json={"areas": ["jerusalem"]}, headers=_auth(owner), timeout=30)
    gig = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_web challot", "description": "for the order form", "category": "shops-products", "area": "Jerusalem",
        "gig_type": "store", "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567", "gallery": [],
        "products": [
            {"name": "Challah", "price": 18, "currency": "ILS", "images": ["https://example.com/c.jpg"]},
            {"name": "Babka", "price": 45, "currency": "ILS", "images": ["https://example.com/b.jpg"]},
            {"name": "Sold out thing", "price": 9, "currency": "ILS", "images": ["https://example.com/s.jpg"], "in_stock": False},
        ],
    }, headers=_auth(owner), timeout=30)
    assert gig.status_code in (200, 201), gig.text
    st = requests.put(f"{BASE}/marketplace/businesses/{biz['id']}/orders/settings", json={
        "cutoffs": [], "pickup_windows": [{"weekday": 5, "start": "08:00", "end": "12:00"}],
        "delivery_windows": [{"weekday": 5, "start": "14:00", "end": "16:00"}],
        "delivery_fee": 15, "min_order": 40, "default_courier_user_id": None,
    }, headers=_auth(owner), timeout=30)
    assert st.status_code == 200, st.text
    return {"biz": biz["id"], "gig": gig.json()["id"]}


def _next_friday():
    d = datetime.now(IL).date()
    return d + timedelta(days=((5 - (d.weekday() + 1) % 7) % 7) or 7)


def test_order_form_lists_what_the_customer_needs(store):
    r = requests.get(f"{BASE}/marketplace/order-form/{store['gig']}", timeout=30)
    assert r.status_code == 200, r.text
    f = r.json()
    names = [p["name"] for p in f["products"]]
    assert names == ["Challah", "Babka", "Sold out thing"]
    assert all(p["id"] for p in f["products"])
    assert f["products"][2]["in_stock"] is False
    assert f["settings"]["delivery_fee"] == 15 and f["settings"]["min_order"] == 40
    assert f["business"]["areas"][0]["slug"] == "jerusalem"
    assert "default_courier_user_id" not in f["settings"]


def test_pickup_order_is_priced_by_the_store(store, owner):
    f = requests.get(f"{BASE}/marketplace/order-form/{store['gig']}", timeout=30).json()
    challah = next(p for p in f["products"] if p["name"] == "Challah")
    fri = _next_friday().isoformat()
    r = requests.post(f"{BASE}/marketplace/order-form/{store['gig']}/orders", json={
        "lines": [{"product_id": challah["id"], "qty": 2}], "extra_items": "1 gluten-free roll",
        "fulfilment": "pickup", "date": fri, "window": {"weekday": 5, "start": "08:00", "end": "12:00"},
        "customer_name": "Web Customer", "customer_phone": "054-1234567", "customer_email": "cust@example.com",
    }, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 36 and body["delivery_fee"] == 0
    assert body["track_url"].endswith(f"/orders/track/{body['track_token']}")
    rows = requests.get(f"{BASE}/marketplace/businesses/{store['biz']}/orders", params={"from": fri, "to": fri}, headers=_auth(owner), timeout=30).json()["orders"]
    o = next(x for x in rows if x["id"] == body["order_id"])
    assert o["source"] == "website" and o["status"] == "new"
    assert o["items"] == "2 × Challah\n1 gluten-free roll"
    assert o["needed_by"] == f"{fri}T08:00" and o["lines"][0]["price"] == 18
    tr = requests.get(f"{BASE}/marketplace/orders/track/{body['track_token']}", timeout=30).json()
    assert tr["status"] == "new" and tr["total"] == 36


def test_rules_are_enforced(store):
    f = requests.get(f"{BASE}/marketplace/order-form/{store['gig']}", timeout=30).json()
    ids = {p["name"]: p["id"] for p in f["products"]}
    fri = _next_friday().isoformat()
    base = {"customer_name": "Rule Test", "customer_phone": "054-1234567", "fulfilment": "pickup", "date": fri,
            "window": {"weekday": 5, "start": "08:00", "end": "12:00"}}
    post = lambda **o: requests.post(f"{BASE}/marketplace/order-form/{store['gig']}/orders", json={**base, **o}, timeout=30)  # noqa: E731
    assert post(lines=[]).status_code == 422                                                     # nothing picked
    assert post(lines=[{"product_id": ids["Sold out thing"], "qty": 1}]).status_code == 400      # out of stock
    assert post(lines=[{"product_id": "nope", "qty": 1}]).status_code == 400                     # unknown product
    assert post(lines=[{"product_id": ids["Challah"], "qty": 1}], window={"weekday": 5, "start": "09:00", "end": "10:00"}).status_code == 400  # not a store window
    assert post(lines=[{"product_id": ids["Challah"], "qty": 1}], date="2020-01-03").status_code == 400  # the past
    # Delivery: unserved city, below minimum, then fine with the fee.
    d = dict(lines=[{"product_id": ids["Babka"], "qty": 1}], fulfilment="delivery", address="Herzl 5",
             window={"weekday": 5, "start": "14:00", "end": "16:00"})
    assert post(**d, city="tel-aviv").status_code == 400
    assert post(**{**d, "lines": [{"product_id": ids["Challah"], "qty": 1}]}, city="jerusalem").status_code == 400   # ₪18 < ₪40
    r = post(**d, city="jerusalem")
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 60 and r.json()["delivery_fee"] == 15


def test_closed_day_is_refused(store, owner):
    fri = _next_friday()
    # Close Friday orders yesterday at 00:01: every Friday is past its cutoff.
    y = (datetime.now(IL) - timedelta(days=1))
    requests.put(f"{BASE}/marketplace/businesses/{store['biz']}/orders/settings", json={
        "cutoffs": [{"for_day": 5, "closes_day": (y.weekday() + 1) % 7, "closes_time": "00:01"}],
        "pickup_windows": [], "delivery_windows": [], "delivery_fee": None, "min_order": None, "default_courier_user_id": None,
    }, headers=_auth(owner), timeout=30)
    f = requests.get(f"{BASE}/marketplace/order-form/{store['gig']}", timeout=30).json()
    r = requests.post(f"{BASE}/marketplace/order-form/{store['gig']}/orders", json={
        "lines": [{"product_id": f["products"][0]["id"], "qty": 1}], "fulfilment": "pickup", "date": fri.isoformat(),
        "customer_name": "Late", "customer_phone": "054-1234567",
    }, timeout=30)
    assert r.status_code == 400 and "closed" in r.json()["detail"]
    requests.put(f"{BASE}/marketplace/businesses/{store['biz']}/orders/settings", json={
        "cutoffs": [], "pickup_windows": [], "delivery_windows": [], "delivery_fee": None, "min_order": None, "default_courier_user_id": None,
    }, headers=_auth(owner), timeout=30)


def test_signed_in_customer_sees_their_orders(store):
    cust = _account("customer", role="renter")
    f = requests.get(f"{BASE}/marketplace/order-form/{store['gig']}", timeout=30).json()
    fri = _next_friday().isoformat()
    r = requests.post(f"{BASE}/marketplace/order-form/{store['gig']}/orders", json={
        "lines": [{"product_id": f["products"][0]["id"], "qty": 3}], "fulfilment": "pickup", "date": fri,
        "customer_name": "Signed In", "customer_phone": "054-1234567",
    }, headers=_auth(cust), timeout=30)
    assert r.status_code == 200, r.text
    mine = requests.get(f"{BASE}/marketplace/orders/mine", headers=_auth(cust), timeout=30).json()
    assert [m["id"] for m in mine] == [r.json()["order_id"]]
    assert mine[0]["business"]["name"] == "TEST_web bakery" and mine[0]["total"] == 54
    summary = requests.get(f"{BASE}/dashboard/summary", headers=_auth(cust), timeout=30).json()
    assert summary["customer_orders"] == 1

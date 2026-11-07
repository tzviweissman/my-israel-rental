"""Three price types for a product (Tzvi, 7 Nov 2026, custom products): fixed, "from" (the business confirms the
final price on the order) and "quote" (no price; the customer asks for one).

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, date, datetime, timedelta

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
IMG = "https://res.cloudinary.com/demo/image/upload/sample.jpg"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def shop():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={"email": f"kinds-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": "kinds owner", "role": "owner"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    owner = r.json()["token"]
    requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_kinds cakes"}, headers=_auth(owner), timeout=30)
    g = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_kinds cakes", "description": "custom cakes for every party", "category": "shops-products", "area": "Jerusalem",
        "gig_type": "store", "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567", "gallery": [IMG],
        "products": [
            {"name": "Challah", "price": 20, "images": [IMG]},
            {"name": "Birthday cake", "price_kind": "from", "price": 180, "price_to": 350, "images": [IMG]},
            {"name": "Wedding cake", "price_kind": "quote", "price": 999, "images": [IMG]},
        ],
    }, headers=_auth(owner), timeout=30)
    assert g.status_code in (200, 201), g.text
    gid = g.json()["id"]
    form = requests.get(f"{BASE}/marketplace/order-form/{gid}", timeout=30).json()
    ids = {p["name"]: p for p in form["products"]}
    return {"owner": owner, "gig": gid, "p": ids}


def _order(shop, product, qty=1):
    day = (date.today() + timedelta(days=3)).isoformat()
    return requests.post(f"{BASE}/marketplace/order-form/{shop['gig']}/orders", json={
        "lines": [{"product_id": shop["p"][product]["id"], "qty": qty}], "fulfilment": "pickup", "date": day,
        "customer_name": "Rina", "customer_phone": "0541239001", "customer_email": "r@example.com"}, timeout=30)


def test_kinds_are_kept_and_quote_has_no_price(shop):
    p = shop["p"]
    assert p["Challah"]["price_kind"] == "fixed"
    assert p["Birthday cake"]["price_kind"] == "from" and p["Birthday cake"]["price_to"] == 350
    assert p["Wedding cake"]["price_kind"] == "quote" and p["Wedding cake"]["price"] == 0   # whatever was sent


def test_quote_product_is_asked_for_not_ordered(shop):
    r = _order(shop, "Wedding cake")
    assert r.status_code == 400 and "Ask for a price" in r.text
    q = requests.post(f"{BASE}/marketplace/gigs/{shop['gig']}/quote-requests", json={
        "description": "Three tiers, white and gold, for 120 people", "name": "Dana", "phone": "0541239002",
        "product_id": shop["p"]["Wedding cake"]["id"]}, timeout=30)
    assert q.status_code == 200, q.text   # a shop opens price requests once a product is priced on request
    rows = requests.get(f"{BASE}/marketplace/quote-requests", headers=_auth(shop["owner"]), timeout=30).json()["quotes"]
    assert rows[0]["product_name"] == "Wedding cake"


def test_from_order_waits_for_the_final_price(shop):
    r = _order(shop, "Birthday cake")
    assert r.status_code == 200, r.text
    body = r.json()
    track = requests.get(f"{BASE}/marketplace/orders/track/{body['track_token']}", timeout=30).json()
    assert track["total"] == 180 and track["price_to_confirm"] is True and track["price_confirmed"] is False
    e = requests.patch(f"{BASE}/marketplace/orders/{body['order_id']}", json={"total": 260}, headers=_auth(shop["owner"]), timeout=30)
    assert e.status_code == 200, e.text
    track = requests.get(f"{BASE}/marketplace/orders/track/{body['track_token']}", timeout=30).json()
    assert track["total"] == 260 and track["price_confirmed"] is True


def test_fixed_order_is_as_before(shop):
    r = _order(shop, "Challah", qty=2)
    assert r.status_code == 200, r.text
    track = requests.get(f"{BASE}/marketplace/orders/track/{r.json()['track_token']}", timeout=30).json()
    assert track["total"] == 40 and track["price_to_confirm"] is False


def test_cards_and_search_ignore_the_zero(shop):
    g = requests.get(f"{BASE}/marketplace/gigs/{shop['gig']}", timeout=30).json()
    assert g["cheapest_price"] == 20

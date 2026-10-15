"""Stock counts and product options (shared.py ProductItem, stock.py,
orders.py): orders take from the count and are refused past it, a
cancelled order gives it back, 0 means sold out; an option sets the line's
name and price and a product with options needs one picked.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, date, datetime, timedelta

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _owner(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": f"{tag} owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def shop():
    owner = _owner("stock")
    requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_stock bakery"}, headers=_auth(owner), timeout=30)
    g = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_stock cakes", "description": "for stock", "category": "shops-products", "area": "Jerusalem",
        "gig_type": "store", "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567", "gallery": [],
        "products": [
            {"name": "Babka", "price": 40, "currency": "ILS", "images": ["https://example.com/b.jpg"], "stock": 3, "low_stock_at": 1},
            {"name": "Cake", "price": 100, "currency": "ILS", "images": ["https://example.com/c.jpg"],
             "options": [{"name": "Small"}, {"name": "Large", "price": 150}, {"name": "Huge", "in_stock": False}]},
        ],
    }, headers=_auth(owner), timeout=30)
    assert g.status_code in (200, 201), g.text
    gid = g.json()["id"]
    form = requests.get(f"{BASE}/marketplace/order-form/{gid}", timeout=30).json()
    babka, cake = form["products"]
    return {"owner": owner, "gig": gid, "babka": babka, "cake": cake}


def _order(shop, lines, phone="0541112233"):
    day = (date.today() + timedelta(days=3)).isoformat()
    return requests.post(f"{BASE}/marketplace/order-form/{shop['gig']}/orders", json={
        "lines": lines, "fulfilment": "pickup", "date": day, "customer_name": "Rina", "customer_phone": phone}, timeout=30)


def _babka(shop):
    form = requests.get(f"{BASE}/marketplace/order-form/{shop['gig']}", timeout=30).json()
    return next(p for p in form["products"] if p["id"] == shop["babka"]["id"])


def test_orders_take_stock_and_cancel_gives_it_back(shop):
    pid = shop["babka"]["id"]
    assert shop["babka"]["stock"] == 3
    first = _order(shop, [{"product_id": pid, "qty": 2}])
    assert first.status_code == 200, first.text
    assert _babka(shop)["stock"] == 1
    over = _order(shop, [{"product_id": pid, "qty": 2}])
    assert over.status_code == 400 and "Only 1 left" in over.json()["detail"]
    last = _order(shop, [{"product_id": pid, "qty": 1}])
    assert last.status_code == 200
    b = _babka(shop)
    assert b["stock"] == 0 and b["in_stock"] is False
    assert _order(shop, [{"product_id": pid, "qty": 1}]).status_code == 400

    r = requests.patch(f"{BASE}/marketplace/orders/{first.json()['order_id']}/status", json={"status": "cancelled"},
                       headers=_auth(shop["owner"]), timeout=30)
    assert r.status_code == 200, r.text
    b = _babka(shop)
    assert b["stock"] == 2 and b["in_stock"] is True
    # Cancelling is final, so stock cannot come back twice.
    requests.patch(f"{BASE}/marketplace/orders/{first.json()['order_id']}/status", json={"status": "cancelled"},
                   headers=_auth(shop["owner"]), timeout=30)
    assert _babka(shop)["stock"] == 2


def test_options_price_and_name(shop):
    cake = shop["cake"]
    small, large, huge = cake["options"]
    assert _order(shop, [{"product_id": cake["id"], "qty": 1}]).status_code == 400          # no choice
    assert _order(shop, [{"product_id": cake["id"], "qty": 1, "option_id": huge["id"]}]).status_code == 400
    r = _order(shop, [{"product_id": cake["id"], "qty": 1, "option_id": small["id"]},
                      {"product_id": cake["id"], "qty": 2, "option_id": large["id"]}])
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 100 + 300
    track = requests.get(f"{BASE}/marketplace/orders/track/{r.json()['track_token']}", timeout=30).json()
    assert "Cake (Large)" in track["items"]

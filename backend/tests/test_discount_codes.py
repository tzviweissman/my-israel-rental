"""Discount codes (routes/marketplace/discounts.py): the business makes
them, the order form and membership sign-up apply them on the server, and
every condition holds (dates, minimum, uses, once per customer, new
customers only, orders vs memberships).

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
    owner = _owner("disc")
    requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_disc bakery"}, headers=_auth(owner), timeout=30)
    g = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_disc cakes", "description": "for discount codes", "category": "shops-products", "area": "Jerusalem",
        "gig_type": "store", "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567", "gallery": [],
        "products": [{"name": "Cake", "price": 100, "currency": "ILS", "images": ["https://example.com/c.jpg"]}],
    }, headers=_auth(owner), timeout=30)
    assert g.status_code in (200, 201), g.text
    gid = g.json()["id"]
    form = requests.get(f"{BASE}/marketplace/order-form/{gid}", timeout=30).json()
    return {"owner": owner, "gig": gid, "biz": form["business"]["id"], "prod": form["products"][0]["id"]}


def _code(shop, **kw):
    r = requests.post(f"{BASE}/marketplace/businesses/{shop['biz']}/discount-codes", json=kw, headers=_auth(shop["owner"]), timeout=30)
    return r


def _order(shop, qty=1, code=None, phone="0541112233", name="Rina"):
    day = (date.today() + timedelta(days=3)).isoformat()
    return requests.post(f"{BASE}/marketplace/order-form/{shop['gig']}/orders", json={
        "lines": [{"product_id": shop["prod"], "qty": qty}], "fulfilment": "pickup", "date": day,
        "customer_name": name, "customer_phone": phone, "discount_code": code}, timeout=30)


def test_codes_are_owner_only_unique_and_valid(shop):
    assert _code(shop, code="first10", kind="percent", value=10).status_code == 200
    assert _code(shop, code="FIRST10", kind="amount", value=5).status_code == 409
    assert _code(shop, code="BAD CODE!", value=5).status_code == 422
    assert _code(shop, code="HALF", kind="percent", value=150).status_code == 422
    stranger = _owner("disc-stranger")
    r = requests.post(f"{BASE}/marketplace/businesses/{shop['biz']}/discount-codes", json={"code": "X123", "value": 5}, headers=_auth(stranger), timeout=30)
    assert r.status_code == 403


def test_percent_code_on_an_order_and_once_per_customer(shop):
    chk = requests.post(f"{BASE}/marketplace/businesses/{shop['biz']}/discount-codes/check", json={"code": " first10 ", "amount": 200}, timeout=30).json()
    assert chk["ok"] is True and chk["discount"] == 20
    r = _order(shop, qty=2, code="first10")
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 180 and r.json()["discount"] == {"code": "FIRST10", "amount": 20}
    again = _order(shop, qty=1, code="FIRST10")
    assert again.status_code == 400 and "already used" in again.text
    codes = requests.get(f"{BASE}/marketplace/businesses/{shop['biz']}/discount-codes", headers=_auth(shop["owner"]), timeout=30).json()
    c = next(x for x in codes if x["code"] == "FIRST10")
    assert c["uses"] == 1 and c["discount_given"] == 20


def test_conditions(shop):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    _code(shop, code="OLD", value=10, ends_on=yesterday)
    assert "expired" in _order(shop, code="OLD", phone="0541112201").text
    _code(shop, code="BIG", kind="amount", value=30, min_order=250)
    assert "at least" in _order(shop, qty=1, code="BIG", phone="0541112202").text
    _code(shop, code="ONCE", kind="amount", value=500, max_uses=1)
    r = _order(shop, qty=1, code="ONCE", phone="0541112203")
    assert r.status_code == 200 and r.json()["total"] == 0          # never below zero
    assert "used up" in _order(shop, code="ONCE", phone="0541112204").text
    _code(shop, code="NEWBIE", value=15, first_order_only=True)
    assert "first-time" in _order(shop, code="NEWBIE", phone="0541112233").text    # Rina ordered already
    assert _order(shop, code="NEWBIE", phone="0541112299").status_code == 200
    _code(shop, code="GYMONLY", value=10, applies_to="memberships")
    assert "memberships only" in _order(shop, code="GYMONLY", phone="0541112205").text
    assert "not valid" in _order(shop, code="NOSUCH", phone="0541112206").text


def test_code_on_a_membership(shop):
    plan = requests.post(f"{BASE}/marketplace/businesses/{shop['biz']}/membership-plans", json={"name": "Monthly", "price": 200},
                         headers=_auth(shop["owner"]), timeout=30).json()
    _code(shop, code="JOIN50", kind="amount", value=50, applies_to="memberships")
    r = requests.post(f"{BASE}/marketplace/memberships/plan/{plan['id']}/join",
                      json={"name": "Moshe", "phone": "0527770000", "discount_code": "join50"}, timeout=30)
    assert r.status_code == 200, r.text
    me = requests.get(f"{BASE}/marketplace/memberships/me/{r.json()['manage_token']}", timeout=30).json()
    assert me["discount"] == {"code": "JOIN50", "amount": 50, "price_after": 150}

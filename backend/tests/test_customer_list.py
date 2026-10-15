"""A business's customer list (routes/marketplace/customers.py): one row
per person across orders and memberships, matched by phone; the owner's
note and tags; owner-only; nothing from another business.

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
    owner = _owner("custlist")
    requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_custlist shop"}, headers=_auth(owner), timeout=30)
    g = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_custlist cakes", "description": "for the customer list", "category": "shops-products", "area": "Jerusalem",
        "gig_type": "store", "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567", "gallery": [],
        "products": [{"name": "Cake", "price": 100, "currency": "ILS", "images": ["https://example.com/c.jpg"]}],
    }, headers=_auth(owner), timeout=30)
    assert g.status_code in (200, 201), g.text
    gid = g.json()["id"]
    form = requests.get(f"{BASE}/marketplace/order-form/{gid}", timeout=30).json()
    biz_id, prod = form["business"]["id"], form["products"][0]["id"]
    day = (date.today() + timedelta(days=3)).isoformat()
    for phone in ("054-1234567", "+972 54 123 4567"):        # the same person, written two ways
        r = requests.post(f"{BASE}/marketplace/order-form/{gid}/orders", json={
            "lines": [{"product_id": prod, "qty": 1}], "fulfilment": "pickup", "date": day,
            "customer_name": "Dana Cohen", "customer_phone": phone}, timeout=30)
        assert r.status_code == 200, r.text
    requests.post(f"{BASE}/marketplace/order-form/{gid}/orders", json={
        "lines": [{"product_id": prod, "qty": 2}], "fulfilment": "pickup", "date": day,
        "customer_name": "Yossi", "customer_phone": "052-9999999"}, timeout=30)
    plan = requests.post(f"{BASE}/marketplace/businesses/{biz_id}/membership-plans", json={"name": "Monthly", "price": 150},
                         headers=_auth(owner), timeout=30).json()
    r = requests.post(f"{BASE}/marketplace/memberships/plan/{plan['id']}/join", json={"name": "Dana", "phone": "0541234567"}, timeout=30)
    assert r.status_code == 200, r.text
    return {"owner": owner, "biz": biz_id}


def _list(shop, **params):
    r = requests.get(f"{BASE}/marketplace/businesses/{shop['biz']}/customer-list", params=params, headers=_auth(shop["owner"]), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_one_row_per_person_across_orders_and_membership(shop):
    d = _list(shop)
    assert d["totals"]["customers"] == 2
    dana = next(c for c in d["customers"] if c["name"] == "Dana Cohen")
    assert dana["orders"] == 2 and dana["spent"] == 200
    assert dana["membership"]["plan"] == "Monthly" and dana["membership"]["status"] == "pending"
    assert _list(shop, sort="spent")["customers"][0]["name"] == "Dana Cohen"
    assert [c["name"] for c in _list(shop, kind="members")["customers"]] == ["Dana Cohen"]
    assert [c["name"] for c in _list(shop, q="9999")["customers"]] == ["Yossi"]


def test_note_and_tags_stick_and_filter(shop):
    dana = next(c for c in _list(shop)["customers"] if c["name"] == "Dana Cohen")
    r = requests.patch(f"{BASE}/marketplace/businesses/{shop['biz']}/customer-list",
                       json={"key": dana["key"], "note": "Allergic to nuts", "tags": ["VIP", "VIP", "  regular  ", "bad,tag"]},
                       headers=_auth(shop["owner"]), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["tags"] == ["VIP", "regular"]
    d = _list(shop, tag="VIP")
    assert [c["name"] for c in d["customers"]] == ["Dana Cohen"] and d["customers"][0]["note"] == "Allergic to nuts"
    assert "VIP" in d["tags"]
    assert [c["name"] for c in _list(shop, q="nuts")["customers"]] == ["Dana Cohen"]

    det = requests.get(f"{BASE}/marketplace/businesses/{shop['biz']}/customer-list/detail", params={"key": dana["key"]},
                       headers=_auth(shop["owner"]), timeout=30).json()
    assert len(det["orders"]) == 2 and len(det["memberships"]) == 1


def test_owner_only_and_export(shop):
    stranger = _owner("custlist-stranger")
    assert requests.get(f"{BASE}/marketplace/businesses/{shop['biz']}/customer-list", headers=_auth(stranger), timeout=30).status_code == 403
    r = requests.get(f"{BASE}/marketplace/businesses/{shop['biz']}/customer-list/export.csv", headers=_auth(shop["owner"]), timeout=30)
    assert r.status_code == 200 and "Dana Cohen" in r.text and "Allergic to nuts" in r.text

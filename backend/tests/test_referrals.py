"""Referrals (referrals.py, through discounts.py): a customer's personal
code gives a friend the business's first-time discount, is refused for
the sender and for returning customers, and earns the sender a one-use
thank-you code that stays out of the business's code list.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, date, datetime, timedelta

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"refer-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": "Refer owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def shop():
    owner = _owner()
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_refer bakery"}, headers=_auth(owner), timeout=30).json()
    g = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_refer cakes", "description": "for referrals", "category": "shops-products", "area": "Jerusalem",
        "gig_type": "store", "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567", "gallery": [],
        "products": [{"name": "Cake", "price": 100, "currency": "ILS", "images": ["https://example.com/c.jpg"]}],
    }, headers=_auth(owner), timeout=30).json()
    form = requests.get(f"{BASE}/marketplace/order-form/{g['id']}", timeout=30).json()
    return {"owner": owner, "biz": biz["id"], "gig": g["id"], "prod": form["products"][0]["id"]}


def _order(shop, phone, name, code=None, email=None):
    day = (date.today() + timedelta(days=3)).isoformat()
    return requests.post(f"{BASE}/marketplace/order-form/{shop['gig']}/orders", json={
        "lines": [{"product_id": shop["prod"], "qty": 1}], "fulfilment": "pickup", "date": day,
        "customer_name": name, "customer_phone": phone, "customer_email": email, "discount_code": code}, timeout=30)


def test_referral_flow(shop):
    first = _order(shop, "0541110001", "Noa Levi", email="noa@example.com").json()
    # Off by default: no link.
    assert requests.get(f"{BASE}/marketplace/referrals/order/{first['track_token']}", timeout=30).json() == {"on": False}

    r = requests.put(f"{BASE}/marketplace/businesses/{shop['biz']}/referrals", json={
        "on": True, "friend_kind": "percent", "friend_value": 10, "reward_kind": "amount", "reward_value": 25},
        headers=_auth(shop["owner"]), timeout=30)
    assert r.status_code == 200, r.text
    link = requests.get(f"{BASE}/marketplace/referrals/order/{first['track_token']}", timeout=30).json()
    assert link["on"] and link["code"].startswith("NOA-") and f"ref={link['code']}" in link["url"]
    # Same person, same code.
    assert requests.get(f"{BASE}/marketplace/referrals/order/{first['track_token']}", timeout=30).json()["code"] == link["code"]

    own = _order(shop, "0541110001", "Noa Levi", code=link["code"])
    assert own.status_code == 400                                           # own code
    friend = _order(shop, "0541110002", "Dan", code=link["code"])
    assert friend.status_code == 200, friend.text
    assert friend.json()["total"] == 90
    again = _order(shop, "0541110002", "Dan", code=link["code"])
    assert again.status_code == 400                                         # not a first order now

    link = requests.get(f"{BASE}/marketplace/referrals/order/{first['track_token']}", timeout=30).json()
    assert link["friends"] == 1 and len(link["rewards"]) == 1
    thanks = link["rewards"][0]
    assert thanks["code"].startswith("THANKS-") and thanks["value"] == 25 and not thanks["used"]
    used = _order(shop, "0541110001", "Noa Levi", code=thanks["code"])
    assert used.status_code == 200 and used.json()["total"] == 75
    assert _order(shop, "0541110003", "Someone", code=thanks["code"]).status_code == 400   # one use

    codes = requests.get(f"{BASE}/marketplace/businesses/{shop['biz']}/discount-codes", headers=_auth(shop["owner"]), timeout=30).json()
    assert all(not c["code"].startswith("THANKS-") for c in codes)
    s = requests.get(f"{BASE}/marketplace/businesses/{shop['biz']}/referrals", headers=_auth(shop["owner"]), timeout=30).json()
    assert s["friends"] == 1 and s["senders"] == 1

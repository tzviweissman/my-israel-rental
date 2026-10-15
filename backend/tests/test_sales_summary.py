"""A business's sales summary (routes/marketplace/sales_summary.py):
orders, memberships, door visits and discounts counted from the business's
own records; owner-only.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, date, datetime, timedelta

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


def test_summary_counts_orders_members_visits_and_discounts():
    owner = _owner("summary")
    requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_summary studio"}, headers=_auth(owner), timeout=30)
    g = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_summary shop", "description": "for the summary", "category": "shops-products", "area": "Jerusalem",
        "gig_type": "store", "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567", "gallery": [],
        "products": [{"name": "Mat", "price": 100, "currency": "ILS", "images": ["https://example.com/m.jpg"]}],
    }, headers=_auth(owner), timeout=30)
    assert g.status_code in (200, 201), g.text
    gid = g.json()["id"]
    form = requests.get(f"{BASE}/marketplace/order-form/{gid}", timeout=30).json()
    biz, prod = form["business"]["id"], form["products"][0]["id"]
    requests.post(f"{BASE}/marketplace/businesses/{biz}/discount-codes", json={"code": "TEN", "kind": "percent", "value": 10},
                  headers=_auth(owner), timeout=30)
    day = (date.today() + timedelta(days=3)).isoformat()
    for phone, code in (("0541230001", "TEN"), ("0541230002", None)):
        r = requests.post(f"{BASE}/marketplace/order-form/{gid}/orders", json={
            "lines": [{"product_id": prod, "qty": 1}], "fulfilment": "pickup", "date": day,
            "customer_name": "Buyer", "customer_phone": phone, "discount_code": code}, timeout=30)
        assert r.status_code == 200, r.text

    monthly = requests.post(f"{BASE}/marketplace/businesses/{biz}/membership-plans", json={"name": "Monthly", "price": 200},
                            headers=_auth(owner), timeout=30).json()
    yearly = requests.post(f"{BASE}/marketplace/businesses/{biz}/membership-plans", json={"name": "Yearly", "price": 1200, "period": "year"},
                           headers=_auth(owner), timeout=30).json()
    a = requests.post(f"{BASE}/marketplace/businesses/{biz}/members", json={"plan_id": monthly["id"], "name": "Ana", "phone": "0541230001"},
                      headers=_auth(owner), timeout=30).json()
    requests.post(f"{BASE}/marketplace/businesses/{biz}/members", json={"plan_id": yearly["id"], "name": "Ben", "phone": "0541230003"},
                  headers=_auth(owner), timeout=30)
    requests.post(f"{BASE}/marketplace/memberships/plan/{monthly['id']}/join", json={"name": "Cal", "phone": "0541230004"}, timeout=30)
    for _ in range(2):
        requests.post(f"{BASE}/marketplace/businesses/{biz}/members/{a['id']}/checkin", headers=_auth(owner), timeout=30)

    r = requests.get(f"{BASE}/marketplace/businesses/{biz}/summary", params={"days": 30}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["orders"]["orders"] == 2 and s["orders"]["revenue"] == 190
    m = s["memberships"]
    assert m["joined"] == 3 and m["active"] == 2 and m["waiting_payment"] == 1
    assert m["monthly_value"] == 300                     # 200 a month + 1200 a year / 12
    assert s["visits"]["count"] == 2 and sum(s["visits"]["weekdays"]) == 2
    assert s["discounts"]["orders"] == 1 and s["discounts"]["orders_amount"] == 10
    assert s["discounts"]["top_codes"] == [{"code": "TEN", "uses": 1}]
    # Ana ordered and joined: one person. Buyer 2, Ben and Cal: four in all, all new.
    assert s["customers"]["in_period"] == 4 and s["customers"]["new"] == 4

    stranger = _owner("summary-stranger")
    assert requests.get(f"{BASE}/marketplace/businesses/{biz}/summary", headers=_auth(stranger), timeout=30).status_code == 403

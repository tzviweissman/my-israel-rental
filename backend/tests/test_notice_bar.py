"""The notice bar (businesses.py Notice): stored with its dates, served on
the business page and the order form, cleared with null, refused when it
ends before it starts or runs past one line.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_notice_bar():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    owner = requests.post(f"{BASE}/auth/register", json={
        "email": f"notice-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": "Notice owner", "role": "owner"}, timeout=30).json()["token"]
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST_notice {stamp}"}, headers=_auth(owner), timeout=30).json()
    url = f"{BASE}/marketplace/businesses/{biz['id']}"
    gig = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_notice shop", "description": "for the notice", "category": "shops-products", "area": "Jerusalem",
        "gig_type": "store", "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567", "gallery": [],
        "products": [{"name": "Cake", "price": 100, "currency": "ILS", "images": ["https://example.com/c.jpg"]}],
    }, headers=_auth(owner), timeout=30).json()

    n = {"text": "  Closed for Sukkot  ", "starts_on": "2026-10-01", "ends_on": "2026-10-20"}
    assert requests.patch(url, json={"notice": n}, headers=_auth(owner), timeout=30).status_code == 200
    page = requests.get(f"{BASE}/marketplace/business/{biz['slug']}", headers=_auth(owner), timeout=30).json()
    assert page["notice"] == {"text": "Closed for Sukkot", "starts_on": "2026-10-01", "ends_on": "2026-10-20"}
    form = requests.get(f"{BASE}/marketplace/order-form/{gig['id']}", timeout=30).json()
    assert form["business"]["notice"]["text"] == "Closed for Sukkot"

    bad = {"text": "x", "starts_on": "2026-10-20", "ends_on": "2026-10-01"}
    assert requests.patch(url, json={"notice": bad}, headers=_auth(owner), timeout=30).status_code == 422
    assert requests.patch(url, json={"notice": {"text": "x" * 141}}, headers=_auth(owner), timeout=30).status_code == 422

    assert requests.patch(url, json={"notice": None}, headers=_auth(owner), timeout=30).status_code == 200
    assert requests.get(f"{BASE}/marketplace/business/{biz['slug']}", headers=_auth(owner), timeout=30).json()["notice"] is None

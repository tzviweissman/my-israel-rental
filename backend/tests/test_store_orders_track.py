"""Store orders, phase 4 (spec O7): the customer's status link.

  * every order has a token from creation, and orders from before get
    one the first time the owner lists them;
  * the link shows the step, the items and the time, and NOT the phone,
    the history, the courier's details or anything else on the record;
  * a bad token is a 404.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"track-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": "Track Owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def business(owner):
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_track bakery"},
                      headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def test_track_link_shows_step_and_nothing_private(owner, business):
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/orders", json={
        "customer_name": "Track Me", "customer_phone": "054-1234567", "items": "2 challahs",
        "needed_by": "2031-06-06T12:00", "fulfilment": "delivery", "address": "Hapalmach 14", "total": 50,
        "notes": "owner-only note",
    }, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    o = r.json()
    assert len(o["track_token"]) >= 16

    t = requests.get(f"{BASE}/marketplace/orders/track/{o['track_token']}", timeout=30)
    assert t.status_code == 200, t.text
    body = t.json()
    assert body["business"]["name"] == "TEST_track bakery"
    assert body["status"] == "new"
    assert body["items"] == "2 challahs"
    assert body["address"] == "Hapalmach 14"
    assert body["out_for_delivery"] is False
    for private in ("customer_phone", "customer_phone_e164", "history", "phone_reveals", "courier", "notes", "track_token"):
        assert private not in body, private

    for s in ("preparing", "ready"):
        requests.patch(f"{BASE}/marketplace/orders/{o['id']}/status", json={"status": s}, headers=_auth(owner), timeout=30)
    body = requests.get(f"{BASE}/marketplace/orders/track/{o['track_token']}", timeout=30).json()
    assert body["status"] == "ready"
    # Ready but nobody assigned: not "out for delivery" yet.
    assert body["out_for_delivery"] is False


def test_bad_track_token_404():
    assert requests.get(f"{BASE}/marketplace/orders/track/short", timeout=30).status_code == 404
    assert requests.get(f"{BASE}/marketplace/orders/track/{'C' * 22}", timeout=30).status_code == 404

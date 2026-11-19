"""The business's photo of an order being made (18 Nov 2026).

POST /marketplace/orders/{id}/making-photo keeps the photo on the order and
shows it on the customer's tracking page; the WhatsApp copy waits for its
template. What can go wrong: a stranger adding a photo to someone else's
order, a photo from anywhere (the tracking page is public and the message
goes out under our name), and a photo on an order already closed.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
PHOTO = "https://res.cloudinary.com/demo/image/upload/v1/making.jpg"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"making-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Making {tag}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner():
    return _account("owner")


@pytest.fixture(scope="module")
def business(owner):
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_making bakery"},
                      headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _order(owner, business):
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/orders", json={
        "customer_name": "Idan Cohen", "customer_phone": "054-1234567", "items": "2 challahs",
        "needed_by": "2031-06-06T12:00", "fulfilment": "pickup", "total": 40,
    }, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _send(token, order_id, url):
    return requests.post(f"{BASE}/marketplace/orders/{order_id}/making-photo", json={"photo_url": url},
                         headers=_auth(token), timeout=30)


def _track(owner, business, order_id):
    full = requests.get(f"{BASE}/marketplace/businesses/{business}/orders",
                        params={"from": "2031-06-06", "to": "2031-06-06"}, headers=_auth(owner), timeout=30).json()
    rec = next(x for x in full["orders"] if x["id"] == order_id)
    return requests.get(f"{BASE}/marketplace/orders/track/{rec['track_token']}", timeout=30).json()


def test_photo_shows_on_the_tracking_page(owner, business):
    o = _order(owner, business)
    r = _send(owner, o["id"], PHOTO)
    assert r.status_code == 200, r.text
    assert r.json()["making_photo"]["url"] == PHOTO
    assert _track(owner, business, o["id"])["making_photo_url"] == PHOTO


def test_the_owners_line_shows_with_it(owner, business):
    o = _order(owner, business)
    r = requests.post(f"{BASE}/marketplace/orders/{o['id']}/making-photo",
                      json={"photo_url": PHOTO, "note": "  Fresh out of the oven  "}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    assert _track(owner, business, o["id"])["making_photo_note"] == "Fresh out of the oven"
    too_long = requests.post(f"{BASE}/marketplace/orders/{o['id']}/making-photo",
                             json={"photo_url": PHOTO, "note": "x" * 121}, headers=_auth(owner), timeout=30)
    assert too_long.status_code == 422


def test_only_a_photo_we_host(owner, business):
    o = _order(owner, business)
    for bad in ("https://evil.example.com/a.jpg", "javascript:alert(1)", ""):
        assert _send(owner, o["id"], bad).status_code == 422, bad


def test_not_someone_elses_order(owner, business):
    o = _order(owner, business)
    assert _send(_account("stranger"), o["id"], PHOTO).status_code == 403


def test_not_on_a_closed_order(owner, business):
    o = _order(owner, business)
    r = requests.patch(f"{BASE}/marketplace/orders/{o['id']}/status", json={"status": "cancelled"},
                       headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    assert _send(owner, o["id"], PHOTO).status_code == 400


def test_the_customer_can_like_the_photo(owner, business):
    o = _order(owner, business)
    full = requests.get(f"{BASE}/marketplace/businesses/{business}/orders",
                        params={"from": "2031-06-06", "to": "2031-06-06"}, headers=_auth(owner), timeout=30).json()
    tok = next(x for x in full["orders"] if x["id"] == o["id"])["track_token"]
    like = f"{BASE}/marketplace/orders/track/{tok}/making-photo/like"
    assert requests.post(like, timeout=30).status_code == 404  # no photo yet
    assert _send(owner, o["id"], PHOTO).status_code == 200
    assert requests.post(like, timeout=30).status_code == 200
    assert requests.post(like, timeout=30).status_code == 200  # twice is fine
    assert _track(owner, business, o["id"])["making_photo_liked"] is True
    assert requests.post(f"{BASE}/marketplace/orders/track/not-a-real-token-123/making-photo/like", timeout=30).status_code == 404
    # A new photo starts fresh.
    assert _send(owner, o["id"], PHOTO).status_code == 200
    assert _track(owner, business, o["id"])["making_photo_liked"] is False

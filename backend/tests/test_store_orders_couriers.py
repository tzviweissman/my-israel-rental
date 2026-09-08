"""Store orders: couriers as accounts, automatic assignment, the door.

Revised 2026-09-08 (Tzvi): couriers are people with accounts, invited
by email; no capability links, no texts.

  * an invite by email reaches an existing account, and one that has not
    signed up yet is held until it does;
  * the courier sees the invite, accepts, and becomes the default courier
    if the business had none;
  * from then on every delivery goes to them automatically the moment it
    exists - typed by the owner or ordered on the site - and the owner can
    move it to another accepted courier, never to one who has not accepted;
  * their Deliveries feed shows only their stops, with the customer's phone
    only while `ready`, and every reveal written on the order;
  * delivered needs a photo, failed needs a reason; cash needs an amount;
  * removing a courier unassigns their open deliveries.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _account(tag, role="owner"):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    email = f"courier-{tag}-{stamp}@example.com"
    r = requests.post(f"{BASE}/auth/register", json={
        "email": email, "password": f"Pw-{stamp}-ok1", "name": f"Courier {tag}", "role": role,
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"], email


@pytest.fixture(scope="module")
def owner():
    return _account("owner")[0]


@pytest.fixture(scope="module")
def courier_acct():
    return _account("yossi", role="renter")


@pytest.fixture(scope="module")
def business(owner):
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_courier bakery"},
                      headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _delivery(token, biz, **over):
    body = {
        "customer_name": "Idan Cohen", "customer_phone": "054-1234567", "items": "2 challahs",
        "needed_by": "2031-05-05T12:00", "fulfilment": "delivery", "address": "Hapalmach 14", "total": 85,
    }
    body.update(over)
    r = requests.post(f"{BASE}/marketplace/businesses/{biz}/orders", json=body, headers=_auth(token), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _status(token, order_id, status):
    return requests.patch(f"{BASE}/marketplace/orders/{order_id}/status", json={"status": status},
                          headers=_auth(token), timeout=30)


def _feed(token):
    return requests.get(f"{BASE}/marketplace/courier/deliveries", headers=_auth(token), timeout=30)


# ---------------------------------------------------------------------------
# invite and accept
# ---------------------------------------------------------------------------

def test_invite_needs_an_email_and_not_yourself(owner, business):
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/couriers/invite", json={"email": "nope"},
                      headers=_auth(owner), timeout=30)
    assert r.status_code == 422


def test_invite_existing_account_then_accept(owner, business, courier_acct):
    ctoken, cemail = courier_acct
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/couriers/invite", json={"email": cemail.upper()},
                      headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "invited"
    assert r.json()["user_id"]

    me = requests.get(f"{BASE}/marketplace/courier/me", headers=_auth(ctoken), timeout=30).json()
    assert [i["business_id"] for i in me["invites"]] == [business]
    assert me["businesses"] == []
    # Nothing to deliver while only invited: the feed is empty, not an error.
    assert _feed(ctoken).json()["stops"] == []

    r = requests.post(f"{BASE}/marketplace/courier/invites/{business}/accept", headers=_auth(ctoken), timeout=30)
    assert r.status_code == 200, r.text
    me = requests.get(f"{BASE}/marketplace/courier/me", headers=_auth(ctoken), timeout=30).json()
    assert [b["business_id"] for b in me["businesses"]] == [business]
    assert me["invites"] == []
    # First to accept becomes the default.
    st = requests.get(f"{BASE}/marketplace/businesses/{business}/orders/settings", headers=_auth(owner), timeout=30).json()
    lst = requests.get(f"{BASE}/marketplace/businesses/{business}/couriers", headers=_auth(owner), timeout=30).json()
    assert lst[0]["status"] == "active"
    assert st["default_courier_user_id"] == lst[0]["user_id"]


def test_invite_unknown_email_is_held(owner, business):
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/couriers/invite", json={"email": "not-yet@example.com"},
                      headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["user_id"] is None and r.json()["status"] == "invited"
    # Same email twice is refused.
    assert requests.post(f"{BASE}/marketplace/businesses/{business}/couriers/invite", json={"email": "not-yet@example.com"},
                         headers=_auth(owner), timeout=30).status_code == 400
    assert requests.delete(f"{BASE}/marketplace/businesses/{business}/couriers/not-yet@example.com",
                           headers=_auth(owner), timeout=30).status_code == 200


# ---------------------------------------------------------------------------
# automatic assignment
# ---------------------------------------------------------------------------

def test_delivery_goes_to_default_courier_automatically(owner, business, courier_acct):
    ctoken, _ = courier_acct
    o = _delivery(owner, business, customer_name="Auto Assigned")
    assert o["courier"] and o["courier"]["user_id"]
    assert o["history"][-1]["event"] == "assigned" and o["history"][-1]["automatic"] is True
    pickup = _delivery(owner, business, customer_name="Pickup", fulfilment="pickup", address=None)
    assert pickup["courier"] is None
    ids = [s["id"] for s in _feed(ctoken).json()["stops"]]
    assert o["id"] in ids and pickup["id"] not in ids


def test_owner_can_move_or_unassign_but_not_to_an_unaccepted_courier(owner, business, courier_acct):
    ctoken, _ = courier_acct
    o = _delivery(owner, business, customer_name="Move Me")
    r = requests.patch(f"{BASE}/marketplace/orders/{o['id']}/assign", json={"courier_user_id": None}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200 and r.json()["order"]["courier"] is None
    assert o["id"] not in [s["id"] for s in _feed(ctoken).json()["stops"]]
    assert requests.patch(f"{BASE}/marketplace/orders/{o['id']}/assign", json={"courier_user_id": "nobody"},
                          headers=_auth(owner), timeout=30).status_code == 404
    me = requests.get(f"{BASE}/marketplace/courier/me", headers=_auth(ctoken), timeout=30)
    lst = requests.get(f"{BASE}/marketplace/businesses/{business}/couriers", headers=_auth(owner), timeout=30).json()
    r = requests.patch(f"{BASE}/marketplace/orders/{o['id']}/assign", json={"courier_user_id": lst[0]["user_id"]},
                       headers=_auth(owner), timeout=30)
    assert r.status_code == 200 and r.json()["order"]["courier"]["user_id"] == lst[0]["user_id"]


# ---------------------------------------------------------------------------
# the feed and the phone rule
# ---------------------------------------------------------------------------

def test_feed_reveals_phone_only_when_ready(owner, business, courier_acct):
    ctoken, _ = courier_acct
    o = _delivery(owner, business, customer_name="Phone Rule")
    stop = next(s for s in _feed(ctoken).json()["stops"] if s["id"] == o["id"])
    assert "customer_phone" not in stop and "history" not in stop
    assert stop["business"]["name"] == "TEST_courier bakery"
    _status(owner, o["id"], "preparing")
    _status(owner, o["id"], "ready")
    stop = next(s for s in _feed(ctoken).json()["stops"] if s["id"] == o["id"])
    assert stop["customer_phone_e164"] == "972541234567"
    _feed(ctoken)
    full = requests.get(f"{BASE}/marketplace/businesses/{business}/orders",
                        params={"from": "2031-05-05", "to": "2031-05-05"}, headers=_auth(owner), timeout=30).json()
    rec = next(x for x in full["orders"] if x["id"] == o["id"])
    assert len(rec["phone_reveals"]) == 1


def test_other_account_sees_nothing(business, owner):
    other, _ = _account("other", role="renter")
    assert _feed(other).json()["stops"] == []
    assert requests.get(f"{BASE}/marketplace/courier/me", headers=_auth(other), timeout=30).json()["businesses"] == []


# ---------------------------------------------------------------------------
# at the door
# ---------------------------------------------------------------------------

def test_delivered_needs_ready_and_photo_and_records_cash(owner, business, courier_acct):
    ctoken, _ = courier_acct
    o = _delivery(owner, business, customer_name="Door Test", total=120)
    url = f"{BASE}/marketplace/courier/deliveries/{o['id']}/status"
    assert requests.patch(url, json={"status": "done", "photo_url": "https://example.com/p.jpg"}, headers=_auth(ctoken), timeout=30).status_code == 409
    _status(owner, o["id"], "preparing")
    _status(owner, o["id"], "ready")
    assert requests.patch(url, json={"status": "done"}, headers=_auth(ctoken), timeout=30).status_code == 400
    assert requests.patch(url, json={"status": "done", "photo_url": "https://example.com/p.jpg", "payment": {"method": "cash"}},
                          headers=_auth(ctoken), timeout=30).status_code == 400
    r = requests.patch(url, json={"status": "done", "photo_url": "https://example.com/p.jpg", "payment": {"method": "cash", "amount": 120}},
                       headers=_auth(ctoken), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "done" and r.json()["delivery"]["photo_url"] == "https://example.com/p.jpg"
    assert r.json()["payment"]["amount"] == 120
    assert "customer_phone" not in r.json()
    # The customer's status link now carries the photo.
    full = requests.get(f"{BASE}/marketplace/businesses/{business}/orders",
                        params={"from": "2031-05-05", "to": "2031-05-05"}, headers=_auth(owner), timeout=30).json()
    rec = next(x for x in full["orders"] if x["id"] == o["id"])
    tr = requests.get(f"{BASE}/marketplace/orders/track/{rec['track_token']}", timeout=30).json()
    assert tr["delivered_photo_url"] == "https://example.com/p.jpg"


def test_failed_needs_reason(owner, business, courier_acct):
    ctoken, _ = courier_acct
    o = _delivery(owner, business, customer_name="Fail Test")
    _status(owner, o["id"], "preparing")
    _status(owner, o["id"], "ready")
    url = f"{BASE}/marketplace/courier/deliveries/{o['id']}/status"
    assert requests.patch(url, json={"status": "failed"}, headers=_auth(ctoken), timeout=30).status_code == 400
    r = requests.patch(url, json={"status": "failed", "reason": "nobody_home"}, headers=_auth(ctoken), timeout=30)
    assert r.status_code == 200 and r.json()["delivery"]["failed_reason"] == "nobody_home"


def test_owner_payment_record(owner, business):
    o = _delivery(owner, business, fulfilment="pickup", address=None, total=40)
    r = requests.patch(f"{BASE}/marketplace/orders/{o['id']}/payment", json={"method": "bit", "amount": 40}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200 and r.json()["payment"]["method"] == "bit"


# ---------------------------------------------------------------------------
# removal
# ---------------------------------------------------------------------------

def test_removing_courier_unassigns_open_orders(owner, business, courier_acct):
    ctoken, _ = courier_acct
    o = _delivery(owner, business, customer_name="Reassign Me")
    assert o["courier"]
    lst = requests.get(f"{BASE}/marketplace/businesses/{business}/couriers", headers=_auth(owner), timeout=30).json()
    r = requests.delete(f"{BASE}/marketplace/businesses/{business}/couriers/{lst[0]['user_id']}", headers=_auth(owner), timeout=30)
    assert r.status_code == 200
    assert _feed(ctoken).json()["stops"] == []
    full = requests.get(f"{BASE}/marketplace/businesses/{business}/orders",
                        params={"from": "2031-05-05", "to": "2031-05-05"}, headers=_auth(owner), timeout=30).json()
    rec = next(x for x in full["orders"] if x["id"] == o["id"])
    assert rec["courier"] is None
    st = requests.get(f"{BASE}/marketplace/businesses/{business}/orders/settings", headers=_auth(owner), timeout=30).json()
    assert st["default_courier_user_id"] is None

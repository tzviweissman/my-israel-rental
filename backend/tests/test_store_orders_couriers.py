"""Store orders, phase 3 (spec O5 + O6): couriers, the run sheet, money.

  * a courier is added by phone, and a phone that cannot be normalised
    is refused - a courier we cannot reach is not one we can hand an
    order to;
  * only a DELIVERY order is assigned, only while open, only to one of
    the business's own couriers; assigning returns the run-sheet link;
  * the run sheet shows the courier only their own stops, and the
    customer's phone ONLY while the order is `ready` - not before, not
    after - and every reveal is written on the order;
  * delivered needs a photo, failed needs a reason, and both are refused
    before the order is `ready`;
  * cash collected at the door needs an amount and lands on the order as
    the store's reconciliation record;
  * removing a courier kills their link and unassigns their open orders.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"courier-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Courier {tag}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner():
    return _account("owner")


@pytest.fixture(scope="module")
def business(owner):
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_courier bakery"},
                      headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


@pytest.fixture(scope="module")
def courier(owner, business):
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/couriers",
                      json={"name": "Yossi Scooter", "phone": "058-1112233"}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["phone_e164"] == "972581112233"
    assert len(c["token"]) >= 24
    return c


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


def _assign(token, order_id, courier_id):
    return requests.patch(f"{BASE}/marketplace/orders/{order_id}/assign", json={"courier_id": courier_id},
                          headers=_auth(token), timeout=30)


def _sheet(courier_token):
    return requests.get(f"{BASE}/marketplace/orders/courier/{courier_token}", timeout=30)


# ---------------------------------------------------------------------------
# the trusted list
# ---------------------------------------------------------------------------

def test_courier_needs_a_real_phone(owner, business):
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/couriers",
                      json={"name": "Nobody", "phone": "12345678"}, headers=_auth(owner), timeout=30)
    assert r.status_code == 400


def test_same_phone_updates_not_duplicates(owner, business, courier):
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/couriers",
                      json={"name": "Yossi S.", "phone": "+972581112233"}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200
    assert r.json()["id"] == courier["id"]
    lst = requests.get(f"{BASE}/marketplace/businesses/{business}/couriers", headers=_auth(owner), timeout=30).json()
    assert [c["id"] for c in lst].count(courier["id"]) == 1
    assert lst[0]["token"] == courier["token"]      # a rename keeps the link


def test_stranger_sees_no_couriers(business):
    other = _account("stranger")
    assert requests.get(f"{BASE}/marketplace/businesses/{business}/couriers", headers=_auth(other), timeout=30).status_code == 403


# ---------------------------------------------------------------------------
# assignment
# ---------------------------------------------------------------------------

def test_assign_only_delivery_only_open_only_own_courier(owner, business, courier):
    pickup = _delivery(owner, business, fulfilment="pickup", address=None)
    assert _assign(owner, pickup["id"], courier["id"]).status_code == 400

    o = _delivery(owner, business)
    assert _assign(owner, o["id"], "not-a-courier").status_code == 404

    r = _assign(owner, o["id"], courier["id"])
    assert r.status_code == 200, r.text
    body = r.json()
    # The rename test may or may not have run first (pytest -k), so
    # either name is right; the id is what matters.
    assert body["order"]["courier"]["id"] == courier["id"]
    assert body["order"]["courier"]["name"] in ("Yossi S.", "Yossi Scooter")
    assert body["runsheet_url"].endswith(f"/orders/courier/{courier['token']}")
    assert body["sms_sent"] is False                  # no TWILIO_SMS_FROM locally
    assert body["order"]["history"][-1]["event"] == "assigned"

    # Unassign.
    r = _assign(owner, o["id"], None)
    assert r.json()["order"]["courier"] is None

    _status(owner, o["id"], "cancelled")
    assert _assign(owner, o["id"], courier["id"]).status_code == 409


# ---------------------------------------------------------------------------
# the run sheet and the phone rule
# ---------------------------------------------------------------------------

def test_runsheet_shows_own_stops_and_phone_only_when_ready(owner, business, courier):
    mine = _delivery(owner, business, customer_name="Sheet Mine")
    other = _delivery(owner, business, customer_name="Sheet Other")
    _assign(owner, mine["id"], courier["id"])

    s = _sheet(courier["token"])
    assert s.status_code == 200, s.text
    body = s.json()
    assert body["business"]["name"] == "TEST_courier bakery"
    assert body["courier"]["name"] == "Yossi S."
    ids = [x["id"] for x in body["stops"]]
    assert mine["id"] in ids and other["id"] not in ids
    stop = next(x for x in body["stops"] if x["id"] == mine["id"])
    # Not ready yet: no phone, and nothing a courier has no business seeing.
    assert "customer_phone" not in stop
    assert "history" not in stop and "phone_reveals" not in stop

    _status(owner, mine["id"], "preparing")
    _status(owner, mine["id"], "ready")
    stop = next(x for x in _sheet(courier["token"]).json()["stops"] if x["id"] == mine["id"])
    assert stop["customer_phone"] == "054-1234567"
    assert stop["customer_phone_e164"] == "972541234567"

    # The reveal is on the record, once, however many times the sheet loads.
    _sheet(courier["token"])
    full = requests.get(f"{BASE}/marketplace/businesses/{business}/orders",
                        params={"from": "2031-05-05", "to": "2031-05-05"}, headers=_auth(owner), timeout=30).json()
    rec = next(x for x in full["orders"] if x["id"] == mine["id"])
    assert len(rec["phone_reveals"]) == 1
    assert rec["phone_reveals"][0]["courier_id"] == courier["id"]


def test_bad_courier_link_is_404(courier):
    assert _sheet("short").status_code == 404
    assert _sheet("B" * len(courier["token"])).status_code == 404


# ---------------------------------------------------------------------------
# at the door
# ---------------------------------------------------------------------------

def test_delivered_needs_ready_and_photo_and_records_cash(owner, business, courier):
    o = _delivery(owner, business, customer_name="Door Test", total=120)
    _assign(owner, o["id"], courier["id"])
    url = f"{BASE}/marketplace/orders/courier/{courier['token']}/{o['id']}/status"

    # Not ready yet.
    assert requests.patch(url, json={"status": "done", "photo_url": "https://example.com/p.jpg"}, timeout=30).status_code == 409
    _status(owner, o["id"], "preparing")
    _status(owner, o["id"], "ready")
    # Ready, but no photo.
    assert requests.patch(url, json={"status": "done"}, timeout=30).status_code == 400
    # Cash without an amount.
    r = requests.patch(url, json={"status": "done", "photo_url": "https://example.com/p.jpg",
                                  "payment": {"method": "cash"}}, timeout=30)
    assert r.status_code == 400
    r = requests.patch(url, json={"status": "done", "photo_url": "https://example.com/p.jpg",
                                  "payment": {"method": "cash", "amount": 120}}, timeout=30)
    assert r.status_code == 200, r.text
    stop = r.json()
    assert stop["status"] == "done"
    assert stop["delivery"]["photo_url"] == "https://example.com/p.jpg"
    assert stop["payment"]["method"] == "cash" and stop["payment"]["amount"] == 120
    assert stop["payment"]["by"] == f"courier:{courier['id']}"
    assert "customer_phone" not in stop                # gone once done

    # The owner sees the same on the record, with the courier in history.
    full = requests.get(f"{BASE}/marketplace/businesses/{business}/orders",
                        params={"from": "2031-05-05", "to": "2031-05-05"}, headers=_auth(owner), timeout=30).json()
    rec = next(x for x in full["orders"] if x["id"] == o["id"])
    assert rec["history"][-1]["by"] == f"courier:{courier['id']}"
    assert rec["delivery"]["by"] == "Yossi S."


def test_failed_needs_reason(owner, business, courier):
    o = _delivery(owner, business, customer_name="Fail Test")
    _assign(owner, o["id"], courier["id"])
    _status(owner, o["id"], "preparing")
    _status(owner, o["id"], "ready")
    url = f"{BASE}/marketplace/orders/courier/{courier['token']}/{o['id']}/status"
    assert requests.patch(url, json={"status": "failed"}, timeout=30).status_code == 400
    r = requests.patch(url, json={"status": "failed", "reason": "nobody_home", "note": "rang twice"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "failed"
    assert r.json()["delivery"]["failed_reason"] == "nobody_home"


def test_courier_cannot_touch_unassigned_order(owner, business, courier):
    o = _delivery(owner, business, customer_name="Not Mine")
    _status(owner, o["id"], "preparing")
    _status(owner, o["id"], "ready")
    url = f"{BASE}/marketplace/orders/courier/{courier['token']}/{o['id']}/status"
    assert requests.patch(url, json={"status": "done", "photo_url": "https://example.com/p.jpg"}, timeout=30).status_code == 404


def test_owner_payment_record(owner, business):
    o = _delivery(owner, business, fulfilment="pickup", address=None, total=40)
    r = requests.patch(f"{BASE}/marketplace/orders/{o['id']}/payment", json={"method": "bit", "amount": 40},
                       headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["payment"]["method"] == "bit"
    r = requests.patch(f"{BASE}/marketplace/orders/{o['id']}/payment", json={"method": None},
                       headers=_auth(owner), timeout=30)
    assert r.json()["payment"] is None


# ---------------------------------------------------------------------------
# removal
# ---------------------------------------------------------------------------

def test_removing_courier_unassigns_open_orders_and_kills_link(owner, business):
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/couriers",
                      json={"name": "Temp Courier", "phone": "052-7776655"}, headers=_auth(owner), timeout=30)
    temp = r.json()
    o = _delivery(owner, business, customer_name="Reassign Me")
    _assign(owner, o["id"], temp["id"])
    r = requests.delete(f"{BASE}/marketplace/businesses/{business}/couriers/{temp['id']}", headers=_auth(owner), timeout=30)
    assert r.status_code == 200
    assert _sheet(temp["token"]).status_code == 404
    full = requests.get(f"{BASE}/marketplace/businesses/{business}/orders",
                        params={"from": "2031-05-05", "to": "2031-05-05"}, headers=_auth(owner), timeout=30).json()
    rec = next(x for x in full["orders"] if x["id"] == o["id"])
    assert rec["courier"] is None

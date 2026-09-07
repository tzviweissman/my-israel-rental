"""Store orders — phase 1 of docs/orders-and-delivery-spec.md.

What has to hold:

  * an order is created with the minimum the sheet had, and comes back
    soonest-first with counters that match the rows;
  * a delivery order without an address or phone is refused at entry,
    not discovered at the door;
  * the status machine is ENFORCED — forward, one step back, the two
    exits, and nothing else. `failed` exists only for a delivery. This is
    the rule `marketplace_bookings` never had;
  * a closed order cannot be edited, and a status cannot be smuggled in
    through the field-edit endpoint;
  * another owner sees 403 on every path — orders are the most private
    thing a business has on the site (customer names, phones, addresses);
  * returning customers are derived from the business's own orders and
    matched on a prefix of the name or the digits of the phone;
  * the paste extractor's parser only lets through values the create
    endpoint would accept (pure, no model call).

The HTTP tests run against the live local API (backend/tests/.env.test);
the parser and transition tests run in-process.
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
        "email": f"orders-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Orders {tag}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner():
    return _account("owner")


@pytest.fixture(scope="module")
def stranger():
    return _account("stranger")


@pytest.fixture(scope="module")
def business(owner):
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_orders bakery"},
                      headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _order(token, biz, **over):
    body = {
        "customer_name": "Idan Cohen",
        "customer_phone": "054-1234567",
        "items": "2 challahs\n1 chocolate babka",
        "needed_by": "2030-01-04T12:00",
        "fulfilment": "pickup",
    }
    body.update(over)
    return requests.post(f"{BASE}/marketplace/businesses/{biz}/orders", json=body,
                         headers=_auth(token), timeout=30)


def _status(token, order_id, status, note=""):
    return requests.patch(f"{BASE}/marketplace/orders/{order_id}/status",
                          json={"status": status, "note": note}, headers=_auth(token), timeout=30)


# ---------------------------------------------------------------------------
# create + list
# ---------------------------------------------------------------------------

def test_create_and_list_soonest_first(owner, business):
    late = _order(owner, business, needed_by="2030-01-05T09:00", customer_name="Late").json()
    early = _order(owner, business, needed_by="2030-01-03", customer_name="Early").json()
    assert early["status"] == "new"
    assert early["customer_phone_e164"] == "972541234567"
    assert early["currency"] == "ILS"
    assert early["total"] is None
    assert "owner_user_id" not in early

    r = requests.get(f"{BASE}/marketplace/businesses/{business}/orders",
                     params={"from": "2030-01-03", "to": "2030-01-05"},
                     headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    ids = [o["id"] for o in body["orders"]]
    assert ids.index(early["id"]) < ids.index(late["id"])
    assert body["status_counts"]["new"] >= 2
    assert body["total"] == sum(body["status_counts"].values())


def test_date_window_is_inclusive_of_last_day(owner, business):
    o = _order(owner, business, needed_by="2030-02-10T18:30").json()
    r = requests.get(f"{BASE}/marketplace/businesses/{business}/orders",
                     params={"from": "2030-02-10", "to": "2030-02-10"},
                     headers=_auth(owner), timeout=30)
    assert o["id"] in [x["id"] for x in r.json()["orders"]]
    r = requests.get(f"{BASE}/marketplace/businesses/{business}/orders",
                     params={"from": "2030-02-11", "to": "2030-02-11"},
                     headers=_auth(owner), timeout=30)
    assert o["id"] not in [x["id"] for x in r.json()["orders"]]


def test_delivery_needs_address_and_phone(owner, business):
    r = _order(owner, business, fulfilment="delivery", address=None)
    assert r.status_code == 422, r.text
    r = _order(owner, business, fulfilment="delivery", address="Hapalmach 14", customer_phone=None)
    assert r.status_code == 422, r.text
    r = _order(owner, business, fulfilment="delivery", address="Hapalmach 14")
    assert r.status_code == 200, r.text
    assert r.json()["address"] == "Hapalmach 14"


def test_pickup_drops_address(owner, business):
    r = _order(owner, business, fulfilment="pickup", address="should not be kept")
    assert r.json()["address"] is None


def test_bad_needed_by_refused(owner, business):
    assert _order(owner, business, needed_by="Friday").status_code == 422
    assert _order(owner, business, needed_by="2030-02-30").status_code == 422
    assert _order(owner, business, needed_by="2030-02-10T25:00").status_code == 422


# ---------------------------------------------------------------------------
# status machine
# ---------------------------------------------------------------------------

def test_forward_path_and_history(owner, business):
    o = _order(owner, business).json()
    for nxt in ("preparing", "ready", "done"):
        r = _status(owner, o["id"], nxt)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == nxt
    hist = [h["status"] for h in r.json()["history"]]
    assert hist == ["new", "preparing", "ready", "done"]
    # Closed: no further move, and no edits.
    assert _status(owner, o["id"], "preparing").status_code == 409
    assert _status(owner, o["id"], "cancelled").status_code == 409
    r = requests.patch(f"{BASE}/marketplace/orders/{o['id']}", json={"notes": "late edit"},
                       headers=_auth(owner), timeout=30)
    assert r.status_code == 409


def test_cannot_skip_ahead(owner, business):
    o = _order(owner, business).json()
    assert _status(owner, o["id"], "ready").status_code == 409
    assert _status(owner, o["id"], "done").status_code == 409


def test_one_step_back_is_allowed(owner, business):
    o = _order(owner, business).json()
    assert _status(owner, o["id"], "preparing").status_code == 200
    assert _status(owner, o["id"], "new").status_code == 200
    assert _status(owner, o["id"], "preparing").status_code == 200
    assert _status(owner, o["id"], "ready").status_code == 200
    assert _status(owner, o["id"], "preparing").json()["status"] == "preparing"
    # Two steps back is not an undo, it is a rewrite.
    assert _status(owner, o["id"], "ready").status_code == 200
    assert _status(owner, o["id"], "new").status_code == 409


def test_failed_only_from_ready_and_only_for_delivery(owner, business):
    pickup = _order(owner, business).json()
    _status(owner, pickup["id"], "preparing")
    _status(owner, pickup["id"], "ready")
    assert _status(owner, pickup["id"], "failed").status_code == 409

    delivery = _order(owner, business, fulfilment="delivery", address="Hapalmach 14").json()
    assert _status(owner, delivery["id"], "failed").status_code == 409     # from new
    _status(owner, delivery["id"], "preparing")
    assert _status(owner, delivery["id"], "failed").status_code == 409     # from preparing
    _status(owner, delivery["id"], "ready")
    r = _status(owner, delivery["id"], "failed", note="nobody home")
    assert r.status_code == 200, r.text
    assert r.json()["history"][-1]["note"] == "nobody home"


def test_cancel_from_any_open_state(owner, business):
    for steps in ([], ["preparing"], ["preparing", "ready"]):
        o = _order(owner, business).json()
        for s in steps:
            _status(owner, o["id"], s)
        assert _status(owner, o["id"], "cancelled").status_code == 200


def test_status_not_settable_through_edit(owner, business):
    o = _order(owner, business).json()
    r = requests.patch(f"{BASE}/marketplace/orders/{o['id']}", json={"status": "done", "notes": "x"},
                       headers=_auth(owner), timeout=30)
    assert r.status_code == 200
    assert r.json()["status"] == "new"
    assert r.json()["notes"] == "x"


def test_edit_enforces_delivery_rule_and_clear_total(owner, business):
    o = _order(owner, business, total=120).json()
    assert o["total"] == 120
    r = requests.patch(f"{BASE}/marketplace/orders/{o['id']}", json={"fulfilment": "delivery"},
                       headers=_auth(owner), timeout=30)
    assert r.status_code == 400
    r = requests.patch(f"{BASE}/marketplace/orders/{o['id']}",
                       json={"fulfilment": "delivery", "address": "Hapalmach 14", "clear_total": True},
                       headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["address"] == "Hapalmach 14"
    assert r.json()["total"] is None


# ---------------------------------------------------------------------------
# privacy
# ---------------------------------------------------------------------------

def test_stranger_is_locked_out_everywhere(owner, stranger, business):
    o = _order(owner, business).json()
    h = _auth(stranger)
    assert requests.get(f"{BASE}/marketplace/businesses/{business}/orders", headers=h, timeout=30).status_code == 403
    assert _order(stranger, business).status_code == 403
    assert requests.patch(f"{BASE}/marketplace/orders/{o['id']}", json={"notes": "x"}, headers=h, timeout=30).status_code == 403
    assert _status(stranger, o["id"], "preparing").status_code == 403
    assert requests.get(f"{BASE}/marketplace/businesses/{business}/customers", headers=h, timeout=30).status_code == 403
    assert requests.post(f"{BASE}/marketplace/businesses/{business}/orders/extract", json={"text": "hi"},
                         headers=h, timeout=30).status_code == 403
    assert requests.get(f"{BASE}/marketplace/businesses/{business}/orders", timeout=30).status_code in (401, 403)


# ---------------------------------------------------------------------------
# returning customers
# ---------------------------------------------------------------------------

def test_returning_customers_grouped_by_phone(owner, business):
    _order(owner, business, customer_name="Rivka Levi", customer_phone="052-9998877",
           fulfilment="delivery", address="Herzl 3")
    _order(owner, business, customer_name="rivka levi", customer_phone="+972529998877",
           fulfilment="delivery", address="Herzl 3, apt 2")
    r = requests.get(f"{BASE}/marketplace/businesses/{business}/customers", params={"q": "riv"},
                     headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["orders"] == 2
    assert rows[0]["address"] == "Herzl 3, apt 2"    # most recent wins
    r = requests.get(f"{BASE}/marketplace/businesses/{business}/customers", params={"q": "9998"},
                     headers=_auth(owner), timeout=30)
    assert [x["orders"] for x in r.json()] == [2]


# ---------------------------------------------------------------------------
# pure: transitions and the paste parser (no server, no model)
# ---------------------------------------------------------------------------

def test_transition_table():
    from routes.marketplace.orders import can_transition
    assert can_transition("new", "preparing", "pickup")
    assert can_transition("ready", "done", "pickup")
    assert can_transition("ready", "failed", "delivery")
    assert not can_transition("ready", "failed", "pickup")
    assert not can_transition("new", "done", "pickup")
    assert not can_transition("done", "new", "pickup")
    assert not can_transition("cancelled", "preparing", "pickup")
    assert not can_transition("new", "nonsense", "pickup")


def test_parse_extract_only_passes_valid_values():
    from routes.marketplace.orders import parse_extract_response
    raw = """```json
    {"customer_name": " Idan ", "customer_phone": "054-1234567",
     "items": "2 challahs\\n1 babka", "total": 85, "needed_by": "2030-01-04T14:00",
     "fulfilment": "delivery", "address": "Hapalmach 14", "notes": "no nuts",
     "status": "done", "courier_user_id": "x"}
    ```"""
    d = parse_extract_response(raw)
    assert d["customer_name"] == "Idan"
    assert d["total"] == 85.0
    assert d["needed_by"] == "2030-01-04T14:00"
    assert d["fulfilment"] == "delivery"
    assert "status" not in d and "courier_user_id" not in d

    # Bad values are dropped, not passed through.
    d = parse_extract_response('{"needed_by": "Friday", "fulfilment": "drone", "total": "85", "items": ""}')
    assert d == {}
    assert parse_extract_response("not json") == {}
    assert parse_extract_response("[1,2]") == {}
    assert parse_extract_response('{"total": true}') == {}

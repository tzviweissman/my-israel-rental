"""Store orders, phase 2 (spec O3 + O9): the staff link, export, import.

  * the staff link is one capability per business: created once, the
    same token comes back until it is rotated, and rotating kills the
    old one at once;
  * through it the counter can READ the board and MOVE orders, and
    nothing else - no create, no edit, no export, no customers;
  * a token that is short, wrong, or belongs to a hidden business is a
    404, not a 403 (a 403 would confirm a token exists);
  * the export is a CSV with a BOM and one row per order in the window;
  * an imported sheet lands in the autocomplete behind real customers,
    and importing it twice changes nothing.

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
        "email": f"staff-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Staff {tag}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner():
    return _account("owner")


@pytest.fixture(scope="module")
def business(owner):
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_staff bakery"},
                      headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _order(token, biz, **over):
    body = {
        "customer_name": "Idan Cohen", "customer_phone": "054-1234567",
        "items": "2 challahs", "needed_by": "2031-03-05T12:00", "fulfilment": "pickup",
    }
    body.update(over)
    r = requests.post(f"{BASE}/marketplace/businesses/{biz}/orders", json=body, headers=_auth(token), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def staff_token(owner, business):
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/orders/staff-link", headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["created"] is True
    return r.json()["token"]


# ---------------------------------------------------------------------------
# the link itself
# ---------------------------------------------------------------------------

def test_link_is_stable_until_rotated(owner, business, staff_token):
    again = requests.post(f"{BASE}/marketplace/businesses/{business}/orders/staff-link", headers=_auth(owner), timeout=30).json()
    assert again == {"token": staff_token, "created": False}
    got = requests.get(f"{BASE}/marketplace/businesses/{business}/orders/staff-link", headers=_auth(owner), timeout=30).json()
    assert got["token"] == staff_token


def test_bad_tokens_are_404(staff_token):
    assert requests.get(f"{BASE}/marketplace/orders/staff/short", timeout=30).status_code == 404
    # A well-formed token that was never issued (not a mutation of the
    # real one, which could collide with it on the last character).
    assert requests.get(f"{BASE}/marketplace/orders/staff/{'A' * len(staff_token)}", timeout=30).status_code == 404


def test_stranger_cannot_read_or_make_the_link(business):
    other = _account("other")
    assert requests.get(f"{BASE}/marketplace/businesses/{business}/orders/staff-link", headers=_auth(other), timeout=30).status_code == 403
    assert requests.post(f"{BASE}/marketplace/businesses/{business}/orders/staff-link", headers=_auth(other), timeout=30).status_code == 403


# ---------------------------------------------------------------------------
# what the counter can do
# ---------------------------------------------------------------------------

def test_staff_reads_board_and_moves_orders(owner, business, staff_token):
    o = _order(owner, business, customer_name="Board Test")
    r = requests.get(f"{BASE}/marketplace/orders/staff/{staff_token}",
                     params={"from": "2031-03-05", "to": "2031-03-05"}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["business"]["name"] == "TEST_staff bakery"
    assert o["id"] in [x["id"] for x in body["orders"]]
    assert body["status_counts"]["new"] >= 1

    r = requests.patch(f"{BASE}/marketplace/orders/staff/{staff_token}/{o['id']}/status",
                       json={"status": "preparing"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "preparing"
    assert r.json()["history"][-1]["by"] == "staff"
    # The same rules as the owner: no skipping.
    r = requests.patch(f"{BASE}/marketplace/orders/staff/{staff_token}/{o['id']}/status",
                       json={"status": "done"}, timeout=30)
    assert r.status_code == 409


def test_staff_cannot_touch_another_business_order(owner, staff_token):
    other = _account("other2")
    other_biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_other"},
                              headers=_auth(other), timeout=30).json()["id"]
    o = _order(other, other_biz)
    r = requests.patch(f"{BASE}/marketplace/orders/staff/{staff_token}/{o['id']}/status",
                       json={"status": "preparing"}, timeout=30)
    assert r.status_code == 404


def test_staff_link_has_no_create_edit_or_export(business, staff_token):
    # These URLs simply do not exist for a token; only the owner's do.
    assert requests.post(f"{BASE}/marketplace/orders/staff/{staff_token}", json={}, timeout=30).status_code in (404, 405)
    assert requests.get(f"{BASE}/marketplace/businesses/{business}/orders/export.csv", timeout=30).status_code in (401, 403)
    assert requests.get(f"{BASE}/marketplace/businesses/{business}/customers", timeout=30).status_code in (401, 403)


def test_rotate_then_revoke(owner, business, staff_token):
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/orders/staff-link",
                      params={"rotate": "true"}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200
    new = r.json()["token"]
    assert new != staff_token
    assert requests.get(f"{BASE}/marketplace/orders/staff/{staff_token}", timeout=30).status_code == 404
    assert requests.get(f"{BASE}/marketplace/orders/staff/{new}", timeout=30).status_code == 200
    r = requests.delete(f"{BASE}/marketplace/businesses/{business}/orders/staff-link", headers=_auth(owner), timeout=30)
    assert r.status_code == 200
    assert requests.get(f"{BASE}/marketplace/orders/staff/{new}", timeout=30).status_code == 404
    assert requests.get(f"{BASE}/marketplace/businesses/{business}/orders/staff-link",
                        headers=_auth(owner), timeout=30).json()["token"] is None


# ---------------------------------------------------------------------------
# export
# ---------------------------------------------------------------------------

def test_export_csv(owner, business):
    _order(owner, business, customer_name="Export, Me", items="1 rye loaf\n6 rolls", total=42,
           needed_by="2031-04-01T09:00")
    r = requests.get(f"{BASE}/marketplace/businesses/{business}/orders/export.csv",
                     params={"from": "2031-04-01", "to": "2031-04-01"}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers.get("content-disposition", "")
    text = r.content.decode("utf-8")
    assert text.startswith("﻿")
    # Parse it as a sheet would: a multi-line items cell is ONE row.
    import csv
    import io
    rows = list(csv.reader(io.StringIO(text.lstrip("﻿"))))
    assert rows[0][:4] == ["date", "time", "customer", "phone"]
    body = rows[1:]
    mine = [r for r in body if r[2] == "Export, Me"]
    assert len(mine) == 1
    assert mine[0][4] == "1 rye loaf\n6 rolls"
    assert mine[0][7] == "42"
    # No other window's rows leaked in.
    assert all(r[0] == "2031-04-01" for r in body), body


# ---------------------------------------------------------------------------
# import
# ---------------------------------------------------------------------------

def test_import_customers_lands_in_autocomplete(owner, business):
    sheet = "Name,Phone,Address\nZehava Import,053-1231234,Ben Yehuda 7\nNo Phone Person,,\n,052-0000000,\n"
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/customers/import",
                      json={"text": sheet}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["imported"] == 3
    assert r.json()["columns"] == {"name": "Name", "phone": "Phone", "address": "Address"}

    r = requests.get(f"{BASE}/marketplace/businesses/{business}/customers", params={"q": "zeh"},
                     headers=_auth(owner), timeout=30)
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["customer_phone"] == "053-1231234"
    assert rows[0]["address"] == "Ben Yehuda 7"
    assert rows[0]["orders"] == 0

    # Twice is idempotent.
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/customers/import",
                      json={"text": sheet}, headers=_auth(owner), timeout=30)
    assert r.json()["imported"] == 3
    r = requests.get(f"{BASE}/marketplace/businesses/{business}/customers", params={"q": "zeh"},
                     headers=_auth(owner), timeout=30)
    assert len(r.json()) == 1


def test_real_customer_outranks_imported_twin(owner, business):
    # Same phone imported AND ordered: one row, with the order count.
    requests.post(f"{BASE}/marketplace/businesses/{business}/customers/import",
                  json={"text": "name,phone\nTwin Person,050-7778899\n"}, headers=_auth(owner), timeout=30)
    _order(owner, business, customer_name="Twin Person", customer_phone="+972507778899")
    r = requests.get(f"{BASE}/marketplace/businesses/{business}/customers", params={"q": "twin"},
                     headers=_auth(owner), timeout=30)
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["orders"] == 1


# ---------------------------------------------------------------------------
# what the board withholds (site audit, 8 Sep 2026)
# ---------------------------------------------------------------------------
#
# The token in the URL is the whole credential and it does not expire on
# its own, so whoever ends up holding the link - forwarded, screenshotted,
# still in a chat thread from months ago - used to have standing access to
# every customer's name, phone AND address for the business. The courier's
# own view already refuses to do that: a phone appears only while the order
# is `ready`, and each reveal is written down. The board now matches: the
# list carries no contact details, and the counter asks for one order at a
# time through an endpoint that logs it.

@pytest.fixture(scope="module")
def redacted_biz(owner):
    """Its own business and its own link.

    The shared `staff_token` fixture is revoked by test_rotate_then_revoke,
    which runs before these do, so borrowing it makes every assertion below
    a 404 that looks like a redaction failure.
    """
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_staff redact"},
                        headers=_auth(owner), timeout=30).json()["id"]
    r = requests.post(f"{BASE}/marketplace/businesses/{biz}/orders/staff-link",
                      headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    return {"business": biz, "token": r.json()["token"]}


def test_the_board_does_not_list_phone_or_address(owner, redacted_biz):
    _order(owner, redacted_biz['business'], customer_name="Rivka Levi", fulfilment="delivery",
           address="Rehov Ussishkin 4, Jerusalem")
    r = requests.get(f"{BASE}/marketplace/orders/staff/{redacted_biz['token']}", timeout=30)
    assert r.status_code == 200, r.text
    orders = r.json()["orders"]
    assert orders, "no orders on the board - the test would prove nothing"
    for o in orders:
        for field in ("customer_phone", "customer_phone_e164", "address"):
            assert field not in o, f"the board still serves {field}"
        # The name and the items stay: without them there is no board.
        assert "customer_name" in o and "items" in o


def test_the_board_says_where_there_is_a_contact_to_ask_for(owner, redacted_biz):
    r = requests.get(f"{BASE}/marketplace/orders/staff/{redacted_biz['token']}", timeout=30)
    assert any(o.get("has_contact") for o in r.json()["orders"])


def test_the_counter_can_still_get_one_order_s_phone(owner, redacted_biz):
    made = _order(owner, redacted_biz['business'], customer_name="Noa Bar", customer_phone="052-7654321",
                  fulfilment="delivery", address="Rehov Herzl 12, Tel Aviv")
    r = requests.get(
        f"{BASE}/marketplace/orders/staff/{redacted_biz['token']}/{made['id']}/contact", timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["customer_phone"] == "052-7654321"
    assert "Herzl" in (body["address"] or "")


def test_a_reveal_is_written_down(owner, redacted_biz):
    """The gating is only half of it - the courier path logs every reveal
    and this one has to as well, or there is no trace of a leaked link
    being used."""
    made = _order(owner, redacted_biz['business'], customer_name="Amit Shalev")
    requests.get(f"{BASE}/marketplace/orders/staff/{redacted_biz['token']}/{made['id']}/contact", timeout=30)
    # The owner's own view is the one that shows the record.
    r = requests.get(f"{BASE}/marketplace/businesses/{redacted_biz['business']}/orders", headers=_auth(owner), timeout=30)
    mine = next(o for o in r.json()["orders"] if o["id"] == made["id"])
    reveals = mine.get("contact_reveals") or []
    assert reveals and reveals[-1]["by"] == "staff", f"no reveal recorded: {reveals}"


def test_another_business_order_cannot_be_revealed(owner, redacted_biz):
    other = _account("otherbiz")
    biz2 = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_staff other"},
                         headers=_auth(other), timeout=30).json()["id"]
    theirs = _order(other, biz2, customer_name="Someone Else")
    r = requests.get(
        f"{BASE}/marketplace/orders/staff/{redacted_biz['token']}/{theirs['id']}/contact", timeout=30)
    assert r.status_code == 404, r.text


def test_moving_an_order_does_not_hand_the_phone_back(owner, redacted_biz):
    """The status-change response is built by the same serializer, so it
    was the obvious way for the withheld field to come straight back."""
    made = _order(owner, redacted_biz['business'], customer_name="Tamar Gold")
    r = requests.patch(f"{BASE}/marketplace/orders/staff/{redacted_biz['token']}/{made['id']}/status",
                       json={"status": "preparing"}, timeout=30)
    assert r.status_code == 200, r.text
    for field in ("customer_phone", "customer_phone_e164", "address"):
        assert field not in r.json(), f"the status response still carries {field}"


def test_the_owner_s_own_listing_is_unchanged(owner, redacted_biz):
    """The owner is authenticated and is the data controller; this fix is
    about the login-free link, and must not have cost them their board."""
    _order(owner, redacted_biz['business'], customer_name="Yael Ben-Ami", customer_phone="053-1112222")
    r = requests.get(f"{BASE}/marketplace/businesses/{redacted_biz['business']}/orders", headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    assert any(o.get("customer_phone") for o in r.json()["orders"])

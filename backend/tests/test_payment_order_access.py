"""Who may read a payment order: its owner and admins, nobody else.

The only test of this lived in test_payments.py's TestOrderAccessControl,
skipped wholesale because it created orders through the discontinued
document-services product (site audit 27 Sep, M4). The check itself
(routes/payments.py, get_payment_order and list_my_orders) applies to every
product type, so this tests it without creating an order through PayPal:
one is written straight into the LOCAL database and read back through the
API as its owner and as someone else.

Needs the live local API and the local test accounts (tests/.env.test).
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from pymongo import MongoClient  # noqa: E402

from tests.conftest import TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD, TEST_RENTER_EMAIL, TEST_RENTER_PASSWORD  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"local login failed for {email}: {r.text}"
    body = r.json()
    return {"Authorization": f"Bearer {body.get('token') or body.get('access_token')}"}, body["user"]["id"]


@pytest.fixture(scope="module")
def parties():
    if not (TEST_RENTER_EMAIL and TEST_OWNER_EMAIL):
        pytest.skip("local test accounts not configured (tests/.env.test)")
    return _login(TEST_RENTER_EMAIL, TEST_RENTER_PASSWORD), _login(TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD)


@pytest.fixture()
def order(parties):
    url = os.environ["MONGO_URL"]
    assert url.startswith(("mongodb://127.0.0.1", "mongodb://localhost")), "writes only to a local database"
    db = MongoClient(url)[os.environ["DB_NAME"]]
    (_, renter_id), _ = parties
    oid = f"test-acl-{uuid.uuid4()}"
    db.orders.insert_one({"id": oid, "user_id": renter_id, "product_type": "sublease_booking",
                          "status": "created", "amount": 10, "currency": "ILS",
                          "created_at": datetime.now(UTC).isoformat()})
    yield oid
    db.orders.delete_one({"id": oid})


def test_the_owner_of_an_order_can_read_it(parties, order):
    (renter, _), _ = parties
    r = requests.get(f"{BASE}/payments/orders/{order}", headers=renter, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["id"] == order


def test_someone_else_cannot_read_it(parties, order):
    _, (owner, _) = parties
    r = requests.get(f"{BASE}/payments/orders/{order}", headers=owner, timeout=30)
    assert r.status_code in (403, 404), f"another user read someone's order: {r.status_code}"


def test_my_orders_lists_only_the_callers(parties, order):
    (renter, _), (owner, _) = parties
    mine = [o["id"] for o in requests.get(f"{BASE}/payments/my", headers=renter, timeout=30).json()]
    theirs = [o["id"] for o in requests.get(f"{BASE}/payments/my", headers=owner, timeout=30).json()]
    assert order in mine
    assert order not in theirs


def test_an_unknown_order_is_a_404(parties):
    (renter, _), _ = parties
    assert requests.get(f"{BASE}/payments/orders/no-such-order", headers=renter, timeout=30).status_code == 404

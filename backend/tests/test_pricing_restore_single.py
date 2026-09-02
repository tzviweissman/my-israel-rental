"""Tests for admin per-listing pricing-restore endpoint.

POST /api/admin/properties/{property_id}/pricing-restore
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

# The admin password used to be a hardcoded "Admin123!" here - one digit
# short of the seeded account's "Admin1234!" - so every admin fixture in
# this file failed with "Invalid credentials" and read as a broken
# feature. The credentials come from tests/.env.test via conftest now.
from conftest import TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD  # noqa: E402
ADMIN = {"email": TEST_ADMIN_EMAIL or "admin@rental.com", "password": TEST_ADMIN_PASSWORD or "Admin1234!"}
OWNER = {"email": "owner@test.com", "password": "Test1234!"}
RENTER = {"email": "renter@test.com", "password": "Test1234!"}

TITLE_PREFIX = "[QUARANTINE-DEMO]"


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def owner_token():
    return _login(OWNER)


@pytest.fixture(scope="module")
def renter_token():
    return _login(RENTER)


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


def _seed(mongo, *, is_hidden: bool, reason: str | None):
    now = datetime.now(timezone.utc).isoformat()
    owner_row = mongo.users.find_one({"email": OWNER["email"]})
    owner_id = owner_row["id"] if owner_row else "test-owner"
    doc = {
        "id": str(uuid.uuid4()),
        "title": f"{TITLE_PREFIX} {reason or 'clean'} {uuid.uuid4().hex[:6]}",
        "rental_type": "long-term",
        "property_type": "apartment",
        "area": "Jerusalem - Test",
        "address": "1 Test St",
        "currency": "ILS",
        "owner_id": owner_id,
        "created_at": now,
        "status": "active",
        "monthly_price": 5000,
        "nightly_price": 0,
        "holiday_lump_price": 0,
    }
    if is_hidden:
        doc["is_hidden"] = True
    if reason:
        doc["pricing_review_reason"] = reason
        doc["pricing_review_at"] = now
    mongo.properties.insert_one(doc)
    return doc["id"]


@pytest.fixture
def seeded(mongo):
    mongo.properties.delete_many({"title": {"$regex": r"^\[QUARANTINE-DEMO\]"}})
    ids = {
        "low": _seed(mongo, is_hidden=True, reason="low_monthly"),
        "zero": _seed(mongo, is_hidden=True, reason="zero_price"),
        "clean": _seed(mongo, is_hidden=False, reason=None),
    }
    yield ids
    mongo.properties.delete_many({"title": {"$regex": r"^\[QUARANTINE-DEMO\]"}})


def _url(pid):
    return f"{BASE_URL}/api/admin/properties/{pid}/pricing-restore"


class TestPerRowRestore:
    def test_admin_restores_quarantined(self, admin_token, seeded, mongo):
        pid = seeded["low"]
        r = requests.post(_url(pid), headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["restored"] is True
        assert data["id"] == pid
        assert "message" in data and isinstance(data["message"], str)

        # verify DB state
        row = mongo.properties.find_one({"id": pid})
        assert not row.get("is_hidden")
        assert "pricing_review_reason" not in row

        # verify via GET /api/admin/properties
        r2 = requests.get(
            f"{BASE_URL}/api/admin/properties",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=30,
        )
        assert r2.status_code == 200
        found = [p for p in r2.json() if p.get("id") == pid]
        assert len(found) == 1
        assert found[0].get("is_hidden") in (False, None)
        assert not found[0].get("pricing_review_reason")

    def test_idempotent_noop_on_clean_row(self, admin_token, seeded):
        pid = seeded["clean"]
        r = requests.post(_url(pid), headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["restored"] is False
        assert "not quarantined" in data["message"].lower()

    def test_unknown_id_returns_404(self, admin_token):
        r = requests.post(
            _url("does-not-exist-" + uuid.uuid4().hex),
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=30,
        )
        assert r.status_code == 404

    def test_owner_forbidden(self, owner_token, seeded):
        r = requests.post(
            _url(seeded["zero"]),
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=30,
        )
        assert r.status_code == 403

    def test_renter_forbidden(self, renter_token, seeded):
        r = requests.post(
            _url(seeded["zero"]),
            headers={"Authorization": f"Bearer {renter_token}"}, timeout=30,
        )
        assert r.status_code == 403

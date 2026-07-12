"""Tests for admin pricing auto-fix + un-quarantine endpoints."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read from frontend/.env directly
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN = {"email": "admin@rental.com", "password": "Admin123!"}
OWNER = {"email": "owner@test.com", "password": "Test1234!"}
RENTER = {"email": "renter@test.com", "password": "Test1234!"}

TITLE_PREFIX = "[AUTOFIX-TEST]"


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


@pytest.fixture
def seeded_props(mongo):
    """Seed 3 broken properties. Cleanup after."""
    # cleanup any previous run
    mongo.properties.delete_many({"title": {"$regex": r"^\[AUTOFIX-TEST\]"}})

    now = datetime.now(timezone.utc).isoformat()
    owner_row = mongo.users.find_one({"email": OWNER["email"]})
    owner_id = owner_row["id"] if owner_row else "test-owner"

    base = {
        "currency": "ILS",
        "owner_id": owner_id,
        "created_at": now,
        "status": "active",
        "property_type": "apartment",
        "area": "Jerusalem - Test",
    }

    zero = {**base, "id": str(uuid.uuid4()),
            "title": f"{TITLE_PREFIX} zero-price",
            "rental_type": "long-term",
            "monthly_price": 0, "nightly_price": 0, "holiday_lump_price": 0}
    low = {**base, "id": str(uuid.uuid4()),
           "title": f"{TITLE_PREFIX} low-monthly",
           "rental_type": "long-term",
           "monthly_price": 350, "nightly_price": 0, "holiday_lump_price": 0}
    wrong = {**base, "id": str(uuid.uuid4()),
             "title": f"{TITLE_PREFIX} wrong-field",
             "rental_type": "long-term",
             "monthly_price": 7500, "nightly_price": 220, "holiday_lump_price": 0}

    mongo.properties.insert_many([zero, low, wrong])
    yield {"zero": zero["id"], "low": low["id"], "wrong": wrong["id"]}
    mongo.properties.delete_many({"title": {"$regex": r"^\[AUTOFIX-TEST\]"}})


class TestPricingAutofix:
    def test_autofix_totals_and_effects(self, admin_token, seeded_props, mongo):
        r = requests.post(
            f"{BASE_URL}/api/admin/properties/pricing-autofix",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        totals = data["totals"]
        assert totals["stripped_nightly"] == 1, totals
        assert totals["quarantined_low_monthly"] == 1, totals
        assert totals["quarantined_zero_price"] == 1, totals
        assert totals["total_fixed"] == 3, totals

        # verify db state
        wrong = mongo.properties.find_one({"id": seeded_props["wrong"]})
        assert wrong["monthly_price"] == 7500
        assert wrong["nightly_price"] == 0
        assert not wrong.get("is_hidden")

        low = mongo.properties.find_one({"id": seeded_props["low"]})
        assert low.get("is_hidden") is True
        assert low.get("pricing_review_reason") == "low_monthly"

        zero = mongo.properties.find_one({"id": seeded_props["zero"]})
        assert zero.get("is_hidden") is True
        assert zero.get("pricing_review_reason") == "zero_price"

    def test_audit_skips_quarantined_and_fixed(self, admin_token, seeded_props):
        # first autofix
        requests.post(
            f"{BASE_URL}/api/admin/properties/pricing-autofix",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=60,
        )
        r = requests.get(
            f"{BASE_URL}/api/admin/properties/pricing-audit",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=60,
        )
        assert r.status_code == 200
        data = r.json()
        # Ensure our seeded rows are NOT in any bucket
        all_ids = {p["id"] for p in data["zero_price"] + data["low_monthly"] + data["wrong_field"]}
        for k in ("zero", "low", "wrong"):
            assert seeded_props[k] not in all_ids, f"{k} still in audit"

    def test_public_properties_hides_quarantined(self, admin_token, seeded_props):
        requests.post(
            f"{BASE_URL}/api/admin/properties/pricing-autofix",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=60,
        )
        r = requests.get(f"{BASE_URL}/api/properties", timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        items = body if isinstance(body, list) else body.get("properties", body.get("items", []))
        ids = {p.get("id") for p in items}
        assert seeded_props["zero"] not in ids
        assert seeded_props["low"] not in ids
        # wrong-field should still be visible (not hidden)
        assert seeded_props["wrong"] in ids

    def test_unquarantine_restores(self, admin_token, seeded_props, mongo):
        requests.post(
            f"{BASE_URL}/api/admin/properties/pricing-autofix",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=60,
        )
        r = requests.post(
            f"{BASE_URL}/api/admin/properties/pricing-unquarantine",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["restored"] >= 2

        for key in ("zero", "low"):
            doc = mongo.properties.find_one({"id": seeded_props[key]})
            assert not doc.get("is_hidden")
            assert "pricing_review_reason" not in doc


class TestAuth:
    def test_owner_forbidden_autofix(self, owner_token):
        r = requests.post(
            f"{BASE_URL}/api/admin/properties/pricing-autofix",
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=30,
        )
        assert r.status_code == 403

    def test_renter_forbidden_autofix(self, renter_token):
        r = requests.post(
            f"{BASE_URL}/api/admin/properties/pricing-autofix",
            headers={"Authorization": f"Bearer {renter_token}"}, timeout=30,
        )
        assert r.status_code == 403

    def test_owner_forbidden_unquarantine(self, owner_token):
        r = requests.post(
            f"{BASE_URL}/api/admin/properties/pricing-unquarantine",
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=30,
        )
        assert r.status_code == 403

    def test_renter_forbidden_unquarantine(self, renter_token):
        r = requests.post(
            f"{BASE_URL}/api/admin/properties/pricing-unquarantine",
            headers={"Authorization": f"Bearer {renter_token}"}, timeout=30,
        )
        assert r.status_code == 403


class TestIdempotency:
    def test_autofix_twice_clean_db(self, admin_token, mongo):
        # Ensure no test rows lingering
        mongo.properties.delete_many({"title": {"$regex": r"^\[AUTOFIX-TEST\]"}})
        # First call (may fix pre-existing broken rows). Then unquarantine so
        # we don't leave the DB in a modified state, then autofix again — but
        # to isolate our idempotency check we call autofix twice in a row and
        # assert the SECOND run's total_fixed == 0.
        r1 = requests.post(
            f"{BASE_URL}/api/admin/properties/pricing-autofix",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=60,
        )
        assert r1.status_code == 200, r1.text
        r2 = requests.post(
            f"{BASE_URL}/api/admin/properties/pricing-autofix",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=60,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["totals"]["total_fixed"] == 0, r2.json()["totals"]

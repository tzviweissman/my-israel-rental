"""Backend tests for pricing-audit endpoint + regression on check-duplicate/property_id route ordering.

Covers the bug-fix verification requested in review:
  - GET /api/admin/properties/pricing-audit auth & bucketing
  - Route ordering: /properties/check-duplicate does NOT swallow /properties/{property_id}
  - POST /api/admin/duplicates/auto-resolve + /api/admin/duplicates/resolve still respond
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://where-am-i-project.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@rental.com", "Admin123!")
OWNER = ("owner@test.com", "Test1234!")
RENTER = ("renter@test.com", "Test1234!")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def owner_token():
    return _login(*OWNER)


@pytest.fixture(scope="module")
def renter_token():
    return _login(*RENTER)


# --- Direct mongo seed for audit buckets ---
@pytest.fixture(scope="module")
def seeded_ids():
    """Insert 3 marker properties covering each audit bucket via mongo directly."""
    from pymongo import MongoClient
    from dotenv import load_dotenv
    from pathlib import Path
    load_dotenv(Path(__file__).parent.parent / ".env")
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    client = MongoClient(mongo_url)
    db = client[db_name]

    ids = {
        "zero": f"TEST_audit_zero_{uuid.uuid4().hex[:8]}",
        "low": f"TEST_audit_low_{uuid.uuid4().hex[:8]}",
        "wrong": f"TEST_audit_wrong_{uuid.uuid4().hex[:8]}",
        "ok": f"TEST_audit_ok_{uuid.uuid4().hex[:8]}",
    }
    base = {"owner_id": "test-owner", "owner_name": "Test", "location": "Test", "area": "Test", "address": "Test", "currency": "ILS", "property_type": "apartment", "bedrooms": 1, "bathrooms": 1, "floor": 1}
    db.properties.insert_many([
        {**base, "id": ids["zero"], "title": "TEST_zero", "rental_type": "long-term", "monthly_price": 0, "nightly_price": 0, "holiday_lump_price": 0},
        {**base, "id": ids["low"], "title": "TEST_low", "rental_type": "long-term", "monthly_price": 450, "nightly_price": 0},
        {**base, "id": ids["wrong"], "title": "TEST_wrong", "rental_type": "long-term", "monthly_price": 5000, "nightly_price": 300},
        {**base, "id": ids["ok"], "title": "TEST_ok", "rental_type": "long-term", "monthly_price": 6000, "nightly_price": 0},
    ])
    yield ids
    db.properties.delete_many({"id": {"$in": list(ids.values())}})
    client.close()


# ---------- pricing-audit auth checks ----------
class TestPricingAuditAuth:
    def test_anonymous_forbidden(self):
        r = requests.get(f"{API}/admin/properties/pricing-audit", timeout=15)
        # verify_token usually returns 401/403 when no header
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_renter_forbidden(self, renter_token):
        r = requests.get(f"{API}/admin/properties/pricing-audit",
                         headers={"Authorization": f"Bearer {renter_token}"}, timeout=15)
        assert r.status_code == 403

    def test_owner_forbidden(self, owner_token):
        r = requests.get(f"{API}/admin/properties/pricing-audit",
                         headers={"Authorization": f"Bearer {owner_token}"}, timeout=15)
        assert r.status_code == 403

    def test_admin_ok(self, admin_token):
        r = requests.get(f"{API}/admin/properties/pricing-audit",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "totals" in data
        assert "thresholds" in data
        assert set(data["totals"].keys()) >= {"checked", "zero_price", "low_monthly", "wrong_field"}
        assert data["thresholds"]["low_monthly_ils"] == 1500
        assert data["thresholds"]["low_monthly_usd"] == 500
        for k in ("zero_price", "low_monthly", "wrong_field"):
            assert isinstance(data[k], list)


# ---------- audit bucketing ----------
class TestPricingAuditBuckets:
    def test_buckets_contain_seeded_ids(self, admin_token, seeded_ids):
        r = requests.get(f"{API}/admin/properties/pricing-audit",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        zero_ids = {p["id"] for p in data["zero_price"]}
        low_ids = {p["id"] for p in data["low_monthly"]}
        wrong_ids = {p["id"] for p in data["wrong_field"]}

        assert seeded_ids["zero"] in zero_ids
        assert seeded_ids["low"] in low_ids
        assert seeded_ids["wrong"] in wrong_ids
        # OK listing must not appear in any bucket
        assert seeded_ids["ok"] not in zero_ids
        assert seeded_ids["ok"] not in low_ids
        assert seeded_ids["ok"] not in wrong_ids

    def test_custom_thresholds(self, admin_token, seeded_ids):
        # Raise floor to 10000 — the 5000 wrong-field row falls into low_monthly first (returns before wrong check).
        r = requests.get(f"{API}/admin/properties/pricing-audit?low_monthly_ils=10000",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["thresholds"]["low_monthly_ils"] == 10000
        low_ids = {p["id"] for p in data["low_monthly"]}
        assert seeded_ids["low"] in low_ids


# ---------- route ordering regression ----------
class TestRouteOrderingRegression:
    def test_check_duplicate_route_reachable(self, owner_token):
        r = requests.get(
            f"{API}/properties/check-duplicate",
            params={"address": "Nonexistent 999", "rental_type": "long-term"},
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=15,
        )
        # Must not 404 as if property_id — should return JSON with duplicate key
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        assert "duplicate" in r.json()

    def test_get_property_by_id_still_works(self):
        # Fetch a real property id from the list endpoint, then confirm detail route serves it
        lst = requests.get(f"{API}/properties?limit=1", timeout=15).json()
        if not lst:
            pytest.skip("No properties in DB")
        prop_id = lst[0]["id"]
        r = requests.get(f"{API}/properties/{prop_id}", timeout=15)
        assert r.status_code == 200
        assert r.json().get("id") == prop_id

    def test_get_property_by_id_not_found(self):
        r = requests.get(f"{API}/properties/{uuid.uuid4()}", timeout=15)
        assert r.status_code == 404


# ---------- duplicates endpoints regression ----------
class TestDuplicatesEndpoints:
    def test_auto_resolve_admin(self, admin_token):
        r = requests.post(f"{API}/admin/duplicates/auto-resolve",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=60)
        assert r.status_code in (200, 201), f"got {r.status_code}: {r.text[:200]}"

    def test_auto_resolve_non_admin(self, renter_token):
        r = requests.post(f"{API}/admin/duplicates/auto-resolve",
                          headers={"Authorization": f"Bearer {renter_token}"}, timeout=30)
        assert r.status_code == 403

    def test_resolve_admin_bad_payload(self, admin_token):
        # We don't know a real duplicate pair; just verify the endpoint is wired,
        # not 404. Accept 400/404/422 for missing/invalid target, but NOT 405.
        r = requests.post(f"{API}/admin/duplicates/resolve",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          json={}, timeout=30)
        assert r.status_code != 405 and r.status_code != 404

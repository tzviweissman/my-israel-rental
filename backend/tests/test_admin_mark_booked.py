"""Tests for the admin 'Mark as Booked' feature.

Covers:
- POST /api/admin/properties/{id}/mark-booked (indefinite, dated, invalid)
- GET /api/admin/properties/{id}/blocks
- DELETE /api/admin/properties/blocks/{block_id}
- POST /api/admin/properties/bulk-mark-booked
- GET /api/admin/properties enrichment (admin_blocks, admin_blocked_now, active_admin_block)
- Public GET /api/properties filter behaviour with/without date range
- 403 behaviour for non-admin tokens
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://where-am-i-project.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@rental.com", "password": "Admin1234!"}
OWNER = {"email": "owner@test.com", "password": "Test1234!"}
RENTER = {"email": "renter@test.com", "password": "Test1234!"}
TEST_PROPERTY_ID = "86c6e09c-b1e0-4705-a86c-91cd9ce13765"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def owner_headers():
    return {"Authorization": f"Bearer {_login(OWNER)}"}


@pytest.fixture(scope="module")
def renter_headers():
    return {"Authorization": f"Bearer {_login(RENTER)}"}


@pytest.fixture(scope="module")
def second_property_id(admin_headers):
    """Pick a second property (not the primary test property) for bulk tests."""
    r = requests.get(f"{API}/properties", timeout=15)
    assert r.status_code == 200
    props = r.json()
    for p in props:
        if p["id"] != TEST_PROPERTY_ID:
            return p["id"]
    pytest.skip("Need at least 2 properties in DB for bulk tests")


@pytest.fixture(autouse=True)
def _cleanup_blocks(admin_headers):
    """Remove any blocks on the test property before AND after each test."""
    def purge():
        for pid in {TEST_PROPERTY_ID}:
            r = requests.get(f"{API}/admin/properties/{pid}/blocks", headers=admin_headers, timeout=15)
            if r.status_code == 200:
                for b in r.json():
                    requests.delete(f"{API}/admin/properties/blocks/{b['id']}", headers=admin_headers, timeout=15)
    purge()
    yield
    purge()


# --- Auth: 403 for non-admins ----------------------------------------

class TestAdminAuth:
    def test_owner_cannot_mark_booked(self, owner_headers):
        r = requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                          json={"indefinite": True}, headers=owner_headers, timeout=15)
        assert r.status_code == 403

    def test_renter_cannot_mark_booked(self, renter_headers):
        r = requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                          json={"indefinite": True}, headers=renter_headers, timeout=15)
        assert r.status_code == 403

    def test_owner_cannot_list_blocks(self, owner_headers):
        r = requests.get(f"{API}/admin/properties/{TEST_PROPERTY_ID}/blocks",
                         headers=owner_headers, timeout=15)
        assert r.status_code == 403

    def test_owner_cannot_bulk_mark(self, owner_headers):
        r = requests.post(f"{API}/admin/properties/bulk-mark-booked",
                          json={"property_ids": [TEST_PROPERTY_ID], "indefinite": True},
                          headers=owner_headers, timeout=15)
        assert r.status_code == 403

    def test_no_token_returns_401_or_403(self):
        r = requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                          json={"indefinite": True}, timeout=15)
        assert r.status_code in (401, 403)


# --- Single mark-booked ---------------------------------------------

class TestMarkBookedSingle:
    def test_mark_indefinite(self, admin_headers):
        r = requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                          json={"indefinite": True}, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "block" in data
        b = data["block"]
        assert b["property_id"] == TEST_PROPERTY_ID
        assert b["indefinite"] == True
        assert b["end_date"] is None
        assert "id" in b
        # verify via list
        lst = requests.get(f"{API}/admin/properties/{TEST_PROPERTY_ID}/blocks",
                           headers=admin_headers, timeout=15).json()
        assert any(x["id"] == b["id"] for x in lst)

    def test_mark_dated_range(self, admin_headers):
        payload = {"start_date": "2030-01-01", "end_date": "2030-01-10", "indefinite": False}
        r = requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                          json=payload, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()["block"]
        assert b["start_date"] == "2030-01-01"
        assert b["end_date"] == "2030-01-10"
        assert b["indefinite"] == False

    def test_invalid_end_before_start(self, admin_headers):
        r = requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                          json={"start_date": "2030-05-10", "end_date": "2030-05-01"},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 400

    def test_empty_body_open_ended(self, admin_headers):
        # Per spec: null start/end is treated as open-ended / indefinite
        r = requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                          json={}, headers=admin_headers, timeout=15)
        assert r.status_code == 200
        b = r.json()["block"]
        assert b["end_date"] is None
        assert b["indefinite"] == True  # end is None => indefinite True

    def test_nonexistent_property_returns_404(self, admin_headers):
        r = requests.post(f"{API}/admin/properties/does-not-exist/mark-booked",
                          json={"indefinite": True}, headers=admin_headers, timeout=15)
        assert r.status_code == 404


# --- Delete block ----------------------------------------------------

class TestDeleteBlock:
    def test_delete_removes_block(self, admin_headers):
        r = requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                          json={"indefinite": True}, headers=admin_headers, timeout=15)
        block_id = r.json()["block"]["id"]

        d = requests.delete(f"{API}/admin/properties/blocks/{block_id}",
                            headers=admin_headers, timeout=15)
        assert d.status_code == 200

        lst = requests.get(f"{API}/admin/properties/{TEST_PROPERTY_ID}/blocks",
                           headers=admin_headers, timeout=15).json()
        assert all(x["id"] != block_id for x in lst)

    def test_delete_missing_returns_404(self, admin_headers):
        r = requests.delete(f"{API}/admin/properties/blocks/ghost-id",
                            headers=admin_headers, timeout=15)
        assert r.status_code == 404


# --- Bulk mark-booked ------------------------------------------------

class TestBulkMarkBooked:
    def test_bulk_creates_one_per_property(self, admin_headers, second_property_id):
        pids = [TEST_PROPERTY_ID, second_property_id]
        r = requests.post(f"{API}/admin/properties/bulk-mark-booked",
                          json={"property_ids": pids, "indefinite": True},
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["created"] == 2

        try:
            for pid in pids:
                lst = requests.get(f"{API}/admin/properties/{pid}/blocks",
                                   headers=admin_headers, timeout=15).json()
                assert len(lst) >= 1
                assert any(b["indefinite"] == True for b in lst)
        finally:
            # cleanup second property's blocks (first is handled by fixture)
            lst2 = requests.get(f"{API}/admin/properties/{second_property_id}/blocks",
                                headers=admin_headers, timeout=15).json()
            for b in lst2:
                requests.delete(f"{API}/admin/properties/blocks/{b['id']}",
                                headers=admin_headers, timeout=15)

    def test_bulk_empty_ids_400(self, admin_headers):
        r = requests.post(f"{API}/admin/properties/bulk-mark-booked",
                          json={"property_ids": [], "indefinite": True},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 400

    def test_bulk_skips_nonexistent(self, admin_headers):
        r = requests.post(f"{API}/admin/properties/bulk-mark-booked",
                          json={"property_ids": ["nope-1", "nope-2"], "indefinite": True},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["created"] == 0
        assert d["skipped"] == 2


# --- Admin properties enrichment ------------------------------------

class TestAdminPropertiesEnrichment:
    def test_enrichment_fields_present_and_reflect_block(self, admin_headers):
        # Seed a block
        requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                      json={"indefinite": True}, headers=admin_headers, timeout=15)

        r = requests.get(f"{API}/admin/properties", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        props = r.json()
        target = next((p for p in props if p["id"] == TEST_PROPERTY_ID), None)
        assert target is not None
        assert "admin_blocks" in target
        assert "admin_blocked_now" in target
        assert "active_admin_block" in target
        assert target["admin_blocked_now"] == True
        assert len(target["admin_blocks"]) >= 1
        assert target["active_admin_block"] is not None


# --- Public search filter behaviour ---------------------------------

class TestPublicSearchFilter:
    def test_no_date_filter_still_shows_blocked(self, admin_headers):
        requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                      json={"indefinite": True}, headers=admin_headers, timeout=15)
        r = requests.get(f"{API}/properties", timeout=15)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert TEST_PROPERTY_ID in ids, "Indefinite block should NOT hide property when no dates filter"

    def test_overlapping_dates_exclude(self, admin_headers):
        requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                      json={"start_date": "2030-06-01", "end_date": "2030-06-15"},
                      headers=admin_headers, timeout=15)
        r = requests.get(f"{API}/properties",
                         params={"date_from": "2030-06-05", "date_to": "2030-06-10"}, timeout=15)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert TEST_PROPERTY_ID not in ids

    def test_non_overlapping_dates_include(self, admin_headers):
        requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                      json={"start_date": "2030-06-01", "end_date": "2030-06-15"},
                      headers=admin_headers, timeout=15)
        r = requests.get(f"{API}/properties",
                         params={"date_from": "2030-07-01", "date_to": "2030-07-05"}, timeout=15)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert TEST_PROPERTY_ID in ids

    def test_indefinite_block_excludes_any_date_range(self, admin_headers):
        requests.post(f"{API}/admin/properties/{TEST_PROPERTY_ID}/mark-booked",
                      json={"indefinite": True}, headers=admin_headers, timeout=15)
        r = requests.get(f"{API}/properties",
                         params={"date_from": "2099-01-01", "date_to": "2099-01-10"}, timeout=15)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert TEST_PROPERTY_ID not in ids

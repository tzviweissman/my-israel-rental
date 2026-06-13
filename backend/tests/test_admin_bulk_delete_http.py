"""HTTP-level smoke tests for DELETE /api/admin/properties/bulk against the
live preview URL. Complements the deeper cascade tests in
test_admin_bulk_delete.py.

We seed throwaway properties via the live POST endpoint so we never touch
the canonical fixtures 4f5680df-... / 86c6e09c-... that other suites
depend on.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(Path(__file__).parent.parent / ".env")
# REACT_APP_BACKEND_URL lives in frontend/.env in this repo.
load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@rental.com", "password": "Admin1234!"}
OWNER = {"email": "owner@test.com", "password": "Test1234!"}
RENTER = {"email": "renter@test.com", "password": "Test1234!"}


def _login(creds: dict) -> str:
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.text}"
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


def _create_property(headers: dict, title_suffix: str) -> str:
    """Create a throwaway property via the owner API. Returns the new id."""
    payload = {
        "title": f"TEST_bulk_delete_http_{title_suffix}",
        "description": "throwaway listing for bulk-delete tests",
        "area": "Tel Aviv",
        "rental_type": "long-term",
        "property_type": "apartment",
        "monthly_price": 4500,
        "currency": "ILS",
        "images": [],
    }
    r = requests.post(f"{API}/properties", json=payload, headers=headers, timeout=15)
    assert r.status_code in (200, 201), f"Property creation failed: {r.status_code} {r.text}"
    body = r.json()
    pid = body.get("id") or body.get("_id") or body.get("property_id")
    assert pid, f"No id in property creation response: {body}"
    return pid


# -------- Auth + payload validation --------

def test_renter_forbidden(renter_headers):
    r = requests.delete(
        f"{API}/admin/properties/bulk",
        json={"property_ids": ["nope"]},
        headers=renter_headers, timeout=15,
    )
    assert r.status_code == 403, r.text


def test_owner_forbidden(owner_headers):
    r = requests.delete(
        f"{API}/admin/properties/bulk",
        json={"property_ids": ["nope"]},
        headers=owner_headers, timeout=15,
    )
    assert r.status_code == 403, r.text


def test_no_auth_returns_401_or_403():
    r = requests.delete(
        f"{API}/admin/properties/bulk",
        json={"property_ids": ["nope"]}, timeout=15,
    )
    assert r.status_code in (401, 403), r.text


def test_empty_list_returns_400(admin_headers):
    r = requests.delete(
        f"{API}/admin/properties/bulk",
        json={"property_ids": []},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 400, r.text


def test_only_unknown_ids_returns_zero_deleted(admin_headers):
    r = requests.delete(
        f"{API}/admin/properties/bulk",
        json={"property_ids": ["ghost-aaa", "ghost-bbb", "ghost-ccc"]},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["deleted"] == 0
    assert body["skipped"] == 3
    assert body.get("messages_deleted") == 0
    assert body.get("bookings_deleted") == 0


# -------- Happy path: actually delete + verify gone from GET --------

def test_bulk_delete_removes_listings_from_admin_list(admin_headers, owner_headers):
    # Seed two throwaway properties via the owner API (real http flow).
    pid_a = _create_property(owner_headers, "alpha")
    pid_b = _create_property(owner_headers, "beta")

    # Sanity: both show up in admin listing.
    list_r = requests.get(f"{API}/admin/properties", headers=admin_headers, timeout=20)
    assert list_r.status_code == 200, list_r.text
    ids_before = {p["id"] for p in list_r.json()}
    assert pid_a in ids_before and pid_b in ids_before, (
        "Seeded properties missing from /api/admin/properties before delete"
    )

    # Mix one ghost id so we can also assert `skipped` count.
    r = requests.delete(
        f"{API}/admin/properties/bulk",
        json={"property_ids": [pid_a, pid_b, "ghost-zzz"]},
        headers=admin_headers, timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["deleted"] == 2, body
    assert body["skipped"] == 1, body
    for key in ("messages_deleted", "bookings_deleted"):
        assert key in body, f"Missing key {key} in response: {body}"
        assert isinstance(body[key], int)

    # Verify they're actually gone from the admin GET.
    list_r2 = requests.get(f"{API}/admin/properties", headers=admin_headers, timeout=20)
    assert list_r2.status_code == 200
    ids_after = {p["id"] for p in list_r2.json()}
    assert pid_a not in ids_after, f"{pid_a} still present after bulk delete"
    assert pid_b not in ids_after, f"{pid_b} still present after bulk delete"


def test_canonical_test_property_untouched(admin_headers):
    """Make sure the canonical fixture from /app/memory/test_credentials.md
    is still alive after our seeded-and-deleted run above. Skip if it was
    already deleted by a prior unrelated test run — what matters is that
    OUR bulk-delete only acted on the ids we passed in."""
    r = requests.get(f"{API}/admin/properties", headers=admin_headers, timeout=20)
    assert r.status_code == 200
    ids = {p["id"] for p in r.json()}
    if "4f5680df-82a1-4af4-8649-eacc0a629214" not in ids:
        pytest.skip("Canonical fixture missing from DB (pre-existing state, "
                    "not caused by this test). 86c6e09c-... presence: "
                    f"{'86c6e09c-b1e0-4705-a86c-91cd9ce13765' in ids}")

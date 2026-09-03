"""Tests for the merged Bookings/Availability tab dependencies."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://where-am-i-project.preview.emergentagent.com').rstrip('/')


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:200]}"
    body = r.json()
    return body.get("access_token") or body["token"]


@pytest.fixture(scope="module")
def owner_token():
    return _login("owner@test.com", "Test1234!")


@pytest.fixture(scope="module")
def renter_token():
    return _login("renter@test.com", "Test1234!")


def test_owner_availability_owner_ok(owner_token):
    r = requests.get(f"{BASE_URL}/api/owner/availability",
                     headers={"Authorization": f"Bearer {owner_token}"}, timeout=20)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert isinstance(data, dict)
    assert "properties" in data and isinstance(data["properties"], list)
    assert "total" in data and isinstance(data["total"], int)
    assert data["total"] == len(data["properties"])
    # Required per-property fields per problem statement
    required = {"property_id", "title", "area", "status", "current_until", "next_available",
                "upcoming", "booked_days_next_90", "vacant_days_next_90", "occupancy_pct_next_90"}
    for p in data["properties"]:
        missing = required - set(p.keys())
        assert not missing, f"missing fields {missing} in property {p.get('property_id')}"
        assert p["status"] in ("available", "upcoming", "booked"), f"invalid status {p['status']}"
        assert isinstance(p["upcoming"], list)


def test_owner_availability_renter_forbidden(renter_token):
    r = requests.get(f"{BASE_URL}/api/owner/availability",
                     headers={"Authorization": f"Bearer {renter_token}"}, timeout=20)
    assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:200]}"


def test_owner_availability_unauthenticated():
    r = requests.get(f"{BASE_URL}/api/owner/availability", timeout=20)
    assert r.status_code in (401, 403), r.status_code


def test_preview_merge_stacked_route_removed():
    """Direct GET to /preview/merge/stacked should fall through to catch-all (200 with SPA index html).

    This is a FRONTEND path. It was fetched from BASE_URL, which is the API
    server, where it is a 404 by construction; on Emergent both were one
    origin. The SPA is at FRONTEND_URL (default :3000); skipped when
    nothing is serving it."""
    front = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    try:
        requests.get(front, timeout=3)
    except requests.exceptions.RequestException:
        pytest.skip(f"no frontend at {front} - set FRONTEND_URL or start the build server")
    r = requests.get(f"{front}/preview/merge/stacked", timeout=20, allow_redirects=True)
    # SPA serves index.html; route on FE side no longer exists so it falls into NotFound/home.
    # We assert it doesn't render the legacy preview page (no "MergePreview" marker).
    assert r.status_code == 200
    assert "MergePreview" not in r.text


def test_owner_bookings_endpoint(owner_token):
    """Sanity: /api/bookings returns a list for the owner."""
    r = requests.get(f"{BASE_URL}/api/bookings", headers={"Authorization": f"Bearer {owner_token}"}, timeout=20)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert isinstance(data, list)

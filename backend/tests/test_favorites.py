"""Backend tests for favorites/liked properties endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://where-am-i-project.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope="module")
def renter_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "renter@test.com",
        "password": "Test1234!",
    }, timeout=30)
    assert resp.status_code == 200, f"Renter login failed: {resp.status_code} {resp.text}"
    data = resp.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(renter_token):
    return {"Authorization": f"Bearer {renter_token}"}


@pytest.fixture(scope="module")
def sample_property_id():
    """Get a real property id (vacation/stay) to test favoriting."""
    resp = requests.get(f"{BASE_URL}/api/properties", params={"limit": 50}, timeout=30)
    assert resp.status_code == 200
    props = resp.json()
    stays = [p for p in props if p.get("rental_type") in ("vacation", "short-term", "long-term")]
    assert stays, "No stay properties found"
    return stays[0]["id"]


def test_liked_property_ids_requires_auth():
    resp = requests.get(f"{BASE_URL}/api/liked-property-ids", timeout=15)
    assert resp.status_code in (401, 403), f"Expected 401/403, got {resp.status_code}"


def test_liked_properties_requires_auth():
    resp = requests.get(f"{BASE_URL}/api/liked-properties", timeout=15)
    assert resp.status_code in (401, 403), f"Expected 401/403, got {resp.status_code}"


def test_like_toggle_requires_auth(sample_property_id):
    resp = requests.post(f"{BASE_URL}/api/properties/{sample_property_id}/like", timeout=15)
    assert resp.status_code in (401, 403)


def test_get_liked_property_ids_authenticated(auth_headers):
    resp = requests.get(f"{BASE_URL}/api/liked-property-ids", headers=auth_headers, timeout=15)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_get_liked_properties_authenticated(auth_headers):
    resp = requests.get(f"{BASE_URL}/api/liked-properties", headers=auth_headers, timeout=15)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_toggle_like_full_cycle(auth_headers, sample_property_id):
    # Ensure starting state: unliked
    ids_resp = requests.get(f"{BASE_URL}/api/liked-property-ids", headers=auth_headers, timeout=15)
    initial_ids = set(ids_resp.json())
    if sample_property_id in initial_ids:
        # Toggle off first
        requests.post(f"{BASE_URL}/api/properties/{sample_property_id}/like", headers=auth_headers, timeout=15)

    # 1st toggle → liked
    r1 = requests.post(f"{BASE_URL}/api/properties/{sample_property_id}/like", headers=auth_headers, timeout=15)
    assert r1.status_code == 200, r1.text
    body1 = r1.json()
    assert body1["liked"] is True

    # Verify in liked-property-ids
    ids = requests.get(f"{BASE_URL}/api/liked-property-ids", headers=auth_headers, timeout=15).json()
    assert sample_property_id in ids

    # Verify in liked-properties
    props = requests.get(f"{BASE_URL}/api/liked-properties", headers=auth_headers, timeout=15).json()
    assert any(p["id"] == sample_property_id for p in props)

    # 2nd toggle → unliked
    r2 = requests.post(f"{BASE_URL}/api/properties/{sample_property_id}/like", headers=auth_headers, timeout=15)
    assert r2.status_code == 200
    body2 = r2.json()
    assert body2["liked"] is False

    # Verify gone
    ids = requests.get(f"{BASE_URL}/api/liked-property-ids", headers=auth_headers, timeout=15).json()
    assert sample_property_id not in ids


def test_like_nonexistent_property(auth_headers):
    resp = requests.post(f"{BASE_URL}/api/properties/does-not-exist-id-123/like", headers=auth_headers, timeout=15)
    assert resp.status_code == 404

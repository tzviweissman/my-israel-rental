"""Backend tests for the language sync pill feature (PUT /api/auth/language).

Verifies that the admin's preferred_language persists and is returned by /auth/me.
Resets the value at the end so other suites aren't surprised.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@rental.com"
ADMIN_PASSWORD = "Admin1234!"


@pytest.fixture(scope="module")
def admin_token() -> str:
    """Login admin and return JWT."""
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token returned: {data}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module", autouse=True)
def _reset_after(auth_headers):
    """After all tests run, restore admin's preferred_language to 'en'."""
    yield
    try:
        requests.put(
            f"{BASE_URL}/api/auth/language",
            json={"language": "en"},
            headers=auth_headers,
            timeout=10,
        )
    except Exception:
        pass


# --- Unauthenticated rejection ---
def test_language_endpoint_requires_auth():
    r = requests.put(
        f"{BASE_URL}/api/auth/language",
        json={"language": "he"},
        timeout=10,
    )
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


# --- Validation: invalid language ---
def test_language_invalid_value_rejected(auth_headers):
    r = requests.put(
        f"{BASE_URL}/api/auth/language",
        json={"language": "fr"},
        headers=auth_headers,
        timeout=10,
    )
    assert r.status_code in (400, 422), f"expected validation error, got {r.status_code} {r.text}"


# --- Toggle EN -> HE persisted ---
def test_set_language_to_he_persists(auth_headers):
    r = requests.put(
        f"{BASE_URL}/api/auth/language",
        json={"language": "he"},
        headers=auth_headers,
        timeout=10,
    )
    assert r.status_code == 200, f"PUT failed: {r.status_code} {r.text}"
    body = r.json()
    assert "message" in body

    # Verify via /auth/me
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=10)
    assert me.status_code == 200
    assert me.json().get("preferred_language") == "he"


# --- Toggle back to EN persisted ---
def test_set_language_to_en_persists(auth_headers):
    r = requests.put(
        f"{BASE_URL}/api/auth/language",
        json={"language": "en"},
        headers=auth_headers,
        timeout=10,
    )
    assert r.status_code == 200
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=10)
    assert me.status_code == 200
    assert me.json().get("preferred_language") == "en"


# --- Cross-device simulation: a fresh login session sees the new value ---
def test_cross_device_persistence(auth_headers):
    # Set HE via first session
    requests.put(
        f"{BASE_URL}/api/auth/language",
        json={"language": "he"},
        headers=auth_headers,
        timeout=10,
    )
    # Fresh login (simulates a different device/browser)
    r2 = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r2.status_code == 200
    tok2 = r2.json().get("access_token") or r2.json().get("token")
    me2 = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {tok2}"},
        timeout=10,
    )
    assert me2.status_code == 200
    assert me2.json().get("preferred_language") == "he"

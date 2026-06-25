"""Super Admin → Bookings tab endpoints.

Pins:
  1. `/admin/dashboard` now surfaces `total_bookings` (and keeps the
     legacy `total_inquiries` alias for backwards compat).
  2. `/admin/bookings` returns the booking list with joined property
     fields (title, area, images, currency) so the dashboard can render
     thumbnails without a second round-trip per row.
  3. The endpoint is gated on `role: admin` — non-admin tokens get 403.
  4. Status filtering works.
"""
import os
import sys
import uuid

import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@rental.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin1234!")
OWNER_EMAIL = os.environ.get("TEST_OWNER_EMAIL", "owner@test.com")
OWNER_PASSWORD = os.environ.get("TEST_OWNER_PASSWORD", "Test1234!")


def _login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _create_booking_with_property(owner_token):
    """Spin up a vacation property + a booking so we know there's at least
    one fully-joinable row for the admin endpoint to surface."""
    headers = {"Authorization": f"Bearer {owner_token}"}
    pid = requests.post(
        f"{BASE_URL}/api/properties",
        json={
            "title": f"Admin Bookings Test {uuid.uuid4().hex[:6]}",
            "rental_type": "vacation",
            "property_type": "apartment",
            "area": "Tel Aviv - Admin Test",
            "nightly_price": 500,
            "currency": "ILS",
            "bedrooms": 1,
            "bathrooms": 1,
            "max_guests": 2,
            "images": ["https://example.com/test.jpg"],
        },
        headers=headers, timeout=10,
    ).json()["id"]
    bid = requests.post(
        f"{BASE_URL}/api/bookings",
        json={
            "property_id": pid,
            "start_date": "2027-04-10",
            "end_date": "2027-04-14",
            "guest_name": "Admin Test Renter",
            "guest_email": "admin-renter@test.com",
            "guest_phone": "+972500000000",
            "number_of_guests": 2,
        },
        headers=headers, timeout=10,
    ).json()["id"]
    return pid, bid


def test_dashboard_exposes_total_bookings():
    """The new card on the Overview reads `total_bookings`, while the legacy
    `total_inquiries` alias must keep working for any cached frontends."""
    admin_token = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    r = requests.get(f"{BASE_URL}/api/admin/dashboard",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "total_bookings" in data
    assert "total_inquiries" in data  # legacy alias intact
    assert data["total_bookings"] == data["total_inquiries"]
    assert isinstance(data["total_bookings"], int)


def test_admin_bookings_returns_joined_property_fields():
    """Endpoint joins in property title, area, images, currency — without
    those, the dashboard couldn't render a useful row."""
    owner_token = _login(OWNER_EMAIL, OWNER_PASSWORD)
    admin_token = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    pid, bid = _create_booking_with_property(owner_token)
    try:
        r = requests.get(
            f"{BASE_URL}/api/admin/bookings?limit=500",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        ours = next((b for b in data["bookings"] if b["id"] == bid), None)
        assert ours is not None, "Our just-created booking should be in the list"
        # Required joined fields
        assert ours["property_title"]
        assert ours["property_area"]
        assert ours["property_currency"] == "ILS"
        assert ours["property_images"] == ["https://example.com/test.jpg"]
        assert "status_counts" in data
    finally:
        requests.delete(f"{BASE_URL}/api/properties/{pid}",
                        headers={"Authorization": f"Bearer {owner_token}"}, timeout=10)


def test_admin_bookings_status_filter():
    """Filtering by status returns only matching bookings."""
    admin_token = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    r = requests.get(
        f"{BASE_URL}/api/admin/bookings?status=confirmed&limit=500",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=15,
    )
    assert r.status_code == 200
    data = r.json()
    assert all(b["status"] == "confirmed" for b in data["bookings"])


def test_admin_bookings_requires_admin_role():
    """Owner/renter accounts must NOT be able to list every booking on the
    platform — that would leak PII (guest emails, phones) across accounts."""
    owner_token = _login(OWNER_EMAIL, OWNER_PASSWORD)
    r = requests.get(
        f"{BASE_URL}/api/admin/bookings?limit=10",
        headers={"Authorization": f"Bearer {owner_token}"}, timeout=10,
    )
    assert r.status_code == 403

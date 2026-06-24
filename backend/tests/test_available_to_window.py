"""Property `available_to` window — booking guard tests.

Owners can cap a listing's availability with `available_to` (e.g. "I'm
only renting my flat out while I'm abroad July 1-8"). The booking API
must:
  1. Accept bookings entirely within [available_from, available_to].
  2. Reject bookings whose end_date overruns `available_to` with a clear
     error pointing the renter back to the window.
  3. Reject bookings whose start_date precedes `available_from`.
  4. Behave unchanged when no `available_to` is set (open-ended).

The error strings here are part of the contract — the renter-side calendar
disables out-of-window dates, but the API is the source of truth and the
message gets surfaced as a toast on the booking sidebar.
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

OWNER_EMAIL = os.environ.get("TEST_OWNER_EMAIL", "owner@test.com")
OWNER_PASSWORD = os.environ.get("TEST_OWNER_PASSWORD", "Test1234!")


def _login():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _create_prop(token, available_from=None, available_to=None):
    payload = {
        "title": f"Avail-To Test {uuid.uuid4().hex[:6]}",
        "rental_type": "vacation",
        "property_type": "apartment",
        "area": "Tel Aviv - Test",
        "nightly_price": 500,
        "currency": "ILS",
        "bedrooms": 1,
        "bathrooms": 1,
        "max_guests": 2,
    }
    if available_from:
        payload["available_from"] = available_from
    if available_to:
        payload["available_to"] = available_to
    r = requests.post(f"{BASE_URL}/api/properties",
                      json=payload,
                      headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _book(token, pid, start, end):
    return requests.post(
        f"{BASE_URL}/api/bookings",
        json={
            "property_id": pid,
            "start_date": start,
            "end_date": end,
            "guest_name": "Test Renter",
            "guest_email": "renter@test.com",
            "guest_phone": "+972500000000",
            "number_of_guests": 2,
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )


def _delete(token, pid):
    requests.delete(f"{BASE_URL}/api/properties/{pid}",
                    headers={"Authorization": f"Bearer {token}"}, timeout=10)


def test_booking_within_window_accepted():
    """Happy path — checkout falls exactly on available_to is allowed."""
    token = _login()
    pid = _create_prop(token, available_from="2027-03-01", available_to="2027-03-08")
    try:
        r = _book(token, pid, "2027-03-03", "2027-03-08")
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "confirmed"
    finally:
        _delete(token, pid)


def test_booking_past_available_to_rejected():
    """End date later than available_to → 400 with explanatory message."""
    token = _login()
    pid = _create_prop(token, available_from="2027-03-01", available_to="2027-03-08")
    try:
        r = _book(token, pid, "2027-03-06", "2027-03-12")
        assert r.status_code == 400
        assert "2027-03-08" in r.json()["detail"]
    finally:
        _delete(token, pid)


def test_booking_before_available_from_rejected():
    """Start date earlier than available_from → 400."""
    token = _login()
    pid = _create_prop(token, available_from="2027-03-01", available_to="2027-03-08")
    try:
        r = _book(token, pid, "2027-02-25", "2027-03-03")
        assert r.status_code == 400
        assert "2027-03-01" in r.json()["detail"]
    finally:
        _delete(token, pid)


def test_no_window_allows_any_future_dates():
    """Property without available_to is unrestricted (open-ended) — the
    pre-existing behavior must keep working."""
    token = _login()
    pid = _create_prop(token)
    try:
        r = _book(token, pid, "2028-01-15", "2028-01-20")
        assert r.status_code == 200, r.text
    finally:
        _delete(token, pid)


def test_only_available_to_set_still_blocks_overflow():
    """Owner can set just `available_to` without `available_from` — the
    cap still applies."""
    token = _login()
    pid = _create_prop(token, available_to="2027-06-30")
    try:
        # Within
        r1 = _book(token, pid, "2027-06-25", "2027-06-30")
        assert r1.status_code == 200, r1.text
        # Overflow
        r2 = _book(token, pid, "2027-07-01", "2027-07-05")
        assert r2.status_code == 400
        assert "2027-06-30" in r2.json()["detail"]
    finally:
        _delete(token, pid)

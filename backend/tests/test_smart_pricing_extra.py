"""Additional smart-pricing HTTP tests for iteration_26.

Covers gaps from the review request:
  - PATCH validation: min_nightly > max_nightly → 400
  - Calculate window contains Fri/Sat with weekend factor labelled correctly
  - Calculate window has last-minute discount on lead<=7 dates
  - GET /api/properties/{id} bumps views AND records a property_view_events row
  - Applied smart-pricing overrides flow into the booking total
"""
import os
import sys
import uuid
import asyncio
from datetime import date, timedelta

import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")
from routes.deps import db  # noqa: E402

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL", "")).rstrip("/")

OWNER = ("owner@test.com", "Test1234!")
RENTER = ("renter@test.com", "Test1234!")


def _login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _create_vacation(token, nightly=500):
    payload = {
        "title": f"SP Extra {uuid.uuid4().hex[:6]}",
        "rental_type": "vacation",
        "property_type": "apartment",
        "area": "Jerusalem - SP Extra",
        "nightly_price": nightly,
        "currency": "ILS",
        "bedrooms": 2,
        "bathrooms": 1,
        "max_guests": 4,
    }
    r = requests.post(f"{BASE_URL}/api/properties", json=payload,
                      headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _delete(token, pid):
    requests.delete(f"{BASE_URL}/api/properties/{pid}",
                    headers={"Authorization": f"Bearer {token}"}, timeout=10)


def test_patch_min_greater_than_max_returns_400():
    token = _login(*OWNER)
    pid = _create_vacation(token)
    h = {"Authorization": f"Bearer {token}"}
    try:
        bad = {"enabled": True, "auto_apply": False, "base_nightly": 500,
               "min_nightly": 2000, "max_nightly": 500,
               "weekend_premium_pct": 20, "holiday_premium_pct": 30,
               "last_minute_discount_pct": 10, "lead_time_premium_pct": 5,
               "high_demand_premium_pct": 12, "low_demand_discount_pct": 8,
               "comparable_blend_pct": 10}
        r = requests.patch(f"{BASE_URL}/api/properties/{pid}/smart-pricing/settings",
                           json=bad, headers=h, timeout=10)
        assert r.status_code == 400
        assert "min_nightly" in r.json()["detail"].lower()
    finally:
        _delete(token, pid)


def test_calculate_factors_weekend_and_lastminute_in_window():
    """14-day window must contain a Fri/Sat with weekend factor, and a
    next-7-day entry with the last-minute discount factor."""
    token = _login(*OWNER)
    pid = _create_vacation(token)
    h = {"Authorization": f"Bearer {token}"}
    try:
        cfg = {"enabled": True, "auto_apply": False, "base_nightly": 1000,
               "min_nightly": 200, "max_nightly": 2000,
               "weekend_premium_pct": 25, "holiday_premium_pct": 0,
               "last_minute_discount_pct": 15, "lead_time_premium_pct": 0,
               "high_demand_premium_pct": 0, "low_demand_discount_pct": 0,
               "comparable_blend_pct": 0}
        r = requests.patch(f"{BASE_URL}/api/properties/{pid}/smart-pricing/settings",
                           json=cfg, headers=h, timeout=10)
        assert r.status_code == 200
        r = requests.post(f"{BASE_URL}/api/properties/{pid}/smart-pricing/calculate",
                          json={"days": 14}, headers=h, timeout=15)
        assert r.status_code == 200
        suggs = r.json()["suggestions"]
        assert len(suggs) == 14
        # Weekend factor must appear for at least one Fri/Sat in the window
        weekend_hits = [s for s in suggs if any("weekend" in f["name"].lower() for f in s["factors"])]
        assert len(weekend_hits) >= 1, "No weekend factor in 14-day window"
        # Last-minute discount must fire on at least one near-term date
        lm_hits = [s for s in suggs if any("last-minute" in f["name"].lower() for f in s["factors"])]
        assert len(lm_hits) >= 1, "No last-minute factor in 14-day window"
        # Reasons non-empty + clamped
        for s in suggs:
            assert isinstance(s["reason"], str) and len(s["reason"]) > 0
            assert 200 <= s["price"] <= 2000
        # Forecast shape
        f = r.json()["forecast"]
        for k in ("open_nights", "booked_nights", "base_total", "smart_total", "delta", "delta_pct"):
            assert k in f
    finally:
        _delete(token, pid)


def test_property_get_records_view_event_and_bumps_views():
    """Public GET /api/properties/{id} should insert a row in
    property_view_events AND increment the views counter."""
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGO_URL") or dotenv_values("/app/backend/.env").get("MONGO_URL")
    db_name = os.environ.get("DB_NAME") or dotenv_values("/app/backend/.env").get("DB_NAME")

    async def _run(pid):
        client = AsyncIOMotorClient(mongo_url)
        d = client[db_name]
        before_evts = await d.property_view_events.count_documents({"property_id": pid})
        before_prop = await d.properties.find_one({"id": pid}, {"_id": 0, "views": 1})
        before_views = (before_prop or {}).get("views", 0) or 0
        # fire HTTP from inside the loop via requests is fine — it's sync
        r = requests.get(f"{BASE_URL}/api/properties/{pid}", timeout=10)
        assert r.status_code == 200
        await asyncio.sleep(0.6)
        after_evts = await d.property_view_events.count_documents({"property_id": pid})
        after_prop = await d.properties.find_one({"id": pid}, {"_id": 0, "views": 1})
        after_views = (after_prop or {}).get("views", 0) or 0
        client.close()
        return before_evts, after_evts, before_views, after_views

    token = _login(*OWNER)
    pid = _create_vacation(token)
    try:
        b_e, a_e, b_v, a_v = asyncio.run(_run(pid))
        assert a_e == b_e + 1, f"view event not inserted ({b_e}→{a_e})"
        assert a_v == b_v + 1, f"views counter not bumped ({b_v}→{a_v})"
    finally:
        _delete(token, pid)


def test_applied_override_feeds_booking_total():
    """After owner applies smart pricing on a 3-night window, a renter
    booking those nights should get a total that reflects the applied
    nightly prices, NOT bare nightly_price * 3."""
    owner_token = _login(*OWNER)
    pid = _create_vacation(owner_token, nightly=500)
    h_owner = {"Authorization": f"Bearer {owner_token}"}
    try:
        # Force a strong weekend premium so applied price ≠ base
        cfg = {"enabled": True, "auto_apply": False, "base_nightly": 500,
               "min_nightly": 100, "max_nightly": 5000,
               "weekend_premium_pct": 50, "holiday_premium_pct": 0,
               "last_minute_discount_pct": 0, "lead_time_premium_pct": 0,
               "high_demand_premium_pct": 0, "low_demand_discount_pct": 0,
               "comparable_blend_pct": 0}
        r = requests.patch(f"{BASE_URL}/api/properties/{pid}/smart-pricing/settings",
                           json=cfg, headers=h_owner, timeout=10)
        assert r.status_code == 200
        # Calculate 60 days so we definitely cover a future window
        r = requests.post(f"{BASE_URL}/api/properties/{pid}/smart-pricing/calculate",
                          json={"days": 60}, headers=h_owner, timeout=20)
        assert r.status_code == 200
        suggs = r.json()["suggestions"]

        # Pick the FIRST 3-night contiguous window in the future where
        # at least one night has price ≠ base (i.e. a weekend hit).
        # We skip the first 8 nights to avoid lead-time interference.
        window = None
        for i in range(8, len(suggs) - 3):
            w = suggs[i:i + 3]
            if any(s["price"] != s["base"] for s in w):
                window = w
                break
        assert window is not None, "No price variance found in 60-day window"
        dates = [s["date"] for s in window]
        expected_total = sum(s["price"] for s in window)

        # Apply ONLY those 3 dates
        r = requests.post(f"{BASE_URL}/api/properties/{pid}/smart-pricing/apply",
                          json={"dates": dates}, headers=h_owner, timeout=10)
        assert r.status_code == 200
        assert r.json()["applied_count"] == 3

        # Renter creates a booking spanning those 3 nights
        renter_token = _login(*RENTER)
        h_renter = {"Authorization": f"Bearer {renter_token}"}
        # end_date is exclusive of last night (3 nights = start..start+3)
        start = dates[0]
        end = (date.fromisoformat(dates[-1]) + timedelta(days=1)).isoformat()
        booking_payload = {
            "property_id": pid, "start_date": start, "end_date": end,
            "guests": 2, "guest_name": "Test", "guest_email": "renter@test.com",
            "guest_phone": "555-1234",
        }
        r = requests.post(f"{BASE_URL}/api/bookings", json=booking_payload,
                          headers=h_renter, timeout=15)
        # Booking may return 200 or 201 depending on impl; key check is total
        # The booking doc/API doesn't surface total_price — it's only used
        # for the confirmation email. Verify the engine by calling
        # _compute_booking_total directly (which is what the email pipeline uses).
        from routes.bookings import _compute_booking_total
        from routes.bookings import BookingCreate as _BC

        async def _calc():
            from motor.motor_asyncio import AsyncIOMotorClient
            mongo_url = os.environ.get("MONGO_URL") or dotenv_values("/app/backend/.env").get("MONGO_URL")
            db_name = os.environ.get("DB_NAME") or dotenv_values("/app/backend/.env").get("DB_NAME")
            client = AsyncIOMotorClient(mongo_url)
            d = client[db_name]
            prop = await d.properties.find_one({"id": pid}, {"_id": 0})
            client.close()
            bc = _BC(property_id=pid, start_date=start, end_date=end, guests=2,
                     guest_name="Test", guest_email="renter@test.com", guest_phone="555-1234")
            return await _compute_booking_total(bc, prop, None)

        total = asyncio.run(_calc())
        bare_total = 500 * 3
        assert total is not None, f"no total in booking response: {b}"
        assert int(round(total)) == expected_total, (
            f"booking total {total} != applied-smart total {expected_total} "
            f"(bare={bare_total}, suggested per-night={[s['price'] for s in window]})"
        )
        assert int(round(total)) != bare_total, "Override did not change total"
    finally:
        _delete(owner_token, pid)

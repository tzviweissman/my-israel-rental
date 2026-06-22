"""Smart Pricing engine — pure-function unit tests + HTTP smoke test.

The engine ships as a deterministic, no-third-party rules pipeline:
weekend / holiday / lead-time / demand / comparable-blend / clamp. These
tests pin each rule independently so a future refactor (e.g. swapping in
a different demand signal) can't silently break the documented behavior
hosts have already calibrated their min/max bands against.

Network-dependent pieces (Hebcal fetch, Mongo aggregates) are stubbed by
passing pre-computed ``signals`` dicts directly to ``compute_suggestion``
— the function contract is "give me signals, get a price". That makes the
tests fast (< 200ms) and CI-friendly.
"""
import os
import sys
import uuid
from datetime import date, timedelta

import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")
from routes.smart_pricing import SmartPricingSettings, compute_suggestion  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL", "").rstrip("/")


# ---------------------------------------------------------------------------
# Pure-function unit tests
# ---------------------------------------------------------------------------

def _settings(**overrides):
    """Build a SmartPricingSettings with most rules zeroed out so each test
    isolates exactly one factor. Override only the rule under test."""
    base = {
        "enabled": True,
        "auto_apply": False,
        "base_nightly": 500,
        "min_nightly": 1,
        "max_nightly": 99999,
        "weekend_premium_pct": 0,
        "holiday_premium_pct": 0,
        "last_minute_discount_pct": 0,
        "lead_time_premium_pct": 0,
        "high_demand_premium_pct": 0,
        "low_demand_discount_pct": 0,
        "comparable_blend_pct": 0,
    }
    base.update(overrides)
    return SmartPricingSettings(**base)


def _empty_signals():
    return {
        "holidays": {},
        "comparable_median": None,
        "views_14d": 0,
        "area_avg_views": 0,
        "booked_dates": set(),
    }


def test_baseline_no_factors_returns_base():
    """All rules at 0 → price = base, no factors recorded."""
    s = _settings()
    target = date.today() + timedelta(days=30)  # Far enough out to skip lead-time
    out = compute_suggestion({"nightly_price": 500, "currency": "ILS"}, s, target, _empty_signals())
    assert out.price == 500
    assert out.base == 500
    assert out.factors == []


def test_weekend_premium_applies_friday_and_saturday():
    """weekday() 4 = Friday, 5 = Saturday in Python — both should fire."""
    s = _settings(weekend_premium_pct=20)
    # Find next Friday
    today = date.today()
    days_to_fri = (4 - today.weekday()) % 7 or 7
    friday = today + timedelta(days=days_to_fri)
    saturday = friday + timedelta(days=1)
    sunday = friday + timedelta(days=2)
    prop = {"nightly_price": 500, "currency": "ILS"}
    assert compute_suggestion(prop, s, friday, _empty_signals()).price == 600
    assert compute_suggestion(prop, s, saturday, _empty_signals()).price == 600
    # Sunday is NOT a weekend in Israel — no premium
    assert compute_suggestion(prop, s, sunday, _empty_signals()).price == 500


def test_holiday_premium_pulls_name_into_factor_label():
    s = _settings(holiday_premium_pct=50)
    target = date.today() + timedelta(days=30)
    signals = _empty_signals()
    signals["holidays"] = {target.isoformat(): "Sukkot"}
    out = compute_suggestion({"nightly_price": 500, "currency": "ILS"}, s, target, signals)
    assert out.price == 750
    assert any("Sukkot" in f.name for f in out.factors)


def test_last_minute_discount_within_seven_days():
    s = _settings(last_minute_discount_pct=20)
    today = date.today()
    target = today + timedelta(days=3)  # ≤7 days
    out = compute_suggestion({"nightly_price": 500, "currency": "ILS"}, s, target, _empty_signals(), today=today)
    assert out.price == 400


def test_lead_time_premium_for_far_future():
    s = _settings(lead_time_premium_pct=10)
    today = date.today()
    target = today + timedelta(days=120)  # ≥90
    out = compute_suggestion({"nightly_price": 500, "currency": "ILS"}, s, target, _empty_signals(), today=today)
    assert out.price == 550


def test_min_max_clamp_floors_and_ceilings():
    # Floor
    s_floor = _settings(weekend_premium_pct=0, holiday_premium_pct=200, min_nightly=400, max_nightly=600)
    target = date.today() + timedelta(days=30)
    signals = _empty_signals()
    signals["holidays"] = {target.isoformat(): "Holiday"}
    out = compute_suggestion({"nightly_price": 500, "currency": "ILS"}, s_floor, target, signals)
    assert out.price == 600  # clamped at max
    # Ceiling — discount below min
    s_ceil = _settings(last_minute_discount_pct=80, min_nightly=400, max_nightly=600)
    today = date.today()
    out2 = compute_suggestion({"nightly_price": 500, "currency": "ILS"}, s_ceil, today + timedelta(days=1), _empty_signals(), today=today)
    assert out2.price == 400  # clamped at min (would otherwise be 100)


def test_high_demand_kicks_in_only_with_sufficient_sample():
    """area_avg < 5 → demand rule should NOT fire (too noisy)."""
    s = _settings(high_demand_premium_pct=20)
    target = date.today() + timedelta(days=30)
    signals = _empty_signals()
    signals.update({"views_14d": 100, "area_avg_views": 3})
    out = compute_suggestion({"nightly_price": 500, "currency": "ILS"}, s, target, signals)
    assert out.price == 500  # no premium — sample too small

    # With a proper sample, premium fires
    signals.update({"views_14d": 100, "area_avg_views": 50})  # 2× area avg
    out2 = compute_suggestion({"nightly_price": 500, "currency": "ILS"}, s, target, signals)
    assert out2.price == 600


def test_comparable_blend_pulls_toward_market_median():
    """10% blend at 1000 base + 800 median → 980 (gentle pull)."""
    s = _settings(comparable_blend_pct=10, base_nightly=1000)
    target = date.today() + timedelta(days=30)
    signals = _empty_signals()
    signals["comparable_median"] = 800
    out = compute_suggestion({"nightly_price": 1000, "currency": "ILS"}, s, target, signals)
    assert out.price == 980


def test_past_date_returns_base_with_empty_factors():
    s = _settings(weekend_premium_pct=99, holiday_premium_pct=99)
    yesterday = date.today() - timedelta(days=1)
    out = compute_suggestion({"nightly_price": 500, "currency": "ILS"}, s, yesterday, _empty_signals())
    assert out.price == 500
    assert out.factors == []


# ---------------------------------------------------------------------------
# HTTP smoke tests — real backend, real Mongo, real owner JWT
# ---------------------------------------------------------------------------

OWNER_EMAIL = os.environ.get("TEST_OWNER_EMAIL", "owner@test.com")
OWNER_PASSWORD = os.environ.get("TEST_OWNER_PASSWORD", "Test1234!")


def _login(email=OWNER_EMAIL, pw=OWNER_PASSWORD):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _create_test_property(token):
    """Create a fresh vacation property so the test is isolated."""
    payload = {
        "title": f"Smart Pricing Test {uuid.uuid4().hex[:6]}",
        "rental_type": "vacation",
        "property_type": "apartment",
        "area": "Jerusalem - Test Smart Pricing",
        "nightly_price": 500,
        "currency": "ILS",
        "bedrooms": 2,
        "bathrooms": 1,
        "max_guests": 4,
    }
    r = requests.post(f"{BASE_URL}/api/properties",
                      json=payload,
                      headers={"Authorization": f"Bearer {token}"},
                      timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _delete_property(token, pid):
    requests.delete(f"{BASE_URL}/api/properties/{pid}",
                    headers={"Authorization": f"Bearer {token}"}, timeout=10)


def test_http_settings_round_trip_and_calculate():
    """End-to-end: PATCH settings → POST calculate → assertions on shape."""
    token = _login()
    pid = _create_test_property(token)
    headers = {"Authorization": f"Bearer {token}"}
    try:
        # GET defaults
        r = requests.get(f"{BASE_URL}/api/properties/{pid}/smart-pricing/settings", headers=headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["settings"]["enabled"] is False

        # PATCH new settings
        new_settings = {
            "enabled": True, "auto_apply": False,
            "base_nightly": 500, "min_nightly": 300, "max_nightly": 1500,
            "weekend_premium_pct": 25, "holiday_premium_pct": 40,
            "last_minute_discount_pct": 10, "lead_time_premium_pct": 5,
            "high_demand_premium_pct": 12, "low_demand_discount_pct": 8,
            "comparable_blend_pct": 10,
        }
        r = requests.patch(f"{BASE_URL}/api/properties/{pid}/smart-pricing/settings",
                           json=new_settings, headers=headers, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["enabled"] is True

        # CALCULATE 14 days
        r = requests.post(f"{BASE_URL}/api/properties/{pid}/smart-pricing/calculate",
                          json={"days": 14}, headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["suggestions"]) == 14
        assert "forecast" in data
        # Every suggestion should expose a reason + numeric price within bands
        for s in data["suggestions"]:
            assert 300 <= s["price"] <= 1500
            assert isinstance(s["reason"], str)

        # APPLY ALL
        r = requests.post(f"{BASE_URL}/api/properties/{pid}/smart-pricing/apply",
                          json={"days": 14}, headers=headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["applied_count"] == 14

        # REVERT one
        first_date = data["suggestions"][0]["date"]
        r = requests.delete(
            f"{BASE_URL}/api/properties/{pid}/smart-pricing/apply/{first_date}",
            headers=headers, timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["reverted"] is True
    finally:
        _delete_property(token, pid)


def test_http_blocks_non_vacation_rentals():
    """Smart Pricing should 400 on long-term properties to prevent
    misconfiguration on rental types where dynamic pricing doesn't make sense."""
    token = _login()
    payload = {
        "title": f"LT Smart Pricing Test {uuid.uuid4().hex[:6]}",
        "rental_type": "long-term",
        "property_type": "apartment",
        "area": "Jerusalem - Test LT",
        "monthly_price": 5000,
        "currency": "ILS",
    }
    r = requests.post(f"{BASE_URL}/api/properties",
                      json=payload,
                      headers={"Authorization": f"Bearer {token}"},
                      timeout=10)
    assert r.status_code == 200
    pid = r.json()["id"]
    try:
        r = requests.get(f"{BASE_URL}/api/properties/{pid}/smart-pricing/settings",
                         headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r.status_code == 400
        assert "vacation" in r.json()["detail"].lower()
    finally:
        _delete_property(token, pid)


def test_http_other_owner_cannot_access():
    """Cross-account access is forbidden — the renter token shouldn't be
    able to read or write another user's Smart Pricing settings."""
    token_owner = _login()
    pid = _create_test_property(token_owner)
    renter_token = _login(
        email=os.environ.get("TEST_RENTER_EMAIL", "renter@test.com"),
        pw=os.environ.get("TEST_RENTER_PASSWORD", "Test1234!"),
    )
    try:
        r = requests.get(
            f"{BASE_URL}/api/properties/{pid}/smart-pricing/settings",
            headers={"Authorization": f"Bearer {renter_token}"},
            timeout=10,
        )
        assert r.status_code == 403
    finally:
        _delete_property(token_owner, pid)

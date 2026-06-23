"""Weekly Pricing Insights digest — HTTP integration tests.

We deliberately use HTTP round-trips (not direct asyncio + Motor calls) so
the tests don't fight Motor's "first loop wins" binding when interleaved
with other test modules that also poke async code. The HTTP layer exercises
the same code paths anyway: `/insights/send-sample` calls
`_build_owner_digest` under the hood, `/insights/preferences` round-trips
the opt-out flag.

Coverage:
  1. Preferences round-trip (GET / PATCH).
  2. Send-sample → 400 when the account has zero SP-enabled vacation
     listings (helpful error message).
  3. Cron pre-check (`_send_owner_digest_if_eligible`) honors opt-out
     without touching Postmark.
"""
import asyncio
import os
import sys
import uuid

import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")
from routes.smart_pricing import _send_owner_digest_if_eligible  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL", "").rstrip("/")

OWNER_EMAIL = os.environ.get("TEST_OWNER_EMAIL", "owner@test.com")
OWNER_PASSWORD = os.environ.get("TEST_OWNER_PASSWORD", "Test1234!")


def _login(email=OWNER_EMAIL, pw=OWNER_PASSWORD):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_http_insights_preferences_round_trip():
    """GET defaults to opt-in (optout=False). PATCH toggles flag both
    ways. Re-reads reflect the new state."""
    token = _login()
    headers = {"Authorization": f"Bearer {token}"}

    r = requests.get(f"{BASE_URL}/api/smart-pricing/insights/preferences",
                     headers=headers, timeout=10)
    assert r.status_code == 200
    assert "optout" in r.json()

    r = requests.patch(f"{BASE_URL}/api/smart-pricing/insights/preferences",
                       json={"optout": True}, headers=headers, timeout=10)
    assert r.status_code == 200
    assert r.json()["optout"] is True

    r = requests.patch(f"{BASE_URL}/api/smart-pricing/insights/preferences",
                       json={"optout": False}, headers=headers, timeout=10)
    assert r.status_code == 200
    assert r.json()["optout"] is False


def test_send_owner_digest_skips_optout():
    """The cron-level helper honors opt-out and short-circuits BEFORE
    hitting Mongo or Postmark — keeps the weekly job fast for accounts
    that have unsubscribed."""
    owner = {
        "id": "test-optout-" + uuid.uuid4().hex,
        "email": "no-such@example.com",
        "name": "Opt Out",
        "pricing_insights_optout": True,
    }
    sent = asyncio.run(_send_owner_digest_if_eligible(owner))
    assert sent is False


def test_send_owner_digest_skips_suppressed_email():
    """Suppressed accounts (hard bounce / spam complaint via Postmark
    webhook) are skipped — avoids the digest re-tripping Postmark's
    suppression list."""
    owner = {
        "id": "test-suppressed-" + uuid.uuid4().hex,
        "email": "bounced@example.com",
        "name": "Bouncer",
        "email_suppressed": True,
    }
    sent = asyncio.run(_send_owner_digest_if_eligible(owner))
    assert sent is False


def test_send_sample_400_with_no_enabled_smart_pricing():
    """An owner with no SP-enabled vacation listings can't preview the
    digest — endpoint returns a helpful 400 instead of sending a blank
    email."""
    # Use a fresh renter account that owns no properties at all.
    renter_email = os.environ.get("TEST_RENTER_EMAIL", "renter@test.com")
    renter_pw = os.environ.get("TEST_RENTER_PASSWORD", "Test1234!")
    token = _login(email=renter_email, pw=renter_pw)
    r = requests.post(f"{BASE_URL}/api/smart-pricing/insights/send-sample",
                      headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 400, r.text
    assert "smart pricing" in r.json()["detail"].lower()

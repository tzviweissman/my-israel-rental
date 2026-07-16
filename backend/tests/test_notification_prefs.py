"""Backend tests locking in notification preferences + signed email tokens.

Covers:
- GET/PATCH /marketplace/notification-preferences
- POST /marketplace/notification-preferences/snooze (auth-gated)
- POST /marketplace/notification-preferences/snooze-consume (public, signed)
- POST /auth/deeplink-consume (public, signed → session JWT)
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

import pytest
import requests

sys.path.insert(0, "/app/backend")
os.environ.setdefault("JWT_SECRET", "m7jrF-RpPUgn7DoQb4O4QCgK2XtfpdCbT-AnXnAky_hKPHrynRXyx2J7_DsihG8R")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://where-am-i-project.preview.emergentagent.com"

RENTER = {"email": "renter@test.com", "password": "Test1234!"}
OWNER = {"email": "owner@test.com", "password": "Test1234!"}

# Cache tokens to avoid /api/auth/login IP throttling
_TOKENS: dict[str, str] = {}


def _login(creds: dict[str, str]) -> str:
    key = creds["email"]
    if key in _TOKENS:
        return _TOKENS[key]
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {key}: {r.status_code} {r.text}"
    tok = r.json()["token"]
    _TOKENS[key] = tok
    return tok


@pytest.fixture(scope="module")
def renter_token() -> str:
    return _login(RENTER)


@pytest.fixture(scope="module")
def renter_headers(renter_token) -> dict[str, str]:
    return {"Authorization": f"Bearer {renter_token}"}


# ------------ Preferences GET / PATCH ------------

class TestPreferences:
    def test_get_returns_defaults_or_existing(self, renter_headers):
        r = requests.get(
            f"{BASE_URL}/api/marketplace/notification-preferences",
            headers=renter_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mode"] in ("instant", "digest", "both")
        assert isinstance(data["snoozed_categories"], list)

    @pytest.mark.parametrize("mode", ["instant", "both", "digest"])
    def test_patch_mode_valid(self, renter_headers, mode):
        r = requests.patch(
            f"{BASE_URL}/api/marketplace/notification-preferences",
            headers=renter_headers, json={"mode": mode}, timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["mode"] == mode
        # Verify persistence
        g = requests.get(
            f"{BASE_URL}/api/marketplace/notification-preferences",
            headers=renter_headers, timeout=15,
        )
        assert g.json()["mode"] == mode

    def test_patch_invalid_mode_400(self, renter_headers):
        r = requests.patch(
            f"{BASE_URL}/api/marketplace/notification-preferences",
            headers=renter_headers, json={"mode": "sometimes"}, timeout=15,
        )
        assert r.status_code in (400, 422), r.text


# ------------ Snooze auth-gated ------------

class TestSnooze:
    def test_snooze_valid_category(self, renter_headers):
        r = requests.post(
            f"{BASE_URL}/api/marketplace/notification-preferences/snooze",
            headers=renter_headers, json={"category": "home-services-repair"}, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["category"] == "home-services-repair"
        until = datetime.fromisoformat(data["until"])
        # ensure ~7 days ahead (allow +/- 2 days slop)
        delta = until - datetime.now(timezone.utc)
        assert timedelta(days=5) < delta < timedelta(days=9), delta

        # GET reflects snooze
        g = requests.get(
            f"{BASE_URL}/api/marketplace/notification-preferences",
            headers=renter_headers, timeout=15,
        ).json()
        assert any(s["category"] == "home-services-repair" for s in g["snoozed_categories"])

    def test_snooze_unknown_category_400(self, renter_headers):
        r = requests.post(
            f"{BASE_URL}/api/marketplace/notification-preferences/snooze",
            headers=renter_headers, json={"category": "foobar"}, timeout=15,
        )
        assert r.status_code == 400, r.text


# ------------ Signed snooze-consume (public) ------------

class TestSnoozeConsume:
    def test_valid_token_applies_snooze(self):
        from utils.notification_tokens import create_snooze_token
        # renter user_id from problem statement
        user_id = "e4d3695f-6090-4499-9912-9d253d3115a4"
        token = create_snooze_token(user_id, "transportation")
        r = requests.post(
            f"{BASE_URL}/api/marketplace/notification-preferences/snooze-consume",
            json={"token": token}, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["category"] == "transportation"
        assert "until" in data

    def test_garbage_token_400(self):
        r = requests.post(
            f"{BASE_URL}/api/marketplace/notification-preferences/snooze-consume",
            json={"token": "not-a-jwt"}, timeout=15,
        )
        assert r.status_code == 400
        assert "invalid" in r.json()["detail"].lower()

    def test_wrong_purpose_token_400(self):
        from utils.notification_tokens import create_deeplink_token
        user_id = "e4d3695f-6090-4499-9912-9d253d3115a4"
        tok = create_deeplink_token(user_id, "some-job")
        r = requests.post(
            f"{BASE_URL}/api/marketplace/notification-preferences/snooze-consume",
            json={"token": tok}, timeout=15,
        )
        assert r.status_code == 400
        assert "invalid" in r.json()["detail"].lower()


# ------------ Deeplink consume ------------

class TestDeeplinkConsume:
    def test_valid_deeplink_returns_session_and_works(self):
        from utils.notification_tokens import create_deeplink_token
        user_id = "e4d3695f-6090-4499-9912-9d253d3115a4"
        job_id = "test-job-id-abc123"
        token = create_deeplink_token(user_id, job_id)
        r = requests.post(
            f"{BASE_URL}/api/auth/deeplink-consume",
            json={"token": token}, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["job_id"] == job_id
        assert data["user"]["email"] == "renter@test.com"
        session_tok = data["token"]
        assert isinstance(session_tok, str) and len(session_tok) > 20

        # Verify session token works on a protected endpoint
        me = requests.get(
            f"{BASE_URL}/api/marketplace/notification-preferences",
            headers={"Authorization": f"Bearer {session_tok}"}, timeout=15,
        )
        assert me.status_code == 200

    def test_garbage_token_400(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/deeplink-consume",
            json={"token": "nope"}, timeout=15,
        )
        assert r.status_code == 400

    def test_wrong_purpose_400(self):
        from utils.notification_tokens import create_snooze_token
        tok = create_snooze_token("e4d3695f-6090-4499-9912-9d253d3115a4", "home-services-repair")
        r = requests.post(
            f"{BASE_URL}/api/auth/deeplink-consume",
            json={"token": tok}, timeout=15,
        )
        assert r.status_code == 400


# ------------ Instant email path (log-observation) ------------

class TestInstantEmailPath:
    """We can't reliably read Postmark inbox, but backend logs record
    Postmark send attempts. We assert the code path fires by posting
    jobs under different pref/snooze combos and inspecting the tail of
    backend logs for renter@test.com."""

    def _read_backend_log_tail(self, lines: int = 500) -> str:
        import subprocess
        try:
            out = subprocess.check_output(
                ["tail", "-n", str(lines), "/var/log/supervisor/backend.err.log"],
                stderr=subprocess.STDOUT, timeout=5,
            ).decode(errors="ignore")
            out2 = subprocess.check_output(
                ["tail", "-n", str(lines), "/var/log/supervisor/backend.out.log"],
                stderr=subprocess.STDOUT, timeout=5,
            ).decode(errors="ignore")
            return out + "\n" + out2
        except Exception:
            return ""

    def _ensure_renter_gig(self):
        """Ensure renter has a published home-repair gig so notifier picks them."""
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        import uuid
        async def _do():
            client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = client[os.environ.get("DB_NAME", "test_database")]
            existing = await db.marketplace_gigs.find_one({
                "provider_user_id": "e4d3695f-6090-4499-9912-9d253d3115a4",
                "category": "home-services-repair",
                "status": "published",
            })
            if not existing:
                await db.marketplace_gigs.insert_one({
                    "_id": str(uuid.uuid4()),
                    "provider_user_id": "e4d3695f-6090-4499-9912-9d253d3115a4",
                    "category": "home-services-repair",
                    "status": "published",
                    "title": "TEST_ home repair gig",
                    "description": "Test gig for notif tests",
                    "gig_type": "deliverable",
                    "tiers": [{"name": "Basic", "price": 100, "currency": "ILS"}],
                    "area": "Tel Aviv",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
            # also ensure no active snoozes for home-repair
            await db.job_notification_preferences.update_one(
                {"user_id": "e4d3695f-6090-4499-9912-9d253d3115a4"},
                {"$set": {"snoozed_categories": []}}, upsert=True,
            )
        asyncio.run(_do())

    def _post_job(self, owner_headers, area="Tel Aviv", category="home-services-repair"):
        payload = {
            "title": "TEST_ Fix leaky pipe",
            "description": "Kitchen tap dripping",
            "category": category,
            "area": area,
            "budget_type": "fixed",
            "budget_amount": 500,
            "budget_currency": "ILS",
        }
        r = requests.post(f"{BASE_URL}/api/marketplace/jobs", headers=owner_headers, json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        return r.json()

    def _set_renter_mode(self, mode, renter_headers):
        r = requests.patch(
            f"{BASE_URL}/api/marketplace/notification-preferences",
            headers=renter_headers, json={"mode": mode}, timeout=15,
        )
        assert r.status_code == 200

    def _clear_snoozes(self, renter_headers):
        # No dedicated endpoint; direct db
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        async def _do():
            client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = client[os.environ.get("DB_NAME", "test_database")]
            await db.job_notification_preferences.update_one(
                {"user_id": "e4d3695f-6090-4499-9912-9d253d3115a4"},
                {"$set": {"snoozed_categories": []}}, upsert=True,
            )
        asyncio.run(_do())

    def test_instant_mode_triggers_email_attempt(self, renter_headers):
        self._ensure_renter_gig()
        self._set_renter_mode("instant", renter_headers)
        self._clear_snoozes(renter_headers)
        owner_tok = _login(OWNER)
        owner_headers = {"Authorization": f"Bearer {owner_tok}"}
        job = self._post_job(owner_headers)
        # Give background task time
        import time; time.sleep(3)
        log = self._read_backend_log_tail(2000)
        # Look for postmark send or subject line marker referencing renter or subject
        # The email pipeline logs 'send_email' calls; alternatively look for the subject
        # or for renter@test.com in the log.
        assert ("renter@test.com" in log) or ("New job match: Home Repair" in log) or ("job-match" in log), (
            f"No sign of instant email path for job {job.get('id')}. Log tail: ...{log[-1500:]}"
        )

    def test_digest_mode_suppresses_instant(self, renter_headers):
        self._ensure_renter_gig()
        self._set_renter_mode("digest", renter_headers)
        self._clear_snoozes(renter_headers)
        owner_tok = _login(OWNER)
        owner_headers = {"Authorization": f"Bearer {owner_tok}"}
        # Baseline log length
        pre_log = self._read_backend_log_tail(500)
        pre_count = pre_log.count("renter@test.com")
        job = self._post_job(owner_headers)
        import time; time.sleep(3)
        post_log = self._read_backend_log_tail(500)
        post_count = post_log.count("renter@test.com")
        # No new email attempt to renter for this job — count should not grow
        assert post_count <= pre_count + 0, (
            f"digest mode leaked instant email. delta={post_count-pre_count}"
        )

    def test_snooze_suppresses_instant(self, renter_headers):
        self._ensure_renter_gig()
        self._set_renter_mode("instant", renter_headers)
        # Snooze home-repair
        r = requests.post(
            f"{BASE_URL}/api/marketplace/notification-preferences/snooze",
            headers=renter_headers, json={"category": "home-services-repair"}, timeout=15,
        )
        assert r.status_code == 200
        owner_tok = _login(OWNER)
        owner_headers = {"Authorization": f"Bearer {owner_tok}"}
        pre_log = self._read_backend_log_tail(500)
        pre_count = pre_log.count("renter@test.com")
        self._post_job(owner_headers)
        import time; time.sleep(3)
        post_log = self._read_backend_log_tail(500)
        post_count = post_log.count("renter@test.com")
        assert post_count <= pre_count, "snoozed provider still emailed"

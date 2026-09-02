"""Regression tests for email-pipeline fixes (iteration_59):

- Signup lowercases email; login works with mixed-case
- Admin /email-health returns postmark_token_present, send_failure_counts, recent_failures
- Admin /email/diagnose lookup (found/not-found/mixed-case/RBAC/param-guard)
- Suppression skips send + records into email_send_failures via send_password_reset_email
- Fire-and-forget task strong-ref set (_bg_email_tasks) prevents GC
"""
import asyncio
import os
import sys
import uuid

import pytest
import requests

# Ensure backend importable for direct-import assertions (bg-email set check)
sys.path.insert(0, "/app/backend")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://where-am-i-project.preview.emergentagent.com").rstrip("/")
# Fallback: read from frontend/.env if env not set
if "REACT_APP_BACKEND_URL" not in os.environ:
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except FileNotFoundError:
        pass

API = f"{BASE_URL}/api"

# The admin password used to be a hardcoded "Admin123!" here - one digit
# short of the seeded account's "Admin1234!" - so every admin fixture in
# this file failed with "Invalid credentials" and read as a broken
# feature. The credentials come from tests/.env.test via conftest now.
from conftest import TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD  # noqa: E402
ADMIN = {"email": TEST_ADMIN_EMAIL or "admin@rental.com", "password": TEST_ADMIN_PASSWORD or "Admin1234!"}
OWNER = {"email": "owner@test.com", "password": "Test1234!"}
RENTER = {"email": "renter@test.com", "password": "Test1234!"}


# ---------- fixtures ----------
def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def owner_token():
    return _login(OWNER)


@pytest.fixture(scope="module")
def renter_token():
    return _login(RENTER)


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


def _mongo_conf():
    """Read MONGO_URL/DB_NAME, stripping quotes from .env file if needed."""
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not (mongo_url and db_name):
        try:
            for line in open("/app/backend/.env"):
                line = line.strip()
                if line.startswith("MONGO_URL="):
                    mongo_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                elif line.startswith("DB_NAME="):
                    db_name = line.split("=", 1)[1].strip().strip('"').strip("'")
        except FileNotFoundError:
            pass
    return mongo_url, db_name


# ---------- signup / login email lowercasing ----------
class TestSignupLowercase:
    def test_signup_stores_lowercase_and_mixed_case_login_works(self):
        suffix = uuid.uuid4().hex[:8]
        mixed = f"FooBar_{suffix}@Example.com"
        lower = mixed.lower()
        r = requests.post(f"{API}/auth/register", json={
            "email": mixed, "password": "Test1234!", "name": "FooBar",
            "role": "renter", "phone": ""
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == lower, f"Expected stored email lowercased, got {data['user']['email']}"

        # Login with the ORIGINAL mixed-case string
        r2 = requests.post(f"{API}/auth/login", json={"email": mixed, "password": "Test1234!"}, timeout=15)
        assert r2.status_code == 200, f"Mixed-case login failed: {r2.text}"
        assert r2.json()["user"]["email"] == lower

        # Login lowercase also works
        r3 = requests.post(f"{API}/auth/login", json={"email": lower, "password": "Test1234!"}, timeout=15)
        assert r3.status_code == 200, r3.text

    def test_legacy_mixed_case_row_still_authenticates(self):
        """Seed a legacy mixed-case user directly in Mongo, then login."""
        import bcrypt
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        mongo_url, db_name = _mongo_conf()
        cli = MongoClient(mongo_url)
        db = cli[db_name]
        suffix = uuid.uuid4().hex[:8]
        legacy_email = f"LegacyMixed_{suffix}@Test.com"
        pw_hash = bcrypt.hashpw(b"Test1234!", bcrypt.gensalt()).decode()
        uid = str(uuid.uuid4())
        db.users.insert_one({
            "id": uid, "email": legacy_email, "password": pw_hash,
            "name": "Legacy", "role": "renter", "email_verified": True,
        })
        try:
            r = requests.post(f"{API}/auth/login", json={"email": legacy_email.lower(), "password": "Test1234!"}, timeout=15)
            assert r.status_code == 200, f"Legacy-fallback login failed: {r.text}"
            assert r.json()["user"]["id"] == uid
        finally:
            db.users.delete_one({"id": uid})
            cli.close()


# ---------- admin/email-health ----------
class TestEmailHealth:
    def test_email_health_shape(self, admin_token):
        r = requests.get(f"{API}/admin/email-health", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # Existing fields
        for k in ("window_days", "delivered", "bounced", "delivery_rate_pct",
                  "suppressed_users", "recent_events"):
            assert k in d, f"missing field {k}"
        # New fields
        assert "postmark_token_present" in d
        assert isinstance(d["postmark_token_present"], bool)
        assert "send_failure_counts" in d
        assert isinstance(d["send_failure_counts"], dict)
        assert "recent_failures" in d
        assert isinstance(d["recent_failures"], list)

    def test_email_health_forbidden_for_renter(self, renter_token):
        r = requests.get(f"{API}/admin/email-health", headers=_hdr(renter_token), timeout=15)
        assert r.status_code == 403

    def test_email_health_forbidden_for_owner(self, owner_token):
        r = requests.get(f"{API}/admin/email-health", headers=_hdr(owner_token), timeout=15)
        assert r.status_code == 403


# ---------- admin/email/diagnose ----------
class TestEmailDiagnose:
    def test_diagnose_found_owner(self, admin_token):
        r = requests.get(f"{API}/admin/email/diagnose?email=owner@test.com",
                         headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["found"] is True
        assert d["user"]["email"] == "owner@test.com"
        for k in ("recent_events", "chat_throttle", "recent_send_failures"):
            assert k in d and isinstance(d[k], list)

    def test_diagnose_not_found_returns_200(self, admin_token):
        r = requests.get(f"{API}/admin/email/diagnose?email=nobody_{uuid.uuid4().hex}@example.com",
                         headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["found"] is False
        assert "queried" in d

    def test_diagnose_mixed_case_finds_lowercase_user(self, admin_token):
        r = requests.get(f"{API}/admin/email/diagnose?email=OWNER@Test.com",
                         headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["found"] is True, f"Mixed-case diagnose failed: {d}"
        assert d["user"]["email"] == "owner@test.com"

    def test_diagnose_forbidden_for_renter(self, renter_token):
        r = requests.get(f"{API}/admin/email/diagnose?email=owner@test.com",
                         headers=_hdr(renter_token), timeout=15)
        assert r.status_code == 403

    def test_diagnose_forbidden_for_owner(self, owner_token):
        r = requests.get(f"{API}/admin/email/diagnose?email=owner@test.com",
                         headers=_hdr(owner_token), timeout=15)
        assert r.status_code == 403

    def test_diagnose_missing_params_400(self, admin_token):
        r = requests.get(f"{API}/admin/email/diagnose", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 400
        assert "Provide email or user_id" in r.text


# ---------- suppression path: send_email + email_send_failures write ----------
class TestSuppressionRecordsFailure:
    """Seed a suppressed user, trigger send_email() via forgot-password (which
    also calls send_password_reset_email → send_email), then verify:
      - No exception; endpoint returns 200 generic response.
      - db.email_send_failures has a new row with reason_code='suppressed'.
      - /admin/email-health.send_failure_counts.suppressed >= 1.
    """
    def test_suppressed_user_records_failure(self, admin_token):
        from pymongo import MongoClient
        mongo_url, db_name = _mongo_conf()
        cli = MongoClient(mongo_url)
        db = cli[db_name]
        import bcrypt
        suffix = uuid.uuid4().hex[:10]
        seed_email = f"suppressed_test_{suffix}@example.com"
        uid = str(uuid.uuid4())
        db.users.insert_one({
            "id": uid, "email": seed_email,
            "password": bcrypt.hashpw(b"Test1234!", bcrypt.gensalt()).decode(),
            "name": "Suppressed", "role": "renter", "email_verified": True,
            "email_suppressed": True, "email_suppressed_reason": "HardBounce",
        })
        # Count failures before
        before_count = db.email_send_failures.count_documents({"to_email": seed_email})
        try:
            # Trigger forgot-password → send_password_reset_email → send_email
            r = requests.post(f"{API}/auth/forgot-password", json={"email": seed_email}, timeout=15)
            assert r.status_code == 200, r.text

            # Give the async send_email a moment (it's awaited inline in forgot-password)
            import time
            time.sleep(1.5)

            after_count = db.email_send_failures.count_documents({
                "to_email": seed_email, "reason_code": "suppressed"
            })
            assert after_count > before_count, (
                f"Expected a new 'suppressed' failure row for {seed_email}. "
                f"before={before_count} after={after_count}"
            )

            # Now /admin/email-health should reflect >=1 suppressed
            hr = requests.get(f"{API}/admin/email-health", headers=_hdr(admin_token), timeout=15)
            assert hr.status_code == 200
            hd = hr.json()
            assert hd["send_failure_counts"].get("suppressed", 0) >= 1
            # Recent failures list should contain our seed
            found_row = any(
                (row.get("to_email") == seed_email and row.get("reason_code") == "suppressed")
                for row in hd["recent_failures"]
            )
            assert found_row, "Seed row not present in recent_failures"
        finally:
            db.users.delete_one({"id": uid})
            db.email_send_failures.delete_many({"to_email": seed_email})
            cli.close()


# ---------- fire-and-forget strong-ref set ----------
class TestBgEmailStrongRef:
    def test_bg_email_tasks_set_exists_in_chat_and_auth(self):
        """Both modules must expose _bg_email_tasks + _schedule_bg_email."""
        from routes import chat as chat_mod
        from routes import auth as auth_mod
        assert hasattr(chat_mod, "_bg_email_tasks")
        assert isinstance(chat_mod._bg_email_tasks, set)
        assert callable(chat_mod._schedule_bg_email)
        assert hasattr(auth_mod, "_bg_email_tasks")
        assert isinstance(auth_mod._bg_email_tasks, set)
        assert callable(auth_mod._schedule_bg_email)

    @pytest.mark.asyncio
    async def test_schedule_bg_email_tracks_task(self):
        """Scheduling a coro adds it to the set; task completion removes it."""
        from routes.chat import _schedule_bg_email, _bg_email_tasks

        started = asyncio.Event()
        release = asyncio.Event()

        async def _slow():
            started.set()
            await release.wait()

        task = _schedule_bg_email(_slow())
        await started.wait()
        assert task in _bg_email_tasks, "Task not tracked in _bg_email_tasks"
        release.set()
        await task
        # done_callback should have discarded it
        await asyncio.sleep(0)
        assert task not in _bg_email_tasks, "Completed task not discarded"

    def test_three_forgot_password_calls_all_200(self):
        """Fire 3 quick forgot-password calls (which schedule bg email tasks
        indirectly via _send_verification_email path OR call send_email
        inline). All 3 must return 200 — no coroutine-never-awaited errors."""
        for _ in range(3):
            r = requests.post(f"{API}/auth/forgot-password",
                              json={"email": "owner@test.com"}, timeout=15)
            assert r.status_code == 200


# ---------- cleanup left-over signup rows ----------
@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_users():
    yield
    try:
        from pymongo import MongoClient
        mongo_url, db_name = _mongo_conf()
        cli = MongoClient(mongo_url)
        db = cli[db_name]
        db.users.delete_many({"email": {"$regex": "^foobar_.*@example\\.com$"}})
        db.users.delete_many({"email": {"$regex": "^suppressed_test_.*@example\\.com$"}})
        db.users.delete_many({"email": {"$regex": "^legacymixed_.*@test\\.com$", "$options": "i"}})
        db.email_send_failures.delete_many({"to_email": {"$regex": "^suppressed_test_"}})
        cli.close()
    except Exception:
        pass

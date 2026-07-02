"""Security audit regression tests.

Covers SEC-001 (admin self-register), SEC-003 (ReDoS on gigs.q),
SEC-004 (path traversal on DELETE /upload), P3 hardening (security
headers, rate limits, review comment max_length).

Note: The rate limiter is in-memory per backend process. These tests
assume a freshly-restarted backend (counters at zero). Tests that
trip limits use unique-per-run buckets where possible.
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

OWNER = ("owner@test.com", "Test1234!")
RENTER = ("renter@test.com", "Test1234!")
ADMIN = ("admin@rental.com", "Admin1234!")


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_token() -> str:
    return _login(*OWNER)


@pytest.fixture(scope="module")
def renter_token() -> str:
    return _login(*RENTER)


# ---------------------------------------------------------------------- #
# SEC-001: Admin self-registration blocked                               #
# ---------------------------------------------------------------------- #
class TestSEC001AdminSelfRegistration:
    def _payload(self, role: str) -> dict:
        return {
            "email": f"TEST_sec001_{role}_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test1234!",
            "name": "SEC001 Tester",
            "role": role,
            "phone": "+15550000000",
        }

    def test_register_as_admin_rejected(self):
        r = requests.post(f"{API}/auth/register", json=self._payload("admin"), timeout=15)
        assert r.status_code == 400, r.text
        assert "renter" in r.json()["detail"].lower() and "owner" in r.json()["detail"].lower()

    def test_register_as_manager_rejected(self):
        r = requests.post(f"{API}/auth/register", json=self._payload("manager"), timeout=15)
        assert r.status_code == 400, r.text

    def test_register_as_renter_succeeds(self):
        p = self._payload("renter")
        r = requests.post(f"{API}/auth/register", json=p, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["role"] == "renter"
        assert body["token"]
        # Verify JWT role via /auth/me
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {body['token']}"}, timeout=15)
        assert me.status_code == 200 and me.json()["role"] == "renter"

    def test_register_as_owner_succeeds(self):
        p = self._payload("owner")
        r = requests.post(f"{API}/auth/register", json=p, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "owner"

    def test_register_empty_role_rejected(self):
        p = self._payload("")
        r = requests.post(f"{API}/auth/register", json=p, timeout=15)
        # Either 400 (allowlist) or 422 (Pydantic) — both are fail-closed
        assert r.status_code in (400, 422), r.text


# ---------------------------------------------------------------------- #
# SEC-003: ReDoS on marketplace gigs `q` search                          #
# ---------------------------------------------------------------------- #
class TestSEC003ReDoS:
    @pytest.mark.parametrize("q", [
        "(a+)+$",
        "((a+)+)+",
        "a{100,}",
        "(x|y|z)+.*",
        "a" * 100,
        "!@#$%^&*()_+-=[]{}|;':,.<>?/",
    ])
    def test_pathological_regex_returns_promptly(self, q):
        start = time.monotonic()
        r = requests.get(f"{API}/marketplace/gigs", params={"q": q}, timeout=5)
        elapsed = time.monotonic() - start
        assert r.status_code == 200, f"q={q!r} status={r.status_code} body={r.text[:200]}"
        assert elapsed < 2.0, f"q={q!r} took {elapsed:.2f}s"
        assert isinstance(r.json(), list)


# ---------------------------------------------------------------------- #
# SEC-004: Path traversal on DELETE /upload/{filename}                   #
# ---------------------------------------------------------------------- #
class TestSEC004PathTraversal:
    @pytest.mark.parametrize("path", [
        "../../etc/passwd",
        "..%2F..%2Fetc%2Fpasswd",
        "..\\..\\etc\\passwd",
        "../../../root/.ssh/id_rsa",
        # iteration_54 retest payloads
        "foo%2F%2E%2E%2Fbar",       # URL-encoded '../' inside path
        "..%5C..%5Cetc%5Cpasswd",   # URL-encoded backslash traversal
        "foo%00.jpg",               # NULL-byte injection
    ])
    def test_traversal_rejected(self, owner_token, path):
        r = requests.delete(
            f"{API}/upload/{path}",
            headers={"Authorization": f"Bearer {owner_token}"},
            timeout=10,
        )
        # Must NOT be 2xx. Accept 400 (backend guard) or 404 (some clients
        # / ingress normalize `../` segments away per RFC 3986 before the
        # request ever hits the backend; Cloudflare returns 400 HTML on
        # NULL-byte). The critical invariant is: never a 200 "File deleted".
        assert r.status_code in (400, 404), (
            f"path={path!r} status={r.status_code} body={r.text[:200]}"
        )
        # If it's JSON from our backend, confirm the detail is meaningful.
        ct = r.headers.get("content-type", "")
        if r.status_code == 400 and "application/json" in ct:
            assert "invalid" in r.json().get("detail", "").lower()

    def test_legit_cloudinary_style_public_id_passes(self, owner_token):
        # A public_id with '/' but no '..' should reach the cloudinary
        # delete branch. If cloudinary isn't wired we still expect 200
        # because the delete branch swallows failures.
        r = requests.delete(
            f"{API}/upload/myisraelrental/some-legit-public-id",
            headers={"Authorization": f"Bearer {owner_token}"},
            timeout=10,
        )
        # Accept 200 (cloudinary branch) or 404 (local branch, not found).
        # The critical thing is: NOT 400 — the guard must not false-positive.
        assert r.status_code in (200, 404), f"unexpected {r.status_code}: {r.text[:200]}"

    def test_legit_local_delete_still_works(self, owner_token):
        # Upload a tiny image, then delete it via the returned filename.
        # If CLOUDINARY is enabled the upload will go to Cloudinary and
        # the delete will hit the cloudinary branch — that's fine, we
        # still want the happy path to return 200.
        png_bytes = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xff\xff"
            b"?\x00\x05\xfe\x02\xfe\xa2\x9c\xf3\xd8\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        up = requests.post(
            f"{API}/upload",
            headers={"Authorization": f"Bearer {owner_token}"},
            files={"file": ("test.png", png_bytes, "image/png")},
            timeout=15,
        )
        assert up.status_code == 200, up.text
        filename = up.json()["filename"]
        dele = requests.delete(
            f"{API}/upload/{filename}",
            headers={"Authorization": f"Bearer {owner_token}"},
            timeout=10,
        )
        assert dele.status_code == 200, dele.text


# ---------------------------------------------------------------------- #
# P3-2: Security headers present                                         #
# ---------------------------------------------------------------------- #
REQUIRED_HEADERS = {
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": None,  # any non-empty value
}


class TestP3SecurityHeaders:
    @pytest.mark.parametrize("path,method", [
        ("/marketplace/categories", "GET"),
        ("/marketplace/gigs", "GET"),
        ("/auth/login", "POST"),
    ])
    def test_headers_present(self, path, method):
        if method == "GET":
            r = requests.get(f"{API}{path}", timeout=10)
        else:
            r = requests.post(f"{API}{path}", json={"email": "x@x", "password": "x"}, timeout=10)
        for h, expected in REQUIRED_HEADERS.items():
            assert h in {k.lower() for k in r.headers}, f"missing {h} on {method} {path}"
            if expected is not None:
                assert r.headers.get(h, "").lower() == expected.lower(), f"{h} mismatch on {path}"


# ---------------------------------------------------------------------- #
# P3-3: Rate limits (in-memory, run in isolation-ish order)              #
# ---------------------------------------------------------------------- #
# These are ordered by increasing "damage" (login is per-email, so cheap
# to isolate; register/forgot are per-IP, so they will trip once and stay
# tripped until backend restart).

class TestP3RateLimits:
    def test_login_email_rate_limit(self):
        """11th attempt on same bogus email in <5min should get 429."""
        email = f"TEST_rl_login_{uuid.uuid4().hex[:8]}@example.com"
        codes = []
        for _ in range(11):
            r = requests.post(f"{API}/auth/login",
                              json={"email": email, "password": "wrong"},
                              timeout=10)
            codes.append(r.status_code)
            if r.status_code == 429:
                assert "retry-after" in {k.lower() for k in r.headers}, "Retry-After missing"
                break
        assert 429 in codes, f"expected 429 within 11 attempts, got {codes}"
        # Fresh email is not affected (per-email keyed limit)
        r2 = requests.post(f"{API}/auth/login",
                           json={"email": f"TEST_rl_login_fresh_{uuid.uuid4().hex[:8]}@example.com",
                                 "password": "wrong"},
                           timeout=10)
        assert r2.status_code == 401, f"per-email keying broken; got {r2.status_code}"

    def test_forgot_password_rate_limit(self):
        """6th forgot-password for same email returns 429."""
        email = f"TEST_rl_forgot_{uuid.uuid4().hex[:8]}@example.com"
        codes = []
        for _ in range(6):
            r = requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=10)
            codes.append(r.status_code)
            if r.status_code == 429:
                break
        assert 429 in codes, f"expected 429 within 6 attempts, got {codes}"

    def test_cloudinary_signature_rate_limit(self, owner_token):
        """61st signature request from same user in a minute should return 429.

        iteration_54: bucket now uses ip_agnostic=True keyed on user_id,
        so the ingress egress-IP rotation should no longer defeat it.
        """
        codes = []
        for _ in range(61):
            r = requests.get(
                f"{API}/cloudinary/signature",
                headers={"Authorization": f"Bearer {owner_token}"},
                timeout=10,
            )
            codes.append(r.status_code)
            if r.status_code == 429:
                assert "retry-after" in {k.lower() for k in r.headers}, "Retry-After missing"
                break
        assert 429 in codes, (
            f"expected 429 within 61 requests, got last 10={codes[-10:]}"
        )

    def test_register_ip_rate_limit(self):
        """6th register from same IP in 10min returns 429. Run LAST because
        it will lock out further registers until process restart."""
        codes = []
        for i in range(6):
            payload = {
                "email": f"TEST_rl_reg_{uuid.uuid4().hex[:8]}@example.com",
                "password": "Test1234!",
                "name": "RL",
                "role": "renter",
                "phone": "",
            }
            r = requests.post(f"{API}/auth/register", json=payload, timeout=10)
            codes.append(r.status_code)
            if r.status_code == 429:
                break
        assert 429 in codes, f"expected 429 within 6 attempts, got {codes}"


# ---------------------------------------------------------------------- #
# P3-4: Review comment max_length=1000                                   #
# ---------------------------------------------------------------------- #
class TestP3ReviewCommentLength:
    def test_comment_over_1000_rejected(self, renter_token):
        # Grab any gig id
        r = requests.get(f"{API}/marketplace/gigs", timeout=10)
        assert r.status_code == 200
        gigs = r.json()
        if not gigs:
            pytest.skip("no gigs available to review")
        gig_id = gigs[0]["id"] if "id" in gigs[0] else gigs[0].get("_id")
        assert gig_id
        r = requests.post(
            f"{API}/marketplace/gigs/{gig_id}/reviews",
            headers={"Authorization": f"Bearer {renter_token}"},
            json={"rating": 5, "comment": "x" * 1001},
            timeout=10,
        )
        assert r.status_code == 422, f"expected 422 got {r.status_code}: {r.text[:200]}"


# ---------------------------------------------------------------------- #
# REGRESSION: seeded admin can still grant admin role                    #
# ---------------------------------------------------------------------- #
class TestSEC001AdminRoleGrantUnaffected:
    def test_admin_login_works(self):
        # Just confirm admin still logs in (post-JWT-rotation).
        tok = _login(*ADMIN)
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=10)
        assert me.status_code == 200
        assert me.json()["role"] == "admin"

"""The security scan of 18 Sep 2026, fixed 23 Sep: one check per finding
that can be checked from outside. Needs the local API and Mongo
(backend/tests/.env.test).

  F4  an email-link token is not a login
  F5  the login email is not a regular expression
  F6  a password reset ends every earlier session
  F9  a blocked account loses its sessions and gets no new one
  F8  an exported cell never starts a formula
  F7  a signature box cannot be made enormous
  F16 the admin stream takes a one-minute ticket, never a session
"""
from __future__ import annotations

import os
import sys
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from pymongo import MongoClient  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
SECRET = os.environ["JWT_SECRET"]
CACHE_WAIT = 21   # utils/auth caches account state for 20 s per process


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _account():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    email, pw = f"sec-{stamp}@example.com", f"Pw-{stamp}-ok1"
    r = requests.post(f"{BASE}/auth/register", json={"email": email, "password": pw, "name": "Sec", "role": "renter"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"], r.json()["user"]["id"], email, pw


def _me(tok):
    return requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=30).status_code


def test_f4_an_email_link_token_is_not_a_login():
    tok, uid, _, _ = _account()
    assert _me(tok) == 200
    for purpose in ("requests_opt_out", "snooze", "job_deeplink"):
        link = jwt.encode({"purpose": purpose, "user_id": uid, "exp": datetime.now(UTC) + timedelta(days=1)}, SECRET, algorithm="HS256")
        assert _me(link) == 401, purpose
    kind = jwt.encode({"kind": "avail_extend", "owner_id": uid, "user_id": uid, "exp": datetime.now(UTC) + timedelta(days=1)}, SECRET, algorithm="HS256")
    assert _me(kind) == 401


def test_f5_the_login_email_is_not_a_pattern():
    _, _, email, pw = _account()
    local, domain = email.split("@")
    wild = f"{local[:4]}.*@{domain}"
    r = requests.post(f"{BASE}/auth/login", json={"email": wild, "password": pw}, timeout=30)
    assert r.status_code in (401, 422), "a wildcard must not match someone else's email"


def test_f6_a_password_reset_ends_earlier_sessions(db):
    tok, uid, email, _ = _account()
    assert _me(tok) == 200
    reset_token = uuid.uuid4().hex
    db.password_resets.insert_one({"token": reset_token, "user_id": uid, "used": False,
                                   "expires_at": (datetime.now(UTC) + timedelta(hours=1)).isoformat()})
    time.sleep(1.1)   # iat is whole seconds
    r = requests.post(f"{BASE}/auth/reset-password", json={"token": reset_token, "new_password": "Brand-new-pw1"}, timeout=30)
    assert r.status_code == 200, r.text
    assert _me(tok) == 401, "the session from before the reset must end"
    fresh = requests.post(f"{BASE}/auth/login", json={"email": email, "password": "Brand-new-pw1"}, timeout=30)
    assert fresh.status_code == 200 and _me(fresh.json()["token"]) == 200


def test_f6_changing_a_password_keeps_this_session_on_the_new_token():
    tok, _, _, pw = _account()
    time.sleep(1.1)
    r = requests.post(f"{BASE}/auth/change-password", json={"current_password": pw, "new_password": "Another-pw-22"},
                      headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    assert r.status_code == 200, r.text
    assert _me(tok) == 401 and _me(r.json()["token"]) == 200


def test_f9_a_blocked_account_is_locked_out(db):
    tok, uid, email, pw = _account()
    assert _me(tok) == 200
    db.users.update_one({"id": uid}, {"$set": {"status": "blocked"}})
    time.sleep(CACHE_WAIT)   # set directly, so the API's cache has to expire
    assert _me(tok) == 403
    assert requests.post(f"{BASE}/auth/login", json={"email": email, "password": pw}, timeout=30).status_code == 403


def test_f8_an_exported_cell_never_starts_a_formula():
    from routes.marketplace.orders import orders_to_csv
    row = orders_to_csv([{"customer_name": "=HYPERLINK(\"https://evil\")", "items": "+1", "notes": "@x",
                          "address": "-2", "total": 85}]).splitlines()[1]
    for bad in ('"=', ",+", ",@", ",-"):
        assert bad not in row, row
    assert ",85," in row, "numbers are not text and stay numbers"


def test_f7_a_signature_box_is_bounded():
    from utils.contract_signing import _MAX_PX, _bounded
    assert _bounded(50000, 1, _MAX_PX, 200) == _MAX_PX
    assert _bounded("nan", 1, _MAX_PX, 200) == 200
    assert _bounded(float("inf"), 1, _MAX_PX, 200) == 200
    assert _bounded(-5, 1, _MAX_PX, 200) == 1


def test_f16_the_admin_stream_refuses_a_session_token():
    tok, _, _, _ = _account()
    r = requests.get(f"{BASE}/admin/events", params={"token": tok}, timeout=10)
    assert r.status_code == 401, "a session token in a URL is refused outright"
    assert requests.post(f"{BASE}/admin/events/ticket", headers={"Authorization": f"Bearer {tok}"}, timeout=10).status_code == 403

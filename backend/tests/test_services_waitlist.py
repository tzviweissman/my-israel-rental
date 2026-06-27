"""Services waitlist endpoint tests.

Light-touch — the endpoint is intentionally simple (single POST that
captures email + business_name + category). We pin:
  1. Happy path: new submission → 200 + deduped=False.
  2. Re-submitting the same email is idempotent (deduped=True) — refreshes
     business_name / category but never creates a duplicate row.
  3. Invalid email rejected (Pydantic validation 422).
  4. Empty business_name rejected (Pydantic validation 422).
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


def test_waitlist_happy_path_returns_deduped_false():
    email = f"new-{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{BASE_URL}/api/services/waitlist",
        json={"email": email, "business_name": "Acme Clean", "category": "Cleaning"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True, "deduped": False}


def test_waitlist_resubmit_same_email_is_idempotent():
    email = f"dup-{uuid.uuid4().hex[:8]}@example.com"
    r1 = requests.post(
        f"{BASE_URL}/api/services/waitlist",
        json={"email": email, "business_name": "First Name", "category": "Cleaning"},
        timeout=10,
    )
    assert r1.status_code == 200
    r2 = requests.post(
        f"{BASE_URL}/api/services/waitlist",
        json={"email": email, "business_name": "Updated Name", "category": "Photography"},
        timeout=10,
    )
    assert r2.status_code == 200
    assert r2.json() == {"ok": True, "deduped": True}


def test_waitlist_rejects_invalid_email():
    r = requests.post(
        f"{BASE_URL}/api/services/waitlist",
        json={"email": "not-an-email", "business_name": "Acme"},
        timeout=10,
    )
    assert r.status_code == 422


def test_waitlist_rejects_empty_business_name():
    r = requests.post(
        f"{BASE_URL}/api/services/waitlist",
        json={"email": "ok@example.com", "business_name": ""},
        timeout=10,
    )
    assert r.status_code == 422

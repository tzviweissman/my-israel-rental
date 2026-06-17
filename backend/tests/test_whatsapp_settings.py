"""Tests for PUT /api/auth/whatsapp + WhatsApp module graceful no-op."""
import os
import sys
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(Path(__file__).parent.parent / ".env")

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://where-am-i-project.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@rental.com", "password": "Admin1234!"}
OWNER = {"email": "owner@test.com", "password": "Test1234!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_headers():
    return {"Authorization": f"Bearer {_login(OWNER)}"}


def test_requires_auth():
    r = requests.put(f"{API}/auth/whatsapp", json={"whatsapp_number": "+972501234567"}, timeout=10)
    assert r.status_code in (401, 403)


def test_too_short_rejected(owner_headers):
    r = requests.put(
        f"{API}/auth/whatsapp",
        json={"whatsapp_number": "123"},
        headers=owner_headers, timeout=10,
    )
    assert r.status_code == 400


def test_save_and_normalize(owner_headers):
    # Mixed spaces / dashes — should be normalized to +972501234567
    r = requests.put(
        f"{API}/auth/whatsapp",
        json={"whatsapp_number": "+972 50-123 45 67"},
        headers=owner_headers, timeout=10,
    )
    assert r.status_code == 200
    me = requests.get(f"{API}/auth/me", headers=owner_headers, timeout=10).json()
    assert me.get("phone") == "+972501234567"


def test_clear_with_empty_string(owner_headers):
    r = requests.put(
        f"{API}/auth/whatsapp",
        json={"whatsapp_number": ""},
        headers=owner_headers, timeout=10,
    )
    assert r.status_code == 200
    me = requests.get(f"{API}/auth/me", headers=owner_headers, timeout=10).json()
    assert me.get("phone") in ("", None)


def test_whatsapp_module_is_safe_when_not_configured():
    """The util must be safely importable and return False (not raise)
    when env vars are missing. This is the core "graceful no-op"
    contract that protects unrelated flows (chat, contract signing)."""
    from utils import whatsapp as wa
    import asyncio
    result = asyncio.run(wa.send_renter_message_notification(
        recipient_phone="+972501234567",
        recipient_name="Test",
        sender_name="Renter",
        conversation_path="chat?property_id=abc",
        language="en",
    ))
    # When WHATSAPP_ACCESS_TOKEN isn't set we expect a clean False return.
    if not os.environ.get("WHATSAPP_ACCESS_TOKEN"):
        assert result is False

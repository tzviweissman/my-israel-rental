"""Unit tests for the Twilio WhatsApp send module.

Exercises both modes (free-form body for sandbox/dev, content template
for production) by mocking the twilio.rest.Client. Also asserts the
graceful no-op contract: chat.py / bookings.py must keep working when
Twilio creds aren't set.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils import whatsapp  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_client_singleton():
    """The module caches the twilio Client. We blow it away before each
    test so a previous test's patched Client doesn't leak forward."""
    whatsapp._client_singleton = None
    yield
    whatsapp._client_singleton = None


@pytest.fixture
def configured_env(monkeypatch):
    """Minimal Twilio-Sandbox-style env. No template SIDs -> free-form
    body path."""
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACtest")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok")
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
    monkeypatch.setenv("PLATFORM_PUBLIC_URL", "https://myisraelrental.com")
    monkeypatch.delenv("TWILIO_CONTENT_SID_RENTER_MESSAGE", raising=False)
    monkeypatch.delenv("TWILIO_CONTENT_SID_CONTRACT_SIGNED", raising=False)


@pytest.fixture
def configured_env_with_templates(monkeypatch):
    """Production-style env with approved Content SIDs."""
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACtest")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok")
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "+14155551234")
    monkeypatch.setenv("PLATFORM_PUBLIC_URL", "https://myisraelrental.com")
    monkeypatch.setenv("TWILIO_CONTENT_SID_RENTER_MESSAGE", "HXrenter123")
    monkeypatch.setenv("TWILIO_CONTENT_SID_CONTRACT_SIGNED", "HXcontract456")


def _mock_twilio_create(returned_sid: str = "SMtest", returned_status: str = "queued"):
    """Build a MagicMock that pretends to be ``Client().messages.create``."""
    mock_msg = MagicMock(sid=returned_sid, status=returned_status)
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_msg
    return mock_client


def test_no_op_when_unconfigured(monkeypatch):
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("TWILIO_WHATSAPP_FROM", raising=False)
    result = asyncio.run(whatsapp.send_renter_message_notification(
        recipient_phone="+972501234567", recipient_name="Avi",
        sender_name="Renter", conversation_path="chat?property_id=abc",
        language="en",
    ))
    assert result is False


def test_no_op_when_phone_missing(configured_env):
    with patch("twilio.rest.Client") as MockClient:
        MockClient.return_value = _mock_twilio_create()
        result = asyncio.run(whatsapp.send_renter_message_notification(
            recipient_phone="", recipient_name="Avi",
            sender_name="Renter", conversation_path="chat?property_id=abc",
            language="en",
        ))
        assert result is False
        # Client must NOT have been called — we short-circuit before
        # touching the network.
        MockClient.assert_not_called()


def test_renter_message_freeform_body_path(configured_env):
    with patch("twilio.rest.Client") as MockClient:
        mock_client = _mock_twilio_create()
        MockClient.return_value = mock_client
        result = asyncio.run(whatsapp.send_renter_message_notification(
            recipient_phone="+972501234567",
            recipient_name="Avi",
            sender_name="Renter Bob",
            conversation_path="chat?property_id=abc&peer_id=xyz",
            language="en",
        ))
    assert result is True
    create_args = mock_client.messages.create.call_args.kwargs
    assert create_args["from_"] == "whatsapp:+14155238886"
    assert create_args["to"] == "whatsapp:+972501234567"
    # Free-form path -> body is set, content_sid is NOT.
    assert "content_sid" not in create_args
    assert "Renter Bob" in create_args["body"]
    assert "myisraelrental.com/chat?property_id=abc&peer_id=xyz" in create_args["body"]


def test_renter_message_template_path(configured_env_with_templates):
    with patch("twilio.rest.Client") as MockClient:
        mock_client = _mock_twilio_create()
        MockClient.return_value = mock_client
        result = asyncio.run(whatsapp.send_renter_message_notification(
            recipient_phone="+972501234567",
            recipient_name="Avi",
            sender_name="Renter Bob",
            conversation_path="chat?property_id=abc",
            language="en",
        ))
    assert result is True
    create_args = mock_client.messages.create.call_args.kwargs
    # Template path -> content_sid set, body NOT set.
    assert create_args["content_sid"] == "HXrenter123"
    assert "body" not in create_args
    # content_variables is a JSON string per Twilio API
    import json
    vars_ = json.loads(create_args["content_variables"])
    assert vars_["1"] == "Avi"
    assert vars_["2"] == "Renter Bob"
    assert "myisraelrental.com" in vars_["3"]


def test_contract_signed_hebrew_body(configured_env):
    with patch("twilio.rest.Client") as MockClient:
        mock_client = _mock_twilio_create()
        MockClient.return_value = mock_client
        result = asyncio.run(whatsapp.send_contract_signed_notification(
            recipient_phone="+972501234567",
            recipient_name="חיים",
            tenant_name="דנה",
            contract_path="dashboard?tab=bookings&booking_id=b1",
            language="he",
        ))
    assert result is True
    body = mock_client.messages.create.call_args.kwargs["body"]
    # Body must be in Hebrew + carry both names + the deep link.
    assert "חיים" in body
    assert "דנה" in body
    assert "myisraelrental.com/dashboard?tab=bookings&booking_id=b1" in body


def test_send_failure_swallowed(configured_env):
    """Twilio raising must surface as False, not propagate. Chat send
    must not break because Twilio briefly hiccupped."""
    with patch("twilio.rest.Client") as MockClient:
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = RuntimeError("boom")
        MockClient.return_value = mock_client
        result = asyncio.run(whatsapp.send_renter_message_notification(
            recipient_phone="+972501234567", recipient_name="Avi",
            sender_name="Renter", conversation_path="chat?x=1",
            language="en",
        ))
        assert result is False


def test_from_number_normalized_when_missing_prefix(monkeypatch):
    """The user may paste a bare ``+14155551234`` instead of
    ``whatsapp:+14155551234`` — we should add the prefix transparently."""
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACtest")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok")
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "+14155551234")
    monkeypatch.delenv("TWILIO_CONTENT_SID_RENTER_MESSAGE", raising=False)
    monkeypatch.delenv("TWILIO_CONTENT_SID_CONTRACT_SIGNED", raising=False)
    with patch("twilio.rest.Client") as MockClient:
        mock_client = _mock_twilio_create()
        MockClient.return_value = mock_client
        asyncio.run(whatsapp.send_renter_message_notification(
            recipient_phone="+972501234567", recipient_name="x",
            sender_name="y", conversation_path="p", language="en",
        ))
    assert mock_client.messages.create.call_args.kwargs["from_"] == "whatsapp:+14155551234"

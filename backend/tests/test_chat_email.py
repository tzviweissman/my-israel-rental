"""Tests for chat message email notifications.

Verifies the chat-message email is dispatched (and not blocked) whenever
POST /api/chat/messages succeeds, and that the helper builds a well-formed
email body for text-only, image-only, and mixed messages.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import patch, AsyncMock

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.email import send_chat_message_email  # noqa: E402


class TestSendChatMessageEmail:
    def _send(self, **kwargs):
        defaults = dict(
            to_email="who@example.com",
            receiver_name="Receiver",
            sender_name="Sender",
            message_snippet="Hello",
            has_image=False,
            property_id="prop-1",
            property_title="Sunny Apartment",
            sender_id="sender-1",
        )
        defaults.update(kwargs)
        with patch("utils.email.send_email") as mock_send:
            mock_send.return_value = asyncio.Future()
            mock_send.return_value.set_result(True)
            asyncio.get_event_loop().run_until_complete(send_chat_message_email(**defaults))
            return mock_send.call_args

    def test_text_message_subject_and_body(self):
        call = self._send(message_snippet="Hi, can I see the place?")
        args, kwargs = call
        to, subject, html_body = args[0], args[1], args[2]
        assert to == "who@example.com"
        assert "Sender" in subject
        assert "Hi, can I see the place?" in subject or "Hi, can I see" in subject
        assert "Hi, can I see the place?" in html_body
        assert "Sunny Apartment" in html_body
        # Deep-link must include the sender id so the recipient lands on the
        # correct conversation.
        assert "/chat/prop-1?with=sender-1" in html_body

    def test_image_only_message_uses_camera_placeholder(self):
        call = self._send(message_snippet="", has_image=True)
        _, _, html_body = call.args
        assert "📷" in html_body or "photo" in html_body.lower()

    def test_subject_truncates_long_snippets(self):
        long_text = "x" * 200
        call = self._send(message_snippet=long_text)
        _, subject, _ = call.args
        # Subject should be capped (helper trims to ~60 chars)
        assert len(subject) <= 120

    def test_html_escapes_user_input(self):
        call = self._send(
            sender_name="<script>alert(1)</script>",
            property_title="<b>Bad</b> Title",
            message_snippet="<img src=x onerror=alert(1)>",
        )
        _, _, html_body = call.args
        # Raw tag breakouts must be neutralised
        assert "<script>" not in html_body
        assert "<img src=x" not in html_body


class TestChatRouteTriggersEmail:
    """The send_message endpoint must spawn a background email task that
    resolves sender + receiver + property and calls send_chat_message_email."""

    def test_send_chat_email_safe_skips_when_sender_equals_receiver(self):
        from routes.chat import _send_chat_email_safe

        with patch("routes.chat.send_chat_message_email") as mock:
            asyncio.get_event_loop().run_until_complete(
                _send_chat_email_safe(
                    sender_id="u1",
                    receiver_id="u1",
                    property_id="p1",
                    message_body="hi",
                    image_url=None,
                )
            )
            mock.assert_not_called()

    def test_send_chat_email_safe_swallows_exceptions(self):
        # If the DB raises or Postmark errors, the helper must never bubble.
        from routes.chat import _send_chat_email_safe

        with patch("routes.chat.db") as mock_db:
            mock_db.users.find_one.side_effect = RuntimeError("boom")
            # Should NOT raise
            asyncio.get_event_loop().run_until_complete(
                _send_chat_email_safe(
                    sender_id="a",
                    receiver_id="b",
                    property_id="p",
                    message_body="hi",
                    image_url=None,
                )
            )


def _async(value):
    fut = asyncio.Future()
    fut.set_result(value)
    return fut


class TestChatEmailThrottle:
    """Two-rule throttle around _send_chat_email_safe:
      A. Skip if we already emailed this conversation in the last 5 min.
      B. Skip if the recipient is actively reading the chat (read_at within 2 min).
    """

    def _run(self, **overrides):
        """Run _send_chat_email_safe with controllable db helpers."""
        from routes import chat as chat_module

        was_recently_emailed = overrides.get("was_recently_emailed", False)
        recipient_active = overrides.get("recipient_active", False)
        receiver_doc = overrides.get("receiver_doc", {"email": "x@example.com", "name": "Rx"})

        with patch.object(chat_module, "_was_recently_emailed", new=AsyncMock(return_value=was_recently_emailed)), \
             patch.object(chat_module, "_recipient_is_actively_in_chat", new=AsyncMock(return_value=recipient_active)), \
             patch.object(chat_module, "send_chat_message_email", new=AsyncMock(return_value=True)) as mock_send, \
             patch.object(chat_module, "db") as mock_db:
            mock_db.users.find_one = AsyncMock(side_effect=[receiver_doc, {"name": "Sx"}])
            mock_db.properties.find_one = AsyncMock(return_value={"title": "Sunny"})
            mock_db.chat_email_throttle.update_one = AsyncMock(return_value=None)

            asyncio.get_event_loop().run_until_complete(
                chat_module._send_chat_email_safe(
                    sender_id="s",
                    receiver_id="r",
                    property_id="p",
                    message_body="hi",
                    image_url=None,
                )
            )
            return mock_send

    def test_throttle_skips_email_when_recently_emailed(self):
        mock_send = self._run(was_recently_emailed=True)
        mock_send.assert_not_called()

    def test_throttle_skips_email_when_recipient_actively_in_chat(self):
        mock_send = self._run(recipient_active=True)
        mock_send.assert_not_called()

    def test_throttle_allows_email_when_quiet(self):
        mock_send = self._run()
        mock_send.assert_called_once()

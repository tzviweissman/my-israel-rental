"""Tests for the job-scoped chat email notification path.

Verifies that when a chat message is sent with ``property_id`` pointing
to a marketplace_jobs row (not a properties row), the email lookup
falls back to the job title so recipients see a meaningful subject
like "Someone: New message" with body "…about Job: <title>" instead
of the generic "…about your conversation" fallback.
"""
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_job_scoped_chat_email_uses_job_title():
    """When property_id resolves to a marketplace_jobs row (not a
    properties row), _send_chat_email_safe should pass
    'Job: <title>' as the property_title argument to
    send_chat_message_email."""
    # Import here so the module-level `db` import doesn't run at
    # collection time.
    from routes import chat as chat_mod

    fake_job_id = "9fa14be5-0000-4000-8000-abcdefabcdef"
    fake_receiver_id = "receiver-uuid"
    fake_sender_id = "sender-uuid"

    captured = {}

    async def fake_send_chat_email(**kwargs):
        captured.update(kwargs)
        return True

    # Mock the DB layer + the outbound Postmark call.
    with patch.object(chat_mod.db, "chat_email_throttle") as _throttle, \
         patch.object(chat_mod.db, "messages") as _msgs, \
         patch.object(chat_mod.db, "users") as _users, \
         patch.object(chat_mod.db, "properties") as _props, \
         patch.object(chat_mod.db, "marketplace_jobs") as _jobs, \
         patch.object(chat_mod, "send_chat_message_email", side_effect=fake_send_chat_email), \
         patch.object(chat_mod, "send_renter_message_notification", new=AsyncMock()):

        # Rule A + Rule B: never recently emailed, never actively reading.
        _msgs.find_one = AsyncMock(return_value=None)
        _throttle.find_one = AsyncMock(return_value=None)
        _throttle.update_one = AsyncMock(return_value=None)

        # Receiver + sender exist.
        _users.find_one = AsyncMock(side_effect=[
            {"email": "recipient@test.com", "name": "Recipient", "phone": None, "preferred_language": "en"},
            {"name": "Sender Name"},
        ])

        # Property lookup MISSES — this simulates the id being a job UUID.
        _props.find_one = AsyncMock(return_value=None)

        # Jobs collection lookup HITS with our test title.
        _jobs.find_one = AsyncMock(return_value={"title": "Need a wedding barber"})

        await chat_mod._send_chat_email_safe(
            sender_id=fake_sender_id,
            receiver_id=fake_receiver_id,
            property_id=fake_job_id,
            message_body="Hi, can you do next Sunday?",
            image_url=None,
            video_url=None,
        )

    assert captured, "send_chat_message_email was not called"
    assert captured["property_title"] == "Job: Need a wedding barber", (
        f"Expected 'Job: Need a wedding barber' but got {captured['property_title']!r}"
    )
    assert captured["property_id"] == fake_job_id
    assert captured["to_email"] == "recipient@test.com"


@pytest.mark.asyncio
async def test_property_chat_email_still_uses_property_title():
    """Regression: when property_id resolves to a live property, the
    email should use the property title unchanged (no 'Job:' prefix)."""
    from routes import chat as chat_mod

    captured = {}

    async def fake_send_chat_email(**kwargs):
        captured.update(kwargs)
        return True

    with patch.object(chat_mod.db, "chat_email_throttle") as _throttle, \
         patch.object(chat_mod.db, "messages") as _msgs, \
         patch.object(chat_mod.db, "users") as _users, \
         patch.object(chat_mod.db, "properties") as _props, \
         patch.object(chat_mod.db, "marketplace_jobs") as _jobs, \
         patch.object(chat_mod, "send_chat_message_email", side_effect=fake_send_chat_email), \
         patch.object(chat_mod, "send_renter_message_notification", new=AsyncMock()):

        _msgs.find_one = AsyncMock(return_value=None)
        _throttle.find_one = AsyncMock(return_value=None)
        _throttle.update_one = AsyncMock(return_value=None)
        _users.find_one = AsyncMock(side_effect=[
            {"email": "r@t.com", "name": "R", "phone": None, "preferred_language": "en"},
            {"name": "S"},
        ])
        _props.find_one = AsyncMock(return_value={"title": "Sunny 2BR in Florentin"})
        # Jobs lookup should NOT be called because property was found —
        # but the mock will return None if called by accident.
        _jobs.find_one = AsyncMock(return_value=None)

        await chat_mod._send_chat_email_safe(
            sender_id="s", receiver_id="r", property_id="live-prop-uuid",
            message_body="hi", image_url=None, video_url=None,
        )

    assert captured["property_title"] == "Sunny 2BR in Florentin"
    assert not captured["property_title"].startswith("Job:")
    _jobs.find_one.assert_not_called()


@pytest.mark.asyncio
async def test_orphan_chat_email_falls_back_to_generic_title():
    """When neither property nor job resolves, keep the historical
    'your conversation' fallback so the email still sends."""
    from routes import chat as chat_mod

    captured = {}

    async def fake_send_chat_email(**kwargs):
        captured.update(kwargs)
        return True

    with patch.object(chat_mod.db, "chat_email_throttle") as _throttle, \
         patch.object(chat_mod.db, "messages") as _msgs, \
         patch.object(chat_mod.db, "users") as _users, \
         patch.object(chat_mod.db, "properties") as _props, \
         patch.object(chat_mod.db, "marketplace_jobs") as _jobs, \
         patch.object(chat_mod, "send_chat_message_email", side_effect=fake_send_chat_email), \
         patch.object(chat_mod, "send_renter_message_notification", new=AsyncMock()):

        _msgs.find_one = AsyncMock(return_value=None)
        _throttle.find_one = AsyncMock(return_value=None)
        _throttle.update_one = AsyncMock(return_value=None)
        _users.find_one = AsyncMock(side_effect=[
            {"email": "r@t.com", "name": "R", "phone": None, "preferred_language": "en"},
            {"name": "S"},
        ])
        _props.find_one = AsyncMock(return_value=None)
        _jobs.find_one = AsyncMock(return_value=None)

        await chat_mod._send_chat_email_safe(
            sender_id="s", receiver_id="r", property_id="orphan-uuid",
            message_body="hi", image_url=None, video_url=None,
        )

    assert captured["property_title"] == "your conversation"

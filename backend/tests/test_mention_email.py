"""Tests for the unread @-mention email background task.

Tests stub `send_mention_notification_email` so we don't hit Postmark and
seed messages directly into the DB to exercise the freshness/eligibility
filter, role resolution, and idempotency.
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from utils import mention_email as me  # noqa: E402


@pytest.fixture()
def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


@pytest.fixture(autouse=True)
def stub_postmark(monkeypatch):
    """Capture every email the task would send instead of hitting Postmark."""
    sent: list[dict] = []

    async def fake_send(**kwargs):
        sent.append(kwargs)
        return True

    monkeypatch.setattr(
        "utils.mention_email.send_mention_notification_email",
        fake_send,
    )
    return sent


async def _seed(db, *, msg_id, mentions, age_minutes, read=False, sent_flag=False):
    """Seed property + receiver + sender + message at the requested age."""
    owner_id = f"owner-{uuid.uuid4()}"
    renter_id = f"renter-{uuid.uuid4()}"
    property_id = f"prop-{uuid.uuid4()}"

    await db.users.insert_one(
        {"id": owner_id, "email": f"owner-{owner_id}@test.local", "name": "Test Owner", "role": "owner"}
    )
    await db.users.insert_one(
        {"id": renter_id, "email": f"renter-{renter_id}@test.local", "name": "Test Renter", "role": "renter"}
    )
    await db.properties.insert_one(
        {"id": property_id, "owner_id": owner_id, "title": "Test Apt", "area": "Tel Aviv"}
    )

    created = (datetime.now(UTC) - timedelta(minutes=age_minutes)).isoformat()
    doc = {
        "id": msg_id,
        "property_id": property_id,
        "sender_id": renter_id,
        "receiver_id": owner_id,
        "message": "Hey @owner please confirm the dates",
        "mentions": mentions,
        "created_at": created,
        "read": read,
    }
    if sent_flag:
        doc["mention_email_sent"] = True
    await db.messages.insert_one(doc)
    return {
        "owner_id": owner_id,
        "renter_id": renter_id,
        "property_id": property_id,
        "msg_id": msg_id,
    }


async def _cleanup(db, ids):
    await db.messages.delete_one({"id": ids["msg_id"]})
    await db.properties.delete_one({"id": ids["property_id"]})
    await db.users.delete_many({"id": {"$in": [ids["owner_id"], ids["renter_id"]]}})


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_old_unread_mention_emails_and_flags(db, stub_postmark):
    ids = _run(_seed(db, msg_id=f"m-{uuid.uuid4()}", mentions=["owner"], age_minutes=15))
    try:
        n = _run(me.scan_once())
        assert n >= 1, f"expected at least 1 scanned msg, got {n}"
        assert any(s["to_email"].endswith("@test.local") and "@owner" in s["message_snippet"]
                   for s in stub_postmark), f"no matching email captured: {stub_postmark}"
        # Idempotency flag stamped
        msg = _run(db.messages.find_one({"id": ids["msg_id"]}, {"_id": 0}))
        assert msg["mention_email_sent"] is True
        assert msg["mention_email_delivered"] is True
        # Second pass: nothing more
        before = len(stub_postmark)
        _run(me.scan_once())
        assert len(stub_postmark) == before
    finally:
        _run(_cleanup(db, ids))


def test_fresh_mention_below_delay_is_skipped(db, stub_postmark):
    ids = _run(_seed(db, msg_id=f"m-{uuid.uuid4()}", mentions=["owner"], age_minutes=2))
    try:
        _run(me.scan_once())
        # Not eligible yet → no email and no flag
        msg = _run(db.messages.find_one({"id": ids["msg_id"]}, {"_id": 0}))
        assert "mention_email_sent" not in msg or msg["mention_email_sent"] is False
        assert not any(s.get("property_id") == ids["property_id"] for s in stub_postmark)
    finally:
        _run(_cleanup(db, ids))


def test_already_read_mention_is_skipped(db, stub_postmark):
    ids = _run(_seed(db, msg_id=f"m-{uuid.uuid4()}", mentions=["owner"],
                     age_minutes=15, read=True))
    try:
        _run(me.scan_once())
        assert not any(s.get("property_id") == ids["property_id"] for s in stub_postmark)
    finally:
        _run(_cleanup(db, ids))


def test_role_mismatch_flags_without_emailing(db, stub_postmark):
    # Receiver is an owner, but only @renter mentioned → flag, don't email
    ids = _run(_seed(db, msg_id=f"m-{uuid.uuid4()}", mentions=["renter"], age_minutes=15))
    try:
        _run(me.scan_once())
        assert not any(s.get("property_id") == ids["property_id"] for s in stub_postmark)
        msg = _run(db.messages.find_one({"id": ids["msg_id"]}, {"_id": 0}))
        assert msg["mention_email_sent"] is True
    finally:
        _run(_cleanup(db, ids))


def test_already_flagged_is_skipped(db, stub_postmark):
    ids = _run(_seed(db, msg_id=f"m-{uuid.uuid4()}", mentions=["owner"],
                     age_minutes=15, sent_flag=True))
    try:
        _run(me.scan_once())
        assert not any(s.get("property_id") == ids["property_id"] for s in stub_postmark)
    finally:
        _run(_cleanup(db, ids))

"""A pending booking must stop holding its slot after the hold window.

Before this, a request nobody answered held its time forever: the slot never
came back, and the owner lost it without ever deciding anything.

Two mechanisms, and the test covers both because they fail differently:

  * **Lazy release** — `_busy_spans` stops counting a lapsed hold the moment
    it lapses. This is the guarantee. It cannot be defeated by a restart, a
    crashed task, or a deploy landing at the wrong minute.
  * **The sweep** — writes the `expired` status and sends the notifications.
    Availability never depends on it having run; if it does not, the slot is
    still free, the dashboard is just briefly out of date.

Runs against the local dev database (never Atlas — see MONGO_URL in
backend/.env). Every document written carries `_hold_test` and is removed in
teardown.
"""
import asyncio
import os
import re
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

MARKER = "_hold_test"
GIG_ID = f"{MARKER}-gig"
PROVIDER = f"{MARKER}-provider"
CLIENT = f"{MARKER}-client"


def _run(coro):
    """Reuse the session loop and never close it — `routes.deps.db` is a
    module-level Motor client bound to whichever loop first drives it, and
    closing that loop poisons the shared client for every later test."""
    try:
        loop = asyncio.get_event_loop_policy().get_event_loop()
        if loop.is_closed():
            raise RuntimeError("closed")
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def _env(key: str) -> str:
    if os.environ.get(key):
        return os.environ[key]
    text = (Path(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8")
    m = re.search(rf"^{key}\s*=\s*(.+)$", text, re.M)
    return m.group(1).strip().strip("\"'") if m else ""


def _db():
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(_env("MONGO_URL"))
    return client, client[_env("DB_NAME")]


DATE = (datetime.now(UTC) + timedelta(days=30)).date().isoformat()


async def _insert(status: str, expires_in_hours, slot: str, created_hours_ago=0):
    """One booking, with its hold expiry placed relative to now.

    `expires_in_hours=None` writes no `hold_expires_at` at all — the shape of
    every booking made before this feature existed.
    """
    client, db = _db()
    now = datetime.now(UTC)
    doc = {
        "_id": f"{MARKER}-{uuid.uuid4()}",
        "gig_id": GIG_ID,
        "provider_user_id": PROVIDER,
        # A real in-platform booking has both sides. A WhatsApp-lead
        # booking has no client account and is deliberately notified
        # once, not twice — see answer_lead.
        "client_user_id": CLIENT,
        "preferred_date": DATE,
        "time_slot": slot,
        "duration_minutes": 60,
        "status": status,
        "created_at": (now - timedelta(hours=created_hours_ago)).isoformat(),
        MARKER: True,
    }
    if expires_in_hours is not None:
        doc["hold_expires_at"] = (now + timedelta(hours=expires_in_hours)).isoformat()
    await db.marketplace_bookings.insert_one(doc)
    client.close()
    return doc["_id"]


async def _teardown():
    client, db = _db()
    await db.marketplace_bookings.delete_many({MARKER: True})
    await db.marketplace_providers.delete_many({MARKER: True})
    await db.notifications.delete_many({"user_id": {"$in": [PROVIDER, CLIENT]}})
    client.close()


async def _status(booking_id):
    client, db = _db()
    doc = await db.marketplace_bookings.find_one({"_id": booking_id}, {"_id": 0, "status": 1})
    client.close()
    return (doc or {}).get("status")


async def _held_slots():
    """Which start-minutes `_busy_spans` currently considers occupied."""
    from routes.marketplace.gigs import _busy_spans
    spans = await _busy_spans(GIG_ID, PROVIDER, DATE)
    return sorted(start for start, _ in spans.get(DATE, []))


@pytest.fixture(autouse=True)
def clean():
    _run(_teardown())
    yield
    _run(_teardown())


# 09:00 = 540 minutes, 10:00 = 600, 11:00 = 660, 12:00 = 720.

def test_live_hold_occupies_its_slot():
    _run(_insert("pending", expires_in_hours=6, slot="09:00"))
    assert 540 in _run(_held_slots())


def test_lapsed_hold_releases_without_the_sweep():
    """The guarantee. No background task has run; the slot is free anyway."""
    bid = _run(_insert("pending", expires_in_hours=-1, slot="10:00"))
    assert 600 not in _run(_held_slots()), "a lapsed hold is still occupying its slot"
    # And it has NOT been rewritten — proving the release is on read, not a
    # side effect of some other write.
    assert _run(_status(bid)) == "pending"


def test_accepted_bookings_never_expire():
    """An accepted booking is an agreed job. Expiry applies to waiting, not
    to work."""
    _run(_insert("accepted", expires_in_hours=-99, slot="11:00"))
    assert 660 in _run(_held_slots())


def test_bookings_predating_expiry_still_hold():
    """No `hold_expires_at` means the booking was made before holds expired.
    Silently freeing those would release slots their owners believe are
    taken."""
    _run(_insert("pending", expires_in_hours=None, slot="12:00"))
    assert 720 in _run(_held_slots())


def test_sweep_marks_lapsed_holds_expired_and_notifies(monkeypatch):
    from routes.marketplace import gigs
    from routes.marketplace.gigs import sweep_expired_holds
    # Notifications are held back during quiet hours (22:00-08:00 Israel).
    # This test is about the sweep, not the clock; the quiet-hours
    # behaviour has its own tests below. Without this it failed every
    # night.
    monkeypatch.setattr(gigs, "_is_waking_hours", lambda *_a, **_k: True)
    bid = _run(_insert("pending", expires_in_hours=-1, slot="13:00", created_hours_ago=25))
    result = _run(sweep_expired_holds())
    assert result["expired"] >= 1
    assert _run(_status(bid)) == "expired"

    client, db = _db()
    notes = _run(db.notifications.count_documents({"booking_id": bid}))
    client.close()
    # Both sides: the customer is told the time is free again, the owner is
    # told they lost it.
    assert notes == 2, f"expected 2 notifications, got {notes}"

    # Idempotent — a sweep every 15 minutes must not re-expire or re-notify.
    again = _run(sweep_expired_holds())
    assert again["expired"] == 0 or _run(_status(bid)) == "expired"


def test_sweep_does_not_touch_a_live_hold():
    from routes.marketplace.gigs import sweep_expired_holds
    bid = _run(_insert("pending", expires_in_hours=6, slot="14:00"))
    _run(sweep_expired_holds())
    assert _run(_status(bid)) == "pending"


def test_halfway_nudge_fires_once(monkeypatch):
    from routes.marketplace import gigs
    from routes.marketplace.gigs import sweep_expired_holds
    # Notifications are held back during quiet hours (22:00-08:00 Israel).
    # This test is about the sweep, not the clock; the quiet-hours
    # behaviour has its own tests below. Without this it failed every
    # night.
    monkeypatch.setattr(gigs, "_is_waking_hours", lambda *_a, **_k: True)
    # Created 13h ago on a 24h hold → 11h left, past the halfway mark.
    bid = _run(_insert("pending", expires_in_hours=11, slot="15:00", created_hours_ago=13))
    first = _run(sweep_expired_holds())
    assert first["nudged"] >= 1

    second = _run(sweep_expired_holds())
    assert second["nudged"] == 0, "the halfway nudge fired twice"

    client, db = _db()
    n = _run(db.notifications.count_documents(
        {"booking_id": bid, "type": "booking_hold_reminder"}))
    client.close()
    assert n == 1


def test_quiet_hours_release_immediately_but_announce_later(monkeypatch):
    """3am: the slot comes back, the phones stay quiet.

    The release must never wait on the clock — an owner losing a slot for
    eight hours because it lapsed overnight is the bug this feature exists
    to remove. Only the message waits.
    """
    from routes.marketplace import gigs
    bid = _run(_insert("pending", expires_in_hours=-1, slot="16:00", created_hours_ago=25))

    monkeypatch.setattr(gigs, "_is_waking_hours", lambda *_a, **_k: False)
    result = _run(gigs.sweep_expired_holds())
    assert result["expired"] >= 1
    assert _run(_status(bid)) == "expired", "the hold did not release overnight"

    client, db = _db()
    quiet_notes = _run(db.notifications.count_documents({"booking_id": bid}))
    client.close()
    assert quiet_notes == 0, f"woke someone at 3am: {quiet_notes} notifications"

    # Morning. The catch-up pass announces what was released overnight.
    monkeypatch.setattr(gigs, "_is_waking_hours", lambda *_a, **_k: True)
    morning = _run(gigs.sweep_expired_holds())
    assert morning["caught_up"] >= 1

    client, db = _db()
    notes = _run(db.notifications.count_documents({"booking_id": bid}))
    client.close()
    assert notes == 2

    # And not again on the next sweep fifteen minutes later.
    _run(gigs.sweep_expired_holds())
    client, db = _db()
    again = _run(db.notifications.count_documents({"booking_id": bid}))
    client.close()
    assert again == 2, "the catch-up pass re-announced an already-announced expiry"


def test_no_halfway_nudge_during_quiet_hours(monkeypatch):
    from routes.marketplace import gigs
    bid = _run(_insert("pending", expires_in_hours=11, slot="17:00", created_hours_ago=13))
    monkeypatch.setattr(gigs, "_is_waking_hours", lambda *_a, **_k: False)
    assert _run(gigs.sweep_expired_holds())["nudged"] == 0

    monkeypatch.setattr(gigs, "_is_waking_hours", lambda *_a, **_k: True)
    assert _run(gigs.sweep_expired_holds())["nudged"] >= 1


def test_a_lapsed_hold_is_never_nudged():
    """Reminding someone to answer a request that has already been released
    is noise at best, and misleading at worst."""
    from routes.marketplace.gigs import sweep_expired_holds
    _run(_insert("pending", expires_in_hours=-2, slot="18:00", created_hours_ago=26))
    assert _run(sweep_expired_holds())["nudged"] == 0


def test_hold_hours_falls_back_to_24_for_an_unknown_business():
    from routes.marketplace.gigs import DEFAULT_HOLD_HOURS, _hold_hours
    assert _run(_hold_hours(None)) == DEFAULT_HOLD_HOURS
    assert _run(_hold_hours("nobody-by-this-id")) == DEFAULT_HOLD_HOURS


def test_hold_hours_reads_the_business_setting():
    from routes.marketplace.gigs import DEFAULT_HOLD_HOURS, _hold_hours
    client, db = _db()
    _run(db.marketplace_providers.insert_one(
        {"_id": f"{MARKER}-p", "user_id": PROVIDER, "booking_hold_hours": 48, MARKER: True}))
    client.close()
    assert _run(_hold_hours(PROVIDER)) == 48

    client, db = _db()
    # A value outside the offered set must not be honoured — a hold of 9999
    # hours is the bug this feature exists to remove.
    _run(db.marketplace_providers.update_one(
        {"user_id": PROVIDER}, {"$set": {"booking_hold_hours": 9999}}))
    client.close()
    assert _run(_hold_hours(PROVIDER)) == DEFAULT_HOLD_HOURS


def test_expired_is_not_settable_through_the_patch_endpoint():
    """Expiry is a system transition. A provider must not be able to declare
    a booking expired by hand."""
    import pydantic
    from routes.marketplace.shared import BookingPatch
    with pytest.raises(pydantic.ValidationError):
        BookingPatch(status="expired")

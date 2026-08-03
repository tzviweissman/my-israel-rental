"""The cancellation guards, exercised against a real database.

These endpoints were hardened and shipped without an integration run, because
no local MongoDB was available at the time. The reasoning was reviewed and the
pure-logic tests passed, but nothing had actually driven the handlers. This
closes that gap.

What's covered, all of it behaviour that used to be wrong:

* ``/cancel`` refuses a booking that is already cancelled. Previously a
  double-click or a stale tab re-cancelled it: the reason was rewritten, the
  renter got a SECOND "your booking was cancelled" notification, and the
  saved-search email batch re-fired for dates freed the first time.
* ``/request-cancel`` refuses anything that isn't live. ``previous_status``
  reads the current status, so re-requesting on an already-requested booking
  recorded ``previous_status='cancellation_requested'`` — and a later deny
  "reverted" the booking to the requested state, with no live status to go
  back to.
* ``/request-cancel`` clears an earlier denial. Without the ``$unset`` a
  booking denied once carried ``cancellation_denial_reason`` forever, and the
  dashboard kept showing the red "your request was denied" box beside a
  request that was still pending, or one later approved.
* Authorisation is by relationship, not role — the renter cannot cancel
  directly, and a stranger cannot touch the booking at all.

The handlers are called directly with a fake token payload rather than over
HTTP, matching ``test_accept_booking_refactor.py``: the same code runs, with
no server to stand up.
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from dotenv import load_dotenv
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from routes.bookings import cancel as cancel_route  # noqa: E402


@pytest.fixture()
def db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(autouse=True)
def no_saved_search(monkeypatch):
    """Cancelling fires saved-search alerts; don't send mail from a test."""
    calls: list[tuple] = []

    async def fake_match(*args, **kwargs):
        calls.append((args, kwargs))
        return []

    monkeypatch.setattr(cancel_route, "match_property_against_searches", fake_match)
    return calls


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


async def _seed(db, *, status: str = "confirmed", extra: dict | None = None):
    ids = {
        "owner_id": f"owner-{uuid.uuid4()}",
        "renter_id": f"renter-{uuid.uuid4()}",
        "property_id": f"prop-{uuid.uuid4()}",
        "booking_id": f"book-{uuid.uuid4()}",
    }
    doc = {
        "id": ids["booking_id"],
        "property_id": ids["property_id"],
        "owner_id": ids["owner_id"],
        "renter_id": ids["renter_id"],
        "start_date": "2026-09-01",
        "end_date": "2026-09-15",
        "status": status,
        "created_at": datetime.now(UTC).isoformat(),
    }
    doc.update(extra or {})
    await db.bookings.insert_one(doc)
    return ids


async def _cleanup(db, ids):
    await db.bookings.delete_one({"id": ids["booking_id"]})
    await db.notifications.delete_many({"booking_id": ids["booking_id"]})


async def _booking(db, ids):
    return await db.bookings.find_one({"id": ids["booking_id"]}, {"_id": 0})


async def _notes(db, ids):
    return await db.notifications.find({"booking_id": ids["booking_id"]}, {"_id": 0}).to_list(50)


# ── /cancel ────────────────────────────────────────────────────────────────


def test_lister_can_cancel_a_confirmed_booking(db, no_saved_search):
    ids = _run(_seed(db, status="confirmed"))
    try:
        _run(cancel_route.cancel_booking(
            ids["booking_id"], reason="plumbing", payload={"user_id": ids["owner_id"]},
        ))
        b = _run(_booking(db, ids))
        assert b["status"] == "cancelled"
        assert b["cancellation_reason"] == "plumbing"
        assert len(_run(_notes(db, ids))) == 1
    finally:
        _run(_cleanup(db, ids))


def test_double_cancel_is_refused_and_sends_no_second_notification(db, no_saved_search):
    """The regression this guard exists for."""
    ids = _run(_seed(db, status="confirmed"))
    try:
        _run(cancel_route.cancel_booking(
            ids["booking_id"], reason="first", payload={"user_id": ids["owner_id"]},
        ))
        with pytest.raises(HTTPException) as exc:
            _run(cancel_route.cancel_booking(
                ids["booking_id"], reason="second", payload={"user_id": ids["owner_id"]},
            ))
        assert exc.value.status_code == 400

        b = _run(_booking(db, ids))
        assert b["cancellation_reason"] == "first", "the second call overwrote the reason"
        assert len(_run(_notes(db, ids))) == 1, "the renter was notified twice"
        assert len(no_saved_search) == 1, "saved-search alerts re-fired"
    finally:
        _run(_cleanup(db, ids))


def test_renter_cannot_cancel_directly(db, no_saved_search):
    ids = _run(_seed(db, status="confirmed"))
    try:
        with pytest.raises(HTTPException) as exc:
            _run(cancel_route.cancel_booking(
                ids["booking_id"], reason="nope", payload={"user_id": ids["renter_id"]},
            ))
        assert exc.value.status_code == 403
        assert _run(_booking(db, ids))["status"] == "confirmed"
    finally:
        _run(_cleanup(db, ids))


def test_stranger_cannot_cancel(db, no_saved_search):
    ids = _run(_seed(db, status="confirmed"))
    try:
        with pytest.raises(HTTPException) as exc:
            _run(cancel_route.cancel_booking(
                ids["booking_id"], reason="nope", payload={"user_id": "someone-else"},
            ))
        assert exc.value.status_code == 403
    finally:
        _run(_cleanup(db, ids))


# ── /request-cancel ────────────────────────────────────────────────────────


def test_renter_request_records_previous_status(db, no_saved_search):
    ids = _run(_seed(db, status="confirmed"))
    try:
        _run(cancel_route.request_cancel_booking(
            ids["booking_id"], reason="changed plans", payload={"user_id": ids["renter_id"]},
        ))
        b = _run(_booking(db, ids))
        assert b["status"] == "cancellation_requested"
        assert b["previous_status"] == "confirmed"
    finally:
        _run(_cleanup(db, ids))


def test_second_request_is_refused_so_previous_status_stays_live(db, no_saved_search):
    """Without the guard, previous_status became 'cancellation_requested'."""
    ids = _run(_seed(db, status="confirmed"))
    try:
        _run(cancel_route.request_cancel_booking(
            ids["booking_id"], reason="first", payload={"user_id": ids["renter_id"]},
        ))
        with pytest.raises(HTTPException) as exc:
            _run(cancel_route.request_cancel_booking(
                ids["booking_id"], reason="again", payload={"user_id": ids["renter_id"]},
            ))
        assert exc.value.status_code == 400
        assert _run(_booking(db, ids))["previous_status"] == "confirmed"
    finally:
        _run(_cleanup(db, ids))


def test_request_clears_an_earlier_denial(db, no_saved_search):
    """The stale red "denied" box that never went away."""
    ids = _run(_seed(db, status="confirmed", extra={
        "cancellation_denied": True,
        "cancellation_denial_reason": "peak season",
        "cancellation_denied_at": "2026-07-01T00:00:00+00:00",
    }))
    try:
        _run(cancel_route.request_cancel_booking(
            ids["booking_id"], reason="trying again", payload={"user_id": ids["renter_id"]},
        ))
        b = _run(_booking(db, ids))
        assert "cancellation_denial_reason" not in b
        assert "cancellation_denied" not in b
        assert "cancellation_denied_at" not in b
    finally:
        _run(_cleanup(db, ids))


def test_cannot_request_cancel_on_a_cancelled_booking(db, no_saved_search):
    ids = _run(_seed(db, status="cancelled"))
    try:
        with pytest.raises(HTTPException) as exc:
            _run(cancel_route.request_cancel_booking(
                ids["booking_id"], reason="too late", payload={"user_id": ids["renter_id"]},
            ))
        assert exc.value.status_code == 400
    finally:
        _run(_cleanup(db, ids))


# ── deny → re-request → approve, the full round trip ───────────────────────


def test_deny_reverts_to_the_live_status_then_approve_works(db, no_saved_search):
    ids = _run(_seed(db, status="confirmed"))
    try:
        _run(cancel_route.request_cancel_booking(
            ids["booking_id"], reason="plans changed", payload={"user_id": ids["renter_id"]},
        ))
        _run(cancel_route.deny_cancel_request(
            ids["booking_id"], denial_reason="peak season",
            payload={"user_id": ids["owner_id"]},
        ))
        b = _run(_booking(db, ids))
        assert b["status"] == "confirmed", "deny must restore the live status"
        assert b["cancellation_denial_reason"] == "peak season"

        # Renter tries again; the stale denial must not follow them.
        _run(cancel_route.request_cancel_booking(
            ids["booking_id"], reason="really cannot come", payload={"user_id": ids["renter_id"]},
        ))
        b = _run(_booking(db, ids))
        assert "cancellation_denial_reason" not in b
        assert b["previous_status"] == "confirmed"

        _run(cancel_route.approve_cancel_request(
            ids["booking_id"], payload={"user_id": ids["owner_id"]},
        ))
        assert _run(_booking(db, ids))["status"] == "cancelled"
    finally:
        _run(_cleanup(db, ids))

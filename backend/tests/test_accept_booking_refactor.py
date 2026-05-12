"""Regression tests for the refactored accept_booking() endpoint.

Locks in the contract of the new helpers and the 2 control paths:
  * Booking with no property contract → notification only, contract_sent=False.
  * Booking with property.contract_path → token minted, both parties notified,
    contract_sent=True.
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

# Import the module so we can monkey-patch its `send_booking_confirmation_email`
from routes import bookings as bookings_route  # noqa: E402


@pytest.fixture()
def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


@pytest.fixture(autouse=True)
def stub_postmark(monkeypatch):
    """Capture the acceptance email instead of hitting Postmark."""
    sent: list[dict] = []

    async def fake_send(**kwargs):
        sent.append(kwargs)
        return True

    monkeypatch.setattr(
        bookings_route, "send_booking_confirmation_email", fake_send
    )
    return sent


async def _seed(db, *, with_contract: bool):
    owner_id = f"owner-{uuid.uuid4()}"
    renter_id = f"renter-{uuid.uuid4()}"
    property_id = f"prop-{uuid.uuid4()}"
    booking_id = f"book-{uuid.uuid4()}"

    await db.users.insert_one(
        {"id": owner_id, "email": f"{owner_id}@test.local", "name": "Test Owner"}
    )
    await db.users.insert_one(
        {"id": renter_id, "email": f"{renter_id}@test.local", "name": "Test Renter"}
    )
    prop_doc: dict = {
        "id": property_id,
        "owner_id": owner_id,
        "title": "Test Apt",
        "area": "Tel Aviv",
        "currency": "ILS",
    }
    if with_contract:
        prop_doc["contract_path"] = "/tmp/whatever.pdf"
    await db.properties.insert_one(prop_doc)
    await db.bookings.insert_one(
        {
            "id": booking_id,
            "property_id": property_id,
            "owner_id": owner_id,
            "renter_id": renter_id,
            "start_date": "2026-09-01",
            "end_date": "2026-09-15",
            "status": "pending",
            "created_at": datetime.now(UTC).isoformat(),
        }
    )
    return {
        "owner_id": owner_id,
        "renter_id": renter_id,
        "property_id": property_id,
        "booking_id": booking_id,
    }


async def _cleanup(db, ids):
    await db.bookings.delete_one({"id": ids["booking_id"]})
    await db.properties.delete_one({"id": ids["property_id"]})
    await db.users.delete_many({"id": {"$in": [ids["owner_id"], ids["renter_id"]]}})
    await db.notifications.delete_many({"booking_id": ids["booking_id"]})


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_accept_no_contract_returns_false_and_one_notification(db, stub_postmark):
    ids = _run(_seed(db, with_contract=False))
    try:
        result = _run(
            bookings_route.accept_booking(
                ids["booking_id"], payload={"user_id": ids["owner_id"]}
            )
        )
        assert result["contract_sent"] is False
        booking = _run(db.bookings.find_one({"id": ids["booking_id"]}, {"_id": 0}))
        assert booking["status"] == "confirmed"
        assert "confirmed_at" in booking
        assert "contract_sign_token" not in booking
        notifs = _run(
            db.notifications.find({"booking_id": ids["booking_id"]}, {"_id": 0})
            .to_list(10)
        )
        # Exactly one notification → the renter's "booking_confirmed"
        assert len(notifs) == 1
        assert notifs[0]["type"] == "booking_confirmed"
        assert notifs[0]["user_id"] == ids["renter_id"]
        # Let the fire-and-forget task complete
        _run(asyncio.sleep(0.05))
        assert any(s.get("status") == "confirmed" for s in stub_postmark)
    finally:
        _run(_cleanup(db, ids))


def test_accept_with_contract_attaches_token_and_two_notifications(db, stub_postmark):
    ids = _run(_seed(db, with_contract=True))
    try:
        result = _run(
            bookings_route.accept_booking(
                ids["booking_id"], payload={"user_id": ids["owner_id"]}
            )
        )
        assert result["contract_sent"] is True
        booking = _run(db.bookings.find_one({"id": ids["booking_id"]}, {"_id": 0}))
        assert booking["status"] == "confirmed"
        assert booking["contract_signed"] is False
        assert booking["contract_sign_token"]
        notifs = _run(
            db.notifications.find({"booking_id": ids["booking_id"]}, {"_id": 0})
            .sort("created_at", 1).to_list(10)
        )
        types = sorted(n["type"] for n in notifs)
        assert types == ["contract_pending", "contract_sent"]
        # Each notification routed to the correct user
        by_type = {n["type"]: n for n in notifs}
        assert by_type["contract_pending"]["user_id"] == ids["renter_id"]
        assert by_type["contract_sent"]["user_id"] == ids["owner_id"]
    finally:
        _run(_cleanup(db, ids))


def test_accept_rejects_non_pending(db, stub_postmark):
    from fastapi import HTTPException
    ids = _run(_seed(db, with_contract=False))
    _run(db.bookings.update_one({"id": ids["booking_id"]}, {"$set": {"status": "confirmed"}}))
    try:
        with pytest.raises(HTTPException) as ei:
            _run(bookings_route.accept_booking(ids["booking_id"], payload={"user_id": ids["owner_id"]}))
        assert ei.value.status_code == 400
    finally:
        _run(_cleanup(db, ids))


def test_accept_rejects_wrong_owner(db, stub_postmark):
    from fastapi import HTTPException
    ids = _run(_seed(db, with_contract=False))
    try:
        with pytest.raises(HTTPException) as ei:
            _run(bookings_route.accept_booking(ids["booking_id"], payload={"user_id": "intruder"}))
        assert ei.value.status_code == 403
    finally:
        _run(_cleanup(db, ids))

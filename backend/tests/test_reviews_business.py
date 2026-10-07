"""Reviewing a business from its storefront (utils/reviews.py, 7 Oct 2026).

Who may: someone with a completed booking, a done order placed while signed
in, or a real conversation (they wrote, the business wrote back). Never the
owner. A conversation-based review is listed but not marked verified. An
average appears only from three reviews up.

In-process against a scratch database on the LOCAL MongoDB, dropped after
each test.   .venv/Scripts/python -m pytest -q tests/test_reviews_business.py
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from utils import reviews as rv  # noqa: E402

LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
pytestmark = pytest.mark.skipif(not LOCAL, reason="needs the local MongoDB; never runs against a remote one")
TEXT = "Friendly, on time and the work was spotless. Would use again."


def run(test):
    async def go():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[f"reviews_biz_test_{uuid.uuid4().hex[:10]}"]
        try:
            await rv.ensure_indexes(db)
            await test(db)
        finally:
            await client.drop_database(db.name)
            client.close()
    asyncio.run(go())


async def seed(db):
    await db.users.insert_many([{"id": "owner", "email": "pro@gmail.com", "name": "Pro Person"},
                                {"id": "cust", "email": "cust@gmail.com", "name": "dana levi cohen"},
                                {"id": "stranger", "email": "s@gmail.com", "name": "Sam"}])
    await db.businesses.insert_one({"_id": "biz1", "owner_user_id": "owner", "name": "Bakery"})
    await db.marketplace_gigs.insert_one({"_id": "gig1", "business_id": "biz1", "provider_user_id": "owner", "title": "Breads"})


def now():
    return datetime.now(UTC).isoformat()


def test_nobody_without_a_relationship():
    async def t(db):
        await seed(db)
        b = await rv.business_basis(db, "biz1", "stranger")
        assert b == {"eligible": False, "reason": "no_relationship", "basis_id": None, "kind": None}
    run(t)


def test_done_order_counts_and_is_verified():
    async def t(db):
        await seed(db)
        await db.store_orders.insert_one({"_id": "o1", "business_id": "biz1", "owner_user_id": "owner", "gig_id": "gig1",
                                          "customer_user_id": "cust", "status": "preparing", "status_changed_at": now()})
        assert (await rv.business_basis(db, "biz1", "cust"))["eligible"] is False  # not done yet
        await db.store_orders.update_one({"_id": "o1"}, {"$set": {"status": "done", "status_changed_at": now()}})
        b = await rv.business_basis(db, "biz1", "cust")
        assert b["eligible"] and b["kind"] == "order" and b["basis_id"] == "o1"
        doc = await rv.create_native(db, booking_id=b["basis_id"], user_id="cust", rating=5, text=TEXT)
        assert doc["verified"] is True and doc["booking_kind"] == "order" and doc["business_id"] == "biz1"
        assert doc["author_display_name"] == "Dana C."
        assert (await rv.business_basis(db, "biz1", "cust"))["reason"] == "already_reviewed"
    run(t)


def test_anonymous_order_does_not_count():
    async def t(db):
        await seed(db)
        await db.store_orders.insert_one({"_id": "o2", "business_id": "biz1", "owner_user_id": "owner", "gig_id": "gig1",
                                          "customer_user_id": None, "status": "done", "status_changed_at": now()})
        assert (await rv.business_basis(db, "biz1", "cust"))["eligible"] is False
    run(t)


def test_chat_needs_both_sides_and_is_not_verified():
    async def t(db):
        await seed(db)
        await db.messages.insert_one({"id": "m1", "property_id": "gig1", "sender_id": "cust", "receiver_id": "owner"})
        assert (await rv.business_basis(db, "biz1", "cust"))["eligible"] is False  # no answer yet
        await db.messages.insert_one({"id": "m2", "property_id": "gig1", "sender_id": "owner", "receiver_id": "cust"})
        b = await rv.business_basis(db, "biz1", "cust")
        assert b["eligible"] and b["kind"] == "chat"
        doc = await rv.create_native(db, booking_id=b["basis_id"], user_id="cust", rating=4, text=TEXT)
        assert doc["verified"] is False and doc["listing_id"] is None
        # one conversation review per person per business
        assert (await rv.business_basis(db, "biz1", "cust"))["reason"] == "already_reviewed"
        # someone else can't spend this person's conversation
        with pytest.raises(rv.ReviewError):
            await rv.create_native(db, booking_id=rv.chat_key("biz1", "cust"), user_id="stranger", rating=5, text=TEXT)
    run(t)


def test_owner_can_never_review_own_business():
    async def t(db):
        await seed(db)
        await db.messages.insert_many([{"id": "a", "property_id": "gig1", "sender_id": "owner", "receiver_id": "owner"}])
        assert (await rv.business_basis(db, "biz1", "owner"))["eligible"] is False
    run(t)


def test_booking_is_preferred_over_chat():
    async def t(db):
        await seed(db)
        await db.messages.insert_many([{"id": "m1", "property_id": "gig1", "sender_id": "cust", "receiver_id": "owner"},
                                       {"id": "m2", "property_id": "gig1", "sender_id": "owner", "receiver_id": "cust"}])
        await db.marketplace_bookings.insert_one({"_id": "mb1", "gig_id": "gig1", "provider_user_id": "owner", "client_user_id": "cust",
                                                  "status": "completed", "completed_at": now()})
        b = await rv.business_basis(db, "biz1", "cust")
        assert b["kind"] == "service" and b["basis_id"] == "mb1"
    run(t)


def test_no_average_below_three():
    async def t(db):
        await seed(db)
        for i, r in enumerate((5, 1)):
            await db.reviews.insert_one({"_id": f"r{i}", "business_id": "biz1", "source": "native", "rating": r,
                                         "status": "published", "source_connected": True})
        assert await rv.summary(db, {"business_id": "biz1"}) == {"native": {"avg": None, "count": 2}}
        await db.reviews.insert_one({"_id": "r3", "business_id": "biz1", "source": "native", "rating": 3,
                                     "status": "published", "source_connected": True})
        assert await rv.summary(db, {"business_id": "biz1"}) == {"native": {"avg": 3.0, "count": 3}}
    run(t)


def test_order_without_an_account_reviews_from_its_tracking_link():
    """Nobody signs in to order or to review (Tzvi, 7 Oct 2026)."""
    async def t(db):
        await seed(db)
        await db.store_orders.insert_one({"_id": "o9", "business_id": "biz1", "owner_user_id": "owner", "gig_id": "gig1",
                                          "customer_user_id": None, "customer_name": "Miriam ben david", "track_token": "trk9-0123456789ab",
                                          "status": "ready", "status_changed_at": now()})
        with pytest.raises(rv.ReviewError):
            await rv.order_review_link(db, "trk9-0123456789ab")  # not done yet
        with pytest.raises(rv.ReviewError):
            await rv.order_review_link(db, "nope")
        await db.store_orders.update_one({"_id": "o9"}, {"$set": {"status": "done", "status_changed_at": now()}})
        link = await rv.order_review_link(db, "trk9-0123456789ab")
        claim = await rv.read_request_token(db, link)
        doc = await rv.create_native(db, booking_id=claim["booking_id"], user_id=None, rating=5, text=TEXT, token_jti=claim["jti"])
        assert doc["verified"] and doc["booking_kind"] == "order" and doc["author_user_id"] is None
        assert doc["author_display_name"] == "Miriam D."
        # the link is spent, and the order can't be reviewed twice
        with pytest.raises(rv.ReviewError):
            await rv.read_request_token(db, link)
        with pytest.raises(rv.ReviewError):
            await rv.order_review_link(db, "trk9-0123456789ab")
        # without the link, an anonymous order is still nobody's to review
        assert (await rv.check_eligibility(db, await rv.load_booking(db, "o9"), None))["reason"] == "not_yours"
    run(t)


def test_booking_without_an_account_reviews_from_its_status_link():
    async def t(db):
        await seed(db)
        await db.marketplace_bookings.insert_one({"_id": "gb1", "gig_id": "gig1", "provider_user_id": "owner", "client_user_id": None,
                                                  "guest_name": "Ruth Adler", "track_token": "trk-guest-booking-1",
                                                  "status": "accepted"})
        with pytest.raises(rv.ReviewError):
            await rv.order_review_link(db, "trk-guest-booking-1", collection="marketplace_bookings")  # not done yet
        await db.marketplace_bookings.update_one({"_id": "gb1"}, {"$set": {"status": "completed", "completed_at": now()}})
        link = await rv.order_review_link(db, "trk-guest-booking-1", collection="marketplace_bookings")
        claim = await rv.read_request_token(db, link)
        doc = await rv.create_native(db, booking_id=claim["booking_id"], user_id=None, rating=4, text=TEXT, token_jti=claim["jti"])
        assert doc["verified"] and doc["booking_kind"] == "service" and doc["author_display_name"] == "Ruth A."
    run(t)

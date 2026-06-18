"""End-to-end regression: when an admin resolves duplicate listings, all
chats/bookings/likes attached to the deleted twin must move to the
keeper so they don't open to "Property not found".

Seeds two duplicate property docs directly in MongoDB (bypassing the
dedupe gate that would otherwise block the second insert), attaches a
message + booking + like to one of them, runs the live resolver via
HTTP, and asserts the rows now point at the keeper.
"""
import asyncio
import os
import uuid
from datetime import UTC, datetime

import pytest
import requests
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@rental.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin1234!")


def _backend_env():
    return dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))


def _login_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login: {r.status_code} {r.text}"
    return r.json()["token"]


def _seed_duplicate_pair_via_db():
    """Insert two property docs with the SAME (owner_id, address,
    rental_type) directly in Mongo + a chat message + booking + like
    attached to the would-be loser. Returns the IDs we need to verify."""
    env = _backend_env()
    addr = f"DupTest {uuid.uuid4().hex[:8]}"
    owner_id = f"dup-test-owner-{uuid.uuid4().hex[:8]}"
    renter_id = f"dup-test-renter-{uuid.uuid4().hex[:8]}"

    keeper_id = str(uuid.uuid4())
    loser_id = str(uuid.uuid4())
    base = {
        "owner_id": owner_id, "title": "Twin",
        "description": "x", "area": "Jerusalem - American Colony",
        "address": addr, "rental_type": "vacation",
        "property_type": "apartment", "bedrooms": 2, "bathrooms": 1,
        "nightly_price": 100, "currency": "ILS", "status": "active",
        "images": [],
    }
    # Distinct created_at so keep_oldest deterministically picks the keeper.
    keeper_created = "2026-01-01T10:00:00+00:00"
    loser_created = "2026-01-01T11:00:00+00:00"
    now = datetime.now(UTC).isoformat()

    async def go():
        c = AsyncIOMotorClient(env["MONGO_URL"])
        db = c[env["DB_NAME"]]
        await db.properties.insert_one({**base, "id": keeper_id, "created_at": keeper_created, "title": "KEEPER"})
        await db.properties.insert_one({**base, "id": loser_id, "created_at": loser_created, "title": "LOSER"})
        # Owner stub (looked up by name/email enrichment in the resolver)
        await db.users.insert_one({
            "id": owner_id, "email": f"{owner_id}@dup-test.local",
            "password": "x", "name": "Dup Test Owner", "role": "owner",
            "email_verified": True,
        })
        await db.messages.insert_one({
            "id": str(uuid.uuid4()), "property_id": loser_id,
            "sender_id": renter_id, "receiver_id": owner_id,
            "message": "Hi, still available?", "created_at": now,
            "read": False, "mentions": [],
        })
        await db.bookings.insert_one({
            "id": str(uuid.uuid4()), "property_id": loser_id,
            "renter_id": renter_id, "owner_id": owner_id,
            "start_date": "2099-01-01", "end_date": "2099-01-05",
            "status": "pending", "created_at": now,
        })
        await db.liked_properties.insert_one({
            "user_id": renter_id, "property_id": loser_id, "created_at": now,
        })
        c.close()

    asyncio.run(go())
    return {
        "keeper_id": keeper_id, "loser_id": loser_id,
        "owner_id": owner_id, "renter_id": renter_id, "address": addr,
    }


def _cleanup(ids: dict):
    env = _backend_env()
    async def go():
        c = AsyncIOMotorClient(env["MONGO_URL"])
        db = c[env["DB_NAME"]]
        await db.properties.delete_many({"id": {"$in": [ids["keeper_id"], ids["loser_id"]]}})
        await db.messages.delete_many({"property_id": {"$in": [ids["keeper_id"], ids["loser_id"]]}})
        await db.bookings.delete_many({"property_id": {"$in": [ids["keeper_id"], ids["loser_id"]]}})
        await db.liked_properties.delete_many({"user_id": ids["renter_id"]})
        await db.users.delete_many({"id": ids["owner_id"]})
        c.close()
    asyncio.run(go())


@pytest.fixture
def dup_pair():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not set")
    ids = _seed_duplicate_pair_via_db()
    yield ids
    _cleanup(ids)


def test_resolve_duplicates_prefers_listing_with_chat_history(dup_pair):
    """When exactly one twin has chat/booking history, the resolver MUST
    keep THAT one regardless of mode — so the renter's bookmarked URL
    stays valid (and no re-attach is needed)."""
    token = _login_token()
    keeper_id, loser_id = dup_pair["keeper_id"], dup_pair["loser_id"]
    # The fixture seeded message + booking + like on `loser_id`. Even
    # though `loser_id` was created LATER, the active-prop preference
    # must override `keep_oldest` and make it the survivor.
    r = requests.post(f"{BASE_URL}/api/admin/duplicates/resolve",
        json={"mode": "keep_oldest"},
        headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"resolve: {r.status_code} {r.text}"
    body = r.json()
    relevant = [g for g in body["report"]
                if set(g["deleted_ids"] + [g["kept_id"]]) == {keeper_id, loser_id}]
    assert relevant, f"Test pair not in report. Got: {body['report']}"
    entry = relevant[0]
    # The one with activity wins — that's `loser_id` in our seed.
    assert entry["kept_id"] == loser_id, (
        f"Resolver kept {entry['kept_id']} but should have kept the listing "
        f"with chat history ({loser_id}). keep_oldest must yield to active-prop preference."
    )
    # And because the active twin already had the data, NO reattach was
    # necessary — the messages/bookings/likes never moved.
    assert entry["reattached"]["messages"] == 0
    assert entry["reattached"]["bookings"] == 0
    assert entry["reattached"]["likes"] == 0

    # Verify the seeded message + booking + like still reference loser_id
    # (which is now the keeper).
    env = _backend_env()
    async def verify():
        c = AsyncIOMotorClient(env["MONGO_URL"])
        db = c[env["DB_NAME"]]
        msgs = await db.messages.count_documents({"property_id": loser_id, "sender_id": dup_pair["renter_id"]})
        bookings = await db.bookings.count_documents({"property_id": loser_id, "renter_id": dup_pair["renter_id"]})
        likes = await db.liked_properties.count_documents({"property_id": loser_id, "user_id": dup_pair["renter_id"]})
        # The other twin (the supposed "keeper" by name) is gone.
        survivor = await db.properties.find_one({"id": keeper_id}, {"_id": 0, "id": 1})
        c.close()
        return msgs, bookings, likes, survivor
    msgs, bookings, likes, survivor = asyncio.run(verify())
    assert msgs >= 1 and bookings >= 1 and likes >= 1
    assert survivor is None, "The chat-less twin should have been deleted"


def test_resolve_duplicates_falls_back_to_mode_when_no_activity():
    """When NEITHER twin has chats/bookings/likes, the mode tiebreaker
    (keep_oldest in this test) picks the survivor as before."""
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not set")
    env = _backend_env()
    addr = f"DupTest-Inactive {uuid.uuid4().hex[:8]}"
    owner_id = f"dup-test-owner-{uuid.uuid4().hex[:8]}"
    older_id = str(uuid.uuid4())
    newer_id = str(uuid.uuid4())
    base = {
        "owner_id": owner_id, "title": "Twin",
        "description": "x", "area": "Jerusalem - American Colony",
        "address": addr, "rental_type": "vacation",
        "property_type": "apartment", "bedrooms": 2, "bathrooms": 1,
        "nightly_price": 100, "currency": "ILS", "status": "active",
        "images": [],
    }

    async def seed():
        c = AsyncIOMotorClient(env["MONGO_URL"])
        db = c[env["DB_NAME"]]
        await db.properties.insert_one({**base, "id": older_id, "created_at": "2026-01-01T10:00:00+00:00", "title": "OLDER"})
        await db.properties.insert_one({**base, "id": newer_id, "created_at": "2026-01-02T10:00:00+00:00", "title": "NEWER"})
        await db.users.insert_one({
            "id": owner_id, "email": f"{owner_id}@dup-test.local",
            "password": "x", "name": "x", "role": "owner",
            "email_verified": True,
        })
        c.close()

    asyncio.run(seed())

    try:
        token = _login_token()
        r = requests.post(f"{BASE_URL}/api/admin/duplicates/resolve",
            json={"mode": "keep_oldest"},
            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        body = r.json()
        relevant = [g for g in body["report"]
                    if set(g["deleted_ids"] + [g["kept_id"]]) == {older_id, newer_id}]
        assert relevant
        entry = relevant[0]
        # Older wins by mode since neither had activity.
        assert entry["kept_id"] == older_id
    finally:
        async def cleanup():
            c = AsyncIOMotorClient(env["MONGO_URL"])
            db = c[env["DB_NAME"]]
            await db.properties.delete_many({"id": {"$in": [older_id, newer_id]}})
            await db.users.delete_many({"id": owner_id})
            c.close()
        asyncio.run(cleanup())


def test_manual_reattach_endpoint_validates_inputs():
    """The new POST /admin/chats/reattach endpoint rejects bad inputs and
    accepts a missing source + valid target."""
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not set")
    token = _login_token()
    fake_dead = str(uuid.uuid4())
    fake_target = str(uuid.uuid4())

    # Same ids → 400
    r = requests.post(f"{BASE_URL}/api/admin/chats/reattach",
        json={"from_property_id": fake_dead, "to_property_id": fake_dead},
        headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 400

    # Target doesn't exist → 404
    r = requests.post(f"{BASE_URL}/api/admin/chats/reattach",
        json={"from_property_id": fake_dead, "to_property_id": fake_target},
        headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 404

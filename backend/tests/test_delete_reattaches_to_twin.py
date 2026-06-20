"""Regression: DELETE /api/properties/{id} auto-reattaches chats / bookings /
likes to a surviving duplicate twin instead of leaving them as orphans.

The bulk dedupe resolver has always done this — but the everyday "owner
deletes one of their two duplicate cards" path used to just delete the
property and abandon the chat. After this fix the chat seamlessly moves
to the twin so the existing renter conversation stays alive.
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone

import requests
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL", "").rstrip("/")
_env = dotenv_values("/app/backend/.env")
MONGO_URL = _env.get("MONGO_URL") or os.environ["MONGO_URL"]
DB_NAME = _env.get("DB_NAME") or os.environ["DB_NAME"]


def _login(email: str, password: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=10)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


async def _seed_dup_pair_with_chat(db, *, keeper_has_images=True):
    """Seed two duplicate listings owned by `owner@test.com` (signature
    matches: same owner + address + rental_type + bedrooms + floor) with
    a chat thread + booking + like on the LOSER. The loser is the one
    we'll DELETE; the keeper is the survivor."""
    now = datetime.now(timezone.utc).isoformat()
    owner = await db.users.find_one({"email": "owner@test.com"})
    renter = await db.users.find_one({"email": "renter@test.com"})
    assert owner and renter, "seed users missing"
    owner_id = owner["id"]
    renter_id = renter["id"]
    address = f"Reattach Test St {uuid.uuid4().hex[:6]}"
    base = {
        "owner_id": owner_id, "address": address, "rental_type": "vacation",
        "bedrooms": 2, "floor": 4, "title": "Reattach Test", "country": "IL",
        "status": "active",
    }
    keeper_id = str(uuid.uuid4())
    loser_id = str(uuid.uuid4())
    await db.properties.insert_many([
        {
            **base, "id": keeper_id, "created_at": now,
            "images": ["https://example.com/keeper.jpg"] if keeper_has_images else [],
            "videos": [],
        },
        {
            **base, "id": loser_id, "created_at": now,
            "images": [
                "https://example.com/loser-a.jpg",
                "https://example.com/loser-b.jpg",
            ],
            "videos": ["https://example.com/loser-v.mp4"],
        },
    ])
    msg_id = str(uuid.uuid4())
    await db.messages.insert_one({
        "id": msg_id, "property_id": loser_id, "sender_id": renter_id,
        "text": "is this still available?", "created_at": now,
    })
    booking_id = str(uuid.uuid4())
    await db.bookings.insert_one({
        "id": booking_id, "property_id": loser_id, "renter_id": renter_id,
        "owner_id": owner_id, "status": "pending",
        "start_date": "2026-08-01", "end_date": "2026-08-10",
        "created_at": now,
    })
    await db.liked_properties.insert_one({
        "id": str(uuid.uuid4()), "property_id": loser_id, "user_id": renter_id,
        "created_at": now,
    })
    return owner_id, keeper_id, loser_id, msg_id, booking_id


def test_delete_loser_reattaches_everything_to_twin():
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    owner_id, keeper_id, loser_id, msg_id, booking_id = loop.run_until_complete(
        _seed_dup_pair_with_chat(db)
    )
    try:
        token = _login("owner@test.com", "Test1234!")
        r = requests.delete(f"{BASE_URL}/api/properties/{loser_id}",
                            headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert r.status_code == 200, f"delete failed: {r.status_code} {r.text}"
        body = r.json()
        # Toast message mentions the rescue
        assert "moved" in body["message"].lower(), body["message"]
        rea = body["reattached"]
        assert rea["to"] == keeper_id
        assert rea["messages"] == 1
        assert rea["bookings"] == 1
        assert rea["likes"] == 1
        # 2 unique loser images merged into the keeper
        assert rea["images_merged"] == 2

        # Loser doc gone
        assert loop.run_until_complete(db.properties.find_one({"id": loser_id})) is None
        # Chat now points at the keeper
        m = loop.run_until_complete(db.messages.find_one({"id": msg_id}))
        assert m["property_id"] == keeper_id
        # Booking re-pointed
        b = loop.run_until_complete(db.bookings.find_one({"id": booking_id}))
        assert b["property_id"] == keeper_id
        # Keeper images now include the rescued loser URLs + mirror_pending set
        keeper = loop.run_until_complete(db.properties.find_one({"id": keeper_id}))
        assert "https://example.com/loser-a.jpg" in keeper["images"]
        assert "https://example.com/loser-b.jpg" in keeper["images"]
        assert "https://example.com/loser-v.mp4" in keeper["videos"]
        assert keeper.get("mirror_pending") is True
    finally:
        loop.run_until_complete(db.properties.delete_many({"id": {"$in": [keeper_id, loser_id]}}))
        loop.run_until_complete(db.messages.delete_many({"id": msg_id}))
        loop.run_until_complete(db.bookings.delete_many({"id": booking_id}))
        loop.run_until_complete(db.liked_properties.delete_many({"property_id": {"$in": [keeper_id, loser_id]}}))
        loop.close()


def test_delete_lone_property_keeps_existing_subleases_detached():
    """Sanity: when there's no twin, behavior matches the legacy path —
    no reattach, subleases get detached so they live as standalones."""
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    owner = loop.run_until_complete(db.users.find_one({"email": "owner@test.com"}))
    owner_id = owner["id"]
    prop_id = str(uuid.uuid4())
    sub_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    loop.run_until_complete(db.properties.insert_one({
        "id": prop_id, "owner_id": owner_id,
        "address": f"Lone St {uuid.uuid4().hex[:6]}", "rental_type": "long-term",
        "bedrooms": 3, "floor": 5, "title": "Lone Test", "country": "IL",
        "status": "active", "images": [], "videos": [], "created_at": now,
    }))
    loop.run_until_complete(db.subleases.insert_one({
        "id": sub_id, "original_property_id": prop_id, "created_at": now,
    }))
    try:
        token = _login("owner@test.com", "Test1234!")
        r = requests.delete(f"{BASE_URL}/api/properties/{prop_id}",
                            headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["reattached"]["to"] is None
        # Sublease was detached (legacy behavior preserved)
        sub = loop.run_until_complete(db.subleases.find_one({"id": sub_id}))
        assert sub["original_property_id"] is None
    finally:
        loop.run_until_complete(db.properties.delete_many({"id": prop_id}))
        loop.run_until_complete(db.subleases.delete_many({"id": sub_id}))
        loop.close()

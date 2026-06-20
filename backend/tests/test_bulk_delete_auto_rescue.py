"""Regression: /admin/properties/bulk DELETE with auto_rescue_duplicates=True.

Mirrors what the new admin UI checkbox does — for each row scheduled for
deletion, if a surviving twin exists outside the batch, reattach its
related rows + merge images into the twin instead of tombstoning. Rows
without a twin still go through the standard snapshot+cascade path.
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


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


async def _seed_mixed_batch(db):
    """Seed two listings:
     - loser_with_twin: has a duplicate twin in the DB → will be rescued.
     - loser_lonely: no twin → will be tombstoned (Undo-eligible).
    Chat history on each loser, plus a twin with no images so we can
    assert the image merge later.
    """
    now = datetime.now(timezone.utc).isoformat()
    owner = await db.users.find_one({"email": "owner@test.com"})
    renter = await db.users.find_one({"email": "renter@test.com"})
    assert owner and renter
    twin_id = str(uuid.uuid4())
    loser_with_twin = str(uuid.uuid4())
    loser_lonely = str(uuid.uuid4())
    addr_shared = f"Shared St {uuid.uuid4().hex[:6]}"
    addr_lonely = f"Lonely St {uuid.uuid4().hex[:6]}"
    base = {
        "owner_id": owner["id"], "rental_type": "vacation",
        "bedrooms": 2, "floor": 3, "title": "Bulk Test", "country": "IL",
        "status": "active", "created_at": now,
    }
    await db.properties.insert_many([
        {**base, "id": twin_id, "address": addr_shared, "images": [], "videos": []},
        {
            **base, "id": loser_with_twin, "address": addr_shared,
            "images": ["https://example.com/rescue.jpg"], "videos": [],
        },
        {
            **base, "id": loser_lonely, "address": addr_lonely,
            "images": ["https://example.com/lonely.jpg"], "videos": [],
        },
    ])
    msg_rescue_id = str(uuid.uuid4())
    msg_lonely_id = str(uuid.uuid4())
    await db.messages.insert_many([
        {"id": msg_rescue_id, "property_id": loser_with_twin,
         "sender_id": renter["id"], "text": "rescue me", "created_at": now},
        {"id": msg_lonely_id, "property_id": loser_lonely,
         "sender_id": renter["id"], "text": "tombstone me", "created_at": now},
    ])
    return twin_id, loser_with_twin, loser_lonely, msg_rescue_id, msg_lonely_id


def test_bulk_delete_with_rescue_moves_chats_for_twin_keeps_tombstone_for_lonely():
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    twin_id, with_twin, lonely, msg_rescue_id, msg_lonely_id = loop.run_until_complete(_seed_mixed_batch(db))
    try:
        token = _login("admin@rental.com", "Admin1234!")
        r = requests.delete(
            f"{BASE_URL}/api/admin/properties/bulk",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "property_ids": [with_twin, lonely],
                "auto_rescue_duplicates": True,
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # Both properties got deleted.
        assert body["deleted"] == 2
        # Exactly one rescue happened.
        assert body["rescued_count"] == 1, body
        assert body["rescue_totals"]["messages"] == 1
        assert body["rescue_totals"]["images_merged"] == 1
        # Tombstone snapshot covers ONLY the lonely loser (the rescued one
        # had everything moved off it; nothing left to restore).
        assert body["snapshot_id"]
        snap = loop.run_until_complete(
            db.property_tombstones.find_one({"id": body["snapshot_id"]})
        )
        assert snap is not None
        assert snap["property_ids"] == [lonely]

        # Rescued chat now points at the twin.
        m_rescue = loop.run_until_complete(db.messages.find_one({"id": msg_rescue_id}))
        assert m_rescue is not None
        assert m_rescue["property_id"] == twin_id
        # Lonely chat got cascade-deleted (it's in the tombstone, restorable
        # via the Undo button).
        assert loop.run_until_complete(db.messages.find_one({"id": msg_lonely_id})) is None

        # Twin received the rescued image + mirror_pending flag.
        twin = loop.run_until_complete(db.properties.find_one({"id": twin_id}))
        assert "https://example.com/rescue.jpg" in twin["images"]
        assert twin.get("mirror_pending") is True

        # Both loser docs are gone.
        assert loop.run_until_complete(db.properties.find_one({"id": with_twin})) is None
        assert loop.run_until_complete(db.properties.find_one({"id": lonely})) is None
    finally:
        loop.run_until_complete(db.properties.delete_many({"id": {"$in": [twin_id, with_twin, lonely]}}))
        loop.run_until_complete(db.messages.delete_many({"id": {"$in": [msg_rescue_id, msg_lonely_id]}}))
        loop.run_until_complete(db.property_tombstones.delete_many({"property_ids": [lonely]}))
        loop.close()


def test_bulk_delete_without_rescue_keeps_legacy_tombstone_behavior():
    """Sanity: when the checkbox is off, behavior matches the old path —
    every property goes into the tombstone, no rescues."""
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    twin_id, with_twin, lonely, msg_rescue_id, msg_lonely_id = loop.run_until_complete(_seed_mixed_batch(db))
    try:
        token = _login("admin@rental.com", "Admin1234!")
        r = requests.delete(
            f"{BASE_URL}/api/admin/properties/bulk",
            headers={"Authorization": f"Bearer {token}"},
            json={"property_ids": [with_twin, lonely]},  # default: auto_rescue=False
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["deleted"] == 2
        assert body["rescued_count"] == 0
        assert body["snapshot_id"]
        snap = loop.run_until_complete(
            db.property_tombstones.find_one({"id": body["snapshot_id"]})
        )
        # BOTH ids in the tombstone — legacy behavior.
        assert set(snap["property_ids"]) == {with_twin, lonely}
        # Both chats were cascade-deleted (snapshot has them for restore).
        assert loop.run_until_complete(db.messages.find_one({"id": msg_rescue_id})) is None
        # Twin's images stay untouched (no merge).
        twin = loop.run_until_complete(db.properties.find_one({"id": twin_id}))
        assert twin["images"] == []
    finally:
        loop.run_until_complete(db.properties.delete_many({"id": {"$in": [twin_id, with_twin, lonely]}}))
        loop.run_until_complete(db.messages.delete_many({"id": {"$in": [msg_rescue_id, msg_lonely_id]}}))
        loop.run_until_complete(db.property_tombstones.delete_many({"property_ids": {"$in": [[with_twin, lonely], [lonely, with_twin]]}}))
        loop.close()

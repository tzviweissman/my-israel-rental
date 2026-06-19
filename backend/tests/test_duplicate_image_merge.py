"""Regression test for the duplicate-resolver image-merge fix.

Bug: when /admin/duplicates/resolve picked a keeper that had no images
(e.g. an "active twin" preferred because it carried chat history), the
loser duplicates' image URLs were deleted with the loser docs. Admins
then saw the re-mirror tool report "many listings have no photo URLs"
even though the original CSV definitely had them.

Fix: merge images + videos from each loser into the keeper BEFORE the
loser delete_many runs. Dedupe by URL. Cap at 30 imgs / 5 vids.

Follows the same pattern as test_duplicate_reattach.py — direct DB seed,
HTTP call to the live backend, DB-level assertions, full cleanup.
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
    # Fall back to the value baked into the frontend .env so the test
    # works from a fresh shell without explicit env vars.
    BASE_URL = dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL", "").rstrip("/")

_env = dotenv_values("/app/backend/.env")
MONGO_URL = _env.get("MONGO_URL") or os.environ["MONGO_URL"]
DB_NAME = _env.get("DB_NAME") or os.environ["DB_NAME"]


def _admin_token() -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@rental.com", "password": "Admin1234!"},
        timeout=10,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _seed(db, docs):
    return asyncio.get_event_loop().run_until_complete(db.properties.insert_many(docs))


async def _seed_for_empty_keeper(db):
    now = datetime.now(timezone.utc).isoformat()
    owner_id = f"test-owner-{uuid.uuid4()}"
    address = f"Test St {uuid.uuid4().hex[:6]}"
    keeper_id = str(uuid.uuid4())
    loser_id = str(uuid.uuid4())
    base = {
        "owner_id": owner_id, "address": address, "rental_type": "vacation",
        "bedrooms": 2, "floor": 3, "title": "Test Apt", "country": "IL",
        "status": "active",
    }
    await db.properties.insert_many([
        {**base, "id": keeper_id, "images": [], "videos": [], "created_at": now},
        {
            **base, "id": loser_id, "created_at": now,
            "images": [
                "https://example.com/a.jpg",
                "https://example.com/b.jpg",
                "https://example.com/c.jpg",
            ],
            "videos": ["https://example.com/v1.mp4"],
        },
    ])
    # Chat history on the keeper → wins active_props preference, reproducing
    # the exact bug shape.
    await db.messages.insert_one({
        "id": str(uuid.uuid4()),
        "property_id": keeper_id,
        "sender_id": "test-renter",
        "text": "is this available?",
        "created_at": now,
    })
    return keeper_id, loser_id


def test_duplicate_resolver_merges_images_from_losers_into_empty_keeper():
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    keeper_id, loser_id = loop.run_until_complete(_seed_for_empty_keeper(db))
    try:
        token = _admin_token()
        r = requests.post(
            f"{BASE_URL}/api/admin/duplicates/resolve",
            json={"mode": "keep_newest"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"resolve failed: {r.status_code} {r.text}"
        body = r.json()
        row = next((g for g in body["report"] if g["kept_id"] == keeper_id), None)
        assert row is not None, f"keeper not retained — report: {body['report']}"
        assert loser_id in row["deleted_ids"]
        assert row["images_merged"] == 3, f"expected 3 merged, got {row['images_merged']}"

        keeper_after = loop.run_until_complete(db.properties.find_one({"id": keeper_id}))
        assert keeper_after is not None
        assert sorted(keeper_after["images"]) == sorted([
            "https://example.com/a.jpg",
            "https://example.com/b.jpg",
            "https://example.com/c.jpg",
        ])
        assert keeper_after["videos"] == ["https://example.com/v1.mp4"]
        assert keeper_after.get("mirror_pending") is True
        assert loop.run_until_complete(db.properties.find_one({"id": loser_id})) is None
    finally:
        loop.run_until_complete(db.properties.delete_many({"id": {"$in": [keeper_id, loser_id]}}))
        loop.run_until_complete(db.messages.delete_many({"property_id": keeper_id}))
        loop.close()


def test_duplicate_resolver_dedupes_overlapping_image_urls():
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    owner_id = f"test-owner-{uuid.uuid4()}"
    now = datetime.now(timezone.utc).isoformat()
    keeper_id = str(uuid.uuid4())
    loser_id = str(uuid.uuid4())
    address = f"Test St {uuid.uuid4().hex[:6]}"
    base = {
        "owner_id": owner_id, "address": address, "rental_type": "vacation",
        "bedrooms": 1, "floor": 0, "title": "Dup Test", "country": "IL", "status": "active",
    }
    loop.run_until_complete(db.properties.insert_many([
        {**base, "id": keeper_id, "images": ["https://example.com/a.jpg", "https://example.com/b.jpg"], "videos": [], "created_at": now},
        {**base, "id": loser_id, "images": ["https://example.com/b.jpg", "https://example.com/c.jpg", "https://example.com/d.jpg"], "videos": [], "created_at": now},
    ]))
    try:
        token = _admin_token()
        r = requests.post(
            f"{BASE_URL}/api/admin/duplicates/resolve",
            json={"mode": "keep_richest"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        kept = loop.run_until_complete(db.properties.find_one({"id": {"$in": [keeper_id, loser_id]}}))
        assert kept is not None
        # 4 unique URLs (a, b, c, d) — b dedupes to one entry.
        assert len(kept["images"]) == 4, f"got {kept['images']}"
        assert len(set(kept["images"])) == 4
        assert "https://example.com/b.jpg" in kept["images"]
    finally:
        loop.run_until_complete(db.properties.delete_many({"id": {"$in": [keeper_id, loser_id]}}))
        loop.close()

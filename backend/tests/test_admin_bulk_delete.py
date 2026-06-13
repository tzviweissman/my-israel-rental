"""Tests for the admin bulk-delete listings endpoint.

Covers:
- POST /api/admin/properties/bulk (auth, empty list, happy path, cascade)
- Cascade cleanup of related messages / bookings / admin_blocks /
  chat_nudges / liked_properties / featured list / sublease detach
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(Path(__file__).parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://where-am-i-project.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@rental.com", "password": "Admin1234!"}
OWNER = {"email": "owner@test.com", "password": "Test1234!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def owner_headers():
    return {"Authorization": f"Bearer {_login(OWNER)}"}


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _seed_property(db, owner_id: str, *, status: str = "active") -> str:
    """Insert a throwaway property + return its id."""
    pid = str(uuid.uuid4())
    asyncio.run(db.properties.insert_one({
        "id": pid, "owner_id": owner_id, "title": f"Bulk-delete test {pid[:6]}",
        "area": "Tel Aviv", "rental_type": "long-term", "status": status,
        "monthly_price": 5000, "currency": "ILS", "images": [],
        "description": "",
    }))
    return pid


def test_non_admin_returns_403(owner_headers):
    r = requests.request(
        "DELETE", f"{API}/admin/properties/bulk",
        json={"property_ids": ["nope"]},
        headers=owner_headers, timeout=15,
    )
    assert r.status_code == 403


def test_empty_list_returns_400(admin_headers):
    r = requests.request(
        "DELETE", f"{API}/admin/properties/bulk",
        json={"property_ids": []},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 400


def test_unknown_ids_skip_silently(admin_headers):
    r = requests.request(
        "DELETE", f"{API}/admin/properties/bulk",
        json={"property_ids": ["ghost-1", "ghost-2"]},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["deleted"] == 0
    assert body["skipped"] == 2


def test_bulk_delete_with_cascade(admin_headers):
    """End-to-end: seed two properties + linked rows, bulk-delete, verify
    cascade cleanup across collections."""
    async def setup_seed():
        db = _db()
        owner_id = f"bulk-delete-owner-{uuid.uuid4().hex[:8]}"
        renter_id = f"bulk-delete-renter-{uuid.uuid4().hex[:8]}"
        prop_a = str(uuid.uuid4())
        prop_b = str(uuid.uuid4())
        prop_keep = str(uuid.uuid4())

        # Seed the properties (two we'll delete, one we keep as control)
        await db.properties.insert_many([
            {"id": prop_a, "owner_id": owner_id, "title": "A", "area": "TLV",
             "rental_type": "long-term", "status": "active",
             "monthly_price": 5000, "currency": "ILS", "images": []},
            {"id": prop_b, "owner_id": owner_id, "title": "B", "area": "TLV",
             "rental_type": "long-term", "status": "active",
             "monthly_price": 6000, "currency": "ILS", "images": []},
            {"id": prop_keep, "owner_id": owner_id, "title": "Keep", "area": "TLV",
             "rental_type": "long-term", "status": "active",
             "monthly_price": 7000, "currency": "ILS", "images": []},
        ])
        # Sublease referencing prop_a (should be detached, not deleted)
        sub_id = str(uuid.uuid4())
        await db.subleases.insert_one({
            "id": sub_id, "original_property_id": prop_a,
            "subleasor_id": owner_id, "active": True, "title": "Linked sub",
        })
        # Messages referencing both props (deleted) and the keeper (kept)
        msg_ids = []
        for prop_id in (prop_a, prop_b, prop_keep):
            mid = str(uuid.uuid4())
            msg_ids.append(mid)
            await db.messages.insert_one({
                "id": mid, "property_id": prop_id,
                "sender_id": renter_id, "receiver_id": owner_id,
                "message": "hi", "created_at": "2026-02-01T00:00:00+00:00",
            })
        # Booking referencing prop_a (should be deleted)
        booking_id = str(uuid.uuid4())
        await db.bookings.insert_one({
            "id": booking_id, "property_id": prop_a,
            "renter_id": renter_id, "owner_id": owner_id,
            "start_date": "2030-01-01", "end_date": "2030-01-10",
            "status": "pending",
        })
        # Admin block on prop_b (should be deleted)
        block_id = str(uuid.uuid4())
        await db.admin_blocks.insert_one({
            "id": block_id, "property_id": prop_b,
            "indefinite": True, "start_date": None, "end_date": None,
        })
        # Featured list includes both deleted ids + the keeper
        await db.site_settings.update_one(
            {"key": "global"},
            {"$addToSet": {"featured_property_ids": {"$each": [prop_a, prop_b, prop_keep]}}},
            upsert=True,
        )
        return owner_id, renter_id, prop_a, prop_b, prop_keep, sub_id, booking_id, block_id, msg_ids

    (owner_id, renter_id, prop_a, prop_b, prop_keep, sub_id, booking_id,
     block_id, msg_ids) = asyncio.run(setup_seed())

    try:
        r = requests.request(
            "DELETE", f"{API}/admin/properties/bulk",
            json={"property_ids": [prop_a, prop_b, "ghost"]},
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["deleted"] == 2
        assert body["skipped"] == 1
        assert body["messages_deleted"] >= 2  # we seeded 2 against deleted props
        assert body["bookings_deleted"] >= 1

        async def verify():
            db = _db()
            # Properties gone
            assert await db.properties.find_one({"id": prop_a}) is None
            assert await db.properties.find_one({"id": prop_b}) is None
            # Keeper still there
            assert await db.properties.find_one({"id": prop_keep}) is not None
            # Sublease detached, not deleted
            sub = await db.subleases.find_one({"id": sub_id}, {"_id": 0})
            assert sub is not None
            assert sub["original_property_id"] is None
            # Cascade: messages on deleted properties gone, keeper's still there
            for pid in (prop_a, prop_b):
                assert await db.messages.count_documents({"property_id": pid}) == 0
            assert await db.messages.count_documents({"property_id": prop_keep}) == 1
            # Booking + admin block gone
            assert await db.bookings.find_one({"id": booking_id}) is None
            assert await db.admin_blocks.find_one({"id": block_id}) is None
            # Featured list pulled
            settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0})
            featured = (settings or {}).get("featured_property_ids", [])
            assert prop_a not in featured
            assert prop_b not in featured
            assert prop_keep in featured  # control row untouched

        asyncio.run(verify())
    finally:
        # Cleanup whatever survived (the keeper + the detached sublease + msg)
        async def cleanup():
            db = _db()
            await db.properties.delete_one({"id": prop_keep})
            await db.subleases.delete_one({"id": sub_id})
            await db.messages.delete_many({"id": {"$in": msg_ids}})
            await db.site_settings.update_one(
                {"key": "global"},
                {"$pull": {"featured_property_ids": {"$in": [prop_keep]}}},
            )
        asyncio.run(cleanup())



def test_bulk_delete_then_restore_brings_back_property_and_messages(admin_headers):
    """Bulk-delete with snapshot_id, then call /bulk-restore — assert the
    properties + related messages are back exactly as they were."""
    async def setup_seed():
        db = _db()
        owner_id = f"undo-owner-{uuid.uuid4().hex[:8]}"
        renter_id = f"undo-renter-{uuid.uuid4().hex[:8]}"
        prop_id = str(uuid.uuid4())
        await db.properties.insert_one({
            "id": prop_id, "owner_id": owner_id, "title": "Undo test",
            "area": "TLV", "rental_type": "long-term", "status": "active",
            "monthly_price": 5000, "currency": "ILS", "images": [],
            "description": "Will be undone",
        })
        msg_id = str(uuid.uuid4())
        await db.messages.insert_one({
            "id": msg_id, "property_id": prop_id,
            "sender_id": renter_id, "receiver_id": owner_id,
            "message": "Pre-delete inquiry", "created_at": "2026-02-01T00:00:00+00:00",
        })
        # Mark as featured so we can verify featured-list restore too.
        await db.site_settings.update_one(
            {"key": "global"},
            {"$addToSet": {"featured_property_ids": prop_id}},
            upsert=True,
        )
        return prop_id, msg_id

    prop_id, msg_id = asyncio.run(setup_seed())

    try:
        # 1. Delete
        r = requests.request(
            "DELETE", f"{API}/admin/properties/bulk",
            json={"property_ids": [prop_id]},
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["deleted"] == 1
        snapshot_id = body.get("snapshot_id")
        assert snapshot_id, "Expected snapshot_id in delete response"

        async def verify_gone():
            db = _db()
            assert await db.properties.find_one({"id": prop_id}) is None
            assert await db.messages.find_one({"id": msg_id}) is None
            settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0})
            assert prop_id not in (settings.get("featured_property_ids") or [])
        asyncio.run(verify_gone())

        # 2. Restore
        r2 = requests.post(
            f"{API}/admin/properties/bulk-restore",
            json={"snapshot_id": snapshot_id},
            headers=admin_headers, timeout=20,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["restored"] == 1

        # 3. Verify everything is back, including featured-list membership.
        async def verify_back():
            db = _db()
            prop = await db.properties.find_one({"id": prop_id}, {"_id": 0})
            assert prop is not None
            assert prop["title"] == "Undo test"
            msg = await db.messages.find_one({"id": msg_id}, {"_id": 0})
            assert msg is not None
            assert msg["message"] == "Pre-delete inquiry"
            settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0})
            assert prop_id in (settings.get("featured_property_ids") or [])
            # Tombstone consumed
            assert await db.property_tombstones.find_one({"id": snapshot_id}) is None
        asyncio.run(verify_back())

        # 4. Re-using the same snapshot id returns 404 (tombstone consumed)
        r3 = requests.post(
            f"{API}/admin/properties/bulk-restore",
            json={"snapshot_id": snapshot_id},
            headers=admin_headers, timeout=15,
        )
        assert r3.status_code == 404
    finally:
        async def cleanup():
            db = _db()
            await db.properties.delete_one({"id": prop_id})
            await db.messages.delete_one({"id": msg_id})
            await db.site_settings.update_one(
                {"key": "global"},
                {"$pull": {"featured_property_ids": prop_id}},
            )
        asyncio.run(cleanup())


def test_bulk_restore_unknown_snapshot_returns_404(admin_headers):
    r = requests.post(
        f"{API}/admin/properties/bulk-restore",
        json={"snapshot_id": "does-not-exist"},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 404

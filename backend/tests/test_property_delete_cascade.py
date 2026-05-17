"""Regression: property-delete cascade detaches linked subleases."""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

import pytest
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(Path(__file__).parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def test_property_delete_cascades_detach_subleases() -> None:
    """Deleting a property should NULL out original_property_id on subleases."""
    from routes.properties import delete_property

    async def run():
        db = _db()
        owner_id = f"test-owner-{uuid.uuid4().hex[:8]}"
        prop_id = str(uuid.uuid4())
        # Seed a property + two subleases referencing it
        await db.properties.insert_one({
            "id": prop_id, "owner_id": owner_id, "title": "Cascade test prop",
            "rental_type": "long-term", "status": "active",
        })
        sub_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
        for sid in sub_ids:
            await db.subleases.insert_one({
                "id": sid, "original_property_id": prop_id,
                "subleasor_id": owner_id, "active": True,
                "title": f"Sub {sid[:6]}", "price": 100,
            })
        # Unrelated sublease (should stay untouched)
        other_prop = str(uuid.uuid4())
        other_sub = str(uuid.uuid4())
        await db.subleases.insert_one({
            "id": other_sub, "original_property_id": other_prop,
            "subleasor_id": owner_id, "active": True, "title": "unrelated",
        })

        # Act
        await delete_property(prop_id, payload={"user_id": owner_id, "role": "owner"})

        # Verify property gone
        assert await db.properties.find_one({"id": prop_id}) is None
        # Verify cascade: both linked subleases now have None original_property_id
        for sid in sub_ids:
            s = await db.subleases.find_one({"id": sid}, {"_id": 0})
            assert s is not None, f"Sublease {sid} should still exist"
            assert s["original_property_id"] is None, f"{sid} should be detached"
        # Verify unrelated untouched
        s = await db.subleases.find_one({"id": other_sub}, {"_id": 0})
        assert s["original_property_id"] == other_prop

        # Cleanup
        await db.subleases.delete_many({"id": {"$in": sub_ids + [other_sub]}})

    asyncio.run(run())

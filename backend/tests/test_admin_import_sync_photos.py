"""Regression test for the "sync_photos" CSV import mode — recovery
path that updates photos on existing listings instead of skipping them
as duplicates.

Use case: a previous import left listings without photos (timed-out
background mirror, partial Cloudinary state, etc.). Admin pastes the
same CSV with `mode="sync_photos"` and the importer refreshes the
photos in place.
"""
from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, patch

from routes import admin_import
# The names are patched on the MODULES that read them. `routes.admin_import`
# re-exports db / mirror_url_to_cloudinary / find_duplicate / send_email for
# convenience, but the import code binds them in `.properties` (and
# send_email in `.helpers`) at import time - patching the package attribute
# swapped a copy nobody reads, so the real Cloudinary mirror and the real
# duplicate check ran and every assertion here counted zero.
from routes.admin_import import helpers as helpers_mod, properties as props_mod


def test_sync_photos_updates_existing_listings():
    """When mode='sync_photos' and a duplicate is found, the importer
    must REPLACE the listing's images/videos with the CSV's rather than
    skip — but never create a second copy of the property."""
    asyncio.run(_run_sync_test())


async def _run_sync_test():
    csv_text = (
        "title,owner_email,images\n"
        "Existing,a@test.com,https://x/new1.jpg | https://x/new2.jpg\n"
    )
    fake_db = type("FakeDB", (), {})()

    # Existing listing in the DB — same owner_email + address (we'll
    # use the default empty address since the CSV doesn't include one).
    existing_doc = {
        "id": "existing-prop-123",
        "owner_id": "owner-a",
        "title": "Existing",
        "address": "",
        "rental_type": "long-term",
        "images": [],  # empty — the bug we're trying to recover from
        "videos": [],
    }

    updates_received = []
    inserts_received = []

    class FakeUsers:
        async def find_one(self, *args, **kwargs):
            return {"id": "owner-a", "email": "a@test.com"}
        async def insert_one(self, doc):
            return None
        async def delete_many(self, *args, **kwargs):
            return None

    class FakeProperties:
        async def find_one(self, *args, **kwargs):
            return None
        async def insert_one(self, doc):
            inserts_received.append(doc)
        async def update_one(self, filter_, update, **kwargs):
            updates_received.append({"filter": filter_, "update": update})

    class FakePasswordResets:
        async def insert_one(self, *args, **kwargs):
            return None
        async def delete_many(self, *args, **kwargs):
            return None

    fake_db.users = FakeUsers()
    fake_db.properties = FakeProperties()
    fake_db.password_resets = FakePasswordResets()

    column_map = {
        "title": "title", "owner_email": "owner_email", "images": "images",
    }
    req = admin_import.PropertyCommitRequest(
        csv_text=csv_text, column_map=column_map, mirror_images=False,
        mode="sync_photos",
    )

    async def fake_find_dup(*args, **kwargs):
        return existing_doc

    with patch.object(props_mod, "db", fake_db), \
         patch.object(props_mod, "find_duplicate", fake_find_dup), \
         patch.object(helpers_mod, "send_email", AsyncMock(return_value=None)), \
         patch("utils.cloud_storage.CLOUDINARY_ENABLED", False):
        res = await admin_import.commit_property_import(req, payload={"role": "admin"})

    # Nothing was inserted — duplicate found.
    assert inserts_received == [], "sync_photos must not create new listings"
    # The existing listing was updated with the new images.
    assert len(updates_received) == 1, f"Expected 1 update, got {len(updates_received)}"
    set_payload = updates_received[0]["update"]["$set"]
    assert set_payload["images"] == [
        "https://x/new1.jpg", "https://x/new2.jpg",
    ]
    # Response reports the row as created (with synced=True).
    assert res["summary"]["created"] == 1
    assert res["summary"]["skipped"] == 0
    assert res["created"][0]["synced"] is True
    assert res["created"][0]["id"] == "existing-prop-123"


def test_sync_photos_skips_already_on_cloudinary():
    """A listing whose images are 100% on Cloudinary doesn't need
    re-mirroring — sync_photos should skip those to avoid paying for
    duplicate Cloudinary uploads."""
    asyncio.run(_run_skip_test())


async def _run_skip_test():
    csv_text = (
        "title,owner_email,images\n"
        "Already CDN,a@test.com,https://x/new1.jpg | https://x/new2.jpg\n"
    )

    existing_doc = {
        "id": "cdn-prop-456",
        "owner_id": "owner-a",
        "title": "Already CDN",
        "address": "",
        "rental_type": "long-term",
        "images": [
            "https://res.cloudinary.com/xx/image/upload/v1/abc.jpg",
            "https://res.cloudinary.com/xx/image/upload/v1/def.jpg",
        ],
        "videos": [],
    }

    fake_db = type("FakeDB", (), {})()
    updates_received = []

    class FakeUsers:
        async def find_one(self, *args, **kwargs):
            return {"id": "owner-a", "email": "a@test.com"}
        async def insert_one(self, doc):
            return None
        async def delete_many(self, *args, **kwargs):
            return None

    class FakeProperties:
        async def find_one(self, *args, **kwargs):
            return None
        async def insert_one(self, doc):
            return None
        async def update_one(self, filter_, update, **kwargs):
            updates_received.append({"filter": filter_, "update": update})

    fake_db.users = FakeUsers()
    fake_db.properties = FakeProperties()
    fake_db.password_resets = type("PR", (), {
        "insert_one": AsyncMock(return_value=None),
        "delete_many": AsyncMock(return_value=None),
    })()

    req = admin_import.PropertyCommitRequest(
        csv_text=csv_text,
        column_map={"title": "title", "owner_email": "owner_email", "images": "images"},
        mirror_images=False, mode="sync_photos",
    )

    async def fake_find_dup(*args, **kwargs):
        return existing_doc

    with patch.object(props_mod, "db", fake_db), \
         patch.object(props_mod, "find_duplicate", fake_find_dup), \
         patch.object(helpers_mod, "send_email", AsyncMock(return_value=None)), \
         patch("utils.cloud_storage.CLOUDINARY_ENABLED", False):
        res = await admin_import.commit_property_import(req, payload={"role": "admin"})

    assert updates_received == [], "Listings already on Cloudinary must NOT be re-mirrored"
    assert res["summary"]["created"] == 0
    assert res["summary"]["skipped"] == 1
    assert "already fully on Cloudinary" in res["skipped"][0]["error"].lower() or \
           "already fully on cloudinary" in res["skipped"][0]["error"].lower()


def test_create_mode_default_still_skips_duplicates():
    """Backwards-compat: omitting `mode` keeps the old "skip duplicates"
    behavior so existing import flows don't change."""
    asyncio.run(_run_default_test())


async def _run_default_test():
    csv_text = (
        "title,owner_email,images\n"
        "Existing,a@test.com,https://x/new1.jpg\n"
    )
    existing_doc = {
        "id": "p1", "owner_id": "owner-a", "title": "Existing",
        "address": "", "rental_type": "long-term", "images": [], "videos": [],
    }
    fake_db = type("FakeDB", (), {})()
    property_inserts = []
    updates = []

    class FakeUsers:
        async def find_one(self, *args, **kwargs):
            return {"id": "owner-a", "email": "a@test.com"}
        async def insert_one(self, doc):
            return None
        async def delete_many(self, *args, **kwargs):
            return None

    class FakeProperties:
        async def find_one(self, *args, **kwargs):
            return None
        async def insert_one(self, doc):
            property_inserts.append(doc)
        async def update_one(self, *args, **kwargs):
            updates.append(args)

    fake_db.users = FakeUsers()
    fake_db.properties = FakeProperties()
    fake_db.password_resets = type("PR", (), {
        "insert_one": AsyncMock(return_value=None),
        "delete_many": AsyncMock(return_value=None),
    })()

    req = admin_import.PropertyCommitRequest(
        csv_text=csv_text,
        column_map={"title": "title", "owner_email": "owner_email", "images": "images"},
        mirror_images=False,  # mode defaults to "create"
    )

    async def fake_find_dup(*args, **kwargs):
        return existing_doc

    with patch.object(props_mod, "db", fake_db), \
         patch.object(props_mod, "find_duplicate", fake_find_dup), \
         patch.object(helpers_mod, "send_email", AsyncMock(return_value=None)), \
         patch("utils.cloud_storage.CLOUDINARY_ENABLED", False):
        res = await admin_import.commit_property_import(req, payload={"role": "admin"})

    assert property_inserts == [], "Duplicate detected → no insert"
    assert updates == [], "Default mode never updates existing listings"
    assert res["summary"]["created"] == 0
    assert res["summary"]["skipped"] == 1

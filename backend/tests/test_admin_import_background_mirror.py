"""Regression test: bulk property CSV import must return BEFORE Cloudinary
mirroring completes, so the edge-proxy 60s timeout never trips on large
CSVs (37 rows × 20 images = 700 mirror calls used to time out).

The commit endpoint inserts rows with source URLs immediately and kicks
off a background task to mirror to Cloudinary. The HTTP response must
return in seconds even when ``mirror_images=True``.
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


def test_commit_returns_fast_with_mirror_enabled():
    """If mirror_url_to_cloudinary takes 1s each, the commit endpoint
    must still return in <3s even with 3 properties × 3 images = 9
    mirror calls (would take 9s if blocking, hence <3s proves async).
    """
    asyncio.run(_run_test_commit_returns_fast())


async def _run_test_commit_returns_fast():
    csv_text = (
        "title,owner_email,images\n"
        "A,a@test.com,https://x/a1.jpg | https://x/a2.jpg | https://x/a3.jpg\n"
        "B,b@test.com,https://x/b1.jpg | https://x/b2.jpg | https://x/b3.jpg\n"
        "C,c@test.com,https://x/c1.jpg | https://x/c2.jpg | https://x/c3.jpg\n"
    )

    async def slow_mirror(url, **kwargs):
        await asyncio.sleep(1.0)
        return {"url": f"https://cdn/{url.rsplit('/', 1)[-1]}"}

    fake_db = type("FakeDB", (), {})()
    user_inserts = []
    property_inserts = []

    class FakeUsersColl:
        async def find_one(self, *args, **kwargs):
            return None
        async def insert_one(self, doc):
            user_inserts.append(doc)
        async def delete_many(self, *args, **kwargs):
            return None

    class FakePropertiesColl:
        async def find_one(self, *args, **kwargs):
            return None
        async def insert_one(self, doc):
            property_inserts.append(doc)
        async def update_one(self, *args, **kwargs):
            return None

    class FakePasswordResetsColl:
        async def insert_one(self, doc):
            return None
        async def delete_many(self, *args, **kwargs):
            return None

    fake_db.users = FakeUsersColl()
    fake_db.properties = FakePropertiesColl()
    fake_db.password_resets = FakePasswordResetsColl()

    column_map = {
        "title": "title", "owner_email": "owner_email", "images": "images",
    }
    req = admin_import.PropertyCommitRequest(
        csv_text=csv_text, column_map=column_map, mirror_images=True,
    )

    with patch.object(props_mod, "db", fake_db), \
         patch.object(props_mod, "mirror_url_to_cloudinary", slow_mirror), \
         patch("utils.cloud_storage.CLOUDINARY_ENABLED", True), \
         patch.object(props_mod, "find_duplicate", AsyncMock(return_value=None)), \
         patch.object(helpers_mod, "send_email", AsyncMock(return_value=None)):
        t0 = time.time()
        res = await admin_import.commit_property_import(req, payload={"role": "admin"})
        elapsed = time.time() - t0

    # Endpoint must return in well under 9s (would be 9s+ if mirroring blocked)
    assert elapsed < 3.0, f"commit blocked on mirroring: took {elapsed:.1f}s"
    assert res["summary"]["created"] == 3
    assert res["summary"]["mirror_pending_count"] == 3
    # Properties get inserted with source URLs immediately so the listing
    # is never blank while background mirroring runs.
    assert len(property_inserts) == 3
    for doc in property_inserts:
        assert doc["images"], "Properties should have images saved (source URLs) before mirror"
        assert doc.get("mirror_pending") is True


def test_pydantic_commit_request_accepts_frontend_payload():
    """The frontend sends ``{csv_text, column_map, mirror_images}`` — the
    Pydantic model must accept it without 422."""
    req = admin_import.PropertyCommitRequest(
        csv_text="title,owner_email\nA,a@b.com\n",
        column_map={"title": "title", "owner_email": "owner_email"},
        mirror_images=True,
    )
    assert req.mirror_images is True
    assert req.column_map["title"] == "title"

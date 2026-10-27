"""An imported listing whose photo file is already on another visible
listing is hidden as a duplicate (Mavo Refidim penthouse, 27 Oct 2026)."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from routes.admin_import import properties as props_mod


class _Cursor:
    def __init__(self, docs):
        self.docs = list(docs)

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self.docs:
            raise StopAsyncIteration
        return self.docs.pop(0)


def _run(existing):
    db = MagicMock()
    db.properties.find_one = AsyncMock(return_value={"rental_type": "vacation", "bedrooms": 5})
    db.properties.find = MagicMock(return_value=_Cursor([existing] if existing else []))
    db.properties.update_one = AsyncMock()
    mirror = AsyncMock(return_value={"url": "https://res.cloudinary.com/x.jpg", "etag": "abc"})
    with patch.object(props_mod, "db", db), patch.object(props_mod, "mirror_url_to_cloudinary", mirror):
        asyncio.run(props_mod._background_mirror_properties([("new", ["https://src/a.jpg"], [])]))
    return db.properties.update_one.call_args.args[1]["$set"]


def test_copy_of_existing_photos_is_hidden():
    s = _run({"id": "orig", "image_etags": ["abc"]})
    assert s["is_hidden"] is True and s["duplicate_of"] == "orig" and s["image_etags"] == ["abc"]


def test_new_photos_stay_visible():
    s = _run(None)
    assert "is_hidden" not in s and s["image_etags"] == ["abc"]


def test_one_shared_building_photo_is_not_a_copy():
    # Two photos, only one matches (a lobby shot): under half → visible.
    db = MagicMock()
    db.properties.find_one = AsyncMock(return_value={"rental_type": "vacation", "bedrooms": 5})
    db.properties.find = MagicMock(return_value=_Cursor([{"id": "o", "image_etags": ["a"]}]))
    db.properties.update_one = AsyncMock()
    mirror = AsyncMock(side_effect=[{"url": "u1", "etag": "a"}, {"url": "u2", "etag": "b"}, {"url": "u3", "etag": "c"}])
    with patch.object(props_mod, "db", db), patch.object(props_mod, "mirror_url_to_cloudinary", mirror):
        asyncio.run(props_mod._background_mirror_properties([("new", ["s1", "s2", "s3"], [])]))
    assert "is_hidden" not in db.properties.update_one.call_args.args[1]["$set"]

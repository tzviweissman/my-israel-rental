"""The background translator: both directions, and safe under edits.

WHY. Gig translation ran inline for a year, 3-6 s on every publish, so
that a toast could say "also translated". Moving it to the background
introduces two races this pins down, and the jobs board translated one
way only (English -> Hebrew) so a Hebrew-authored job never got English.

Everything here mocks the LLM call and runs against the LOCAL database.
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
import uuid
from pathlib import Path
from unittest.mock import patch

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from utils.translate import translate_missing_side  # noqa: E402

LOG = logging.getLogger("test-translate")


def _db():
    url = os.environ["MONGO_URL"]
    assert "localhost" in url or "127.0.0.1" in url, "refusing to run against a non-local database"
    return AsyncIOMotorClient(url)[os.environ["DB_NAME"]]


async def _fake_translate(text: str, target: str) -> str:
    return f"[{target}] {text}"


def _run(coro):
    return asyncio.run(coro)


def test_english_post_gets_hebrew():
    db = _db()
    _id = f"tr-{uuid.uuid4()}"

    async def go():
        await db.marketplace_gigs.insert_one({"_id": _id, "title": "Deep clean", "description": "Sparkling", "title_he": None})
        with patch("utils.translate.translate_marketing", _fake_translate):
            out = await translate_missing_side(db.marketplace_gigs, _id, "Deep clean", "Sparkling", fill_only=True, label="t", logger=LOG)
        doc = await db.marketplace_gigs.find_one({"_id": _id})
        await db.marketplace_gigs.delete_one({"_id": _id})
        return out, doc

    out, doc = _run(go())
    assert doc["source_lang"] == "en"
    assert doc["title_he"] == "[he] Deep clean"
    assert doc["description_he"] == "[he] Sparkling"
    assert "title_en" not in doc or doc.get("title_en") is None
    assert set(out) == {"source_lang", "title_he", "description_he"}


def test_hebrew_post_gets_english():
    """The jobs board's bug: a Hebrew job used to get 'Hebrew from Hebrew'
    and no English. Now the OTHER side is filled."""
    db = _db()
    _id = f"tr-{uuid.uuid4()}"

    async def go():
        await db.marketplace_jobs.insert_one({"_id": _id, "title": "צריך אינסטלטור", "description": "דחוף מאוד", "title_he": None, "title_en": None})
        with patch("utils.translate.translate_marketing", _fake_translate):
            await translate_missing_side(db.marketplace_jobs, _id, "צריך אינסטלטור", "דחוף מאוד", fill_only=True, label="t", logger=LOG)
        doc = await db.marketplace_jobs.find_one({"_id": _id})
        await db.marketplace_jobs.delete_one({"_id": _id})
        return doc

    doc = _run(go())
    assert doc["source_lang"] == "he"
    assert doc["title_en"] == "[en] צריך אינסטלטור"
    assert doc["description_en"] == "[en] דחוף מאוד"
    assert doc.get("title_he") is None, "must not translate Hebrew into Hebrew"


def test_a_stale_translation_is_dropped_when_the_source_changed():
    """Two edits in quick succession fire two tasks that can finish out of
    order. The older one must not land stale Hebrew under the new title."""
    db = _db()
    _id = f"tr-{uuid.uuid4()}"

    async def slow_translate(text, target):
        # Simulate the title being edited while this translation is in flight.
        await db.marketplace_gigs.update_one({"_id": _id}, {"$set": {"title": "NEW title"}})
        return f"[{target}] {text}"

    async def go():
        await db.marketplace_gigs.insert_one({"_id": _id, "title": "OLD title", "description": "d", "title_he": None})
        with patch("utils.translate.translate_marketing", slow_translate):
            out = await translate_missing_side(db.marketplace_gigs, _id, "OLD title", None, fill_only=False, label="t", logger=LOG)
        doc = await db.marketplace_gigs.find_one({"_id": _id})
        await db.marketplace_gigs.delete_one({"_id": _id})
        return out, doc

    out, doc = _run(go())
    assert doc["title"] == "NEW title"
    assert doc.get("title_he") is None, "a translation of the OLD title landed on the NEW one"
    assert "title_he" not in out


def test_fill_only_keeps_the_owners_own_hebrew():
    """An owner who typed their own Hebrew while the create-time task was
    in flight keeps it: fill_only writes only into an empty field."""
    db = _db()
    _id = f"tr-{uuid.uuid4()}"

    async def go():
        await db.marketplace_gigs.insert_one({"_id": _id, "title": "Movers", "description": None, "title_he": "המובילים שלי"})
        with patch("utils.translate.translate_marketing", _fake_translate):
            await translate_missing_side(db.marketplace_gigs, _id, "Movers", None, fill_only=True, label="t", logger=LOG)
        doc = await db.marketplace_gigs.find_one({"_id": _id})
        await db.marketplace_gigs.delete_one({"_id": _id})
        return doc

    doc = _run(go())
    assert doc["title_he"] == "המובילים שלי"


def test_an_edit_that_changed_the_source_overwrites_the_old_translation():
    db = _db()
    _id = f"tr-{uuid.uuid4()}"

    async def go():
        await db.marketplace_gigs.insert_one({"_id": _id, "title": "Movers deluxe", "description": None, "title_he": "[he] Movers"})
        with patch("utils.translate.translate_marketing", _fake_translate):
            await translate_missing_side(db.marketplace_gigs, _id, "Movers deluxe", None, fill_only=False, label="t", logger=LOG)
        doc = await db.marketplace_gigs.find_one({"_id": _id})
        await db.marketplace_gigs.delete_one({"_id": _id})
        return doc

    doc = _run(go())
    assert doc["title_he"] == "[he] Movers deluxe"


def test_an_llm_failure_still_records_the_language_and_keeps_going():
    db = _db()
    _id = f"tr-{uuid.uuid4()}"
    calls = []

    async def flaky(text, target):
        calls.append(text)
        if text == "Title":
            raise RuntimeError("LLM down")
        return f"[{target}] {text}"

    async def go():
        await db.marketplace_gigs.insert_one({"_id": _id, "title": "Title", "description": "Body", "title_he": None})
        with patch("utils.translate.translate_marketing", flaky):
            await translate_missing_side(db.marketplace_gigs, _id, "Title", "Body", fill_only=True, label="t", logger=LOG)
        doc = await db.marketplace_gigs.find_one({"_id": _id})
        await db.marketplace_gigs.delete_one({"_id": _id})
        return doc

    doc = _run(go())
    assert doc["source_lang"] == "en"
    assert doc.get("title_he") is None
    assert doc["description_he"] == "[he] Body", "one field failing must not lose the other"
    assert calls == ["Title", "Body"]

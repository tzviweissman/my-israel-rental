"""Owner edits of fields that used to be create-only.

Unit style: patch_gig is called directly against an in-memory fake
collection, so no running API or Mongo is needed. The point is that an
edit is never looser than the create route (shared `_validate_contact_fields`)
and that only the listing's owner can make one.
"""
import asyncio

import pytest
from fastapi import HTTPException

from routes.marketplace import gigs
from routes.marketplace.shared import GigPatch


class _Coll:
    def __init__(self, doc):
        self.doc = doc
        self.updates = []

    async def find_one(self, q):
        return dict(self.doc) if q.get("_id") == self.doc["_id"] else None

    async def update_one(self, q, upd):
        self.updates.append(upd["$set"])
        self.doc.update(upd["$set"])


class _DB:
    def __init__(self, doc):
        self.marketplace_gigs = _Coll(doc)


def _gig(**kw):
    base = {
        "_id": "g1", "provider_user_id": "owner1", "title": "Cleaning",
        "description": "d", "title_he": "ניקיון", "description_he": "תיאור",
        "category": "home-services-repair", "gig_type": "appointment",
        "booking_mode": "in_platform", "whatsapp": None, "area": "Tel Aviv",
        "status": "published", "title_en": "Cleaning", "description_en": "d",
        "source_lang": "en",
    }
    base.update(kw)
    return base


@pytest.fixture
def run(monkeypatch):
    def _run(doc, payload, user="owner1"):
        fake = _DB(doc)
        monkeypatch.setattr(gigs, "db", fake)
        import routes.marketplace.price_watch as pw
        monkeypatch.setattr(pw, "listing_saved", lambda *a, **k: None)
        monkeypatch.setattr(gigs, "_clean_gig", lambda g: g)
        res = asyncio.run(gigs.patch_gig("g1", GigPatch(**payload), {"user_id": user}))
        return fake.marketplace_gigs, res
    return _run


def _status(doc, payload, run, user="owner1"):
    with pytest.raises(HTTPException) as e:
        run(doc, payload, user)
    return e.value.status_code


def test_owner_can_edit_availability_and_contact(run):
    coll, _ = run(_gig(), {
        "weekly_availability": {"mon": [{"start": "09:00", "end": "12:00"}]},
        "slot_duration_minutes": 45, "contact_email": " a@b.co ", "area": "Haifa",
    })
    s = coll.updates[0]
    assert s["weekly_availability"]["mon"] == [{"start": "09:00", "end": "12:00"}]
    assert s["slot_duration_minutes"] == 45
    assert s["contact_email"] == "a@b.co"
    assert s["area"] == "Haifa"


def test_other_user_is_refused(run):
    assert _status(_gig(), {"area": "Haifa"}, run, user="someone-else") == 403


def test_bad_booking_mode_refused(run):
    assert _status(_gig(), {"booking_mode": "carrier-pigeon"}, run) == 400


def test_whatsapp_mode_needs_a_number(run):
    assert _status(_gig(), {"booking_mode": "whatsapp"}, run) == 400
    coll, _ = run(_gig(), {"booking_mode": "whatsapp", "whatsapp": "+972501234567"})
    assert coll.updates[0]["booking_mode"] == "whatsapp"


def test_clearing_whatsapp_on_a_whatsapp_listing_refused(run):
    doc = _gig(booking_mode="whatsapp", whatsapp="+972501234567")
    assert _status(doc, {"whatsapp": "  "}, run) == 400


def test_blank_area_refused(run):
    assert _status(_gig(), {"area": "   "}, run) == 400


def test_unknown_category_refused(run):
    assert _status(_gig(), {"category": "not-a-category"}, run) == 400


def test_slot_and_date_booking_only_kept_for_their_gig_type(run):
    coll, _ = run(_gig(gig_type="deliverable"), {"slot_duration_minutes": 30, "enable_date_booking": True})
    s = coll.updates[0]
    assert "slot_duration_minutes" not in s
    assert s["enable_date_booking"] is True
    coll, _ = run(_gig(gig_type="appointment"), {"enable_date_booking": True})
    assert coll.updates[0]["enable_date_booking"] is False


def test_blank_optional_text_clears_to_none(run):
    coll, _ = run(_gig(), {"contact_email": "", "title_he": " ", "description_he": ""})
    s = coll.updates[0]
    assert s["contact_email"] is None and s["title_he"] is None and s["description_he"] is None


def test_unrelated_edit_not_blocked_on_legacy_listing(run):
    doc = _gig(booking_mode="whatsapp", whatsapp=None)
    coll, _ = run(doc, {"description": "new text"})
    assert coll.updates[0]["description"] == "new text"

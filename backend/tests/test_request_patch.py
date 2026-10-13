"""PATCH /marketplace/requests/{id}: only the poster may edit, and fields are validated.

No live API or database: `requests.db` is swapped for an in-memory fake.
"""
import asyncio

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from routes.marketplace import requests as req


class FakeCollection:
    def __init__(self, doc):
        self.doc = doc

    async def find_one(self, query):
        return dict(self.doc) if self.doc and query.get("_id") == self.doc["_id"] else None

    async def update_one(self, query, update):
        self.doc.update(update["$set"])


class FakeDB:
    def __init__(self, doc):
        self.requests = FakeCollection(doc)


def _doc(**over):
    base = {
        "_id": "r1", "poster_user_id": "poster", "title": "Two room flat", "description": "Looking for two rooms",
        "area": "Jerusalem", "budget_type": "open", "budget_amount": None, "budget_currency": "ILS",
        "source_lang": "en", "title_he": "x", "description_he": "y",
    }
    base.update(over)
    return base


@pytest.fixture
def patch_env(monkeypatch):
    spawned = []
    monkeypatch.setattr(req, "spawn", lambda coro: (spawned.append(1), coro.close()))
    def install(doc):
        monkeypatch.setattr(req, "db", FakeDB(doc))
        return doc
    install.spawned = spawned
    return install


def run(payload, user, doc, patch_env):
    patch_env(doc)
    return asyncio.run(req.patch_request("r1", req.RequestPatch(**payload), user))


def test_stranger_cannot_edit(patch_env):
    doc = _doc()
    with pytest.raises(HTTPException) as e:
        run({"title": "A different title"}, {"user_id": "stranger"}, doc, patch_env)
    assert e.value.status_code == 403
    assert doc["title"] == "Two room flat"


def test_admin_role_is_not_the_poster(patch_env):
    with pytest.raises(HTTPException) as e:
        run({"area": "Tel Aviv"}, {"user_id": "admin1", "role": "admin"}, _doc(), patch_env)
    assert e.value.status_code == 403


def test_missing_request_is_404(patch_env):
    patch_env(_doc())
    with pytest.raises(HTTPException) as e:
        asyncio.run(req.patch_request("nope", req.RequestPatch(title="Some title"), {"user_id": "poster"}))
    assert e.value.status_code == 404


def test_poster_can_edit_and_only_sent_fields_change(patch_env):
    doc = _doc()
    out = run({"area": "  Haifa  "}, {"user_id": "poster"}, doc, patch_env)
    assert out["area"] == "Haifa"
    assert out["title"] == "Two room flat"
    assert patch_env.spawned == []  # no title/description change, no re-translation


def test_title_change_retranslates(patch_env):
    run({"title": "A brand new title"}, {"user_id": "poster"}, _doc(), patch_env)
    assert patch_env.spawned == [1]


def test_fixed_budget_needs_positive_amount(patch_env):
    with pytest.raises(HTTPException) as e:
        run({"budget_type": "fixed"}, {"user_id": "poster"}, _doc(), patch_env)
    assert e.value.status_code == 400
    with pytest.raises(HTTPException):
        run({"budget_type": "fixed", "budget_amount": 0}, {"user_id": "poster"}, _doc(), patch_env)


def test_fixed_budget_with_amount_saves(patch_env):
    out = run({"budget_type": "fixed", "budget_amount": 5000, "budget_currency": "USD"},
              {"user_id": "poster"}, _doc(), patch_env)
    assert out["budget_amount"] == 5000 and out["budget_currency"] == "USD"


def test_open_budget_clears_amount(patch_env):
    out = run({"budget_type": "open"}, {"user_id": "poster"},
              _doc(budget_type="fixed", budget_amount=900), patch_env)
    assert out["budget_amount"] is None


def test_whatsapp_never_returned_and_empty_withdraws(patch_env):
    doc = _doc(whatsapp="+972501234567")
    out = run({"whatsapp": ""}, {"user_id": "poster"}, doc, patch_env)
    assert "whatsapp" not in out
    assert out["whatsapp_available"] is False
    assert doc["whatsapp"] is None


@pytest.mark.parametrize("bad", [
    {"title": "short"},
    {"description": "too short"},
    {"area": "x"},
    {"budget_type": "weekly"},
    {"budget_currency": "EUR"},
    {"date_mode": "never"},
    {"whatsapp": "1" * 41},
    {"title": "t" * 141},
])
def test_field_validation_rejects(bad):
    with pytest.raises(ValidationError):
        req.RequestPatch(**bad)


def test_unknown_fields_are_not_written(patch_env):
    doc = _doc()
    run({"poster_user_id": "me", "status": "found"}, {"user_id": "poster"}, doc, patch_env)
    assert doc["poster_user_id"] == "poster"
    assert "status" not in doc

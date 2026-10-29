"""The page-translate endpoint (routes/marketplace/page_edits.py) with the model and the database stood in:
it sends the owner's words, reads the JSON array back, and refuses what it cannot use."""
import asyncio

import pytest
from fastapi import HTTPException

import routes.deps as deps
import routes.marketplace.page_edits as pe


class _Chat:
    reply = '["Balloon wall"]'

    def __init__(self, **kw):
        self.system = kw.get("system_message")

    def with_model(self, *a):
        return self

    async def send_message(self, m):
        _Chat.sent = m.text
        return "Here: " + _Chat.reply


class _Counts:
    n = 0

    async def find_one_and_update(self, *a, **k):
        _Counts.n += 1
        return {"n": _Counts.n}


@pytest.fixture
def stubbed(monkeypatch):
    import utils.llm as llm
    monkeypatch.setattr(llm, "LlmChat", _Chat)
    monkeypatch.setattr(deps, "ANTHROPIC_API_KEY", "x")

    async def owned(bid, user):
        return {"_id": "b1"}
    monkeypatch.setattr(pe, "_owned", owned)

    class DB:
        page_translations = _Counts()
    monkeypatch.setattr(pe, "db", DB())


def test_translates_and_reads_the_array(stubbed):
    out = asyncio.run(pe.translate_page_words("b1", pe.TranslateBody(texts=["  קיר   בלונים "], to="en"), user={}))
    assert out == {"texts": ["Balloon wall"]}
    assert _Chat.sent == '["קיר בלונים"]'


def test_wrong_count_or_language_is_refused(stubbed):
    _Chat.reply = '["a", "b"]'
    with pytest.raises(HTTPException):
        asyncio.run(pe.translate_page_words("b1", pe.TranslateBody(texts=["x"], to="en"), user={}))
    with pytest.raises(HTTPException):
        asyncio.run(pe.translate_page_words("b1", pe.TranslateBody(texts=["x"], to="fr"), user={}))

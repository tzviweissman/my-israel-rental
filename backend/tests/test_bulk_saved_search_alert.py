"""Owner bulk upload triggers saved-search alerts for each listing it creates,
and an alert failure never fails the upload. No database or network."""
import asyncio

import routes.bulk_upload as bu


class _Props:
    def __init__(self):
        self.inserted = []

    async def insert_one(self, doc):
        self.inserted.append(doc)


class _Db:
    def __init__(self):
        self.properties = _Props()


class _Model:
    def __init__(self, **kw):
        self.kw = kw

    def model_dump(self):
        return dict(self.kw)


def _setup(monkeypatch, matcher):
    fake = _Db()
    monkeypatch.setattr(bu, "db", fake)
    monkeypatch.setattr(bu, "_normalize_row", lambda row: dict(row))
    monkeypatch.setattr(bu, "_validate_row", lambda row: None)
    monkeypatch.setattr(bu, "PropertyCreate", _Model)
    monkeypatch.setattr(bu, "match_property_against_searches", matcher)
    return fake


def _commit(rows):
    async def go():
        out = await bu.commit_bulk(bu.BulkCommitBody(rows=rows), {"role": "owner", "user_id": "o1"})
        await asyncio.sleep(0)  # let the scheduled alert tasks run
        return out
    return asyncio.run(go())


def test_each_created_property_triggers_alert(monkeypatch):
    calls = []

    async def matcher(db, property_id, *, reason, send_email_fn):
        calls.append((property_id, reason, send_email_fn))

    fake = _setup(monkeypatch, matcher)
    out = _commit([{"title": "A"}, {"title": "B"}])
    assert out["summary"]["created"] == 2
    ids = [d["id"] for d in fake.properties.inserted]
    assert [c[0] for c in calls] == ids
    assert all(c[1] == "new_listing" and c[2] is bu.send_email for c in calls)


def test_alert_failure_does_not_fail_upload(monkeypatch):
    async def matcher(*_a, **_k):
        raise RuntimeError("boom")

    _setup(monkeypatch, matcher)
    out = _commit([{"title": "A"}])
    assert out["summary"] == {"created": 1, "skipped": 0}

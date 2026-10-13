"""The restaurants' daily jobs fail soft (site audit, 11 and 12 Oct 2026).

* A certificate whose website could not be read is tried again tomorrow,
  not in a week; one that was read and is simply not newer waits a week.
* A map-pin lookup that times out is a miss, never a crash that loses the
  admin's whole batch.

No database or network: the collection and the fetchers are stand-ins.
"""
import asyncio

import httpx

import routes.restaurants as restaurants
import scripts.check_kosher_websites as kw


class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, _n):
        return self.docs


class _Coll:
    def __init__(self, docs):
        self.docs, self.updates = docs, []

    def find(self, *_a, **_k):
        return _Cursor(self.docs)

    async def find_one(self, *_a, **_k):
        return self.docs[0] if self.docs else None

    async def update_one(self, flt, upd):
        self.updates.append((flt, upd))


class _Db:
    def __init__(self, docs):
        self.restaurants = _Coll(docs)


def _doc():
    return {"_id": 1, "place_id": "p1", "contact": {"website": "https://x.test"},
            "kosher_check": {"certificate": {"url": "https://x.test/c.jpg", "certifier": "Badatz", "valid_until": "2026-10-01"}}}


def _run(monkeypatch, texts, cert):
    fake = _Db([_doc()])
    monkeypatch.setattr(kw, "db", fake)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")

    async def read_site(_http, _url, images=None):
        return texts, None

    async def read_certificate(_http, _url):
        return cert

    monkeypatch.setattr(kw, "read_site", read_site)
    monkeypatch.setattr(kw, "read_certificate", read_certificate)
    out = asyncio.run(kw.refresh_certificates())
    return out, fake.restaurants.updates


def test_site_down_is_retried_tomorrow(monkeypatch):
    out, updates = _run(monkeypatch, [], None)
    assert out == {"checked": 1, "renewed": 0}
    assert updates == []


def test_unreadable_certificate_is_retried_tomorrow(monkeypatch):
    _, updates = _run(monkeypatch, ["home page"], None)
    assert updates == []


def test_read_but_not_newer_waits_a_week(monkeypatch):
    _, updates = _run(monkeypatch, ["home page"], {"certifier": "Badatz", "valid_until": "2026-10-01"})
    assert len(updates) == 1
    assert "rechecked_at" in updates[0][1]["$set"]["kosher_check.certificate"]


def test_newer_certificate_replaces_the_old(monkeypatch):
    out, updates = _run(monkeypatch, ["home page"], {"certifier": "Badatz", "valid_until": "2027-10-01", "kashrut": "dairy"})
    assert out["renewed"] == 1
    sets = updates[0][1]["$set"]
    assert sets["kosher_check.certificate"]["valid_until"] == "2027-10-01"
    assert sets["kashrut"] == "dairy"


def test_pin_lookup_timeout_is_a_miss(monkeypatch):
    fake = _Db([{"place_id": "mir-1", "city": "jerusalem", "contact": {"address": "Luntz 4", "name_en": "Cafe"}}])
    monkeypatch.setattr(restaurants, "db", fake)

    class _Client:
        def __init__(self, *_a, **_k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_a):
            return False

        async def get(self, *_a, **_k):
            raise httpx.ReadTimeout("slow")

    async def no_sleep(_s):
        return None

    monkeypatch.setattr(httpx, "AsyncClient", _Client)
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    assert asyncio.run(restaurants._pin_from_address("mir-1")) is False
    assert fake.restaurants.updates == []

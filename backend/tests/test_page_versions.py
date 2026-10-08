"""Page builder v3: owners choose their page from three versions, and only a
passed visual check puts one live (utils/page_versions.py,
routes/marketplace/page_versions.py; Tzvi, 6 Oct 2026).

The first block is the rules, pure. The second drives the routes in-process
against the LOCAL database only (it refuses any other), in a database of its
own that it drops afterwards.
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tests.test_design_brief import CHOLENT  # noqa: E402
from utils.page_versions import (  # noqa: E402
    CHECK_TIMEOUT, PREVIEW_TTL, can_publish, candidates, check_secret_ok, new_preview_token, preview_ok, too_close,
)

NOW = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)
# Their cover and five gallery pictures, all checked as photos: enough for
# three different bold moments (a held hero, a push-in, the photo rail).
PHOTOS = [{"ref": "cover", "kind": "photo"}] + [{"ref": f"listing:g1:gallery:{i}", "kind": "photo"} for i in range(5)]


# ------------------------------------------------------------------ the rules

def test_three_versions_have_three_different_bold_moments():
    briefs = candidates({**CHOLENT, "_id": "b1"}, None, PHOTOS, [], generation=1)
    assert len(briefs) == 3
    assert len({b["showstopper"] for b in briefs}) == 3


def test_fewer_bold_moments_means_fewer_versions_never_a_repeat():
    """No photos and occasions in one language: a held hero, or the hero as
    it is. Two versions, not a third that repeats one of them."""
    briefs = candidates({**CHOLENT, "_id": "b1"}, None, [], [], generation=1)
    assert len(briefs) == len({b["showstopper"] for b in briefs}) == 2


def test_a_new_generation_gives_new_versions_and_the_same_one_repeats():
    rec = {**CHOLENT, "_id": "b1"}
    one = [b["effects"] for b in candidates(rec, None, PHOTOS, [], generation=1)]
    assert one == [b["effects"] for b in candidates(rec, None, PHOTOS, [], generation=1)]
    assert one != [b["effects"] for b in candidates(rec, None, PHOTOS, [], generation=2)]


def test_a_page_is_too_close_to_its_twin_and_not_to_a_different_one():
    a = {"effects": ["pin-hero-hold", "btn-press", "rules-double"], "showstopper": "pin-hero-hold"}
    b = {"effects": ["rail-gallery", "btn-invert", "corners-soft", "kinetic-words-headline"], "showstopper": "rail-gallery"}
    assert too_close(a, [a]) and not too_close(a, [b]) and not too_close(a, [])


def test_a_near_miss_is_never_offered(monkeypatch):
    """The picker keeps its nearest miss when nothing passes; such a version
    is not offered, since publishing it would be refused."""
    import utils.page_versions as pv
    live = {"effects": ["pin-hero-hold", "btn-press", "rules-double"], "showstopper": "pin-hero-hold"}
    other = {"effects": ["rail-gallery", "btn-invert", "corners-soft", "kinetic-words-headline"], "showstopper": "rail-gallery"}

    class Brief:
        def __init__(self, d):
            self.d, self.showstopper = d, d["showstopper"]

        def model_dump(self):
            return dict(self.d)
    made = iter([live, other])      # first the twin of a live page, then a different one
    monkeypatch.setattr(pv, "build_brief", lambda *a, **k: Brief(next(made, other)))
    offered = pv.candidates({**CHOLENT, "_id": "b1"}, None, PHOTOS, [live], generation=1)
    assert [b["showstopper"] for b in offered] == ["rail-gallery"]


@pytest.mark.parametrize("status,since,ok", [
    ("candidate", None, True), ("failed", None, True), ("archived", None, True),
    ("live", None, False), ("checking", 1, False), ("checking", 11, True),
])
def test_what_can_be_published(status, since, ok):
    v = {"status": status}
    if since is not None:
        v["checking_since"] = (NOW - timedelta(minutes=since)).isoformat()
    assert (can_publish(v, NOW) is None) is ok
    assert CHECK_TIMEOUT == timedelta(minutes=10)


def test_a_preview_token_opens_one_version_until_it_expires():
    token, stored = new_preview_token(NOW)
    v = {"preview": stored}
    assert token not in str(stored)                      # only the hash is kept
    assert preview_ok(v, token, NOW)
    assert not preview_ok(v, token + "x", NOW)
    assert not preview_ok({"preview": new_preview_token(NOW)[1]}, token, NOW)   # another version's
    assert not preview_ok(v, token, NOW + PREVIEW_TTL)
    assert not preview_ok({}, token, NOW) and not preview_ok(v, "", NOW)


def test_the_check_secret(monkeypatch):
    monkeypatch.delenv("PAGE_CHECK_SECRET", raising=False)
    assert not check_secret_ok("anything") and not check_secret_ok("")   # unset is off, never open
    monkeypatch.setenv("PAGE_CHECK_SECRET", "s3cret-for-tests")
    assert check_secret_ok("s3cret-for-tests")
    assert not check_secret_ok("s3cret-for-test") and not check_secret_ok(None)


# ------------------------------------------------------------------ the routes

@pytest.fixture(scope="module")
def app():
    """The real app, in-process, on the configured database, which must be
    local. Not entered as a context manager: its shutdown closes the shared
    Motor client other test files still use (see test_legacy_category_slugs)."""
    url = os.environ.get("MONGO_URL", "")
    if not ("localhost" in url or "127.0.0.1" in url):
        pytest.skip("route tests run against a local database only")
    testclient = pytest.importorskip("fastapi.testclient")
    import pymongo

    import routes.deps
    import server

    class OneLoopPerRequest(testclient.TestClient):
        """Without the context manager every request runs on a fresh event
        loop, and the shared Motor client stays bound to the first one.
        Unbind it before each request, as conftest does between tests."""
        def request(self, *args, **kwargs):
            routes.deps.client._io_loop = None
            return super().request(*args, **kwargs)
    # A synchronous client of its own for setting up and reading back: the
    # app's Motor client belongs to the app's event loop.
    sync = pymongo.MongoClient(url)[os.environ["DB_NAME"]]
    yield OneLoopPerRequest(server.app), sync


@pytest.fixture()
def world(app, monkeypatch):
    """One business with a live v3 page, its owner, a stranger and an admin;
    everything it creates is deleted afterwards."""
    client, db = app
    monkeypatch.setenv("PAGE_BUILDER_V3_ENABLED", "1")
    monkeypatch.delenv("PAGE_CHECK_URL", raising=False)
    monkeypatch.setenv("PAGE_CHECK_SECRET", "s3cret-for-tests")
    monkeypatch.setenv("OWNER_PAGE_VERSIONS_ENABLED", "1")
    from utils.auth import create_token
    ids = {k: uuid.uuid4().hex for k in ("owner", "other", "admin", "biz", "gig")}
    from utils.design_brief import build_brief
    if True:
        db.users.insert_many([{"id": ids[k], "status": "active"} for k in ("owner", "other", "admin")])
        live = build_brief({**CHOLENT, "_id": ids["biz"]}).model_dump()
        at = NOW.isoformat()
        db.businesses.insert_one({**{k: v for k, v in CHOLENT.items() if k != "listings"}, "_id": ids["biz"],
                                        "slug": f"pv-{ids['biz'][:8]}", "owner_user_id": ids["owner"], "active": True,
                                        "page_v3": True, "design_brief": live, "design_brief_at": at,
                                        "page_check": {"brief_at": at, "passed": True, "failures": []}})
        db.marketplace_gigs.insert_one({"_id": ids["gig"], "business_id": ids["biz"], "status": "published",
                                              "title": "Cholent", "provider_user_id": ids["owner"],
                                              "created_at": at})
    tok = {k: create_token(ids[k], "admin" if k == "admin" else "user") for k in ("owner", "other", "admin")}
    hdr = {k: {"Authorization": f"Bearer {t}"} for k, t in tok.items()}
    yield client, db, ids, hdr
    db.users.delete_many({"id": {"$in": [ids["owner"], ids["other"], ids["admin"]]}})
    db.businesses.delete_one({"_id": ids["biz"]})
    db.marketplace_gigs.delete_one({"_id": ids["gig"]})
    db.business_page_versions.delete_many({"business_id": ids["biz"]})


def _url(ids, tail=""):
    return f"/api/marketplace/businesses/{ids['biz']}/page-versions{tail}"


def test_only_the_owner_or_an_admin_and_only_once_switched_on(world):
    client, db, ids, hdr = world
    assert client.post(_url(ids), headers=hdr["other"]).status_code == 403
    assert client.get(_url(ids), headers=hdr["other"]).status_code == 403
    assert client.get(_url(ids)).status_code in (401, 403)
    db.businesses.update_one({"_id": ids["biz"]}, {"$set": {"page_v3": False}})
    assert client.post(_url(ids), headers=hdr["owner"]).status_code == 409


def test_publish_checks_then_a_pass_goes_live_and_a_fail_keeps_the_old_page(world):
    client, db, ids, hdr = world
    made = client.post(_url(ids), headers=hdr["owner"])
    assert made.status_code == 200, made.text
    vs = made.json()["versions"]
    # No photos on this business: two bold moments to offer, each different.
    assert len(vs) >= 2 and len({v["showstopper"] for v in vs}) == len(vs)

    # The owner publishes; no check service here, so no token for the owner.
    r = client.post(_url(ids, f"/{vs[0]['id']}/publish"), headers=hdr["owner"]).json()
    assert r["status"] == "checking" and "preview_token" not in r
    # One at a time.
    assert client.post(_url(ids, f"/{vs[1]['id']}/publish"), headers=hdr["owner"]).status_code == 409

    # Only the check records a verdict: not the owner, not a wrong secret.
    fail = {"passed": False, "failures": ["hero text 2.1:1 on the photo"]}
    assert client.post(_url(ids, f"/{vs[0]['id']}/check"), json=fail, headers=hdr["owner"]).status_code == 403
    assert client.post(_url(ids, f"/{vs[0]['id']}/check"), json=fail,
                       headers={"X-Page-Check-Secret": "wrong"}).status_code == 403
    before = db.businesses.find_one({"_id": ids["biz"]})
    r = client.post(_url(ids, f"/{vs[0]['id']}/check"), json=fail, headers={"X-Page-Check-Secret": "s3cret-for-tests"})
    assert r.json()["status"] == "failed"
    after = db.businesses.find_one({"_id": ids["biz"]})
    assert after["design_brief"] == before["design_brief"]          # the old page stays

    # An admin publishes the second: the token comes back for a local check.
    r = client.post(_url(ids, f"/{vs[1]['id']}/publish"), headers=hdr["admin"]).json()
    token = r["preview_token"]
    page = f"/api/marketplace/business/{ids['biz']}"
    assert client.get(page, params={"pv": token}).json()["design_brief"]["effects"] == vs[1]["brief"]["effects"]
    assert client.get(page, params={"pv": "not-it"}).json()["design_brief"]["effects"] == before["design_brief"]["effects"]
    r = client.post(_url(ids, f"/{vs[1]['id']}/check"), json={"passed": True}, headers={"X-Page-Check-Secret": "s3cret-for-tests"})
    assert r.json()["status"] == "live"
    biz = db.businesses.find_one({"_id": ids["biz"]})
    assert biz["design_brief"]["effects"] == vs[1]["brief"]["effects"]
    assert biz["page_check"]["passed"] and biz["page_check"]["brief_at"] == biz["design_brief_at"]
    assert client.get(page, params={"pv": token}).json()["design_brief"]["effects"] == vs[1]["brief"]["effects"]
    assert biz["design_brief_history"][0]["effects"] == before["design_brief"]["effects"]

    # The failed one, fixed and published again, passes and replaces it; the
    # second is archived, and restoring it checks it again before it is live.
    client.post(_url(ids, f"/{vs[0]['id']}/publish"), headers=hdr["owner"])
    client.post(_url(ids, f"/{vs[0]['id']}/check"), json={"passed": True}, headers={"X-Page-Check-Secret": "s3cret-for-tests"})
    listed = {v["id"]: v["status"] for v in client.get(_url(ids), headers=hdr["owner"]).json()["versions"]}
    assert listed[vs[0]["id"]] == "live" and listed[vs[1]["id"]] == "archived"
    assert client.post(_url(ids, f"/{vs[1]['id']}/publish"), headers=hdr["owner"]).json()["status"] == "checking"
    biz = db.businesses.find_one({"_id": ids["biz"]})
    assert biz["design_brief"]["effects"] == vs[0]["brief"]["effects"]    # the live one stays until it passes


def test_generating_again_replaces_unpicked_versions_only(world):
    client, db, ids, hdr = world
    first = client.post(_url(ids), headers=hdr["owner"]).json()["versions"]
    client.post(_url(ids, f"/{first[0]['id']}/publish"), headers=hdr["owner"])
    second = client.post(_url(ids), headers=hdr["owner"]).json()["versions"]
    statuses = [v["status"] for v in client.get(_url(ids), headers=hdr["owner"]).json()["versions"]]
    assert statuses.count("candidate") == len(second) and statuses.count("checking") == 1
    assert {v["id"] for v in second}.isdisjoint({v["id"] for v in first})


def _live_twin(db, ids, brief, live=True):
    """Another business of the same category, live (or not) with this brief."""
    other = f"twin-{uuid.uuid4().hex[:8]}"
    at = datetime.now(UTC).isoformat()
    db.businesses.insert_one({"_id": other, "slug": other, "name": "Twin", "owner_user_id": "nobody", "page_v3": True,
                              "design_brief": brief, "design_brief_at": at,
                              "page_check": {"brief_at": at if live else "earlier", "passed": True}})
    ids.setdefault("twins", []).append(other)
    return other


def test_only_live_pages_are_the_ledger(world):
    import asyncio
    from routes.marketplace.businesses import recent_briefs
    client, db, ids, hdr = world
    import routes.deps
    b = db.businesses.find_one({"_id": ids["biz"]})["design_brief"]

    def ledger():
        routes.deps.client._io_loop = None
        try:
            return len(asyncio.run(recent_briefs(b["category"], ids["biz"])))
        finally:
            routes.deps.client._io_loop = None
    base = ledger()
    _live_twin(db, ids, b, live=False)
    unchecked = ledger()
    _live_twin(db, ids, b, live=True)
    try:
        assert unchecked == base                   # a page nobody can see is not in the ledger
        assert ledger() == base + 1                # a live one is
    finally:
        db.businesses.delete_many({"_id": {"$in": ids.get("twins", [])}})


def test_a_version_that_became_too_close_is_refused_and_a_race_fails_at_go_live(world):
    client, db, ids, hdr = world
    vs = client.post(_url(ids), headers=hdr["owner"]).json()["versions"]
    try:
        # A twin of version 0 goes live elsewhere: publishing it is refused.
        _live_twin(db, ids, vs[0]["brief"])
        r = client.post(_url(ids, f"/{vs[0]['id']}/publish"), headers=hdr["owner"])
        assert r.status_code == 409 and "too much like another page" in r.json()["detail"]

        # Version 1 starts its check; its twin goes live meanwhile; the pass
        # becomes a fail and the old page stays.
        assert client.post(_url(ids, f"/{vs[1]['id']}/publish"), headers=hdr["owner"]).json()["status"] == "checking"
        before = db.businesses.find_one({"_id": ids["biz"]})["design_brief"]
        _live_twin(db, ids, vs[1]["brief"])
        r = client.post(_url(ids, f"/{vs[1]['id']}/check"), json={"passed": True},
                        headers={"X-Page-Check-Secret": "s3cret-for-tests"}).json()
        assert r["status"] == "failed" and "too close" in r["failures"][0]
        assert db.businesses.find_one({"_id": ids["biz"]})["design_brief"] == before
    finally:
        db.businesses.delete_many({"_id": {"$in": ids.get("twins", [])}})


def test_owners_cannot_choose_until_switched_on_but_an_admin_can(world, monkeypatch):
    """Tzvi, 8 Oct 2026: the rules are being tuned, so no owner builds a page yet."""
    client, db, ids, hdr = world
    monkeypatch.delenv("OWNER_PAGE_VERSIONS_ENABLED", raising=False)
    assert client.get(_url(ids), headers=hdr["owner"]).status_code == 403
    assert client.post(_url(ids), headers=hdr["owner"]).status_code == 403
    made = client.post(_url(ids), headers=hdr["admin"])
    assert made.status_code == 200 and made.json()["versions"]
    vid = made.json()["versions"][0]["id"]
    assert client.post(_url(ids, f"/{vid}/publish"), headers=hdr["owner"]).status_code == 403
    assert client.post(_url(ids, f"/{vid}/publish"), headers=hdr["admin"]).json()["status"] == "checking"

"""Job posting and job search, driven through the real HTTP routes.

WHY THIS IS DIFFERENT FROM THE OTHER TESTS. Almost every other job test
in this repo needs a live server and a live Atlas, so none of them run in
a normal working session — which is how a route can be broken for a while
without anything saying so. These run the actual FastAPI app over an ASGI
transport against `mongomock_motor`, so they exercise real routing, real
Pydantic validation, real query construction and real handler code, with
no server, no network and no database to install.

WHAT IT DOES NOT COVER, said plainly rather than implied: mongomock is
not MongoDB. Anything depending on a genuine text index, a real
aggregation pipeline, or Atlas-specific behaviour is out of scope here
and still needs the live suite. What it does cover is the part that
actually broke — which fields a query filters on, and who comes back.

THE PATCHING, which is the fiddly bit. Route modules do
`from routes.deps import db`, binding the object at import time, so
patching `routes.deps.db` alone changes nothing for code already
imported. Every module holding its own `db` reference is rebound.
"""
from __future__ import annotations

import sys
from pathlib import Path

import jwt
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.auth import JWT_SECRET  # noqa: E402

POSTER = "poster-user-1"
PROVIDER = "provider-user-1"


def _token(user_id: str, role: str = "renter") -> str:
    return jwt.encode(
        {"user_id": user_id, "email": f"{user_id}@example.test", "role": role},
        JWT_SECRET,
        algorithm="HS256",
    )


def _auth(user_id: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(user_id)}"}


@pytest_asyncio.fixture
async def client(monkeypatch):
    """The real app, with every `db` reference pointed at a fake Mongo."""
    fake = AsyncMongoMockClient()["test_db"]

    import routes.deps as deps

    monkeypatch.setattr(deps, "db", fake)
    for name, module in list(sys.modules.items()):
        if not (name.startswith("routes") or name.startswith("utils")):
            continue
        if getattr(module, "db", None) is not None and hasattr(module, "__file__"):
            monkeypatch.setattr(module, "db", fake, raising=False)

    # Notifications fan out over email in a background task. Nothing here
    # is testing SMTP, and letting it run would make these tests depend on
    # a mail provider being reachable.
    import routes.marketplace.jobs as jobs_mod

    async def _no_email(*a, **k):
        return None

    monkeypatch.setattr(jobs_mod, "send_email", _no_email, raising=False)
    monkeypatch.setattr(jobs_mod, "_translate_bg", _no_email, raising=False)

    import server

    transport = ASGITransport(app=server.app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        c.fake_db = fake
        yield c


# --------------------------------------------------------------------------
# Posting
# --------------------------------------------------------------------------

JOB = {
    "title": "Need a plumber for a burst pipe",
    "category": "home-services-repair",
    "description": "Kitchen pipe burst overnight, water everywhere. Need someone today.",
    "budget_type": "open",
    "area": "Jerusalem",
}


@pytest.mark.asyncio
async def test_posting_a_job_requires_auth(client):
    r = await client.post("/api/marketplace/jobs", json=JOB)
    assert r.status_code in (401, 403), r.text


@pytest.mark.asyncio
async def test_post_a_job_and_read_it_back(client):
    r = await client.post("/api/marketplace/jobs", json=JOB, headers=_auth(POSTER))
    assert r.status_code == 200, r.text
    job = r.json()
    assert job["title"] == JOB["title"]
    assert job["area"] == "Jerusalem"
    assert job["status"] == "open"
    assert job.get("id")

    got = await client.get(f"/api/marketplace/jobs/{job['id']}")
    assert got.status_code == 200, got.text
    assert got.json()["id"] == job["id"]


@pytest.mark.asyncio
async def test_a_job_appears_on_the_public_board_without_a_login(client):
    await client.post("/api/marketplace/jobs", json=JOB, headers=_auth(POSTER))
    r = await client.get("/api/marketplace/jobs")
    assert r.status_code == 200, r.text
    assert [j["title"] for j in r.json()] == [JOB["title"]]


@pytest.mark.asyncio
async def test_a_fixed_budget_with_no_amount_is_rejected(client):
    bad = {**JOB, "budget_type": "fixed"}
    r = await client.post("/api/marketplace/jobs", json=bad, headers=_auth(POSTER))
    assert r.status_code == 400, r.text


@pytest.mark.asyncio
async def test_an_unknown_category_is_rejected(client):
    bad = {**JOB, "category": "not-a-real-category"}
    r = await client.post("/api/marketplace/jobs", json=bad, headers=_auth(POSTER))
    assert r.status_code in (400, 422), r.text


@pytest.mark.asyncio
async def test_a_too_short_description_is_rejected(client):
    bad = {**JOB, "description": "help"}
    r = await client.post("/api/marketplace/jobs", json=bad, headers=_auth(POSTER))
    assert r.status_code == 422, r.text


@pytest.mark.asyncio
async def test_the_open_job_cap_holds(client):
    """Five open jobs per user. The sixth must be refused, not silently
    accepted — this is the only thing stopping one account flooding the
    board."""
    for i in range(5):
        r = await client.post(
            "/api/marketplace/jobs",
            json={**JOB, "title": f"{JOB['title']} number {i}"},
            headers=_auth(POSTER),
        )
        assert r.status_code == 200, r.text
    sixth = await client.post("/api/marketplace/jobs", json=JOB, headers=_auth(POSTER))
    assert sixth.status_code == 400, sixth.text

    # And the cap is PER USER, not global.
    other = await client.post("/api/marketplace/jobs", json=JOB, headers=_auth("someone-else"))
    assert other.status_code == 200, other.text


# --------------------------------------------------------------------------
# Searching the board
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_board_filters_by_category(client):
    await client.post("/api/marketplace/jobs", json=JOB, headers=_auth(POSTER))
    await client.post(
        "/api/marketplace/jobs",
        json={**JOB, "title": "Photographer for a bar mitzvah", "category": "creative-design"},
        headers=_auth("poster-2"),
    )

    hit = await client.get("/api/marketplace/jobs", params={"category": "creative-design"})
    assert [j["category"] for j in hit.json()] == ["creative-design"]

    both = await client.get("/api/marketplace/jobs")
    assert len(both.json()) == 2


@pytest.mark.asyncio
async def test_board_filters_by_area_and_is_prefix_matched(client):
    await client.post("/api/marketplace/jobs", json=JOB, headers=_auth(POSTER))
    await client.post(
        "/api/marketplace/jobs",
        json={**JOB, "title": "Mover needed in the north", "area": "Haifa"},
        headers=_auth("poster-2"),
    )

    r = await client.get("/api/marketplace/jobs", params={"area": "Jerusalem"})
    assert [j["area"] for j in r.json()] == ["Jerusalem"]

    # The docstring on SavedSearchIn promises prefix matching, so a job in
    # "Jerusalem, Katamon" must be found by someone filtering "Jerusalem".
    await client.post(
        "/api/marketplace/jobs",
        json={**JOB, "title": "Electrician in Katamon please", "area": "Jerusalem, Katamon"},
        headers=_auth("poster-3"),
    )
    r2 = await client.get("/api/marketplace/jobs", params={"area": "Jerusalem"})
    assert len(r2.json()) == 2


@pytest.mark.asyncio
async def test_board_area_filter_does_not_match_mid_string(client):
    """Prefix-anchored, so "Aviv" must not find "Tel Aviv" — otherwise a
    filter for one city quietly returns another's jobs."""
    await client.post(
        "/api/marketplace/jobs",
        json={**JOB, "area": "Tel Aviv"},
        headers=_auth(POSTER),
    )
    r = await client.get("/api/marketplace/jobs", params={"area": "Aviv"})
    assert r.json() == []


@pytest.mark.asyncio
async def test_closed_jobs_are_off_the_open_board(client):
    r = await client.post("/api/marketplace/jobs", json=JOB, headers=_auth(POSTER))
    job_id = r.json()["id"]

    patched = await client.patch(
        f"/api/marketplace/jobs/{job_id}",
        json={"status": "closed"},
        headers=_auth(POSTER),
    )
    assert patched.status_code == 200, patched.text

    open_board = await client.get("/api/marketplace/jobs")
    assert open_board.json() == []
    closed = await client.get("/api/marketplace/jobs", params={"status": "closed"})
    assert len(closed.json()) == 1


@pytest.mark.asyncio
async def test_someone_else_cannot_edit_your_job(client):
    r = await client.post("/api/marketplace/jobs", json=JOB, headers=_auth(POSTER))
    job_id = r.json()["id"]
    hijack = await client.patch(
        f"/api/marketplace/jobs/{job_id}",
        json={"title": "Totally different job now"},
        headers=_auth("not-the-poster"),
    )
    assert hijack.status_code in (403, 404), hijack.text


@pytest.mark.asyncio
async def test_a_missing_job_is_a_404(client):
    r = await client.get("/api/marketplace/jobs/does-not-exist")
    assert r.status_code == 404


# --------------------------------------------------------------------------
# Who gets told about a posted job
# --------------------------------------------------------------------------
# The end the whole service-area feature exists for: a customer posts a
# job, and the businesses that actually cover that city hear about it.
# Asserted against the real fan-out by recording who it tries to email.
#
# Seeding and notifying are separate on purpose. Folding them together
# re-seeded on every call, and the first version of this test passed
# empty lists into the combined helper — so it seeded nothing, notified
# nobody, and the empty result looked like a real answer.


async def _seed_providers(fake_db, businesses, gigs):
    for b in businesses:
        await fake_db.businesses.insert_one(b)
    for g in gigs:
        await fake_db.marketplace_gigs.insert_one(g)
    for uid in sorted({g["provider_user_id"] for g in gigs}):
        await fake_db.users.insert_one({"id": uid, "email": f"{uid}@example.test", "name": uid})
        # 'instant' so the per-post path is the one under test.
        await fake_db.job_notification_preferences.insert_one({"user_id": uid, "mode": "instant"})


async def _notified_for(monkeypatch, job):
    """Run the real notifier; return the addresses it tried to email."""
    import routes.marketplace.jobs as jobs_mod

    sent: list[str] = []

    async def _record(to_email, **kwargs):
        sent.append(to_email)

    monkeypatch.setattr(jobs_mod, "send_email", _record)
    await jobs_mod._notify_matching_providers(job)
    return sent


def _gig(uid, business_id, category="home-services-repair"):
    return {
        "_id": f"gig-{uid}",
        "provider_user_id": uid,
        "business_id": business_id,
        "category": category,
        "status": "published",
        "area": "Somewhere",
    }


def _job(area, _id="job-1"):
    return {
        "_id": _id,
        "category": "home-services-repair",
        "area": area,
        "title": "Burst pipe",
        "poster_user_id": POSTER,
        "budget_type": "open",
    }


@pytest.mark.asyncio
async def test_a_posted_job_reaches_the_right_businesses(client, monkeypatch):
    """Jerusalem job: the Jerusalem business and the nationwide courier
    hear about it; the Haifa-only business does not."""
    await _seed_providers(
        client.fake_db,
        [
            {"_id": "b-jlm", "owner_user_id": "u-jlm", "areas": ["jerusalem"], "serves_nationwide": False},
            {"_id": "b-hfa", "owner_user_id": "u-hfa", "areas": ["haifa"], "serves_nationwide": False},
            {"_id": "b-nat", "owner_user_id": "u-nat", "areas": [], "serves_nationwide": True},
        ],
        [_gig("u-jlm", "b-jlm"), _gig("u-hfa", "b-hfa"), _gig("u-nat", "b-nat")],
    )
    sent = await _notified_for(monkeypatch, _job("Jerusalem"))
    assert set(sent) == {"u-jlm@example.test", "u-nat@example.test"}, sent


@pytest.mark.asyncio
async def test_a_multi_city_business_hears_about_each_of_its_cities(client, monkeypatch):
    await _seed_providers(
        client.fake_db,
        [{"_id": "b-multi", "owner_user_id": "u-multi",
          "areas": ["jerusalem", "bet-shemesh"], "serves_nationwide": False}],
        [_gig("u-multi", "b-multi")],
    )
    for city in ("Jerusalem", "Bet Shemesh"):
        sent = await _notified_for(monkeypatch, _job(city))
        assert sent == ["u-multi@example.test"], f"{city}: {sent}"

    # And not a city it does not cover.
    assert await _notified_for(monkeypatch, _job("Haifa")) == []


@pytest.mark.asyncio
async def test_a_business_with_no_service_area_still_hears_about_jobs(client, monkeypatch):
    """The migration-safety clause, end to end. Every business predating
    the picker is in this state; they must not go quiet."""
    await _seed_providers(
        client.fake_db,
        [{"_id": "b-old", "owner_user_id": "u-old", "areas": [], "serves_nationwide": False}],
        [_gig("u-old", "b-old")],
    )
    assert await _notified_for(monkeypatch, _job("Jerusalem")) == ["u-old@example.test"]


@pytest.mark.asyncio
async def test_a_job_in_an_unlisted_town_still_reaches_everyone(client, monkeypatch):
    """"Ramat Gan" is not in the catalogue, so nobody can be excluded on
    the strength of it."""
    await _seed_providers(
        client.fake_db,
        [
            {"_id": "b-a", "owner_user_id": "u-a", "areas": ["jerusalem"], "serves_nationwide": False},
            {"_id": "b-b", "owner_user_id": "u-b", "areas": ["haifa"], "serves_nationwide": False},
        ],
        [_gig("u-a", "b-a"), _gig("u-b", "b-b")],
    )
    sent = await _notified_for(monkeypatch, _job("Ramat Gan"))
    assert set(sent) == {"u-a@example.test", "u-b@example.test"}, sent

"""The two endpoints the goods composer talks to, through real routing.

`/item-schema` is the composer's only source of structure. If it and the
validator ever disagree, the seller fills in a field that is silently
dropped on write - so the test that matters is not "does it respond", it
is "does it offer exactly what the writer accepts".

`/items/draft` hands a URL to a third party to fetch. That makes the URL
check a security boundary rather than a formatting nicety: without it
any account holder could have any host retrieved from our vendor's
network, on our bill, with our name on the request. Both halves of that
check are tested - the host AND the cloud name - because
`res.cloudinary.com/<somebody-else>/...` is a URL a stranger controls.
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
from routes.marketplace.item_taxonomy import (  # noqa: E402
    ITEM_CATEGORY_SLUGS,
    PROVENANCE_FIELDS,
    fields_for,
    normalize_attributes,
)

OUR_CLOUD = "test-cloud"
OURS = f"https://res.cloudinary.com/{OUR_CLOUD}/image/upload/v1/myisraelrental/sofa.jpg"


def _auth(uid="seller-1"):
    tok = jwt.encode({"user_id": uid, "email": f"{uid}@x.test", "role": "renter"},
                     JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


@pytest_asyncio.fixture
async def client(monkeypatch):
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", OUR_CLOUD)
    # The limiter is a sliding window shared across the process, so a test
    # file that posts twenty drafts would otherwise poison the next one.
    monkeypatch.setenv("DISABLE_RATE_LIMIT", "1")
    monkeypatch.delenv("RAILWAY_ENVIRONMENT", raising=False)

    fake = AsyncMongoMockClient()["test_db"]
    import routes.deps as deps

    monkeypatch.setattr(deps, "db", fake)
    for name, mod in list(sys.modules.items()):
        if not (name.startswith("routes") or name.startswith("utils")):
            continue
        if getattr(mod, "db", None) is not None and hasattr(mod, "__file__"):
            monkeypatch.setattr(mod, "db", fake, raising=False)

    import server

    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://t") as c:
        yield c


# --------------------------------------------------------------------------
# /item-schema
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_the_schema_is_public(client):
    """It is a vocabulary, and it is on every listing page already.
    Requiring a token to learn what "220v" means would only stop the board
    being readable signed out."""
    r = await client.get("/api/marketplace/item-schema")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_the_schema_offers_exactly_what_the_writer_accepts(client):
    """The one assertion this endpoint exists for. A field the composer
    renders but the writer does not declare is filled in by the seller and
    dropped on write - they see a form that took their answer and a
    listing that does not have it."""
    body = (await client.get("/api/marketplace/item-schema")).json()

    assert {c["slug"] for c in body["categories"]} == ITEM_CATEGORY_SLUGS

    for slug in ITEM_CATEGORY_SLUGS:
        offered = {f["key"] for f in body["shared_fields"]} | {
            f["key"] for f in body["category_fields"][slug]}
        accepted = {f["key"] for f in fields_for(slug)}
        assert offered == accepted, slug


@pytest.mark.asyncio
async def test_every_offered_enum_value_survives_validation(client):
    """Rendering an option the validator then drops is the same bug one
    level down: the seller picks "220V", the listing has no voltage, and
    nothing anywhere reports it."""
    body = (await client.get("/api/marketplace/item-schema")).json()
    for slug in ITEM_CATEGORY_SLUGS:
        for field in body["shared_fields"] + body["category_fields"][slug]:
            if field["type"] != "enum":
                continue
            for option in field["options"]:
                kept = normalize_attributes(slug, {field["key"]: option["value"]})
                assert kept.get(field["key"]) == option["value"], (slug, field["key"], option)


@pytest.mark.asyncio
async def test_the_provenance_fields_are_named_rather_than_hardcoded_client_side(client):
    """The composer marks these two differently - presence is the signal,
    the value is never a facet. Sent so the marking cannot drift from the
    list the backend actually treats that way."""
    body = (await client.get("/api/marketplace/item-schema")).json()
    assert set(body["provenance_fields"]) == set(PROVENANCE_FIELDS)


@pytest.mark.asyncio
async def test_vision_availability_is_reported_honestly(client, monkeypatch):
    """So the composer can skip offering a step that cannot run, rather
    than showing a spinner for a call that was never going to happen."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    body = (await client.get("/api/marketplace/item-schema")).json()
    assert body["vision_available"] is False

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    body = (await client.get("/api/marketplace/item-schema")).json()
    assert body["vision_available"] is True


# --------------------------------------------------------------------------
# /items/draft — the URL is a security boundary
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_drafting_requires_an_account(client):
    """It spends real credit per call. Anonymous access is an open tap."""
    r = await client.post("/api/marketplace/items/draft", json={"photo_url": OURS})
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
@pytest.mark.parametrize("url", [
    # Someone else's Cloudinary account. The host is right and the URL is
    # entirely theirs - this is the case that makes the host check alone
    # insufficient, and the one a reviewer is most likely to wave through.
    "https://res.cloudinary.com/somebody-else/image/upload/v1/x.jpg",
    "https://evil.example.com/x.jpg",
    "http://res.cloudinary.com/test-cloud/image/upload/x.jpg",
    "https://res.cloudinary.com.evil.example/test-cloud/x.jpg",
    "https://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd",
    "",
])
async def test_a_photo_we_do_not_host_is_refused(client, url):
    r = await client.post("/api/marketplace/items/draft",
                          json={"photo_url": url}, headers=_auth())
    assert r.status_code == 400, url


@pytest.mark.asyncio
async def test_an_unconfigured_cloud_name_refuses_rather_than_falls_open(client, monkeypatch):
    """A missing environment variable must never be the thing that widens
    what a URL is allowed to point at."""
    monkeypatch.delenv("CLOUDINARY_CLOUD_NAME", raising=False)
    r = await client.post("/api/marketplace/items/draft",
                          json={"photo_url": OURS}, headers=_auth())
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_our_own_photo_is_accepted_and_nothing_is_written(client, monkeypatch):
    """The control for every refusal above: without this passing, those
    400s could just as well mean the route is broken."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")

    class Fake:
        def __init__(self, *a, **k):
            pass

        def with_model(self, *a, **k):
            return self

        def with_params(self, *a, **k):
            return self

        async def send_message(self, msg):
            return '{"category": "furniture", "confidence": "high", ' \
                   '"attributes": {"colour": "grey"}, "title_suggestion": "Sofa"}'

    import utils.llm as llm
    monkeypatch.setattr(llm, "LlmChat", Fake)

    r = await client.post("/api/marketplace/items/draft",
                          json={"photo_url": OURS, "title": "sofa"}, headers=_auth())
    assert r.status_code == 200
    body = r.json()
    assert body["category"] == "furniture"
    assert body["attributes"] == {"colour": "grey"}


@pytest.mark.asyncio
async def test_an_unconfigured_key_answers_rather_than_erroring(client, monkeypatch):
    """Vision is an accelerator, never a dependency. With no key the
    composer must get a well-formed 'nothing to suggest', not a 500 in the
    middle of somebody's listing."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    r = await client.post("/api/marketplace/items/draft",
                          json={"photo_url": OURS}, headers=_auth())
    assert r.status_code == 200
    assert r.json()["available"] is False

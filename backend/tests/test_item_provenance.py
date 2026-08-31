"""Serial numbers and frame numbers: shown as a signal, never as a value.

WHAT THE FIELD IS FOR. A fence cannot publish a serial number, and it
costs an honest seller nothing. That asymmetry is the entire value: the
buyer is not reading the digits, they are reading "this seller could
produce them".

WHY THE DIGITS DO NOT LEAVE THE SERVER. Printed on a public page, the
signal becomes forgeable in one copy-paste: lift a real serial off an
honest listing, put it on a stolen one, and the marker now means nothing
on either. The buyer checks the number against the physical object at
collection, which is the only check that was ever going to catch
anything. So the API serves `provenance_provided` and never the value -
the same rule the phone number in this module already follows, for a
different reason.

THE QUERY-BUILDING TESTS ARE THE OTHER HALF. `area` puts an `$or` at the
top level of the query. A presence filter written as a second bare `$or`
replaces it silently, and "sofas in Jerusalem with a serial" quietly
becomes "anything, anywhere, with a serial" - more results, no error,
and a filter chip still lit. Every combination that could collide is
tested for that reason and not for coverage.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

SELLER = "seller-1"
SERIAL = "356938035643809"


@pytest_asyncio.fixture
async def client(monkeypatch):
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
        c.fake_db = fake
        yield c


def _item(_id, *, category="electronics", area="Jerusalem", title="a laptop", attributes=None):
    return {
        "_id": _id, "request_type": "item", "post_kind": "have",
        "status": "open", "hidden_by_admin": False, "item_status": "available",
        "title": title, "description": "a thing for sale",
        "category": category, "area": area, "area_id": None,
        "condition": "good",
        "budget_type": "fixed", "budget_amount": 100, "budget_currency": "ILS",
        "attributes": attributes or {}, "attributes_version": 1,
        "poster_user_id": SELLER, "created_at": "2026-08-01T00:00:00+00:00",
    }


SEED = [
    _item("with-1", area="Jerusalem", attributes={"serial_or_imei": SERIAL, "voltage": "220v"}),
    _item("with-2", area="Haifa", attributes={"serial_or_imei": "ABC999"}),
    _item("bike-1", category="bikes-scooters", area="Jerusalem",
          title="a bicycle", attributes={"frame_number": "WTU123456K"}),
    _item("without-1", area="Jerusalem", attributes={"voltage": "220v"}),
    _item("without-2", area="Jerusalem", attributes={}),
    # An empty string is not a published serial. Stored as one it would
    # count toward the marker and toward the filter, which would make the
    # signal free to fake by typing a space.
    _item("blank-1", area="Jerusalem", attributes={"serial_or_imei": ""}),
]


async def _seed(client):
    for doc in SEED:
        await client.fake_db.requests.insert_one(doc)


# --------------------------------------------------------------------------
# The value never leaves the server
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_the_serial_is_not_in_the_listing_response(client):
    await _seed(client)
    body = (await client.get("/api/marketplace/requests/with-1")).json()
    assert SERIAL not in str(body), "the serial number reached a public response"
    assert body["attributes"].get("voltage") == "220v", "the other attributes still serve"


@pytest.mark.asyncio
async def test_the_marker_is_served_instead(client):
    await _seed(client)
    body = (await client.get("/api/marketplace/requests/with-1")).json()
    assert body["provenance_provided"] == ["serial_or_imei"]


@pytest.mark.asyncio
async def test_the_serial_is_not_in_the_board_response_either(client):
    """The detail page is the obvious place to check and the board is the
    one that gets forgotten - it serves the same documents through a
    different call."""
    await _seed(client)
    body = (await client.get("/api/marketplace/requests?request_type=item")).json()
    assert SERIAL not in str(body)
    assert "WTU123456K" not in str(body)


@pytest.mark.asyncio
async def test_a_listing_without_one_says_so_by_omission(client):
    await _seed(client)
    body = (await client.get("/api/marketplace/requests/without-1")).json()
    assert body.get("provenance_provided") == []


@pytest.mark.asyncio
async def test_a_blank_serial_is_not_a_published_one(client):
    await _seed(client)
    body = (await client.get("/api/marketplace/requests/blank-1")).json()
    assert body.get("provenance_provided") == []


# --------------------------------------------------------------------------
# Filtering on presence
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_the_filter_returns_only_sellers_who_published_one(client):
    await _seed(client)
    ids = {r["id"] for r in (await client.get(
        "/api/marketplace/requests?request_type=item&has_provenance=true")).json()}
    assert ids == {"with-1", "with-2", "bike-1"}


@pytest.mark.asyncio
async def test_it_covers_both_fields_as_one_filter(client):
    """A buyer is not hunting for "listings with a frame number". They are
    hunting for a seller who did the thing a fence cannot do, and which
    field applies is decided by the category, not by them."""
    await _seed(client)
    ids = {r["id"] for r in (await client.get(
        "/api/marketplace/requests?request_type=item&has_provenance=true")).json()}
    assert "bike-1" in ids and "with-1" in ids


@pytest.mark.asyncio
async def test_off_by_default(client):
    await _seed(client)
    ids = {r["id"] for r in (await client.get(
        "/api/marketplace/requests?request_type=item")).json()}
    assert "without-1" in ids


@pytest.mark.asyncio
async def test_it_does_not_widen_an_area_filter(client):
    """The collision this whole file exists for. `area` owns the query's
    top-level $or; a presence filter written as a second bare $or replaces
    it, and the board silently returns Haifa results under a Jerusalem
    chip - more items, no error, nothing to notice."""
    await _seed(client)
    ids = {r["id"] for r in (await client.get(
        "/api/marketplace/requests?request_type=item&area=Jerusalem&has_provenance=true")).json()}
    assert ids == {"with-1", "bike-1"}, "Haifa leaked into a Jerusalem filter"


@pytest.mark.asyncio
async def test_it_does_not_widen_a_text_search(client):
    """`q` owns the query's $and for the same reason, and loses it the
    same way."""
    await _seed(client)
    ids = {r["id"] for r in (await client.get(
        "/api/marketplace/requests?request_type=item&q=bicycle&has_provenance=true")).json()}
    assert ids == {"bike-1"}


# --------------------------------------------------------------------------
# The count beside the checkbox
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_the_count_is_what_turning_it_on_would_give(client):
    await _seed(client)
    body = (await client.get("/api/marketplace/requests/facets?request_type=item")).json()
    assert body["facets"]["provenance"]["provided"] == 3


@pytest.mark.asyncio
async def test_the_count_excludes_its_own_selection(client):
    """Self-exclusion, the failure that is invisible when it is wrong: a
    facet counted INSIDE its own selection makes every alternative read
    zero, which looks exactly like an empty board."""
    await _seed(client)
    on = (await client.get(
        "/api/marketplace/requests/facets?request_type=item&has_provenance=true")).json()
    assert on["facets"]["provenance"]["provided"] == 3
    assert on["total"] == 3, "the total DOES narrow, unlike the facet count"


@pytest.mark.asyncio
async def test_the_count_respects_the_other_filters(client):
    await _seed(client)
    body = (await client.get(
        "/api/marketplace/requests/facets?request_type=item&area=Jerusalem")).json()
    assert body["facets"]["provenance"]["provided"] == 2


@pytest.mark.asyncio
async def test_no_dead_end_when_the_filter_empties_the_board(client):
    """L6 - the relaxation payload has to name this filter like any other,
    so the copy can say what dropping it would give instead of showing a
    bare zero."""
    await _seed(client)
    body = (await client.get(
        "/api/marketplace/requests/facets?request_type=item"
        "&area=Jerusalem&condition=new&has_provenance=true")).json()
    assert body["total"] == 0
    assert body["relaxation"] is not None
    assert body["relaxation"]["count"] > 0

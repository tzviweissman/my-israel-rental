"""Item filters and facet counts, driven through the real HTTP routes.

Run against mongomock_motor, so this exercises real routing, real query
construction and the real aggregation shape without a server or a
database to install.

THE TWO THINGS WORTH TESTING HERE, because both are invisible when wrong:

  EXACTNESS. "220V (14)" is read as a promise about what is behind the
  click. A count that lies teaches people to stop trusting every number
  on the page, which is worse than showing none - so the endpoint's
  `exact` flag is asserted, not just its numbers.

  SELF-EXCLUSION. The count beside "110V" must be what you would get if
  you SWITCHED to 110V, not the count inside the current voltage
  selection. Get that wrong and every option except the one already
  chosen reads zero, which looks exactly like a board with nothing on it.
  Nothing about the page appears broken; it just quietly tells everyone
  there is nothing else to see.
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

SELLER = "seller-1"


def _auth(uid=SELLER):
    tok = jwt.encode({"user_id": uid, "email": f"{uid}@x.test", "role": "renter"},
                     JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


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


def _item(_id, *, category, area, condition="good", price=100, attributes=None, sold=False):
    return {
        "_id": _id, "request_type": "item", "post_kind": "have",
        "status": "open", "hidden_by_admin": False,
        "item_status": "sold" if sold else "available",
        "title": f"item {_id}", "description": "a thing for sale",
        "category": category, "area": area, "area_id": None,
        "condition": condition,
        "budget_type": "fixed", "budget_amount": price, "budget_currency": "ILS",
        "attributes": attributes or {}, "attributes_version": 1,
        "poster_user_id": SELLER, "created_at": "2026-08-01T00:00:00+00:00",
    }


async def _seed(db, docs):
    for d in docs:
        await db.requests.insert_one(d)


APPLIANCES = [
    _item("a1", category="appliances", area="Jerusalem", attributes={"voltage": "220v"}),
    _item("a2", category="appliances", area="Jerusalem", attributes={"voltage": "220v"}),
    _item("a3", category="appliances", area="Jerusalem", attributes={"voltage": "110v"}),
    _item("a4", category="appliances", area="Haifa", attributes={"voltage": "110v"}),
    _item("a5", category="appliances", area="Haifa", attributes={"voltage": "dual"}),
]


# --------------------------------------------------------------------------
# The filters that existed in the API and were never sent
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_the_board_filters_by_an_item_category(client):
    """Regression: the read path validated `category` against the SERVICES
    tree, so asking for a real goods category returned 400."""
    await _seed(client.fake_db, APPLIANCES)
    r = await client.get("/api/marketplace/requests",
                         params={"request_type": "item", "category": "appliances"})
    assert r.status_code == 200, r.text
    assert len(r.json()) == 5


@pytest.mark.asyncio
async def test_a_services_slug_is_still_refused_on_the_item_view(client):
    r = await client.get("/api/marketplace/requests",
                         params={"request_type": "item", "category": "home-services-repair"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_condition_and_price_filters_work(client):
    await _seed(client.fake_db, [
        _item("c1", category="furniture", area="Jerusalem", condition="new", price=500),
        _item("c2", category="furniture", area="Jerusalem", condition="used", price=50),
    ])
    r = await client.get("/api/marketplace/requests",
                         params={"request_type": "item", "condition": "new"})
    assert [d["id"] for d in r.json()] == ["c1"]

    r = await client.get("/api/marketplace/requests",
                         params={"request_type": "item", "max_price": 100})
    assert [d["id"] for d in r.json()] == ["c2"]


@pytest.mark.asyncio
async def test_sold_items_are_excluded_by_default_and_reachable_on_request(client):
    await _seed(client.fake_db, [
        _item("s1", category="furniture", area="Jerusalem"),
        _item("s2", category="furniture", area="Jerusalem", sold=True),
    ])
    default = await client.get("/api/marketplace/requests", params={"request_type": "item"})
    assert [d["id"] for d in default.json()] == ["s1"]

    with_sold = await client.get("/api/marketplace/requests",
                                 params={"request_type": "item", "include_sold": True})
    assert {d["id"] for d in with_sold.json()} == {"s1", "s2"}


# --------------------------------------------------------------------------
# Attribute filters
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_filtering_on_an_attribute(client):
    await _seed(client.fake_db, APPLIANCES)
    r = await client.get("/api/marketplace/requests", params=[
        ("request_type", "item"), ("category", "appliances"), ("attr", "voltage:110v"),
    ])
    assert {d["id"] for d in r.json()} == {"a3", "a4"}


@pytest.mark.asyncio
async def test_two_attribute_filters_intersect(client):
    await _seed(client.fake_db, APPLIANCES + [
        _item("a6", category="appliances", area="Jerusalem",
              attributes={"voltage": "110v", "shabbat_mode": "true"}),
    ])
    r = await client.get("/api/marketplace/requests", params=[
        ("request_type", "item"), ("category", "appliances"),
        ("attr", "voltage:110v"), ("attr", "shabbat_mode:true"),
    ])
    assert {d["id"] for d in r.json()} == {"a6"}


@pytest.mark.asyncio
async def test_an_unknown_attribute_filter_is_dropped_not_an_error(client):
    """A stale bookmark carrying a retired attribute should show the board,
    not an error page."""
    await _seed(client.fake_db, APPLIANCES)
    r = await client.get("/api/marketplace/requests", params=[
        ("request_type", "item"), ("category", "appliances"),
        ("attr", "nonsense:whatever"), ("attr", "malformed-no-colon"),
    ])
    assert r.status_code == 200
    assert len(r.json()) == 5


# --------------------------------------------------------------------------
# Facet counts
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_counts_are_exact_and_say_so(client):
    await _seed(client.fake_db, APPLIANCES)
    r = await client.get("/api/marketplace/requests/facets",
                         params={"request_type": "item", "category": "appliances"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["exact"] is True, "a count that is not exact must not be presented as one"
    assert body["total"] == 5
    assert body["facets"]["attr:voltage"] == {"220v": 2, "110v": 2, "dual": 1}
    assert body["facets"]["area"] == {"Jerusalem": 3, "Haifa": 2}


@pytest.mark.asyncio
async def test_a_facet_excludes_its_own_selection(client):
    """The one that is invisible when wrong.

    With voltage=220v applied, the voltage facet must still report what
    110V and dual WOULD give - 2 and 1. If it applied its own filter it
    would report 220v:2 and nothing else, and the page would tell the
    reader there is no other voltage on the board.
    """
    await _seed(client.fake_db, APPLIANCES)
    r = await client.get("/api/marketplace/requests/facets", params=[
        ("request_type", "item"), ("category", "appliances"), ("attr", "voltage:220v"),
    ])
    body = r.json()
    assert body["facets"]["attr:voltage"] == {"220v": 2, "110v": 2, "dual": 1}, (
        "the voltage facet applied its own selection; every alternative reads zero"
    )
    # But a DIFFERENT facet does narrow, because that selection still holds.
    assert body["facets"]["area"] == {"Jerusalem": 2}
    assert body["total"] == 2


@pytest.mark.asyncio
async def test_facets_respect_the_other_filters(client):
    await _seed(client.fake_db, APPLIANCES)
    r = await client.get("/api/marketplace/requests/facets",
                         params={"request_type": "item", "category": "appliances", "area": "Haifa"})
    body = r.json()
    assert body["total"] == 2
    assert body["facets"]["attr:voltage"] == {"110v": 1, "dual": 1}


@pytest.mark.asyncio
async def test_only_this_categorys_facets_are_offered(client):
    """A voltage filter on a bookshelf is noise, so it is neither offered
    nor counted there."""
    await _seed(client.fake_db, [
        _item("b1", category="books-judaica", area="Jerusalem",
              attributes={"language": "he", "nusach": "ashkenaz"}),
    ])
    r = await client.get("/api/marketplace/requests/facets",
                         params={"request_type": "item", "category": "books-judaica"})
    keys = set(r.json()["facets"])
    assert "attr:language" in keys
    assert "attr:voltage" not in keys, "voltage was counted for books"


@pytest.mark.asyncio
async def test_zero_options_are_not_listed(client):
    """An option with nothing behind it is not a choice, it is a dead end
    with a label on it."""
    await _seed(client.fake_db, APPLIANCES)
    r = await client.get("/api/marketplace/requests/facets",
                         params={"request_type": "item", "category": "appliances"})
    for counts in r.json()["facets"].values():
        assert all(n > 0 for n in counts.values())


@pytest.mark.asyncio
async def test_the_facets_route_is_not_swallowed_as_a_request_id(client):
    """`/requests/facets` and `/requests/{request_id}` collide unless the
    literal is declared first. If it ever regresses this returns 404."""
    r = await client.get("/api/marketplace/requests/facets", params={"request_type": "item"})
    assert r.status_code == 200
    assert "facets" in r.json()


# --------------------------------------------------------------------------
# Never dead-end (L6)
# --------------------------------------------------------------------------
# A zero-result page is a demand signal thrown away. It has to say which
# constraint is costing the results, or the reader's only move is to leave.

@pytest.mark.asyncio
async def test_a_zero_result_filter_names_the_one_to_drop(client):
    await _seed(client.fake_db, APPLIANCES)
    # 110V exists, and Jerusalem exists, but no 110V in... a price band
    # nothing occupies.
    r = await client.get("/api/marketplace/requests/facets", params=[
        ("request_type", "item"), ("category", "appliances"),
        ("attr", "voltage:110v"), ("min_price", 9000),
    ])
    body = r.json()
    assert body["total"] == 0
    assert body["relaxation"], "a zero-result view offered no way forward"
    assert body["relaxation"]["drop"] == "budget_amount", body["relaxation"]
    assert body["relaxation"]["count"] == 2, "should report what dropping the price would give"


@pytest.mark.asyncio
async def test_it_picks_the_filter_that_helps_most_not_the_first_one(client):
    await _seed(client.fake_db, APPLIANCES)
    r = await client.get("/api/marketplace/requests/facets", params=[
        ("request_type", "item"), ("category", "appliances"),
        ("condition", "new"), ("attr", "voltage:220v"),
    ])
    body = r.json()
    assert body["total"] == 0
    # Dropping `condition` yields the two 220V items; dropping voltage
    # yields nothing, since no item is `new`. The better one must win.
    assert body["relaxation"]["drop"] == "condition"
    assert body["relaxation"]["count"] == 2


@pytest.mark.asyncio
async def test_when_no_single_drop_helps_it_says_so(client):
    """The constraint is in the category or the search words, not the
    facets. Suggesting a click that changes nothing is worse than none."""
    await _seed(client.fake_db, APPLIANCES)
    r = await client.get("/api/marketplace/requests/facets", params=[
        ("request_type", "item"), ("category", "bikes-scooters"), ("condition", "new"),
    ])
    body = r.json()
    assert body["total"] == 0
    assert body["relaxation"]["exhausted"] is True
    assert body["relaxation"]["drop"] is None
    assert body["relaxation"]["count"] == 5, "should report the broader board it could fall back to"


@pytest.mark.asyncio
async def test_no_relaxation_offered_when_there_are_results(client):
    await _seed(client.fake_db, APPLIANCES)
    r = await client.get("/api/marketplace/requests/facets",
                         params={"request_type": "item", "category": "appliances"})
    assert r.json()["relaxation"] is None

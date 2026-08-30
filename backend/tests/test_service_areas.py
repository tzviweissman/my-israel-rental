"""Service areas: multiple cities, or the whole country, or both.

THE BUG THIS EXISTS TO PREVENT is not a crash. `businesses.areas` was a
real field, accepted on create and patch, returned in the public view —
and search read `gigs.area` instead. So a business could list six cities,
save successfully, see them on its own page, and appear in none of those
city filters. Nothing errored. The only symptom was an owner wondering
why nobody called.

That failure mode comes back the moment the location filter stops
consulting the business, so `test_location_filter_*` reads the query the
route actually builds rather than trusting the comment above it.

Everything here is pure: the normaliser is a function, and the filter is
asserted against the source of the route that builds it. No server, no
database.
"""
import inspect
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.marketplace import gigs  # noqa: E402
from routes.marketplace.shared import (  # noqa: E402
    LOCATIONS,
    MAX_SERVICE_AREAS,
    normalize_service_areas,
    service_area_labels,
)


# --------------------------------------------------------------------------
# Normalising
# --------------------------------------------------------------------------

def test_slugs_pass_through():
    assert normalize_service_areas(["jerusalem", "haifa"]) == ["jerusalem", "haifa"]


def test_display_labels_become_slugs():
    """The stored-but-unmatchable case that motivated the normaliser."""
    assert normalize_service_areas(["Tel Aviv", "Bet Shemesh"]) == ["tel-aviv", "bet-shemesh"]


def test_mixed_forms_and_casing():
    assert normalize_service_areas(["JERUSALEM", "Tel Aviv", "haifa"]) == [
        "jerusalem", "tel-aviv", "haifa",
    ]


def test_unknown_cities_are_dropped_not_stored():
    """Storing them would recreate the invisible-value bug exactly."""
    assert normalize_service_areas(["jerusalem", "Atlantis", "Ramat Gan"]) == ["jerusalem"]


def test_order_is_preserved():
    """The owner's page lists them in the order they picked."""
    assert normalize_service_areas(["haifa", "jerusalem", "ashdod"]) == [
        "haifa", "jerusalem", "ashdod",
    ]


def test_duplicates_collapse():
    assert normalize_service_areas(["jerusalem", "Jerusalem", "JERUSALEM"]) == ["jerusalem"]


def test_capped():
    every = [loc["slug"] for loc in LOCATIONS]
    assert len(every) > MAX_SERVICE_AREAS, "catalogue must exceed the cap for this to mean anything"
    assert len(normalize_service_areas(every)) == MAX_SERVICE_AREAS


@pytest.mark.parametrize("junk", [None, [], [""], ["   "], [None], [5], [{"a": 1}], [["nested"]]])
def test_junk_never_raises(junk):
    """This runs on user input from a public API; it must not throw."""
    assert normalize_service_areas(junk) == []


def test_empty_list_is_distinct_from_none():
    """[] means "clear it" — how an owner who moved premises drops a city."""
    assert normalize_service_areas([]) == []
    assert normalize_service_areas(None) == []


def test_labels_round_trip():
    assert service_area_labels(["jerusalem", "tel-aviv"]) == ["Jerusalem", "Tel Aviv"]


def test_labels_skip_unknown_slugs():
    assert service_area_labels(["jerusalem", "atlantis"]) == ["Jerusalem"]


# --------------------------------------------------------------------------
# The location filter
# --------------------------------------------------------------------------

def _list_gigs_source() -> str:
    """The route body, with comments stripped.

    Stripped because an earlier test in this repo asserted a substring
    was absent and matched its own explanatory comment instead of the
    code — passing while the behaviour it described was broken.
    """
    src = inspect.getsource(gigs.list_gigs)
    return "\n".join(
        re.sub(r"#.*$", "", line) for line in src.splitlines()
    )


def test_location_filter_consults_the_business():
    """The whole point: `areas` and `serves_nationwide` must be read."""
    src = _list_gigs_source()
    assert "db.businesses.find" in src, (
        "the location filter no longer looks at businesses — a business's "
        "service areas are unmatchable again"
    )
    assert '"areas": location' in src or "'areas': location" in src, (
        "the business lookup no longer filters on `areas`"
    )
    assert "serves_nationwide" in src, (
        "nationwide businesses are no longer matched by the city filter"
    )


def test_location_filter_still_matches_the_gigs_own_area():
    """Backwards compatibility: gigs with no business must still match."""
    src = _list_gigs_source()
    assert '"area": {"$regex"' in src, (
        "the gig's own `area` is no longer matched — every listing without "
        "a business would vanish from city filters"
    )


def test_location_filter_composes_with_the_text_search():
    """`q` builds its own $or; a second top-level $or would clobber it."""
    src = _list_gigs_source()
    assert 'query["$and"] = query.get("$and", []) + [{"$or": location_clauses}]' in src, (
        "the location clauses are no longer nested under $and — if this "
        "became query['$or'] it would silently overwrite the text search"
    )


def test_unknown_location_is_still_rejected():
    src = _list_gigs_source()
    assert "Unknown location" in src


# --------------------------------------------------------------------------
# The document shape
# --------------------------------------------------------------------------

def test_new_businesses_default_to_not_nationwide():
    """A claim nobody made must never be on by default."""
    from utils.businesses import new_business_doc

    doc = new_business_doc("u1", "Test", slug="test")
    assert doc["serves_nationwide"] is False
    assert doc["areas"] == []


def test_nationwide_and_cities_are_independent():
    """A Jerusalem shop that ships countrywide is BOTH, not either/or."""
    from utils.businesses import new_business_doc

    doc = new_business_doc("u1", "Test", slug="test", areas=["jerusalem"])
    doc["serves_nationwide"] = True
    assert doc["areas"] == ["jerusalem"]
    assert doc["serves_nationwide"] is True


# --------------------------------------------------------------------------
# Nationwide with NO cities
# --------------------------------------------------------------------------
# A courier or an online shop has no "base city" worth naming. Every layer
# has to survive `areas == []` with `serves_nationwide == True`, and each
# one is a separate chance to have written `if areas:` somewhere and
# quietly dropped the business out of every search.

def test_nationwide_with_no_cities_is_a_valid_state():
    from utils.businesses import new_business_doc

    doc = new_business_doc("u1", "Courier", slug="courier", areas=[])
    doc["serves_nationwide"] = True
    assert doc["areas"] == []
    assert doc["serves_nationwide"] is True


def test_normaliser_does_not_require_a_city():
    """No floor of one. Empty is a legitimate answer, not a failure."""
    assert normalize_service_areas([]) == []


def test_search_matches_nationwide_regardless_of_areas():
    """The business lookup is an $or, so `areas` being empty cannot
    exclude a nationwide business from a city filter."""
    src = _list_gigs_source()
    assert '{"$or": [{"areas": location}, {"serves_nationwide": True}]}' in src, (
        "the business lookup is no longer an $or — a nationwide business "
        "with no cities listed would match no city filter at all"
    )


def test_nothing_requires_areas_alongside_nationwide():
    """No cross-validation anywhere: the two fields are independent."""
    from routes.marketplace import businesses as biz_routes

    src = inspect.getsource(biz_routes.update_business)
    stripped = "\n".join(re.sub(r"#.*$", "", ln) for ln in src.splitlines())
    # A guard like `if serves_nationwide and not areas: raise` would show
    # up as the two names in one conditional. There must not be one.
    for line in stripped.splitlines():
        if "serves_nationwide" in line and "areas" in line:
            pytest.fail(f"areas and serves_nationwide are cross-validated: {line.strip()!r}")


# --------------------------------------------------------------------------
# Job notifications
# --------------------------------------------------------------------------
# A posted job emails providers. That fan-out used to match on CATEGORY
# ALONE — so a Jerusalem-only plumber was told about every Haifa job, and
# nothing a business said about covering the country made any difference
# because nothing read it.
#
# Narrowing it is the fix, and it is also the danger: filter too eagerly
# and businesses silently stop receiving the work they get today, with
# nothing anywhere saying why. The fallbacks below are the whole safety
# argument, so they are asserted rather than trusted.

def _reaching_source() -> str:
    from routes.marketplace import jobs

    src = inspect.getsource(jobs._providers_reaching_area)
    return "\n".join(re.sub(r"#.*$", "", ln) for ln in src.splitlines())


def test_job_notifications_consult_service_areas():
    from routes.marketplace import jobs

    src = "\n".join(
        re.sub(r"#.*$", "", ln)
        for ln in inspect.getsource(jobs._notify_matching_providers).splitlines()
    )
    assert "_providers_reaching_area" in src, (
        "job notifications no longer filter by service area — nationwide and "
        "multi-city businesses are back to being indistinguishable from anyone else"
    )


def test_nationwide_businesses_are_kept():
    src = _reaching_source()
    assert "nationwide or (areas & job_slugs)" in src, (
        "a nationwide business is no longer matched to jobs outside its listed cities"
    )


def test_businesses_that_never_set_an_area_are_not_cut_off():
    """The migration-safety clause. Most businesses predate the picker."""
    src = _reaching_source()
    assert "uid not in configured" in src, (
        "businesses that have not set a service area would now be filtered out — "
        "they would silently stop receiving the jobs they get today"
    )


def test_an_unplaceable_job_area_notifies_everyone():
    """"Ramat Gan" is not in the catalogue. Guessing would cut off every
    provider working in a town the catalogue does not list yet."""
    src = _reaching_source()
    assert "if not job_slugs:" in src and "return provider_ids" in src, (
        "a job whose area matches no catalogue city no longer falls back to "
        "notifying everyone"
    )


def test_free_text_area_maps_to_catalogue_cities():
    from routes.marketplace.shared import service_area_slugs_in_text as f

    assert f("Tel Aviv, Florentin") == ["tel-aviv"]
    assert f("jerusalem") == ["jerusalem"]
    assert f("Near Haifa") == ["haifa"]


def test_unplaceable_text_returns_empty_not_a_guess():
    from routes.marketplace.shared import service_area_slugs_in_text as f

    assert f("Ramat Gan") == []
    assert f("up north") == []
    assert f("") == []
    assert f(None) == []


# --------------------------------------------------------------------------
# _providers_reaching_area — BEHAVIOUR, not source
# --------------------------------------------------------------------------
# Everything above this line reads source text. That catches a deletion but
# it cannot catch wrong logic: an `&` that should be `|`, a fallback that
# inverts, a set built from the wrong side. These run the real function
# against a stubbed collection and assert who actually comes back.

class _FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def __aiter__(self):
        async def gen():
            for d in self._docs:
                yield d
        return gen()


class _FakeBusinesses:
    def __init__(self, docs):
        self._docs = docs

    def find(self, query, projection=None):
        wanted = query["owner_user_id"]["$in"]
        return _FakeCursor([d for d in self._docs if d["owner_user_id"] in wanted])


class _FakeDb:
    def __init__(self, docs):
        self.businesses = _FakeBusinesses(docs)


async def _reaching(monkeypatch, docs, provider_ids, job_area):
    from routes.marketplace import jobs

    monkeypatch.setattr(jobs, "db", _FakeDb(docs))
    return await jobs._providers_reaching_area(provider_ids, job_area)


def _biz(uid, areas=None, nationwide=False):
    return {"owner_user_id": uid, "areas": areas or [], "serves_nationwide": nationwide}


@pytest.mark.asyncio
async def test_reaching_keeps_the_business_in_that_city(monkeypatch):
    got = await _reaching(
        monkeypatch,
        [_biz("in-city", ["jerusalem"]), _biz("elsewhere", ["haifa"])],
        ["in-city", "elsewhere"],
        "Jerusalem",
    )
    assert got == ["in-city"]


@pytest.mark.asyncio
async def test_reaching_keeps_a_nationwide_business_anywhere(monkeypatch):
    got = await _reaching(
        monkeypatch,
        [_biz("courier", [], nationwide=True), _biz("local", ["haifa"])],
        ["courier", "local"],
        "Beersheba",
    )
    assert got == ["courier"], "a nationwide business must match every city"


@pytest.mark.asyncio
async def test_reaching_keeps_a_multi_city_business_on_any_of_its_cities(monkeypatch):
    docs = [_biz("multi", ["jerusalem", "bet-shemesh", "modiin"])]
    for city in ("Jerusalem", "Bet Shemesh", "Modiin"):
        assert await _reaching(monkeypatch, docs, ["multi"], city) == ["multi"], city
    assert await _reaching(monkeypatch, docs, ["multi"], "Haifa") == []


@pytest.mark.asyncio
async def test_reaching_keeps_businesses_that_never_set_an_area(monkeypatch):
    """The migration-safety clause, proven rather than asserted in source."""
    got = await _reaching(
        monkeypatch,
        [_biz("unset"), _biz("wrong-city", ["haifa"])],
        ["unset", "wrong-city"],
        "Jerusalem",
    )
    assert got == ["unset"]


@pytest.mark.asyncio
async def test_reaching_keeps_a_provider_with_no_business_row_at_all(monkeypatch):
    """Gigs can exist without a business. They must not lose their jobs."""
    got = await _reaching(monkeypatch, [], ["orphan"], "Jerusalem")
    assert got == ["orphan"]


@pytest.mark.asyncio
async def test_reaching_returns_everyone_for_an_unplaceable_area(monkeypatch):
    got = await _reaching(
        monkeypatch,
        [_biz("a", ["jerusalem"]), _biz("b", ["haifa"])],
        ["a", "b"],
        "Ramat Gan",
    )
    assert got == ["a", "b"], "an unplaceable job must not silently notify nobody"


@pytest.mark.asyncio
async def test_reaching_handles_a_free_text_area(monkeypatch):
    got = await _reaching(
        monkeypatch,
        [_biz("tlv", ["tel-aviv"]), _biz("jlm", ["jerusalem"])],
        ["tlv", "jlm"],
        "Tel Aviv, Florentin",
    )
    assert got == ["tlv"]


@pytest.mark.asyncio
async def test_reaching_matches_a_second_business_of_the_same_owner(monkeypatch):
    """Someone with two businesses is reachable through either."""
    got = await _reaching(
        monkeypatch,
        [_biz("owner", ["haifa"]), _biz("owner", ["jerusalem"])],
        ["owner"],
        "Jerusalem",
    )
    assert got == ["owner"]


@pytest.mark.asyncio
async def test_reaching_preserves_input_order_and_never_duplicates(monkeypatch):
    got = await _reaching(
        monkeypatch,
        [_biz("a", ["jerusalem"]), _biz("a", ["jerusalem"]), _biz("b", [], True)],
        ["b", "a"],
        "Jerusalem",
    )
    assert got == ["b", "a"]

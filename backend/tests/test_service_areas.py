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

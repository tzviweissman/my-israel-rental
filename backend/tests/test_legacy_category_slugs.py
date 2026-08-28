"""Legacy category slugs still resolve at read time (spec L4).

WHY THIS TEST EXISTS, SPECIFICALLY
----------------------------------
`_normalize_category` was written so an old bookmark keeps working, and a
comment above it in `shared.py` said so plainly. It was called from
nowhere. `list_gigs` validated first, so `/marketplace/gigs?category=
photography` — a URL somebody could have shared a year ago — answered 400.

A comment claiming behaviour is not the behaviour. This asserts it against
the real route, so the next person to reorder those two calls finds out
here rather than from somebody whose link stopped working.

Two layers, on purpose:

  * the pure mapping, which needs no server and cannot be skipped
  * the actual HTTP endpoint, which is where the bug lived — the helper
    was always correct in isolation
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.marketplace.shared import (  # noqa: E402
    CATEGORY_MIGRATION,
    _normalize_category,
    _validate_category,
)


# --------------------------------------------------------------------------
# The mapping itself
# --------------------------------------------------------------------------

@pytest.mark.parametrize("legacy,current", sorted(CATEGORY_MIGRATION.items()))
def test_every_legacy_slug_maps_to_a_real_category(legacy, current):
    """Each old slug resolves, and lands somewhere that actually validates.

    The second half matters more than it looks: a migration entry pointing
    at a category that has since been renamed would still "normalise", and
    then fail validation one line later — turning a 400 into a different
    400 and looking fixed.
    """
    assert _normalize_category(legacy) == current
    _validate_category(current)   # raises if `current` is not a live slug


def test_a_current_slug_is_left_alone():
    assert _normalize_category("cleaning-services") == "cleaning-services"


def test_none_survives():
    """`?category=` absent must stay absent rather than becoming a string."""
    assert _normalize_category(None) is None


def test_an_unknown_slug_is_not_invented_into_something():
    """Normalising must not guess. An unknown slug passes through unchanged
    so validation can reject it honestly."""
    assert _normalize_category("not-a-category") == "not-a-category"


# --------------------------------------------------------------------------
# The route, which is where it was actually broken
# --------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    """One app, started once for the whole module.

    Module-scoped deliberately. A TestClient context manager fires the
    app's startup event, which spawns the background loops; entering it
    once per parametrised case started nine copies of them and the later
    cases failed on the contention rather than on anything about
    categories. One client, one startup, nine requests.
    """
    fastapi_testclient = pytest.importorskip(
        "fastapi.testclient",
        reason="fastapi.testclient (httpx) not installed",
    )
    import server  # noqa: E402  — imported late so the skip above can fire

    with fastapi_testclient.TestClient(server.app) as c:
        yield c


@pytest.mark.parametrize("legacy", sorted(CATEGORY_MIGRATION))
def test_legacy_category_url_does_not_400(client, legacy):
    """`/marketplace/gigs?category=<legacy>` returns a list, not a 400.

    Against the app rather than a live server, so it runs with no network
    and no seeded data. An empty list is a pass: the assertion is that the
    URL is ACCEPTED, not that anything is published in that category today.
    """
    res = client.get(f"/api/marketplace/gigs?category={legacy}")

    assert res.status_code != 400, (
        f"legacy category '{legacy}' was rejected: {res.text[:200]}. "
        "Every bookmark and shared link using it is a hard error."
    )
    assert res.status_code == 200, res.text
    assert isinstance(res.json(), list)


def test_a_current_slug_still_works_through_the_route(client):
    """The normaliser must not have broken the ordinary case."""
    res = client.get("/api/marketplace/gigs?category=cleaning-services")
    assert res.status_code == 200, res.text


def test_a_nonsense_category_is_still_rejected(client):
    """Normalising is not the same as accepting anything. An unknown slug
    must still 400 — otherwise a typo silently returns the whole board."""
    res = client.get("/api/marketplace/gigs?category=not-a-category")
    assert res.status_code == 400, res.text

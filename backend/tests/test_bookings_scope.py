"""GET /bookings must never return someone else's bookings.

The handler built its filter as `query = {}` and narrowed it only for
renter / owner / manager. Every other role — provider, admin, and anything
added later — fell through with an empty filter, which in Mongo means "match
everything". A brand-new provider account, created to test subscriptions,
opened its dashboard to a full list of strangers' bookings: guest names,
dates, prices, properties.

Nothing failed. An empty filter is a perfectly valid query.

These tests pin the property that actually matters — the filter is never
unscoped — rather than the specific shape, so a future refactor is free to
change the query as long as it still constrains to the caller.
"""
from __future__ import annotations

import pytest

from routes.bookings.crud import bookings_scope_query

USER = "user-123"

# Every role the app can currently issue a token for, plus one that doesn't
# exist yet — the point is that an unrecognised role is safe by default.
ALL_ROLES = ["renter", "owner", "manager", "provider", "admin", "something-new", None, ""]


def _mentions_only(query: dict, user_id: str) -> bool:
    """True when every leaf value in the filter is this user's id."""
    values: list = []

    def walk(node) -> None:
        if isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
        else:
            values.append(node)

    walk(query)
    return bool(values) and all(v == user_id for v in values)


@pytest.mark.parametrize("role", ALL_ROLES)
def test_query_is_never_empty(role) -> None:
    """An empty filter matches every document in the collection."""
    query = bookings_scope_query(role, USER)
    assert query, (
        f"role {role!r} produced an empty filter — that returns EVERY booking "
        f"in the database, not just this user's."
    )


@pytest.mark.parametrize("role", ALL_ROLES)
def test_query_only_ever_references_the_caller(role) -> None:
    query = bookings_scope_query(role, USER)
    assert _mentions_only(query, USER), (
        f"role {role!r} produced {query!r}, which constrains on something "
        f"other than the caller's own id."
    )


def test_owner_and_manager_see_bookings_on_their_properties() -> None:
    for role in ("owner", "manager"):
        assert bookings_scope_query(role, USER) == {"owner_id": USER}


def test_renter_sees_their_own_and_their_subleases() -> None:
    # owner_id on a sublease booking points at the sublessor, who is a
    # renter — so both sides are theirs to see.
    assert bookings_scope_query("renter", USER) == {
        "$or": [{"renter_id": USER}, {"owner_id": USER}],
    }


@pytest.mark.parametrize("role", ["provider", "admin", "something-new", None, ""])
def test_unknown_roles_fall_back_to_self_scoped(role) -> None:
    """The regression itself: these all used to get an unscoped query."""
    assert bookings_scope_query(role, USER) == bookings_scope_query("renter", USER)

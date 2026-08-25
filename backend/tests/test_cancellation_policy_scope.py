"""A listing only carries a cancellation policy if its owner was asked.

``PropertyCreate`` defaults ``cancellation_policy`` to ``'flexible'``, but
only vacation and short-term owners are ever shown the field. Every other
listing therefore stored a refund promise nobody made — invisible until the
booking sidebar started printing the policy under the reserve button.

These are pure unit tests over the normalizer: no database, no server, so
they run in milliseconds and cannot be skipped for want of credentials.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.properties.shared import (  # noqa: E402
    _CANCELLATION_ASKED_TYPES,
    _strip_unasked_cancellation_policy,
)


def _doc(rental_type, policy="flexible", custom="whatever the owner typed"):
    return {
        "rental_type": rental_type,
        "cancellation_policy": policy,
        "custom_cancellation_policy": custom,
        "title": "untouched",
    }


@pytest.mark.parametrize("rental_type", sorted(_CANCELLATION_ASKED_TYPES))
def test_asked_types_keep_their_policy(rental_type):
    doc = _doc(rental_type)
    removed = _strip_unasked_cancellation_policy(doc)
    assert removed == []
    assert doc["cancellation_policy"] == "flexible"
    assert doc["custom_cancellation_policy"] == "whatever the owner typed"


@pytest.mark.parametrize("rental_type", ["long-term", "sublease", "storage", None])
def test_unasked_types_lose_their_policy(rental_type):
    doc = _doc(rental_type)
    removed = _strip_unasked_cancellation_policy(doc)

    assert "cancellation_policy" not in doc
    assert "custom_cancellation_policy" not in doc
    # The caller needs these names to `$unset` the stored value — the edit
    # path writes a full `$set`, so dropping the key only stops it being
    # re-written and would leave the old value in place.
    assert set(removed) == {"cancellation_policy", "custom_cancellation_policy"}
    assert doc["title"] == "untouched", "stripped an unrelated field"


def test_switching_a_listing_to_long_term_sheds_the_policy():
    """A vacation listing legitimately has one. Change its type and it
    should not keep a promise that no longer belongs to it."""
    doc = _doc("vacation")
    assert _strip_unasked_cancellation_policy(doc) == []

    doc["rental_type"] = "long-term"
    assert _strip_unasked_cancellation_policy(doc)
    assert "cancellation_policy" not in doc


def test_is_idempotent():
    doc = _doc("long-term")
    _strip_unasked_cancellation_policy(doc)
    # Second pass on an already-clean doc must still report the keys, so a
    # repeated edit keeps `$unset`-ing rather than silently leaving a value
    # that an older client just re-sent.
    assert _strip_unasked_cancellation_policy(doc)
    assert "cancellation_policy" not in doc

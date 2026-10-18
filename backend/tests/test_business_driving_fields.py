"""The driver facts: Shabbat, the vehicle, and transportation subcategories.

Added 18 Oct 2026, before approaching taxi and driver businesses.

WHY these four checks and not others. Three of them guard a failure this
file's neighbours have already paid for:

  * `_public` must carry both new fields. BusinessDetailsForm sends every
    field it knows on save and the API clears a null, so a field the
    dashboard payload omits opens blank in the form and is then wiped by
    an owner who came to fix a typo. That is not hypothetical here - the
    comment above the block in businesses.py exists because hours and
    languages were lost that way.
  * An empty vehicle must store as null, not as a row of falses. Every
    surface tests presence to decide whether a row exists, so a vehicle
    of all-defaults would print an empty "Vehicle" label on every
    business that never answered.
  * Shabbat must refuse anything outside the three answers, because the
    page maps the value to a sentence and an unmapped value would say
    nothing while reading as answered.

Pure model and dict work. No database, no API, no network.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from routes.marketplace.businesses import SHABBAT, BusinessPatch, Vehicle, _public  # noqa: E402
from routes.marketplace.shared import SUBCATEGORIES, _validate_subcategory  # noqa: E402


# ------------------------------------------------------------ Shabbat

def test_shabbat_accepts_the_three_answers():
    for answer in SHABBAT:
        assert BusinessPatch(shabbat=answer).shabbat == answer


def test_shabbat_refuses_anything_else():
    # "yes"/"no" are the plausible wrong guesses from a second client.
    for bad in ("yes", "no", "true", "Closed", "shabbos"):
        with pytest.raises(ValidationError):
            BusinessPatch(shabbat=bad)


def test_shabbat_unanswered_is_none_not_closed():
    """A business that has not said is NOT shut: showing it as closed on a
    day it works would cost it the booking."""
    assert BusinessPatch().shabbat is None
    assert "closed" != BusinessPatch().shabbat


# ------------------------------------------------------------ vehicle

def test_empty_vehicle_is_empty():
    assert Vehicle().is_empty()
    # Whitespace in the free-text field is not an answer either.
    assert Vehicle(luggage="   ").is_empty()
    # Unticked boxes are the default, so a form that sends all four
    # untouched must still count as nothing said.
    assert Vehicle(seats=None, luggage=None, accessible=False, child_seat=False).is_empty()


def test_any_single_answer_makes_a_vehicle():
    assert not Vehicle(seats=6).is_empty()
    assert not Vehicle(luggage="2 large cases").is_empty()
    assert not Vehicle(accessible=True).is_empty()
    assert not Vehicle(child_seat=True).is_empty()


def test_seat_count_bounds():
    with pytest.raises(ValidationError):
        Vehicle(seats=0)
    with pytest.raises(ValidationError):
        Vehicle(seats=61)
    assert Vehicle(seats=1).seats == 1
    assert Vehicle(seats=60).seats == 60


# --------------------------------------------------- the payload the form reads

def _doc(**extra):
    return {"_id": "b1", "owner_user_id": "u1", "name": "Zion Taxi", **extra}


def test_public_carries_both_fields_so_the_form_does_not_wipe_them():
    veh = {"seats": 6, "luggage": "2 large cases", "accessible": True, "child_seat": False}
    out = _public(_doc(shabbat="by_arrangement", vehicle=veh), 0)
    assert out["shabbat"] == "by_arrangement"
    assert out["vehicle"] == veh


def test_public_reports_unanswered_as_none():
    out = _public(_doc(), 0)
    # Present as keys - the form needs to see them to initialise - and
    # null, which is what "not said" means on both.
    assert "shabbat" in out and out["shabbat"] is None
    assert "vehicle" in out and out["vehicle"] is None


# ------------------------------------------------------ subcategories

def test_transportation_has_subcategories():
    """A taxi stand and a wedding chauffeur were sharing one bucket."""
    slugs = {s["slug"] for s in SUBCATEGORIES["transportation"]}
    assert {"taxi", "airport-transfer", "chauffeur"} <= slugs
    for entry in SUBCATEGORIES["transportation"]:
        assert entry["label"] and entry["slug"] == entry["slug"].lower()


def test_transportation_subcategory_validates():
    _validate_subcategory("transportation", "airport-transfer")   # known
    _validate_subcategory("transportation", None)                 # optional
    _validate_subcategory("transportation", "sherut to eilat")    # long tail
    with pytest.raises(HTTPException):
        _validate_subcategory("transportation", "<script>")


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))

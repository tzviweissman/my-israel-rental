"""The business's own questions on the enquiry form.

Added 18 Oct 2026. Almaxpress tells customers on WhatsApp to send "date,
time, destination, passenger count"; our quote form asked for none of it.
Rather than add four driver fields to QuoteIn, the `quote` form joins the
two that custom_fields.py already served, so a driver asks for the pick-up
time and a mover asks which floor.

WHY these checks. The mechanism is shared with membership sign-ups and
store orders, so the risk is not in the field types, which those two
already exercise. It is in the wiring:

  * a required question must actually stop the request, or the form is
    decoration;
  * answers must be stored WITH a copy of the question, because a driver
    who renames "How many passengers?" next month must not silently
    change what last month's customer was asked;
  * each form must map to the right staff permission, or someone with
    till access can rewrite the enquiry form.

Pure model and dict work. No database, no API, no network.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from routes.marketplace.custom_fields import (  # noqa: E402
    FORM_PERM,
    FORMS,
    answers_text,
    check_answers,
    public_fields,
)
from routes.marketplace.quotes import QuoteIn  # noqa: E402


def _driver_biz():
    """A driver's four questions, in the order Almaxpress asks for them."""
    return {"custom_fields": {"quote": [
        {"id": "pickup", "label": "Pick-up time", "type": "text", "required": True, "options": [], "help": None},
        {"id": "pax", "label": "How many passengers?", "type": "number", "required": True, "options": [], "help": None},
        {"id": "flight", "label": "Flight number", "type": "text", "required": False, "options": [], "help": None},
        {"id": "seat", "label": "Child seat needed", "type": "checkbox", "required": False, "options": [], "help": None},
    ]}}


# ------------------------------------------------------------- wiring

def test_quote_is_a_form():
    assert "quote" in FORMS


def test_every_form_maps_to_a_permission():
    """A missing entry would be a KeyError on save; a wrong one would let
    the wrong member of staff rewrite the form."""
    assert set(FORM_PERM) == set(FORMS)
    assert FORM_PERM["quote"] == "job-requests"


def test_quote_in_accepts_answers():
    q = QuoteIn(description="Airport run on Thursday", name="Dani", phone="0501234567",
                answers={"pax": "4"})
    assert q.answers == {"pax": "4"}


def test_quote_in_defaults_to_no_answers():
    """A business with no questions, and every older client, send none."""
    assert QuoteIn(description="Airport run on Thursday", name="Dani", phone="0501234567").answers == {}


# ------------------------------------------------------------ answering

def test_a_business_with_no_questions_asks_nothing():
    assert check_answers({}, "quote", {"pax": "4"}) == []
    assert public_fields({}, "quote") == []


def test_required_question_stops_the_request():
    with pytest.raises(HTTPException) as e:
        check_answers(_driver_biz(), "quote", {"pax": "4"})
    # The question's own wording, so the customer knows which answer is missing.
    assert "Pick-up time" in e.value.detail
    assert e.value.status_code == 400


def test_answers_are_stored_with_a_copy_of_the_question():
    out = check_answers(_driver_biz(), "quote",
                        {"pickup": "05:00", "pax": "4", "seat": True})
    by_id = {a["id"]: a for a in out}
    assert by_id["pickup"]["label"] == "Pick-up time"
    assert by_id["pax"]["value"] == "4"
    assert by_id["seat"]["value"] is True
    # Unanswered and not required: left out entirely rather than stored blank.
    assert "flight" not in by_id


def test_a_number_question_refuses_words():
    with pytest.raises(HTTPException) as e:
        check_answers(_driver_biz(), "quote", {"pickup": "05:00", "pax": "a few"})
    assert "How many passengers?" in e.value.detail


def test_answers_read_as_lines_for_the_email():
    """The owner's email says the pick-up time, rather than leaving it in
    the dashboard behind a click."""
    text = answers_text(check_answers(_driver_biz(), "quote",
                                      {"pickup": "05:00", "pax": "4", "seat": True}))
    assert "Pick-up time: 05:00" in text
    assert "Child seat needed: Yes" in text


def test_answers_to_retired_questions_are_dropped():
    """The driver deleted "Flight number"; an old form still sends it."""
    out = check_answers(_driver_biz(), "quote",
                        {"pickup": "05:00", "pax": "4", "ghost": "anything"})
    assert all(a["id"] != "ghost" for a in out)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))

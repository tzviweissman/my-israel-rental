"""Reading a business's own price list into product rows.

Added 18 Oct 2026, after a meat-board business said the reason it had not
listed was ten products' worth of typing and ten trips to the camera roll.

WHY THESE CHECKS. The model's output is about to be shown to the owner as
their own data and then saved as prices customers pay. So the parser's job
is not to be clever, it is to refuse anything it is not sure of:

  * a price it cannot read becomes blank, never a guess. A blank price is
    obvious on screen; a wrong one is not, and it is the one mistake here
    that costs the owner money;
  * a row with no name is not a product, whatever else it has;
  * the cap holds whatever the model returns, because the form has one too
    and a longer list would silently lose the tail.

The prompt itself (skip headings, phone numbers and delivery terms; keep
the source language; never invent a description) is checked against a real
model in the browser, not here. These are the guards that must hold even
when the model does something unexpected.

Pure parsing. No network, no model call, no database.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from routes.marketplace.product_extract import MAX_PRODUCTS, _rows  # noqa: E402


def _reply(products):
    return json.dumps({"products": products})


# ------------------------------------------------------------- the happy path

def test_reads_a_plain_list():
    out = _rows(_reply([
        {"name": "Classic board", "price": 180, "currency": "ILS", "description": "Serves 6-8"},
        {"name": "מגש משפחתי", "price": 280, "currency": "ILS", "description": ""},
    ]))
    assert [p["name"] for p in out] == ["Classic board", "מגש משפחתי"]
    assert out[0]["price"] == 180
    assert out[0]["description"] == "Serves 6-8"
    # The source language is kept. Translating a business's own product
    # names is not ours to do.
    assert out[1]["name"] == "מגש משפחתי"


def test_survives_the_model_fencing_its_json():
    out = _rows("```json\n" + _reply([{"name": "Board", "price": 90, "currency": "ILS"}]) + "\n```")
    assert out[0]["name"] == "Board"


def test_survives_a_sentence_around_the_json():
    out = _rows("Here are the products:\n" + _reply([{"name": "Board", "price": 90}]) + "\nLet me know.")
    assert out[0]["name"] == "Board"


# ------------------------------------------------------------- the refusals

def test_an_unreadable_price_becomes_blank_not_a_guess():
    """The one mistake here that costs real money. Blank is visible on the
    form; wrong is not."""
    for bad in (None, "", "about 200", "180-220", {}, []):
        out = _rows(_reply([{"name": "Board", "price": bad}]))
        assert out[0]["price"] is None, f"{bad!r} should not become a price"


def test_an_absurd_price_is_refused():
    assert _rows(_reply([{"name": "Board", "price": 0}]))[0]["price"] is None
    assert _rows(_reply([{"name": "Board", "price": -5}]))[0]["price"] is None
    assert _rows(_reply([{"name": "Board", "price": 9_000_000}]))[0]["price"] is None


def test_a_row_with_no_name_is_not_a_product():
    out = _rows(_reply([{"name": "", "price": 100}, {"price": 50}, {"name": "   ", "price": 10}]))
    assert out == []


def test_currency_defaults_to_shekels():
    """An Israeli price list with no symbol is shekels. USD only when the
    model actually saw a dollar."""
    assert _rows(_reply([{"name": "A", "price": 1}]))[0]["currency"] == "ILS"
    assert _rows(_reply([{"name": "A", "price": 1, "currency": "eur"}]))[0]["currency"] == "ILS"
    assert _rows(_reply([{"name": "A", "price": 1, "currency": "usd"}]))[0]["currency"] == "USD"


def test_the_cap_holds():
    out = _rows(_reply([{"name": f"Board {i}", "price": i + 1} for i in range(MAX_PRODUCTS + 20)]))
    assert len(out) == MAX_PRODUCTS


def test_long_values_are_cut_not_dropped():
    out = _rows(_reply([{"name": "x" * 400, "price": 10, "description": "y" * 900}]))
    assert len(out[0]["name"]) == 60
    assert len(out[0]["description"]) == 300


def test_junk_is_refused_rather_than_half_read():
    """A reply we cannot parse must say so. Returning an empty list would
    look to the owner like "your price list has no products in it"."""
    for junk in ("", "I could not read the image.", "{not json"):
        with pytest.raises(HTTPException) as e:
            _rows(junk)
        assert e.value.status_code == 502


def test_a_reply_with_no_products_key_is_empty_not_an_error():
    """Well-formed, nothing found. The endpoint turns this into its own
    "no products in that" message, which says what to do next."""
    assert _rows(json.dumps({"products": []})) == []
    assert _rows(json.dumps({"other": 1})) == []


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))

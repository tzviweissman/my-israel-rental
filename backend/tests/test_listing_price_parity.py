"""The server prices listings exactly as the website does.

Both copies of "which price does this listing show" - utils/listing_price.py
here, frontend/src/utils/listingPrice.js on the website - are held to the
same cases in shared/listing_price_cases.json. If this fails, the Smart List
a customer receives would say something different from the listing card
they click through to. Pure: no API or database needed.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from utils.listing_price import price_label, shown_price  # noqa: E402

CASES = json.loads((ROOT.parent / "shared" / "listing_price_cases.json").read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_same_answer_as_the_website(case):
    assert shown_price(case["property"], case.get("holiday")) == case["expected"]


def test_the_message_wording():
    sukkot_night = shown_price({"rental_type": "vacation", "holiday_lump_price": 154,
                                "holiday_lump_is_per_night": True, "holiday_tags": ["sukkot"]})
    assert price_label(sukkot_night) == "/night (Sukkot)"
    assert price_label(shown_price({"rental_type": "vacation", "holiday_lump_price": 6000,
                                    "holiday_tags": ["sukkot"]})) == "/ Sukkot"
    assert price_label(shown_price({"rental_type": "long-term", "monthly_price": 7000})) == "/mo"
    assert price_label(None) == ""

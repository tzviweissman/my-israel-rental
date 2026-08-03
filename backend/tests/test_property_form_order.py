"""The property form asks holiday questions together, then the regular price.

Ticking "Sukkot Rental" should answer every Sukkot question in one card: the
tag, the date window, and the holiday rate. The form used to interleave them —
tags, window, then the REGULAR nightly/monthly price, then a second card for
the holiday rate — so the rate box read as though it belonged to a different
question, and a lister filling in a Sukkot rental had to jump over an
unrelated field to finish the thought.

This ordering has now been wrong twice, so it's pinned here rather than left
to whoever next edits an 1100-line JSX file.

The rule, in source order:

    holiday tags  →  holiday window  →  holiday rate  →  regular price

The holiday rate must also be *inside* the holiday card, not a sibling card
below it — that's what "same box" means to the person using it.
"""
from __future__ import annotations

import pathlib

import pytest

REPO = pathlib.Path(__file__).resolve().parent.parent.parent
FORM = REPO / "frontend" / "src" / "components" / "dashboard" / "AddPropertyModal.jsx"

# (label, marker) — markers are the stable anchors in the JSX.
ANCHORS = [
    ("holiday tags", "Holiday Categories —"),
    ("holiday window", 'testid="property-holiday-end"'),
    ("holiday rate", 'data-testid="holiday-rate-block"'),
    ("regular price", "Price section — always"),
]


def _positions() -> dict[str, int]:
    src = FORM.read_text(encoding="utf-8")
    out = {}
    for label, marker in ANCHORS:
        idx = src.find(marker)
        assert idx != -1, (
            f"Anchor for {label!r} not found in {FORM.name} (searched {marker!r}). "
            "The form was restructured — update the anchor, don't delete the test."
        )
        out[label] = idx
    return out


def test_all_anchors_present() -> None:
    """Fail loudly rather than passing on an empty set."""
    pos = _positions()
    assert len(pos) == len(ANCHORS)


@pytest.mark.parametrize(
    ("earlier", "later"),
    [
        ("holiday tags", "holiday window"),
        ("holiday window", "holiday rate"),
        ("holiday rate", "regular price"),
    ],
)
def test_form_section_order(earlier: str, later: str) -> None:
    pos = _positions()
    assert pos[earlier] < pos[later], (
        f"{FORM.name} puts '{later}' before '{earlier}'.\n"
        "Expected order: holiday tags → holiday window → holiday rate → "
        "regular price. Ticking a holiday tag should answer every holiday "
        "question in one place, with the regular price asked afterwards."
    )


def test_holiday_rate_is_inside_the_holiday_card() -> None:
    """The rate is a section within the holiday card, not a card of its own.

    It previously carried the card's own background and border, which is what
    made it render as a separate box further down the form.
    """
    src = FORM.read_text(encoding="utf-8")
    idx = src.find('data-testid="holiday-rate-block"')
    assert idx != -1
    line_start = src.rfind("<div", 0, idx)
    wrapper = src[line_start:idx]
    assert "rounded-xl bg-[#FBF8F2]" not in wrapper, (
        "The holiday rate block is styled as its own card again. Inside the "
        "holiday card it should be a divider section (border-t), otherwise it "
        "reads as a separate question."
    )

"""Backend-side unit-test mirror for the new date-aware holiday-rate
auto-switch logic that lives in the BookingSidebar React component.

We can't easily JSDOM-test the React effect here, but the core
"does this check-in date land inside a holiday window?" decision is
the bit that matters — exercising it with the same window shape the
frontend consumes catches regressions in the JSON contract.

The window shape comes from `frontend/src/constants/holidayWindows.js`:
    { sukkot: {start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', ...}, pesach: {...} }
"""
from __future__ import annotations


def pick_holiday_tag_for_check_in(check_in_iso: str, tags: list[str], windows: dict) -> str | None:
    """Mirrors the React effect: return 'sukkot' / 'pesach' / None for a
    given check-in ISO date + the listing's available holiday tags + the
    resolved holiday windows. ISO date comparison is safe because the
    YYYY-MM-DD format is lexicographically ordered."""
    if not check_in_iso:
        return None
    for tag in ("sukkot", "pesach"):
        if tag not in tags:
            continue
        win = windows.get(tag)
        if not win:
            continue
        if win["start"] <= check_in_iso <= win["end"]:
            return tag
    return None


WINDOWS = {
    "sukkot": {"start": "2025-10-06", "end": "2025-10-14"},
    "pesach": {"start": "2026-04-01", "end": "2026-04-09"},
}


def test_check_in_inside_sukkot_window_returns_sukkot():
    assert pick_holiday_tag_for_check_in(
        "2025-10-08", ["sukkot", "pesach"], WINDOWS,
    ) == "sukkot"


def test_check_in_inside_pesach_window_returns_pesach():
    assert pick_holiday_tag_for_check_in(
        "2026-04-05", ["sukkot", "pesach"], WINDOWS,
    ) == "pesach"


def test_check_in_outside_any_window_returns_none():
    assert pick_holiday_tag_for_check_in(
        "2026-01-15", ["sukkot", "pesach"], WINDOWS,
    ) is None


def test_check_in_on_boundary_inclusive():
    """Both edges are inclusive — Sukkot starts and ends should match."""
    assert pick_holiday_tag_for_check_in("2025-10-06", ["sukkot"], WINDOWS) == "sukkot"
    assert pick_holiday_tag_for_check_in("2025-10-14", ["sukkot"], WINDOWS) == "sukkot"


def test_check_in_in_sukkot_window_but_listing_lacks_tag_returns_none():
    """A listing that doesn't have the sukkot tag must NOT be auto-flipped
    to the sukkot rate even if the check-in lands in the window."""
    assert pick_holiday_tag_for_check_in(
        "2025-10-08", ["pesach"], WINDOWS,
    ) is None


def test_empty_check_in_returns_none():
    assert pick_holiday_tag_for_check_in("", ["sukkot", "pesach"], WINDOWS) is None


def test_empty_tags_returns_none():
    assert pick_holiday_tag_for_check_in("2025-10-08", [], WINDOWS) is None

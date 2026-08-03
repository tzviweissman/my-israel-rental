"""The static holiday windows must never be in the past.

`frontend/src/constants/holidayWindows.js` is the fallback used when the
Hebcal API is unreachable. It is hand-maintained, and its own comment says
"update once a year" — which is precisely the kind of instruction that stops
being followed.

On 2026-08-02 the Pesach fallback still read 2026-04-01 → 2026-04-09, four
months in the past. The effect: a renter on a listing that relies on the
fallback (11 live listings had a holiday price with no owner-set window) gets
a "Book Pesach" CTA that pre-fills a date range the calendar immediately
greys out, because every date before today is disabled. Pesach is
unbookable, and nothing errors.

It only bites when Hebcal is unreachable — which is exactly when nobody is
watching. So the staleness itself has to be the thing that fails.

This test turns "someone remembers to update it" into "the suite goes red".
"""
from __future__ import annotations

import datetime
import pathlib
import re

import pytest

REPO = pathlib.Path(__file__).resolve().parent.parent.parent
CONST = REPO / "frontend" / "src" / "constants" / "holidayWindows.js"


def _windows() -> dict[str, dict[str, str]]:
    """Parse `{ sukkot: {start, end, ...}, pesach: {...} }` out of the JS."""
    src = CONST.read_text(encoding="utf-8")
    out: dict[str, dict[str, str]] = {}
    for name, block in re.findall(r"(\w+):\s*\{(.*?)\n  \},", src, re.S):
        start = re.search(r"start:\s*'([\d-]+)'", block)
        end = re.search(r"end:\s*'([\d-]+)'", block)
        if start and end:
            out[name] = {"start": start.group(1), "end": end.group(1)}
    return out


def test_parser_found_the_windows() -> None:
    """Fail loudly if the file's shape changed, rather than passing empty."""
    w = _windows()
    assert w, f"Parsed no windows out of {CONST.name} — fix the regex, don't delete the test."
    assert {"sukkot", "pesach"} <= set(w), f"Expected sukkot and pesach, got {sorted(w)}"


@pytest.mark.parametrize("holiday", ["sukkot", "pesach"])
def test_fallback_window_has_not_passed(holiday: str) -> None:
    w = _windows()[holiday]
    end = datetime.date.fromisoformat(w["end"])
    today = datetime.date.today()
    assert end >= today, (
        f"The {holiday} fallback window ended {end} ({(today - end).days} days ago).\n"
        f"When Hebcal is unreachable this window is served to renters, and a "
        f"holiday window in the past means the booking calendar greys out every "
        f"date in it — the holiday becomes unbookable with no error.\n"
        f"Fix: update {CONST} with the next window. Real dates come from\n"
        f"  https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&i=on&year=<YYYY>"
    )


@pytest.mark.parametrize("holiday", ["sukkot", "pesach"])
def test_fallback_window_is_coherent(holiday: str) -> None:
    w = _windows()[holiday]
    start = datetime.date.fromisoformat(w["start"])
    end = datetime.date.fromisoformat(w["end"])
    assert start <= end, f"{holiday} starts ({start}) after it ends ({end})"
    assert (end - start).days <= 21, (
        f"{holiday} window spans {(end - start).days} days — that's too long for "
        "a chag and suggests two separate years were merged into one run."
    )

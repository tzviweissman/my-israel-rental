"""The two holiday date tables must be correct, and must agree with each other.

There are two of them:

* ``frontend/src/utils/holidayCalendar.js`` — per-year Sukkot/Pesach windows.
  This is what fills a lister's holiday booking window when they tick a
  holiday tag in the property form.
* ``frontend/src/constants/holidayWindows.js`` — the single "next window"
  fallback used when the Hebcal API is unreachable.

Both are hand-curated, and on 2026-08-02 they disagreed with the real calendar
and with each other:

    sukkot 2026   real 09-25→10-03    table 10-06→10-13   (11 days out)
    sukkot 2027   real 10-15→10-23    table 09-25→10-02   (three weeks out)
    sukkot 2028   real 10-04→10-12    table 10-14→10-21   (10 days out)
    pesach 2026   real 04-01→04-08    table 04-01→04-09   (a day long)

Every Sukkot row was wrong. A lister who used the one-click "fill my holiday
window" button got a window that does not contain Sukkot — so the holiday
premium applied to the wrong week and renters searching the real dates didn't
match the listing. Nothing errored; the dates simply looked plausible.

The expected values below were read from the Hebcal API (Israel schedule,
``i=on``, Erev Yom Tov through the last day of the chag) rather than typed
from memory. To extend this table, re-derive rather than guess:

    https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&i=on&year=<YYYY>
"""
from __future__ import annotations

import pathlib
import re

import pytest

REPO = pathlib.Path(__file__).resolve().parent.parent.parent
CALENDAR = REPO / "frontend" / "src" / "utils" / "holidayCalendar.js"
CONSTANT = REPO / "frontend" / "src" / "constants" / "holidayWindows.js"

# Hebcal-verified, Israel schedule. Erev Yom Tov → last day inclusive.
EXPECTED: dict[str, dict[int, tuple[str, str]]] = {
    "sukkot": {
        2026: ("2026-09-25", "2026-10-03"),
        2027: ("2027-10-15", "2027-10-23"),
        2028: ("2028-10-04", "2028-10-12"),
    },
    "pesach": {
        2026: ("2026-04-01", "2026-04-08"),
        2027: ("2027-04-21", "2027-04-28"),
        2028: ("2028-04-10", "2028-04-17"),
    },
}


def _calendar_table() -> dict[str, dict[int, tuple[str, str]]]:
    """Parse the per-year table out of utils/holidayCalendar.js."""
    src = CALENDAR.read_text(encoding="utf-8")
    out: dict[str, dict[int, tuple[str, str]]] = {}
    for holiday in ("sukkot", "pesach"):
        m = re.search(rf"\b{holiday}:\s*\{{(.*?)\n  \}},", src, re.S)
        if not m:
            continue
        rows = re.findall(
            r"(\d{4}):\s*\{\s*start:\s*'([\d-]+)',\s*end:\s*'([\d-]+)'", m.group(1)
        )
        out[holiday] = {int(y): (s, e) for y, s, e in rows}
    return out


def _constant_window(holiday: str) -> tuple[str, str]:
    src = CONSTANT.read_text(encoding="utf-8")
    m = re.search(rf"\b{holiday}:\s*\{{(.*?)\n  \}},", src, re.S)
    assert m, f"no {holiday} block in {CONSTANT.name}"
    start = re.search(r"start:\s*'([\d-]+)'", m.group(1))
    end = re.search(r"end:\s*'([\d-]+)'", m.group(1))
    assert start and end, f"{holiday} block has no start/end"
    return start.group(1), end.group(1)


def test_parsers_found_data() -> None:
    """Fail loudly rather than passing vacuously if a file's shape changed."""
    tbl = _calendar_table()
    assert tbl, f"parsed nothing from {CALENDAR.name} — fix the regex, don't delete the test"
    for holiday in ("sukkot", "pesach"):
        assert tbl.get(holiday), f"no {holiday} rows parsed from {CALENDAR.name}"
        assert _constant_window(holiday)


@pytest.mark.parametrize("holiday", ["sukkot", "pesach"])
def test_calendar_table_matches_real_dates(holiday: str) -> None:
    parsed = _calendar_table()[holiday]
    wrong = []
    for year, expected in EXPECTED[holiday].items():
        actual = parsed.get(year)
        if actual is None:
            wrong.append(f"{year}: missing")
        elif actual != expected:
            wrong.append(f"{year}: table {actual[0]}→{actual[1]} but real {expected[0]}→{expected[1]}")
    assert not wrong, (
        f"{CALENDAR.name} has wrong {holiday} dates:\n  " + "\n  ".join(wrong) +
        "\n\nThis table fills a lister's holiday booking window, so wrong dates "
        "price the wrong week. Re-derive from:\n"
        "  https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&i=on&year=<YYYY>"
    )


@pytest.mark.parametrize("holiday", ["sukkot", "pesach"])
def test_the_two_tables_agree(holiday: str) -> None:
    """The fallback constant must name a window the per-year table also has."""
    start, end = _constant_window(holiday)
    year = int(start[:4])
    row = _calendar_table()[holiday].get(year)
    assert row is not None, (
        f"{CONSTANT.name} points {holiday} at {year}, which {CALENDAR.name} "
        f"doesn't cover — one of the two tables is out of date."
    )
    assert row == (start, end), (
        f"{holiday} disagrees between the two tables:\n"
        f"  {CONSTANT.name}: {start}→{end}\n"
        f"  {CALENDAR.name}: {row[0]}→{row[1]}\n"
        "They describe the same chag and must match."
    )

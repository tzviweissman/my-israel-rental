"""Regression tests for utils-like helpers in admin_smart_lists.

The original bug: ``_parse_iso_date`` returned a *naive* datetime while the
``cutoff`` used in the availability filter was *timezone-aware* (UTC).
Comparing them raised ``TypeError: can't compare offset-naive and
offset-aware datetimes`` and the whole endpoint blew up with HTTP 500 the
moment any property had a ``starting_date`` / ``available_from`` set —
which is exactly what the user reported as "failed to generate list".
"""
from __future__ import annotations

import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from routes.admin_smart_lists import _parse_iso_date  # noqa: E402


class TestParseIsoDate:
    def test_returns_aware_datetime(self):
        d = _parse_iso_date("2026-09-01")
        assert d is not None
        # The whole point of the fix — must be timezone-aware so it can be
        # compared against the UTC cutoff below.
        assert d.tzinfo is not None

    def test_aware_comparison_with_utc_cutoff_does_not_raise(self):
        d = _parse_iso_date("2026-09-01")
        cutoff = datetime.now(UTC) + timedelta(days=30)
        # Either ordering must work without raising
        _ = d > cutoff
        _ = d < cutoff

    def test_supports_iso_with_t_separator(self):
        assert _parse_iso_date("2026-09-01T00:00:00") is not None

    def test_supports_trailing_z(self):
        assert _parse_iso_date("2026-09-01T00:00:00Z") is not None

    def test_empty_returns_none(self):
        assert _parse_iso_date(None) is None
        assert _parse_iso_date("") is None

    def test_garbage_returns_none(self):
        assert _parse_iso_date("not-a-date") is None

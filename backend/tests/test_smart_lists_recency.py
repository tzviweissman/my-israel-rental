"""Smart Lists: the recency filter, the rent/bedroom ranges, and save-shape.

WHY THESE EXIST. The tab used to share every match. At 300 listings that
is a WhatsApp message nobody reads and that wa.me silently truncated past
~4000 characters, so the tail was dropped without a word. The fix was a
"recently added" filter plus a selection layer, and these tests pin the
three things that are easy to get quietly wrong:

1. A listing with no ``created_at`` must NOT appear in a "last 7 days"
   list. A handful of production rows predate the field; letting them
   through would put six-month-old apartments in a "just listed" blast,
   which is worse than omitting them.
2. Timestamps arrive in several shapes ("…Z", "+00:00", naive). A naive
   value compared against an aware cutoff raises TypeError and 500s the
   whole endpoint — the exact bug test_smart_lists_dates.py was written
   for, one field over.
3. ``save_smart_list`` builds its filter object from the model's declared
   fields rather than a hand-written list, so a filter added later can't
   be silently dropped on save. Presets losing a filter is invisible: the
   list still generates, just wrong.
"""
from __future__ import annotations

import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from routes.admin_smart_lists import (  # noqa: E402
    SmartListFilters,
    SmartListSaveBody,
    _parse_iso_datetime,
)


class TestParseIsoDatetime:
    def test_keeps_time_of_day(self):
        """The whole difference from ``_parse_iso_date``, which truncates."""
        d = _parse_iso_datetime("2026-09-01T14:30:00Z")
        assert d is not None
        assert (d.hour, d.minute) == (14, 30)

    def test_trailing_z_is_aware(self):
        d = _parse_iso_datetime("2026-09-01T00:00:00Z")
        assert d is not None and d.tzinfo is not None

    def test_offset_form_is_aware(self):
        d = _parse_iso_datetime("2026-09-01T00:00:00+00:00")
        assert d is not None and d.tzinfo is not None

    def test_naive_is_assumed_utc(self):
        """Naive vs aware comparison raises TypeError and 500s the endpoint."""
        d = _parse_iso_datetime("2026-09-01T00:00:00")
        assert d is not None and d.tzinfo is not None
        _ = d < datetime.now(UTC)  # must not raise

    def test_date_only_still_parses(self):
        assert _parse_iso_datetime("2026-09-01") is not None

    def test_unusable_returns_none(self):
        assert _parse_iso_datetime(None) is None
        assert _parse_iso_datetime("") is None
        assert _parse_iso_datetime("not-a-date") is None

    def test_missing_date_cannot_pass_a_recency_cutoff(self):
        """Encodes the policy: undated is excluded, never assumed fresh."""
        cutoff = datetime.now(UTC) - timedelta(days=7)
        added = _parse_iso_datetime(None)
        assert not (added is not None and added >= cutoff)


class TestFilterModel:
    def test_recency_defaults_to_off(self):
        assert SmartListFilters().listed_within_days is None

    def test_recency_is_bounded(self):
        import pytest

        for bad in (0, -1, 400):
            with pytest.raises(Exception):
                SmartListFilters(listed_within_days=bad)

    def test_rent_and_bedrooms_are_two_sided(self):
        f = SmartListFilters(
            min_monthly_rent_ils=5000,
            max_monthly_rent_ils=9000,
            min_bedrooms=2,
            max_bedrooms=3,
        )
        assert (f.min_monthly_rent_ils, f.max_monthly_rent_ils) == (5000, 9000)
        assert (f.min_bedrooms, f.max_bedrooms) == (2, 3)

    def test_save_body_carries_every_filter_field(self):
        """The regression that motivated building filters from model_fields."""
        missing = set(SmartListFilters.model_fields) - set(SmartListSaveBody.model_fields)
        assert not missing, f"SmartListSaveBody would drop {missing} on save"

    def test_save_body_roundtrips_through_the_filter_model(self):
        body = SmartListSaveBody(
            name="Sanhedria, new this week",
            location="Jerusalem - Sanhedria",
            min_monthly_rent_ils=4000,
            max_monthly_rent_ils=9000,
            min_bedrooms=2,
            max_bedrooms=3,
            listed_within_days=7,
            rental_category="long-term",
        )
        filters = SmartListFilters(
            **{k: getattr(body, k) for k in SmartListFilters.model_fields}
        )
        assert filters.listed_within_days == 7
        assert filters.min_monthly_rent_ils == 4000
        assert filters.max_bedrooms == 3

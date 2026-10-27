"""quote-batch prices each listing with the booking's own function and
leaves out listings that have no single total (long-term)."""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from routes.properties import quote as q


def _call(body, props, totals):
    cursor = MagicMock()
    cursor.to_list = AsyncMock(return_value=props)
    db = MagicMock()
    db.properties.find = MagicMock(return_value=cursor)
    calc = AsyncMock(side_effect=lambda data, p, s: totals[p["id"]])
    with patch.object(q, "db", db), patch.object(q, "_compute_booking_total", calc):
        return asyncio.run(q.get_property_quotes(q.QuoteBatchIn(**body)))


def test_totals_from_booking_function_and_long_term_left_out():
    out = _call({"start": "2026-11-01", "end": "2026-11-06", "ids": ["a", "b"]},
                [{"id": "a", "currency": "USD"}, {"id": "b"}], {"a": 1300, "b": None})
    assert out == {"nights": 5, "quotes": {"a": {"total": 1300, "currency": "USD"}}}


def test_bad_dates_refused():
    with pytest.raises(HTTPException):
        _call({"start": "2026-11-06", "end": "2026-11-01", "ids": []}, [], {})

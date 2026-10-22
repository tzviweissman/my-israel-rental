"""Prices customers accept: lines, the business's own price, the message
(routes/marketplace/quotes.py)."""
from datetime import UTC, datetime

import pytest
from fastapi import HTTPException

from routes.marketplace.quotes import Line, _priced, quote_message


def test_lines_set_the_price():
    q = _priced(999, [Line(label="Two movers, 4 hours", amount=1200), Line(label="Truck", amount=450.5)], "", 14,
                datetime(2026, 10, 22, tzinfo=UTC))
    assert q["price"] == 1650.5 and len(q["lines"]) == 2 and q["valid_until"] == "2026-11-05"


def test_a_price_is_needed():
    with pytest.raises(HTTPException):
        _priced(None, [], "", 14, datetime.now(UTC))


def test_message(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://myisraelrental.com")
    q = {"name": "Dana Cohen", "description": "Moving\na 3 room flat", "quote": {"price": 1650.5}, "track_token": "tok", "lang": "en"}
    m = quote_message("Fast Movers", q)
    assert m.startswith("Hello Dana,") and "Moving a 3 room flat" in m and "₪1,650.50" in m and m.endswith("/quotes/tok")
    he = quote_message("Fast Movers", {**q, "lang": "he", "name": ""})
    assert he.startswith("שלום,") and "סה\"כ" in he

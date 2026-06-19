"""Unit tests for the per-row currency sniffer in admin_import.

Lets a CSV without a currency column (or with mixed NIS/USD prices)
classify each row correctly instead of dumping everything into the
default ILS bucket.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.admin_import import _sniff_currency, _coerce_float  # noqa: E402


def test_explicit_currency_cell_wins():
    assert _sniff_currency({"currency": "USD"}, {}) == "USD"
    assert _sniff_currency({"currency": "ILS"}, {}) == "ILS"
    assert _sniff_currency({"currency": "₪"}, {}) == "ILS"
    assert _sniff_currency({"currency": "NIS"}, {}) == "ILS"
    assert _sniff_currency({"currency": "$"}, {}) == "USD"
    assert _sniff_currency({"currency": "Dollar"}, {}) == "USD"
    assert _sniff_currency({"currency": "€"}, {}) == "EUR"
    assert _sniff_currency({"currency": "Shekel"}, {}) == "ILS"


def test_sniff_from_price_cell_when_currency_missing():
    # Dollar sign in price cell → USD
    assert _sniff_currency({"monthly_price": "$5,000"}, {}) == "USD"
    assert _sniff_currency({"nightly_price": "$120"}, {}) == "USD"
    # NIS / ₪ in price → ILS
    assert _sniff_currency({"monthly_price": "₪ 4,500"}, {}) == "ILS"
    assert _sniff_currency({"nightly_price": "350 NIS"}, {}) == "ILS"
    # Numeric-only with no signals → default
    assert _sniff_currency({"monthly_price": "5000"}, {}) == "ILS"
    assert _sniff_currency({"monthly_price": "5000"}, {}, default="USD") == "USD"


def test_sniff_falls_back_to_raw_price_column():
    # No mapped currency, no mapped price field, but a "price" raw column.
    assert _sniff_currency({}, {"Price": "$2,000"}) == "USD"
    assert _sniff_currency({}, {"asking_price": "₪3000"}) == "ILS"
    # Non-price columns shouldn't influence the result.
    assert _sniff_currency({}, {"title": "Studio for $500/night near Old City"}) == "ILS"


def test_coerce_float_strips_currency_tokens():
    assert _coerce_float("$1,200") == 1200.0
    assert _coerce_float("5000 USD") == 5000.0
    assert _coerce_float("₪ 4,500/month") == 4500.0
    assert _coerce_float("NIS 3500") == 3500.0
    assert _coerce_float("120/night") == 120.0
    assert _coerce_float("EUR 850 per month") == 850.0
    assert _coerce_float("") is None
    assert _coerce_float(None) is None
    assert _coerce_float("not a number") is None

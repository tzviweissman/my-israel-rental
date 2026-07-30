"""Pin the server-side WhatsApp link builder to its JS twin.

``backend/utils/whatsapp_link.py`` and ``frontend/src/utils/whatsappLink.js``
implement the same rules for two different reasons: the frontend decides
whether to render a WhatsApp button at all, and the backend has to build the
``wa.me`` destination for the tracked-contact redirect (taking a
client-supplied URL there would be an open redirect).

Two implementations of one rule is precisely how the `phone` /
`whatsapp_number` mismatch happened, so the shared cases are pinned here and
the parametrised table is copied verbatim from the JS module's documented
behaviour. If the JS changes, this fails.
"""
from __future__ import annotations

import pathlib
import re

import pytest

from utils.whatsapp import _to_whatsapp_address
from utils.whatsapp_link import (
    MAX_DIGITS,
    MIN_DIGITS,
    build_whatsapp_link,
    normalize_whatsapp_number,
)

JS_MODULE = (
    pathlib.Path(__file__).resolve().parent.parent.parent
    / "frontend" / "src" / "utils" / "whatsappLink.js"
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        # The case that matters most locally: national format. The trunk 0 is
        # REPLACED by the country code, never kept alongside it.
        ("0501234567", "972501234567"),
        ("050-123-4567", "972501234567"),
        ("050 123 4567", "972501234567"),
        # Already international — passed through untouched.
        ("972501234567", "972501234567"),
        ("+972-50-123-4567", "972501234567"),
        ("+1 (415) 555-0123", "14155550123"),
        # `00` international prefix stripped before the leading-zero rule,
        # which would otherwise mangle it into 972 + 972…
        ("00972501234567", "972501234567"),
        # Unusable — None means "no WhatsApp", not "try anyway".
        ("123", None),
        ("", None),
        (None, None),
        ("abc", None),
        ("+", None),
        ("1" * (MAX_DIGITS + 1), None),
    ],
)
def test_normalize_matches_js_rules(raw, expected) -> None:
    assert normalize_whatsapp_number(raw) == expected


def test_min_digits_boundary() -> None:
    assert normalize_whatsapp_number("1" * MIN_DIGITS) == "1" * MIN_DIGITS
    assert normalize_whatsapp_number("1" * (MIN_DIGITS - 1)) is None


def test_builds_link_with_encoded_message() -> None:
    url = build_whatsapp_link("0501234567", 'Hi! Interested in "Deep clean" (₪250)')
    assert url is not None
    assert url.startswith("https://wa.me/972501234567?text=")
    # The raw characters must not survive unencoded into the query string.
    assert '"' not in url and " " not in url


def test_blank_message_emits_no_stray_query() -> None:
    assert build_whatsapp_link("0501234567") == "https://wa.me/972501234567"
    assert build_whatsapp_link("0501234567", "   ") == "https://wa.me/972501234567"


def test_no_link_without_a_usable_number() -> None:
    # A truthiness check on the raw string is not enough: `https://wa.me/`
    # with no digits is a live URL that goes nowhere useful.
    assert build_whatsapp_link("junk", "hello") is None


class TestTwilioAddress:
    """`_to_whatsapp_address` used to strip non-digits and prepend '+'."""

    def test_national_format_gets_the_country_code(self) -> None:
        # Was "whatsapp:+0501234567" — undeliverable, and the format
        # essentially every Israeli user types.
        assert _to_whatsapp_address("050-123-4567") == "whatsapp:+972501234567"

    def test_international_unchanged(self) -> None:
        assert _to_whatsapp_address("+972501234567") == "whatsapp:+972501234567"

    @pytest.mark.parametrize("raw", ["", None, "abc", "12"])
    def test_empty_for_unusable(self, raw) -> None:
        assert _to_whatsapp_address(raw) == ""


class TestJsParity:
    """Guard the constants against silent drift between the two files."""

    def test_js_module_still_exists(self) -> None:
        assert JS_MODULE.exists(), f"expected the JS twin at {JS_MODULE}"

    @pytest.mark.parametrize(
        ("const_name", "py_value"),
        [("MIN_DIGITS", MIN_DIGITS), ("MAX_DIGITS", MAX_DIGITS), ("ISRAEL_CC", 972)],
    )
    def test_constants_agree(self, const_name, py_value) -> None:
        src = JS_MODULE.read_text(encoding="utf-8")
        match = re.search(rf"{const_name}\s*=\s*'?(\d+)'?", src)
        assert match, f"{const_name} not found in {JS_MODULE.name}"
        assert int(match.group(1)) == int(py_value), (
            f"{const_name} is {match.group(1)} in JS but {py_value} in Python — "
            f"the two WhatsApp normalisers have drifted apart."
        )

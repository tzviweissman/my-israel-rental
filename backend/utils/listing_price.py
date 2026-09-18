"""Which price a listing shows, and per what - the server's copy.

The website's copy is `frontend/src/utils/listingPrice.js` (`shownPrice`).
The two are held to the SAME cases, `shared/listing_price_cases.json`, by
`backend/tests/test_listing_price_parity.py` and the frontend test beside
listingPrice.js. Change a rule by changing a case first; both tests then fail
until both copies agree. That is the whole point of the file: until 18 Sep
2026 about fifteen places each decided this for themselves, a new kind of
price reached two of them, and a Sukkot list told customers a flat was
"$154 / Sukkot" when the owner had said $154 a night.

Never an invented number: no price is None, never 0.
"""
from __future__ import annotations

from typing import Any, Optional

HOLIDAYS = ("sukkot", "pesach")


def _num(v: Any) -> Optional[float]:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def _whole(n: float):
    """7200.0 -> 7200, so the output compares equal to the JSON cases and
    reads naturally; a real fraction is kept."""
    return int(n) if n == int(n) else n


def regular_shown(p: dict) -> Optional[dict]:
    """Everyday price: nightly for a vacation stay; otherwise monthly, or
    nightly when that is the only box the owner filled in."""
    if not p:
        return None
    cur = p.get("currency") or "ILS"
    nightly, monthly = _num(p.get("nightly_price")), _num(p.get("monthly_price"))
    if p.get("rental_type") == "vacation":
        return {"amount": _whole(nightly), "currency": cur, "per": "night", "holidays": []} if nightly else None
    if monthly:
        return {"amount": _whole(monthly), "currency": cur, "per": "month", "holidays": []}
    return {"amount": _whole(nightly), "currency": cur, "per": "night", "holidays": []} if nightly else None


def holiday_shown(p: dict, holiday: Optional[str] = None) -> Optional[dict]:
    """The holiday price, if any. With `holiday`, only when the listing is
    offered for that holiday, and named as it. Any rental type: a long-term
    flat can also be listed for Sukkot with its own price."""
    if not p:
        return None
    amount = _num(p.get("holiday_lump_price"))
    if not amount:
        return None
    tags = [x for x in (p.get("holiday_tags") or []) if x in HOLIDAYS]
    if holiday and holiday not in tags:
        return None
    return {
        "amount": _whole(amount),
        "currency": p.get("holiday_lump_currency") or p.get("currency") or "ILS",
        "per": "holidayNight" if p.get("holiday_lump_is_per_night") else "holiday",
        "holidays": [holiday] if holiday else [h for h in HOLIDAYS if h in tags],
    }


def shown_price(p: dict, holiday: Optional[str] = None) -> Optional[dict]:
    """The price to show. In a holiday context the holiday price wins when
    the listing is offered for it; otherwise the everyday price, and the
    holiday price only when it is the only one."""
    if holiday in HOLIDAYS:
        h = holiday_shown(p, holiday)
        if h:
            return h
    return regular_shown(p) or holiday_shown(p)


def price_label(shown: Optional[dict]) -> str:
    """The English suffix the Smart List message uses: "/mo", "/night",
    "/ Sukkot", "/night (Sukkot)". English because the message is written
    in English; the website translates its own copy."""
    if not shown:
        return ""
    names = "/".join(h.capitalize() for h in shown.get("holidays") or [])
    per = shown["per"]
    if per == "month":
        return "/mo"
    if per == "night":
        return "/night"
    if per == "holidayNight":
        return f"/night ({names})" if names else "/night"
    return f"/ {names}" if names else "/ holiday"

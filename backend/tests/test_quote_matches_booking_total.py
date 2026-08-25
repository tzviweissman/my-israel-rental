"""The quote endpoint and the booking pricing function must not diverge.

``GET /api/properties/{id}/quote`` exists so the reserve button can show a
real total instead of ``nightly_price × nights``. That is only worth doing
if the number it prints is the number the booking charges — otherwise it
is a more expensive way to be wrong.

So this file does not check that the quote is *plausible*. It checks that
the quote equals ``_compute_booking_total`` called with the same inputs,
for the cases where the two could realistically drift apart:

  * a vacation listing with applied Smart Pricing overrides — the case a
    frontend multiplication gets wrong, and the reason the endpoint exists
  * the same listing with no overrides
  * a long-term listing, where the honest total is ``None``
  * a sublease, whose price supersedes the property's

If someone later "optimises" the endpoint by inlining the arithmetic, or
changes the pricing function without thinking about the quote, one of
these fails. That is the whole point — the pin is the test, not the
docstring on the endpoint.

Runs against the local dev API and the local dev database (never Atlas —
see MONGO_URL in backend/.env). Every document it writes carries the
``_quote_test`` marker and is deleted in teardown.
"""
import asyncio
import os
import re
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

import pytest
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from conftest import TEST_API_BASE  # noqa: E402

BASE = TEST_API_BASE.rstrip("/")
MARKER = "_quote_test"


def _run(coro):
    """Run one coroutine on the session's event loop, and never close it.

    Both obvious spellings break the rest of the suite, for the same
    reason. `asyncio.run` creates a loop and closes it; so did the first
    version of this helper. But `_compute_booking_total` reads through
    `routes.deps.db` — a module-level Motor client created once at import
    — and Motor binds that client to whichever loop first drives it. Close
    that loop and the SHARED client is bound to a corpse: every later test
    touching routes.deps.db dies with "Event loop is closed", nowhere near
    the file that caused it.

    That is exactly what happened. All four tests in
    test_accept_booking_refactor failed whenever this file ran before them
    in the same session, while both files passed alone.

    So: reuse the current loop, create one only if there isn't a usable
    one, and never close it. The loop outlives this module on purpose.
    """
    try:
        loop = asyncio.get_event_loop_policy().get_event_loop()
        if loop.is_closed():
            raise RuntimeError("closed")
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def _env(key: str) -> str:
    """Read one key out of backend/.env without importing dotenv."""
    if os.environ.get(key):
        return os.environ[key]
    text = (Path(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8")
    m = re.search(rf"^{key}\s*=\s*(.+)$", text, re.M)
    return m.group(1).strip().strip("\"'") if m else ""


def _db():
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(_env("MONGO_URL"))
    return client, client[_env("DB_NAME")]


# Far enough out that no seeded booking or availability block collides.
_START = date.today() + timedelta(days=420)
_NIGHTS = 5
_BASE_RATE = 250.0
# Two nights repriced well away from the base, so a bug that ignores
# overrides cannot coincidentally produce the right number.
_OVERRIDES = {1: 400.0, 3: 610.0}


def _iso(offset: int) -> str:
    return (_START + timedelta(days=offset)).isoformat()


async def _seed() -> dict:
    """Create the fixtures directly in Mongo and return their ids."""
    client, db = _db()
    owner_id = f"{MARKER}-owner-{uuid.uuid4()}"
    vacation_id = f"{MARKER}-vac-{uuid.uuid4()}"
    plain_id = f"{MARKER}-plain-{uuid.uuid4()}"
    longterm_id = f"{MARKER}-lt-{uuid.uuid4()}"
    sublease_id = f"{MARKER}-sub-{uuid.uuid4()}"

    common = {
        "owner_id": owner_id, "status": "active", "area": "jerusalem",
        "title": "Quote divergence fixture", "currency": "ILS", MARKER: True,
    }
    await db.properties.insert_many([
        {**common, "id": vacation_id, "rental_type": "vacation",
         "nightly_price": _BASE_RATE},
        {**common, "id": plain_id, "rental_type": "vacation",
         "nightly_price": _BASE_RATE},
        # Long-term deliberately carries a nightly_price too: the None must
        # come from the rental type, not from an absent field.
        {**common, "id": longterm_id, "rental_type": "long-term",
         "nightly_price": _BASE_RATE, "price": 6000},
    ])
    await db.nightly_price_overrides.insert_many([
        {"id": str(uuid.uuid4()), "property_id": vacation_id, "date": _iso(off),
         "price": price, "applied": True, MARKER: True}
        for off, price in _OVERRIDES.items()
    ])
    await db.subleases.insert_one({
        "id": sublease_id, "property_id": plain_id, "active": True,
        "price": 190.0, "price_type": "per_night", "currency": "ILS",
        "title": "Quote fixture sublease", MARKER: True,
    })
    client.close()
    return {"vacation": vacation_id, "plain": plain_id,
            "longterm": longterm_id, "sublease": sublease_id}


async def _teardown() -> None:
    client, db = _db()
    for coll in ("properties", "nightly_price_overrides", "subleases"):
        await db[coll].delete_many({MARKER: True})
    client.close()


async def _direct_total(property_id: str, sublease_id: str | None):
    """What the booking pipeline itself would charge for this window."""
    from models import BookingCreate
    from routes.bookings import _compute_booking_total

    client, db = _db()
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    sub = (await db.subleases.find_one({"id": sublease_id}, {"_id": 0})
           if sublease_id else None)
    client.close()
    booking = BookingCreate(
        property_id=property_id,
        start_date=_iso(0),
        end_date=_iso(_NIGHTS),
        sublease_id=sublease_id,
    )
    return await _compute_booking_total(booking, prop, sub)


def _quote(property_id: str, sublease_id: str | None = None, **overrides) -> dict:
    params = {"start": _iso(0), "end": _iso(_NIGHTS), **overrides}
    if sublease_id:
        params["sublease_id"] = sublease_id
    r = requests.get(f"{BASE}/properties/{property_id}/quote",
                     params=params, timeout=15)
    r.raise_for_status()
    return r.json()


@pytest.fixture(scope="module")
def ids():
    _run(_teardown())          # leftovers from an interrupted run
    seeded = _run(_seed())
    yield seeded
    _run(_teardown())


def test_api_reachable():
    requests.get(f"{BASE}/properties?limit=1", timeout=15).raise_for_status()


@pytest.mark.parametrize("case,sublease", [
    ("vacation", None),   # with applied Smart Pricing overrides
    ("plain", None),      # same shape, no overrides
    ("longterm", None),   # total is None, deliberately
    ("plain", "sublease"),
])
def test_quote_equals_booking_total(ids, case, sublease):
    """The endpoint's total IS the pricing function's total. No exceptions."""
    property_id = ids[case]
    sublease_id = ids[sublease] if sublease else None

    quoted = _quote(property_id, sublease_id)["total"]
    charged = _run(_direct_total(property_id, sublease_id))

    assert quoted == charged, (
        f"{case}: quote says {quoted}, the booking would charge {charged}. "
        "These two must be the same function or the button lies."
    )


def test_overrides_actually_change_the_total(ids):
    """Guards the guard.

    If the fixture's overrides silently stopped applying, the test above
    would still pass — both sides would agree on the plain base × nights.
    The endpoint would then be pinned to the wrong behaviour, which is
    worse than no test. So: the overridden listing must cost more than the
    identical listing without overrides, by exactly the repricing.
    """
    with_overrides = _quote(ids["vacation"])["total"]
    without = _quote(ids["plain"])["total"]

    expected_gap = sum(price - _BASE_RATE for price in _OVERRIDES.values())
    assert without == pytest.approx(_BASE_RATE * _NIGHTS)
    assert with_overrides == pytest.approx(without + expected_gap)
    assert with_overrides != pytest.approx(_BASE_RATE * _NIGHTS), (
        "nightly_price × nights matched the real total — this fixture can no "
        "longer prove a frontend multiplication would be wrong"
    )


def test_long_term_has_no_total_and_no_placeholder(ids):
    """None, not 0. A zero would read as a free stay."""
    body = _quote(ids["longterm"])
    assert body["total"] is None
    assert body["per_night_avg"] is None
    assert body["nights"] == _NIGHTS       # still an honest night count


def test_nights_and_average_are_consistent(ids):
    body = _quote(ids["vacation"])
    assert body["nights"] == _NIGHTS
    assert body["currency"] == "ILS"
    assert body["per_night_avg"] == pytest.approx(body["total"] / body["nights"], abs=0.01)


@pytest.mark.parametrize("start,end", [
    ("not-a-date", None),
    (None, "also-not-a-date"),
    ("2027-05-10", "2027-05-10"),   # zero nights
    ("2027-05-10", "2027-05-03"),   # end before start
])
def test_bad_windows_are_rejected_not_guessed(ids, start, end):
    """`_booking_window` falls back to one night for the email path. A quote
    must not inherit that leniency and print a confident wrong number."""
    params = {"start": start or _iso(0), "end": end or _iso(_NIGHTS)}
    r = requests.get(f"{BASE}/properties/{ids['vacation']}/quote",
                     params=params, timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"


def test_missing_property_is_404():
    r = requests.get(f"{BASE}/properties/{MARKER}-does-not-exist/quote",
                     params={"start": _iso(0), "end": _iso(_NIGHTS)}, timeout=15)
    assert r.status_code == 404

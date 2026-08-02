"""The instant-book rule is written twice; the two copies must agree.

`backend/routes/bookings/shared.py` decides whether a new booking is
``confirmed`` or ``pending``. `frontend/src/utils/instantBooking.js` decides
whether the button says "Book now" or "Request to book". They answer the same
question in different languages, and a renter only ever sees the disagreement:
they press a button labelled "Book now", nothing is confirmed, and the dates
sit pending while they believe they have a reservation.

The rule has three inputs and one genuinely subtle case — ``instant_booking``
is tri-state. ``False`` ("review each request") and ``None`` ("never chosen")
must NOT collapse together: for a vacation rental they give opposite answers,
because ``None`` falls back to the legacy "vacation is instant" behaviour that
every pre-existing listing relies on.

This test runs both implementations over the same table of cases. The JS side
is executed with Node when it's available, and skipped with a clear reason
when it isn't — a skip here means "unverified", not "passed".
"""
from __future__ import annotations

import json
import pathlib
import shutil
import subprocess

import pytest

REPO = pathlib.Path(__file__).resolve().parent.parent.parent
JS_HELPER = REPO / "frontend" / "src" / "utils" / "instantBooking.js"

# (rental_type, instant_booking, has_sublease) -> expected instant?
CASES: list[tuple[str, bool | None, bool, bool]] = [
    # Legacy fallback: nobody has chosen, so rental_type decides.
    ("vacation", None, False, True),
    ("short-term", None, False, False),
    ("long-term", None, False, False),
    # Explicit lister choice overrides the legacy rule in both directions.
    ("vacation", False, False, False),   # opting a vacation rental OUT
    ("long-term", True, False, True),    # opting a long-term rental IN
    ("short-term", True, False, True),
    ("vacation", True, False, True),
    # Subleases are never instant, whatever the property says.
    ("vacation", True, True, False),
    ("vacation", None, True, False),
    ("long-term", True, True, False),
]


def _python_rule(rental_type: str, instant_booking: bool | None, has_sublease: bool) -> bool:
    """Mirror of the decision in ``_build_booking_doc``."""
    from routes.bookings.shared import _build_booking_doc

    doc = _build_booking_doc(
        booking_data=_FakeBookingData(),
        property_data={
            "rental_type": rental_type,
            "instant_booking": instant_booking,
            "owner_id": "owner-1",
        },
        sublease_data={"subleasor_id": "sub-1"} if has_sublease else None,
        renter_id="renter-1",
    )
    return doc["status"] == "confirmed"


class _FakeBookingData:
    """Minimal stand-in for BookingCreate — only model_dump() is used."""

    def model_dump(self) -> dict:
        return {"property_id": "p1", "start_date": "2026-09-01", "end_date": "2026-09-05"}


@pytest.mark.parametrize(
    ("rental_type", "instant_booking", "has_sublease", "expected"),
    CASES,
    ids=[f"{c[0]}-{c[1]}-{'sublease' if c[2] else 'direct'}" for c in CASES],
)
def test_python_rule(rental_type, instant_booking, has_sublease, expected) -> None:
    assert _python_rule(rental_type, instant_booking, has_sublease) is expected


@pytest.mark.skipif(shutil.which("node") is None, reason="node not on PATH — JS side UNVERIFIED")
def test_js_matches_python() -> None:
    """Run the JS helper over the same table and compare, case by case."""
    assert JS_HELPER.exists(), f"{JS_HELPER} is missing — did the helper move?"

    script = f"""
    const src = require('fs').readFileSync({json.dumps(str(JS_HELPER))}, 'utf8');
    // Strip the ES module syntax so this runs under plain CommonJS node.
    const body = src.replace(/export default[^;]*;/, '').replace(/export /g, '');
    const mod = new Function(body + '; return isInstantBooking;')();
    const cases = {json.dumps([[c[0], c[1], c[2]] for c in CASES])};
    console.log(JSON.stringify(cases.map(([rt, ib, sub]) =>
      mod({{ rental_type: rt, instant_booking: ib }}, sub ? {{ id: 's1' }} : null)
    )));
    """
    out = subprocess.run(
        ["node", "-e", script], capture_output=True, text=True, timeout=30
    )
    assert out.returncode == 0, f"node failed:\n{out.stderr}"
    js_results = json.loads(out.stdout.strip())

    assert len(js_results) == len(CASES), "JS returned the wrong number of results"
    mismatches = [
        f"{c[0]} instant_booking={c[1]} sublease={c[2]}: js={js} python={c[3]}"
        for c, js in zip(CASES, js_results)
        if js is not c[3]
    ]
    assert not mismatches, "JS and Python disagree:\n  " + "\n  ".join(mismatches)

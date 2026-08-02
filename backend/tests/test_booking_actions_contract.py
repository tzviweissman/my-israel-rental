"""Booking action buttons must gate on the same thing the API authorises on.

The backend decides every booking action by the caller's **relationship to
that booking** — ``booking.owner_id`` for the lister side, ``renter_id`` for
the renter side. It never looks at the account's role. The dashboard, which
decides whether to *show* each button, gated on ``user.role`` instead.

Both sides read as correct on their own. The gap produced two live bugs:

* ``isOwner = user.role === 'owner' || 'manager'`` put a **Cancel** button on
  bookings the user didn't own. Clicking it returned 403 "Not authorized" —
  reported by a lister who couldn't cancel a booking.
* ``isRenter = user.role === 'renter'`` hid **Request cancellation** from
  anyone whose account role wasn't literally ``renter``. An owner, manager or
  admin who books a place had no way to ask to cancel it, even though
  ``/request-cancel`` would have accepted them — it only checks
  ``renter_id``. Found by testing a booking from a non-renter account.

Role and relationship are different questions, and only the second one
decides what the server allows. This test reads both sides and fails if the
frontend reintroduces a role check in the components that render these
buttons.

See ``docs/failure-patterns.md`` §1 for the general shape.
"""
from __future__ import annotations

import pathlib
import re

import pytest

REPO = pathlib.Path(__file__).resolve().parent.parent.parent
CANCEL_PY = REPO / "backend" / "routes" / "bookings" / "cancel.py"
BOOKING_ROW = REPO / "frontend" / "src" / "components" / "dashboard" / "BookingRow.jsx"
BOOKING_CHIP = REPO / "frontend" / "src" / "components" / "dashboard" / "BookingChip.jsx"

# The components whose whole job is rendering booking action buttons. Neither
# has any legitimate reason to branch on the account role.
ACTION_COMPONENTS = (BOOKING_ROW, BOOKING_CHIP)


def _strip_comments(src: str) -> str:
    """Drop // and /* */ comments so prose about the bug isn't matched as code.

    Both components carry comments naming ``user.role ===`` while explaining
    why they must not use it. Without this the test would fail on its own
    documentation.
    """
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return re.sub(r"//[^\n]*", "", src)


def _authorised_fields() -> set[str]:
    """Booking fields the cancellation endpoints compare against the caller."""
    src = CANCEL_PY.read_text(encoding="utf-8")
    return set(
        re.findall(r"booking\.get\('(\w+)'\)\s*!=\s*payload\['user_id'\]", src)
    )


def test_collectors_are_not_empty() -> None:
    """A rename must turn this suite red, not silently stop checking it.

    ``test_type_coverage.py`` skipped itself on every run for weeks because
    the thing it looked for had moved. Assert we actually collected something
    before asserting anything about it.
    """
    assert _authorised_fields(), (
        f"Parsed no authorisation checks out of {CANCEL_PY.name}. The regex "
        "no longer matches the source — fix the regex, don't delete the test."
    )
    for path in ACTION_COMPONENTS:
        assert path.exists(), f"{path} is missing — did it move or get renamed?"
        assert "booking" in path.read_text(encoding="utf-8").lower()


def test_backend_authorises_on_relationship_only() -> None:
    """Every cancellation endpoint compares a booking id field, not a role."""
    fields = _authorised_fields()
    assert fields <= {"owner_id", "renter_id"}, (
        f"{CANCEL_PY.name} authorises on unexpected field(s): "
        f"{sorted(fields - {'owner_id', 'renter_id'})}"
    )
    # Both sides of the flow must be represented: the lister endpoints
    # (cancel / approve / deny) and the renter one (request-cancel).
    assert fields == {"owner_id", "renter_id"}, (
        f"Expected both owner_id and renter_id checks, found {sorted(fields)}"
    )

    src = CANCEL_PY.read_text(encoding="utf-8")
    assert "payload['role']" not in src and 'payload.get("role")' not in src, (
        "A cancellation endpoint started authorising on role. If that is "
        "deliberate (e.g. an admin override), update this test and the "
        "frontend gates together — they must agree."
    )


@pytest.mark.parametrize("path", ACTION_COMPONENTS, ids=lambda p: p.name)
def test_action_buttons_do_not_gate_on_role(path: pathlib.Path) -> None:
    """No ``user.role`` in the components that render booking actions.

    This is deliberately blunt. A narrower rule — "role may be read but not
    used in a can* flag" — is the rule that was already being followed when
    both bugs shipped, because each individual use looked reasonable.
    """
    code = _strip_comments(path.read_text(encoding="utf-8"))
    offenders = re.findall(r"\buser\??\.role\b", code)
    assert not offenders, (
        f"{path.name} gates on user.role ({len(offenders)} use(s)). Booking "
        "actions are authorised by relationship — use "
        "`booking.owner_id === user.id` / `booking.renter_id === user.id` so "
        "the button appears exactly when the API will accept it."
    )


@pytest.mark.parametrize("path", ACTION_COMPONENTS, ids=lambda p: p.name)
def test_action_buttons_compare_both_id_fields(path: pathlib.Path) -> None:
    """Both relationships are actually derived, so neither side is missing."""
    code = _strip_comments(path.read_text(encoding="utf-8"))
    for field in ("owner_id", "renter_id"):
        assert re.search(rf"\.{field}\s*===\s*user\.id", code), (
            f"{path.name} never compares {field} to user.id. The renter side "
            "went missing exactly this way: without it there is no way to "
            "render 'Request cancellation' for the person who booked."
        )

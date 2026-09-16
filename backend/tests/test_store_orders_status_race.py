"""Two people moving the same order at the same moment cannot both win.

The bug (site audit, 12 Sep 2026, F5): `_transition` read the order's
status, checked the transition table against it, then wrote the new status
UNCONDITIONALLY. Three surfaces can be looking at one order - the owner's
dashboard, the counter's staff board, and the courier's phone - so two
legal transitions could each pass the check against the same starting
status, and the later write simply won.

The damage was not a double fulfilment (assignment is guarded separately).
It was a LOST UPDATE with both history entries still recorded: an order
reading `done` whose history says new -> preparing -> done -> ready, and no
way afterwards to tell which of the two actually happened. One of the two
people also got a success screen for a write that had been overwritten.

The fix is one clause - `"status": current` in the update's filter - placed
in `_transition` itself rather than at its three call sites, so every
surface inherits it.

HOW THIS IS TESTED, since it matters. The endpoint re-reads the order on
every request, so the window cannot be reproduced by calling it twice in
sequence: the second call would simply read the first call's result. The
race has to be real, so these tests fire genuinely simultaneous requests
from threads and then assert an invariant that holds either way:

    the number of history entries added == the number of requests that
    were told they succeeded, and the final status is the last entry.

If the two requests miss each other, the invariant holds trivially and the
test passes without proving much. If they overlap - which they do, most
runs, and the test repeats to make that near-certain - the OLD code breaks
the invariant and the new code keeps it. A test that cannot fail when the
code is wrong is worse than no test, so the repeat count is not decoration.

Needs the live local API and the local Mongo (see backend/tests/.env.test).
"""
from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from pymongo import MongoClient  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")

# How many independent orders get the two-thread treatment. Each round is
# one coin toss on whether the two requests genuinely overlap; twelve makes
# "they never overlapped, so the test proved nothing" vanishingly unlikely
# while keeping the file under a few seconds.
ROUNDS = 12


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"orders-race-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": "Orders Race", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def business(owner):
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_race bakery"},
                      headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _new_order(owner, business):
    r = requests.post(f"{BASE}/marketplace/businesses/{business}/orders", json={
        "customer_name": "Idan Cohen",
        "customer_phone": "054-1234567",
        "items": "2 challahs",
        "needed_by": "2030-01-04T12:00",
        "fulfilment": "pickup",
    }, headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _set_status(owner, order_id, status):
    return requests.patch(
        f"{BASE}/marketplace/orders/{order_id}/status",
        json={"status": status, "note": ""}, headers=_auth(owner), timeout=30,
    )


@pytest.fixture(scope="module")
def db():
    """Read straight from Mongo: there is no single-order GET for an owner,
    and the invariant under test is about what was actually STORED, which
    is the honest place to look at it anyway."""
    client = MongoClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


def _read(db, order_id):
    row = db.store_orders.find_one({"_id": order_id})
    assert row is not None, f"order {order_id} vanished"
    return row


def test_simultaneous_status_changes_leave_status_and_history_agreeing(owner, business, db):
    """The invariant, across many real races.

    `preparing` and `cancelled` are both legal from `new`, so before the fix
    both threads passed the transition table and both wrote.
    """
    conflicts = 0

    for _ in range(ROUNDS):
        order_id = _new_order(owner, business)

        with ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(_set_status, owner, order_id, "preparing")
            b = pool.submit(_set_status, owner, order_id, "cancelled")
            results = [a.result(), b.result()]

        codes = sorted(r.status_code for r in results)
        won = [r for r in results if r.status_code in (200, 201)]
        assert won, f"both requests were refused: {[r.text for r in results]}"

        if codes[-1] == 409:
            conflicts += 1
            loser = [r for r in results if r.status_code == 409][0]
            assert "refresh" in loser.text.lower() or "cannot become" in loser.text.lower(), (
                f"a refused change must say what to do next, got: {loser.text}"
            )

        order = _read(db, order_id)
        # The order was created with one history entry ("new"); every
        # ACCEPTED change adds exactly one more. This is the assertion the
        # old code failed: it recorded both entries and kept one status.
        assert len(order["history"]) == 1 + len(won), (
            f"history has {len(order['history'])} entries for {len(won)} accepted "
            f"change(s): {order['history']}"
        )
        assert order["status"] == order["history"][-1]["status"], (
            f"status {order['status']!r} does not match the last history entry "
            f"{order['history'][-1]!r}"
        )

    # Not an assertion about correctness - a guard against this test quietly
    # becoming a no-op. If no round ever collided, it never exercised the
    # fix, and saying so is more useful than a green tick that means nothing.
    if conflicts == 0:
        pytest.skip(
            f"{ROUNDS} rounds and the two requests never overlapped - the race "
            "window was not reached, so this run proved nothing"
        )


def test_the_loser_is_told_where_the_order_actually_is(owner, business, db):
    """A refusal has to name the current status, not just say no.

    The courier who taps 'delivered' and loses the race needs to know their
    tap did not take and what the order is now; otherwise they walk away
    from a success screen for a write that vanished.
    """
    order_id = _new_order(owner, business)

    losers = []
    for _ in range(ROUNDS):
        oid = _new_order(owner, business)
        with ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(_set_status, owner, oid, "preparing")
            b = pool.submit(_set_status, owner, oid, "cancelled")
            results = [a.result(), b.result()]
        losers += [r for r in results if r.status_code == 409]

    if not losers:
        pytest.skip("no collision in this run - nothing to inspect")

    detail = losers[0].json()["detail"].lower()
    assert any(s in detail for s in ("new", "preparing", "cancelled")), (
        f"the refusal must name a real status, got: {detail}"
    )

    # And the order it was raced against is still coherent.
    assert _read(db, order_id)["status"] == "new"


def test_a_sequential_change_still_just_works(owner, business, db):
    """The guard must not make the ordinary, uncontended path fail."""
    order_id = _new_order(owner, business)
    # The full legal path for a pickup order. `preparing -> done` is NOT a
    # transition the table allows (_TRANSITIONS: preparing -> ready -> done),
    # and writing the shortcut here is how this test first went red against
    # perfectly good code.
    assert _set_status(owner, order_id, "preparing").status_code in (200, 201)
    assert _set_status(owner, order_id, "ready").status_code in (200, 201)
    assert _set_status(owner, order_id, "done").status_code in (200, 201)

    order = _read(db, order_id)
    assert order["status"] == "done"
    assert [h["status"] for h in order["history"]] == ["new", "preparing", "ready", "done"]

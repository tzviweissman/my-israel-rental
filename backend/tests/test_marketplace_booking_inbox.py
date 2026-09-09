"""`GET /marketplace/bookings` — the read half of the gig booking loop.

Booking a gig shipped with a create endpoint and an accept/decline endpoint
and nothing that could LIST either, so a provider had no screen showing what
had been asked of them (dead-ends audit 2026-09-08, #4). These tests pin the
three things the dashboard depends on and that a refactor could quietly
break:

  * a booking appears on the provider's side and on the client's side, and
    on neither of them for a stranger;
  * a lapsed pending hold is reported as `expired`, matching what
    `_live_hold_query` already enforces on availability — otherwise the
    provider is offered an Accept button for a slot that has already gone
    back on sale;
  * the contact details the buyer typed reach the provider and nobody else,
    including the buyer's own row (they came from a form addressed to one
    reader).

Runs against the local dev database (MONGO_URL in backend/.env — never
Atlas). Every document written carries `_inbox_test` and is removed in
teardown.
"""
import asyncio
import os
import re
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

MARKER = "_inbox_test"
GIG_ID = f"{MARKER}-gig"
PROVIDER = f"{MARKER}-provider"
CLIENT = f"{MARKER}-client"
STRANGER = f"{MARKER}-stranger"


def _run(coro):
    """Reuse the session loop and never close it — `routes.deps.db` is a
    module-level Motor client bound to whichever loop first drives it."""
    try:
        loop = asyncio.get_event_loop_policy().get_event_loop()
        if loop.is_closed():
            raise RuntimeError("closed")
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def _env(key: str) -> str:
    if os.environ.get(key):
        return os.environ[key]
    text = (Path(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8")
    m = re.search(rf"^{key}\s*=\s*(.+)$", text, re.M)
    return m.group(1).strip().strip("\"'") if m else ""


def _db():
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(_env("MONGO_URL"))
    return client, client[_env("DB_NAME")]


DATE = (datetime.now(UTC) + timedelta(days=30)).date().isoformat()


async def _seed(status="pending", expires_in_hours=6, client_user_id=CLIENT):
    client, db = _db()
    now = datetime.now(UTC)
    bid = f"{MARKER}-{uuid.uuid4()}"
    doc = {
        "_id": bid,
        "gig_id": GIG_ID,
        "provider_user_id": PROVIDER,
        "client_user_id": client_user_id,
        "tier_name": "Basic",
        "message": "Three bedrooms, Thursday if you can.",
        "contact_email": "buyer@example.test",
        "contact_phone": "0500000000",
        "preferred_date": DATE,
        "time_slot": "09:00",
        "duration_minutes": 60,
        "status": status,
        "created_at": now.isoformat(),
        MARKER: True,
    }
    if expires_in_hours is not None:
        doc["hold_expires_at"] = (now + timedelta(hours=expires_in_hours)).isoformat()
    await db.marketplace_bookings.insert_one(doc)
    await db.marketplace_gigs.insert_one({
        "_id": GIG_ID, "title": "Inbox test cleaning", "gig_type": "deliverable",
        "provider_user_id": PROVIDER, MARKER: True,
    })
    # `users` carries a unique index on email, and two rows with a missing
    # email collide on null — the seed has to give each one its own.
    await db.users.insert_many([
        {"id": PROVIDER, "name": "Inbox Provider", "email": f"{PROVIDER}@example.test", MARKER: True},
        {"id": CLIENT, "name": "Inbox Buyer", "email": f"{CLIENT}@example.test", MARKER: True},
    ])
    client.close()
    return bid


async def _teardown():
    client, db = _db()
    for coll in ("marketplace_bookings", "marketplace_gigs", "users"):
        await db[coll].delete_many({MARKER: True})
    client.close()


async def _list(role, user_id):
    from routes.marketplace.gigs import list_bookings
    return await list_bookings(role=role, user={"user_id": user_id})


@pytest.fixture(autouse=True)
def clean():
    _run(_teardown())
    yield
    _run(_teardown())


def test_provider_sees_the_request_made_to_them():
    bid = _run(_seed())
    rows = _run(_list("provider", PROVIDER))
    assert [r["id"] for r in rows] == [bid]
    row = rows[0]
    assert row["status"] == "pending"
    assert row["gig_title"] == "Inbox test cleaning"
    assert row["other_party"] == "Inbox Buyer"


def test_client_sees_their_own_request():
    bid = _run(_seed())
    rows = _run(_list("client", CLIENT))
    assert [r["id"] for r in rows] == [bid]
    assert rows[0]["other_party"] == "Inbox Provider"


def test_neither_side_leaks_to_anybody_else():
    _run(_seed())
    assert _run(_list("provider", STRANGER)) == []
    assert _run(_list("client", STRANGER)) == []
    # And the two sides are not interchangeable: being the provider does not
    # put the booking in your own "requests I sent" list.
    assert _run(_list("client", PROVIDER)) == []


def test_lapsed_pending_hold_reports_as_expired():
    """The slot went back on sale the moment the hold lapsed, whether or not
    the sweep has run. Reporting the stored `pending` would offer an Accept
    button for a time somebody else may already have taken."""
    _run(_seed(expires_in_hours=-1))
    assert _run(_list("provider", PROVIDER))[0]["status"] == "expired"


def test_a_booking_with_no_expiry_still_reads_as_pending():
    """Bookings that predate hold expiry hold indefinitely — same rule as
    `_live_hold_query`. Expiring them here would report a slot as free that
    its owner believes is taken."""
    _run(_seed(expires_in_hours=None))
    assert _run(_list("provider", PROVIDER))[0]["status"] == "pending"


def test_contact_details_go_to_the_provider_only():
    _run(_seed())
    prov = _run(_list("provider", PROVIDER))[0]
    assert prov["contact_email"] == "buyer@example.test"
    assert prov["contact_phone"] == "0500000000"
    mine = _run(_list("client", CLIENT))[0]
    assert mine["contact_email"] is None
    assert mine["contact_phone"] is None


def test_whatsapp_lead_booking_belongs_to_no_client_list():
    """`answer_lead` writes `client_user_id: None` on purpose — the booking
    happened on WhatsApp and the customer has no account here."""
    bid = _run(_seed(status="accepted", client_user_id=None))
    assert [r["id"] for r in _run(_list("provider", PROVIDER))] == [bid]
    # No signed-in account can claim it: not the customer who never had one,
    # not the provider, not anybody else. (`user_id` is never null here —
    # verify_token has already refused the request by then.)
    assert _run(_list("client", CLIENT)) == []
    assert _run(_list("client", STRANGER)) == []

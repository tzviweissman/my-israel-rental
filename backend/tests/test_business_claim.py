"""Handing a built page over to the business it was built for.

Added 18 Oct 2026. Of the 26 taxi companies surveyed that day, several had
no website and one had only a Facebook page; none of them is going to fill
in a sign-up form. So the page gets built for them and handed over with a
one-time link.

WHY THESE CHECKS. A link that gives away a business is a credential, and
it is handled like one: never stored in the clear, spent on first use, and
refused once the business has anything to lose. Each test below pins one
of those, because the failure in every case is silent - a working link is
indistinguishable from a leaked one until someone uses it.

The transfer itself is deliberately narrow. It moves the business record
and its listings, and refuses outright once a business has traded, because
a half-finished sweep across orders, bookings, members and messages would
leave a business split between two accounts with no way to tell. The
"refuses" half is therefore as load-bearing as the "moves" half.

Needs mongod. Skips without one rather than failing, as the rest of the
suite does.
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import asyncio

import pytest
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from routes.marketplace.businesses import (  # noqa: E402
    CLAIM_TTL_DAYS,
    _TRADED_IN,
    _claim_hash,
)

MONGO_URL = os.environ.get("MONGO_URL", "")
pytestmark = pytest.mark.skipif(
    not ("localhost" in MONGO_URL or "127.0.0.1" in MONGO_URL),
    reason="needs a local mongod; never runs against a remote database",
)


def _local_db():
    """The suite's own rule: local mongod only, asserted rather than
    assumed. A test that writes business records must never be one
    environment variable away from production."""
    from motor.motor_asyncio import AsyncIOMotorClient
    url = os.environ["MONGO_URL"]
    assert "localhost" in url or "127.0.0.1" in url, "refusing to run against a non-local database"
    return AsyncIOMotorClient(url)[os.environ.get("DB_NAME", "myisraelrental")]


# -------------------------------------------------------- the token itself

def test_the_token_is_never_stored_in_the_clear():
    """A leaked database must not hand out businesses. The stored value is
    a hash; the token itself is returned once and never again."""
    token = "a-secret-token"
    h = _claim_hash(token)
    assert h != token
    assert len(h) == 64 and all(c in "0123456789abcdef" for c in h)
    # Deterministic, so a presented token can be looked up.
    assert _claim_hash(token) == h
    assert _claim_hash(token + "x") != h


def test_the_link_expires():
    """Thirty days. A link that lives forever is a key left in a door."""
    assert 0 < CLAIM_TTL_DAYS <= 90


# ----------------------------------------------- what counts as "has traded"

def test_history_is_looked_for_everywhere_it_lives():
    """Each entry is (collection, the field naming its owner). A missing
    collection here is the whole bug this guard exists to prevent: the
    business would be handed over and its history left behind."""
    by_coll = dict(_TRADED_IN)
    assert by_coll["store_orders"] == "owner_user_id"
    assert by_coll["business_members"] == "owner_user_id"
    assert by_coll["membership_plans"] == "owner_user_id"
    assert by_coll["marketplace_bookings"] == "provider_user_id"
    assert by_coll["quote_requests"] == "provider_user_id"


def test_a_business_that_has_traded_cannot_be_claimed():
    """The guard that keeps the narrow transfer honest. A fresh business
    has no history and may be handed over; one with a single order may
    not, because moving it would leave that order behind."""
    from unittest.mock import patch
    from routes.marketplace import businesses as bzr

    owner = f"test-claim-{uuid.uuid4().hex[:8]}"
    # A slug of its own: `businesses.slug` carries a unique index, so two
    # fixtures without one collide on null.
    biz = {"_id": str(uuid.uuid4()), "owner_user_id": owner, "name": "TEST_Claim",
           "slug": f"test-claim-{uuid.uuid4().hex[:10]}"}
    order = {"_id": str(uuid.uuid4()), "owner_user_id": owner, "TEST": True}

    async def go():
        db = _local_db()
        with patch.object(bzr, "db", db):
            await db.businesses.insert_one(biz)
            try:
                before = await bzr._has_traded(biz)
                await db.store_orders.insert_one(order)
                after = await bzr._has_traded(biz)
                return before, after
            finally:
                await db.businesses.delete_one({"_id": biz["_id"]})
                await db.store_orders.delete_one({"_id": order["_id"]})

    before, after = asyncio.run(go())
    assert before is None, "a business with no history should be claimable"
    assert after == "store_orders", "an order must block the handover, and name itself"


# ------------------------------------------------------- the link's lifetime

def _with_claim(**claim):
    base = {"token_hash": None, "claimed_at": None,
            "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat()}
    return {"_id": str(uuid.uuid4()), "owner_user_id": "u1", "name": "TEST_Claim",
            "slug": f"test-claim-{uuid.uuid4().hex[:10]}",
            "claim": {**base, **claim}}


def _resolve(biz, token, *, spend=False):
    """Look the token up the way the endpoints do, optionally after the
    link has been used. Returns the business, or the HTTPException."""
    from unittest.mock import patch
    from fastapi import HTTPException
    from routes.marketplace import businesses as bzr

    async def go():
        db = _local_db()
        with patch.object(bzr, "db", db):
            if biz:
                await db.businesses.insert_one(biz)
            try:
                if spend:
                    await db.businesses.update_one(
                        {"_id": biz["_id"]},
                        {"$set": {"claim.claimed_at": datetime.now(UTC).isoformat()}})
                try:
                    return await bzr._claimable(token)
                except HTTPException as e:
                    return e
            finally:
                if biz:
                    await db.businesses.delete_one({"_id": biz["_id"]})

    return asyncio.run(go())


def test_a_live_link_resolves():
    token = uuid.uuid4().hex
    biz = _with_claim(token_hash=_claim_hash(token))
    assert _resolve(biz, token)["_id"] == biz["_id"]


def test_a_spent_link_stops_working():
    """Single use, and the SAME 404 as a token that never existed, so the
    endpoint cannot be used to learn which tokens are real."""
    token = uuid.uuid4().hex
    biz = _with_claim(token_hash=_claim_hash(token))
    got = _resolve(biz, token, spend=True)
    assert getattr(got, "status_code", None) == 404


def test_an_expired_link_stops_working():
    token = uuid.uuid4().hex
    biz = _with_claim(token_hash=_claim_hash(token),
                      expires_at=(datetime.now(UTC) - timedelta(days=1)).isoformat())
    got = _resolve(biz, token)
    assert getattr(got, "status_code", None) == 404


def test_an_unknown_token_is_refused():
    got = _resolve(None, uuid.uuid4().hex)
    assert getattr(got, "status_code", None) == 404


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))

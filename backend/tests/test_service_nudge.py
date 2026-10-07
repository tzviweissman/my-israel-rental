"""The unanswered-message reminder covers services too.

A service chat lives in the same `messages` collection as a rental chat,
with property_id = the gig id. The pass used to look that id up in
`properties` only, so a business never heard that a customer was waiting.

Local MongoDB only; the email is stubbed, nothing is sent.
    .venv/Scripts/python -m pytest -q tests/test_service_nudge.py
"""
import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
pytestmark = pytest.mark.skipif(
    not any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1")),
    reason="local MongoDB only",
)

from routes.admin import chats_nudge as cn  # noqa: E402
from routes.deps import db  # noqa: E402


def run(c):
    return asyncio.get_event_loop().run_until_complete(c)


@pytest.fixture
def chat(monkeypatch):
    started = datetime.now(UTC).isoformat()
    sent = []

    async def capture(**kw):
        sent.append(kw)

    monkeypatch.setattr(cn, "_send_owner_nudge_email", capture)
    tag = uuid.uuid4().hex[:8]
    provider, customer, gig = f"nudge-pro-{tag}", f"nudge-cus-{tag}", f"nudge-gig-{tag}"
    run(db.users.insert_many([
        {"id": provider, "email": f"{provider}@local.test", "name": "Pro"},
        {"id": customer, "email": f"{customer}@local.test", "name": "Dana"},
    ]))
    run(db.marketplace_gigs.insert_one({"_id": gig, "title": "Deep cleaning", "provider_user_id": provider, "status": "published"}))

    def say(frm, to, hours_ago):
        run(db.messages.insert_one({"id": str(uuid.uuid4()), "property_id": gig, "sender_id": frm, "receiver_id": to,
                                    "content": "hi", "created_at": (datetime.now(UTC) - timedelta(hours=hours_ago)).isoformat()}))

    yield {"gig": gig, "provider": provider, "customer": customer, "say": say,
           "mine": lambda: [s for s in sent if s["property_id"] == gig]}
    run(db.messages.delete_many({"property_id": gig}))
    run(db.marketplace_gigs.delete_one({"_id": gig}))
    run(db.users.delete_many({"id": {"$in": [provider, customer]}}))
    run(db.chat_nudges.delete_many({"sent_at": {"$gte": started}, "source": "auto"}))
    run(db.admin_auto_nudge_log.delete_many({"ran_at": {"$gte": started}}))


def test_waiting_customer_nudges_the_provider_once(chat):
    chat["say"](chat["customer"], chat["provider"], 13)
    run(cn.run_auto_owner_nudge_pass())
    mine = chat["mine"]()
    assert len(mine) == 1
    assert mine[0]["owner"]["email"] == f"{chat['provider']}@local.test"
    assert mine[0]["renter"]["name"] == "Dana"
    assert mine[0]["kind"] == "service"
    run(cn.run_auto_owner_nudge_pass())
    assert len(chat["mine"]()) == 1


def test_no_nudge_after_the_provider_replied(chat):
    chat["say"](chat["customer"], chat["provider"], 14)
    chat["say"](chat["provider"], chat["customer"], 1)
    run(cn.run_auto_owner_nudge_pass())
    assert chat["mine"]() == []


def test_no_nudge_before_12_hours(chat):
    chat["say"](chat["customer"], chat["provider"], 11)
    run(cn.run_auto_owner_nudge_pass())
    assert chat["mine"]() == []

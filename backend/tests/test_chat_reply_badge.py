"""The reply badge counts chat replies.

Most service leads arrive by chat, but the badge was fed only when a
booking left "pending", so it almost never appeared. A provider's FIRST
reply in a conversation a customer started now counts; later messages and
conversations the provider opened do not.

Local MongoDB only.
    .venv/Scripts/python -m pytest -q tests/test_chat_reply_badge.py
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

from routes.deps import db  # noqa: E402
from routes.marketplace.shared import MIN_RESPONSES_FOR_BADGE, _response_bucket, record_chat_reply  # noqa: E402


def run(c):
    return asyncio.get_event_loop().run_until_complete(c)


@pytest.fixture
def world():
    tag = uuid.uuid4().hex[:8]
    pro, gig = f"badge-pro-{tag}", f"badge-gig-{tag}"
    run(db.marketplace_providers.insert_one({"user_id": pro}))
    run(db.marketplace_gigs.insert_one({"_id": gig, "provider_user_id": pro, "status": "published"}))

    def say(frm, to, hours_ago):
        at = (datetime.now(UTC) - timedelta(hours=hours_ago)).isoformat()
        run(db.messages.insert_one({"id": str(uuid.uuid4()), "property_id": gig, "sender_id": frm,
                                    "receiver_id": to, "message": "hi", "created_at": at}))
        run(record_chat_reply(gig, frm, to, at))

    def prov():
        return run(db.marketplace_providers.find_one({"user_id": pro}))

    yield {"pro": pro, "say": say, "prov": prov, "customer": lambda: f"badge-cus-{uuid.uuid4().hex[:8]}"}
    run(db.messages.delete_many({"property_id": gig}))
    run(db.marketplace_gigs.delete_one({"_id": gig}))
    run(db.marketplace_providers.delete_one({"user_id": pro}))


def test_first_reply_counts_once(world):
    c = world["customer"]()
    world["say"](c, world["pro"], 5)
    world["say"](c, world["pro"], 4)          # a second question: the clock is the first
    world["say"](world["pro"], c, 0)          # the first reply: 5 hours
    p = world["prov"]()
    assert p["response_count"] == 1 and abs(p["avg_response_hours"] - 5) < 0.05
    world["say"](world["pro"], c, 0)          # later messages never count
    assert world["prov"]()["response_count"] == 1


def test_provider_opened_conversation_never_counts(world):
    c = world["customer"]()
    world["say"](world["pro"], c, 3)
    world["say"](c, world["pro"], 2)
    world["say"](world["pro"], c, 0)
    assert not world["prov"]().get("response_count")


def test_badge_needs_the_minimum(world):
    for k in range(MIN_RESPONSES_FOR_BADGE):
        assert _response_bucket(world["prov"]()) is None
        c = world["customer"]()
        world["say"](c, world["pro"], 1)
        world["say"](world["pro"], c, 0)
    assert world["prov"]()["response_count"] == MIN_RESPONSES_FOR_BADGE
    assert _response_bucket(world["prov"]()) is not None

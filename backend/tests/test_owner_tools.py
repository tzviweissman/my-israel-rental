"""The three owner tools of 24 Oct 2026:

  * away_reply.py   one automatic "we got your message", only when the
                    business has not answered, once a day, and it never
                    counts as the business answering on the leads board
  * weekly_insights the to-do lines: enquiries waiting for an answer
  * ask.py          the model's reply is read safely

Runs in-process against the database in backend/.env (local only), with
the chat email replaced so nothing leaves the machine.
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
pytestmark = pytest.mark.skipif(not LOCAL, reason="needs the local MongoDB")


def test_parse_answer():
    from routes.marketplace.ask import parse_answer
    assert parse_answer('{"answer": "Yes, we deliver to Modiin.", "known": true}') == {"answer": "Yes, we deliver to Modiin.", "known": True}
    assert parse_answer('Sure! {"answer": "Not sure — ask them.", "known": false}')["answer"] == "Not sure , ask them."
    assert parse_answer("no json here") == {"answer": "", "known": False}
    assert parse_answer('{"answer": "", "known": true}')["known"] is False


def test_away_reply_and_weekly_todo(monkeypatch):
    import routes.chat
    from routes import weekly_insights as wi
    from routes.deps import db
    from routes.marketplace import away_reply as ar
    from routes.marketplace.leads import leads_board

    async def no_email(**_):
        return None
    monkeypatch.setattr(routes.chat, "_send_chat_email_safe", no_email)

    tag = uuid.uuid4().hex[:8]
    owner, cust, cust2 = f"TEST_ar_o_{tag}", f"TEST_ar_c_{tag}", f"TEST_ar_c2_{tag}"
    biz, gig = f"TEST_ar_b_{tag}", f"TEST_ar_g_{tag}"
    now = datetime.now(UTC)

    def msg(sender, receiver, minutes_ago, **extra):
        return {"id": str(uuid.uuid4()), "property_id": gig, "sender_id": sender, "receiver_id": receiver,
                "message": "Do you deliver on Friday?", "created_at": (now - timedelta(minutes=minutes_ago)).isoformat(),
                "read": False, **extra}

    async def go():
        await ar.ensure_away_indexes()
        await db.users.insert_many([{"id": owner, "name": "Owner", "email": f"{owner}@example.com"}, {"id": cust, "name": "Cust", "preferred_language": "he", "email": f"{cust}@example.com"},
                                    {"id": cust2, "name": "Cust2", "email": f"{cust2}@example.com"}])
        await db.businesses.insert_one({"_id": biz, "slug": biz, "owner_user_id": owner, "name": "Test bakery",
                                        "away_reply": {"on": True, "text": ""}})
        await db.marketplace_gigs.insert_one({"_id": gig, "business_id": biz, "provider_user_id": owner, "status": "published"})
        await db.messages.insert_many([
            msg(cust, owner, 15),                       # waiting 15 minutes: gets the reply
            msg(cust2, owner, 20), msg(owner, cust2, 12),  # the business answered: nothing
        ])
        try:
            assert await ar.run_once(now) == 1
            auto = await db.messages.find_one({"property_id": gig, "receiver_id": cust, "auto": ar.AUTO})
            assert auto["message"] == ar.DEFAULT_TEXT["he"] and auto["sender_id"] == owner
            # never twice: not on the next pass, nor for a new message within a day
            assert await ar.run_once(now) == 0
            await db.messages.insert_one(msg(cust, owner, 11))
            assert await ar.run_once(now) == 0
            # the leads board still shows the customer as waiting
            board = await leads_board(biz, {"user_id": owner})
            stage = {c["customer_id"]: c["stage"] for c in board["leads"] if c["source"] == "chat"}
            assert stage == {cust: "new", cust2: "replied"}
            # the weekly email's to-do counts it, and says so
            todo = await wi.todo_for(owner, [biz])
            assert todo["waiting"] == 1
            stats = {"services": None, "rentals": None, "todo": todo}
            assert wi.has_activity(stats)
            w = wi.week_windows(now)
            _, html = wi.render("Owner", stats, w, "en", "https://x/off")
            assert "1 enquiry is waiting for your reply." in html and "view=leads" in html
            # switched off: nothing
            await db.businesses.update_one({"_id": biz}, {"$set": {"away_reply.on": False}})
            await db.messages.insert_one(msg(f"TEST_ar_c3_{tag}", owner, 15))
            assert await ar.run_once(now) == 0
        finally:
            await db.messages.delete_many({"property_id": gig})
            await db.away_replies.delete_many({"business_id": biz})
            await db.businesses.delete_one({"_id": biz})
            await db.marketplace_gigs.delete_one({"_id": gig})
            await db.users.delete_many({"id": {"$in": [owner, cust, cust2]}})
            await db.notifications.delete_many({"user_id": {"$in": [cust, cust2]}})

    asyncio.run(go())

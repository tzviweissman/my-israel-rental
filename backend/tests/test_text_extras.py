"""The texts added on 7 Nov 2026 (routes/marketplace/order_texts.py): the
business's own line, review requests, reminders, delivery reports and
replies. No network, no database: a small in-memory stand-in."""
import asyncio
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pymongo.errors import DuplicateKeyError  # noqa: E402

from routes.marketplace import order_texts as ot  # noqa: E402
from routes.marketplace import orders  # noqa: E402
from utils import sms  # noqa: E402


def _match(d, q):
    for k, v in q.items():
        if k == "$or":
            if not any(_match(d, x) for x in v):
                return False
            continue
        if isinstance(v, dict) and "$in" in v:
            if d.get(k) not in v["$in"]:
                return False
            continue
        if isinstance(v, dict) and "$nin" in v:
            if d.get(k) in v["$nin"]:
                return False
            continue
        if isinstance(v, dict) and "$exists" in v:
            if (k in d) != v["$exists"]:
                return False
        elif isinstance(v, dict) and "$ne" in v:
            if d.get(k) == v["$ne"]:
                return False
        elif d.get(k) != v:
            return False
    return True


class Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *a, **k):
        self.docs = sorted(self.docs, key=lambda d: d.get("at") or "", reverse=True)
        return self

    def limit(self, n):
        self.docs = self.docs[:n]
        return self

    def __aiter__(self):
        self._it = iter(self.docs)
        return self

    async def __anext__(self):
        try:
            return next(self._it)
        except StopIteration:
            raise StopAsyncIteration


class Coll:
    def __init__(self, docs=()):
        self.docs = [dict(d) for d in docs]

    async def find_one(self, q, proj=None, sort=None):
        hits = [d for d in self.docs if _match(d, q)]
        if sort:
            hits.sort(key=lambda d: d.get("at") or "", reverse=True)
        return hits[0] if hits else None

    def find(self, q, proj=None):
        return Cursor([d for d in self.docs if _match(d, q)])

    async def insert_one(self, d):
        if any(x.get("_id") == d.get("_id") for x in self.docs):
            raise DuplicateKeyError("dup")
        self.docs.append(dict(d))

    async def update_one(self, q, u):
        for d in self.docs:
            if _match(d, q):
                d.update(u["$set"])
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)

    async def find_one_and_update(self, q, u, return_document=None):
        for d in self.docs:
            if _match(d, q):
                d.update(u["$set"])
                return d
        return None

    async def delete_one(self, q):
        self.docs = [d for d in self.docs if not _match(d, q)]


class DB:
    def __init__(self, **colls):
        self.__dict__.update(colls)

    def __getitem__(self, name):
        return getattr(self, name)

    def __getattr__(self, name):
        c = Coll()
        setattr(self, name, c)
        return c


def run(c):
    return asyncio.get_event_loop().run_until_complete(c) if False else asyncio.run(c)


@pytest.fixture
def world(monkeypatch):
    biz = {"_id": "b1", "name": "Blazin Boards", "owner_user_id": "u1",
           "order_settings": {"text_on": True, "text_number": "055-337-8799", "text_note": "Pickup at Farn 5"}}
    order = {"_id": "o1", "business_id": "b1", "gig_id": "g1", "order_no": 1042, "source": "website", "status": "done",
             "customer_phone": "052-111-2222", "track_token": "t" * 22, "owner_token": "o" * 22, "lang": "en"}
    booking = {"_id": "k1", "gig_id": "g1", "contact_phone": "052-111-2222", "track_token": "k" * 22, "lang": "en",
               "preferred_date": "2026-11-08", "time_slot": "14:00"}
    db = DB(businesses=Coll([biz]), store_orders=Coll([order]), marketplace_bookings=Coll([booking]),
            marketplace_gigs=Coll([{"_id": "g1", "business_id": "b1", "title": "Haircut"}]),
            users=Coll([{"id": "u1", "email": "owner@example.com"}]))
    monkeypatch.setattr(ot, "db", db)
    monkeypatch.setattr(orders, "_frontend_url", lambda: "https://myisraelrental.com")
    ids = iter(str(uuid.uuid4()) for _ in range(50))
    sent = AsyncMock(side_effect=lambda **k: next(ids))
    monkeypatch.setattr(ot, "send_sms", sent)
    monkeypatch.setattr(orders, "_email", AsyncMock())
    monkeypatch.setattr(orders, "_notify", AsyncMock())
    monkeypatch.setenv("REVIEWS_NATIVE_ENABLED", "1")
    monkeypatch.setenv("CELLACT_API_KEY", "test-key")
    return SimpleNamespace(db=db, biz=biz, order=order, booking=booking, sent=sent)


def test_own_line_on_customer_texts_only(world):
    run(ot._texts_after(world.order, world.biz, True))
    to_customer, to_business = world.sent.await_args_list
    assert to_customer.kwargs["body"].endswith("\nPickup at Farn 5") and to_customer.kwargs["reply"] is True
    assert "Pickup at Farn 5" not in to_business.kwargs["body"] and to_business.kwargs["reply"] is False


def test_review_text_once_and_only_with_switch_on(world):
    run(ot.text_review_order(world.order))
    run(ot.text_review_order(world.order))
    assert world.sent.await_count == 1
    assert "review" in world.sent.await_args.kwargs["body"] and "/orders/track/" in world.sent.await_args.kwargs["body"]
    world.biz["order_settings"]["text_on"] = False
    world.biz["order_settings"]["text_number"] = None
    run(ot.text_review_booking(world.booking))
    assert world.sent.await_count == 1


def test_booking_review_goes_to_its_status_page(world):
    run(ot.text_review_booking(world.booking))
    assert "/bookings/track/" + "k" * 22 in world.sent.await_args.kwargs["body"]


def test_reminder_text_carries_link_and_line(world):
    ok = run(ot.text_booking_reminder(world.booking, world.biz, "Haircut", "tomorrow", "14:00"))
    body = world.sent.await_args.kwargs["body"]
    assert ok and "Haircut" in body and "tomorrow at 14:00" in body and "/bookings/track/" in body and body.endswith("Pickup at Farn 5")


def test_delivery_report_marks_the_text_and_tells_owner_of_their_own_number(world):
    run(ot.text_owner_new_order("o1"))
    row = world.db.sms_log.docs[0]
    assert row["who"] == "business" and row["status"] == "sent"
    key = sms.hook_key()

    def post(ev):
        req = SimpleNamespace(json=AsyncMock(return_value=ev))
        return run(ot.sms_status(key, req))

    post({"id": row["_id"], "event": "mt_ok", "errorId": "5000"})
    assert row["status"] == "sent"
    post({"id": row["_id"], "event": "mt_rej", "errorId": "7001"})
    assert row["status"] == "failed" and row["problem"] == "unreachable"
    assert orders._email.await_count == 1 and orders._notify.await_count == 1
    post({"id": row["_id"], "event": "mt_del", "errorId": "1000"})  # a late report never overwrites the final one
    assert row["status"] == "failed"
    with pytest.raises(HTTPException):
        run(ot.sms_status("wrong", SimpleNamespace(json=AsyncMock(return_value={}))))


def test_reply_reaches_the_business(world):
    run(ot._texts_after(world.order, world.biz, True, tell_business=False))
    world.sent.reset_mock()
    req = SimpleNamespace(json=AsyncMock(return_value={"id": "m1", "event": "mo", "sender": "+972521112222", "content": "Running 10 minutes late"}))
    run(ot.sms_in(sms.hook_key(), req))
    body = world.sent.await_args.kwargs["body"]
    assert "Running 10 minutes late" in body and "#1042" in body and world.sent.await_args.kwargs["to"] == "055-337-8799"
    assert orders._notify.await_count == 1
    run(ot.sms_in(sms.hook_key(), req))  # the same reply twice is passed on once
    assert world.sent.await_count == 1
    texts, replies = run(ot.recent_texts("b1"))
    assert replies[0]["content"] == "Running 10 minutes late" and texts


def test_cellact_request_has_report_address_and_reply_number(monkeypatch):
    monkeypatch.setenv("CELLACT_API_KEY", "k")
    monkeypatch.setenv("CELLACT_SENDER", "myisraelrental")
    monkeypatch.setenv("FRONTEND_URL", "https://myisraelrental.com")
    monkeypatch.delenv("CELLACT_REPLY_NUMBER", raising=False)
    req = sms._request_for("972521112222", "hi", reply=True)
    assert req["json"]["sender"] == "myisraelrental"
    assert req["json"]["webhook_url"] == f"https://myisraelrental.com/api/marketplace/sms/status/{sms.hook_key()}"
    monkeypatch.setenv("CELLACT_REPLY_NUMBER", "972557000918")
    assert sms._request_for("972521112222", "hi", reply=True)["json"]["sender"] == "972557000918"
    assert sms._request_for("972521112222", "hi", reply=False)["json"]["sender"] == "myisraelrental"


def test_reminder_texts_the_day_before_and_two_hours_before(world, monkeypatch):
    from datetime import UTC, datetime, timedelta
    from routes.marketplace import appointment_reminders as ar
    monkeypatch.setattr(ar, "db", world.db)
    monkeypatch.setattr(ar, "send_reminder", AsyncMock(return_value=False))  # the email has its own tests
    b = world.db.marketplace_bookings.docs[0]
    b["status"] = "accepted"
    start = datetime(2026, 11, 8, 14, 0, tzinfo=ar.IL)
    run(ar.run_once(start.astimezone(UTC) - timedelta(hours=20)))
    assert world.sent.await_count == 1 and "tomorrow at 14:00" in world.sent.await_args.kwargs["body"]
    run(ar.run_once(start.astimezone(UTC) - timedelta(hours=19)))  # once per stage
    assert world.sent.await_count == 1
    run(ar.run_once(start.astimezone(UTC) - timedelta(hours=2, minutes=30)))  # between the two: nothing
    assert world.sent.await_count == 1
    run(ar.run_once(start.astimezone(UTC) - timedelta(minutes=90)))
    assert world.sent.await_count == 2 and "today at 14:00" in world.sent.await_args.kwargs["body"]

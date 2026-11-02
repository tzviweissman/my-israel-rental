"""New orders by text: the owner's one-tap Confirm / Decline page, and the
texts that go out after it (routes/marketplace/order_texts.py).

No network, no database: `db` is a small in-memory stand-in and the
sender is a mock.
"""
import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from routes.marketplace import order_texts as ot  # noqa: E402
from routes.marketplace import orders  # noqa: E402
from utils import sms  # noqa: E402

TOKEN = "o" * 22


class Coll:
    def __init__(self, docs=()):
        self.docs = list(docs)

    async def find_one(self, q, proj=None):
        for d in self.docs:
            if all(d.get(k) == v for k, v in q.items()):
                return d
        return None


@pytest.fixture
def world(monkeypatch):
    order = {"_id": "abcdef123456", "business_id": "b1", "gig_id": "g1", "owner_user_id": "u1",
             "status": "new", "fulfilment": "pickup", "order_no": 1042,
             "customer_name": "Dani", "customer_phone": "052-111-2222", "customer_phone_e164": "972521112222",
             "items": "2 × Family board", "total": 240.0, "currency": "ILS", "needed_by": "2026-11-06T10:00",
             "track_token": "t" * 22, "owner_token": TOKEN, "lang": "en"}
    db = type("DB", (), {})()
    db.store_orders = Coll([order])
    db.businesses = Coll([{"_id": "b1", "name": "Blazin Boards", "owner_user_id": "u1"}])
    db.users = Coll([{"id": "u1", "preferred_language": "en"}])
    db.marketplace_gigs = Coll([{"_id": "g1"}])
    monkeypatch.setattr(ot, "db", db)
    monkeypatch.setattr(ot, "check_rate", lambda *a, **k: None)
    monkeypatch.setattr(orders, "_frontend_url", lambda: "https://myisraelrental.com")

    async def move(o, payload, by):
        # _transition's compare-and-set: only lands if the order is still "new".
        if o["status"] != "new":
            raise HTTPException(status_code=409, detail="moved")
        order["status"] = payload.status
    monkeypatch.setattr(orders, "_transition", AsyncMock(side_effect=move))

    sent = AsyncMock(return_value=True)
    monkeypatch.setattr(ot, "send_sms", sent)
    with patch("routes.marketplace.gigs.gig_whatsapp_number", AsyncMock(return_value="+972501234567")):
        yield order, sent


def run(c):
    return asyncio.run(c)


def test_owner_text_has_everything_to_decide(world):
    order, _ = world
    body = ot.owner_text(order, "https://x/orders/owner/" + TOKEN, he=False)
    for part in ("#1042", "Dani", "052-111-2222", "2 x Family board", "Pickup", "06/11 10:00", "ILS 240", TOKEN):
        assert part in body
    # Plain SMS alphabet only, or every part of the text costs double.
    assert all(ord(ch) < 128 for ch in body)


def test_confirm_moves_once_and_texts_both(world):
    order, sent = world
    out = run(ot.owner_confirm(TOKEN, None))
    assert out["status"] == "preparing" and out["already"] is False
    to = {c.kwargs["to"]: c.kwargs["body"] for c in sent.await_args_list}
    assert "#1042" in to["972521112222"] and "/orders/track/" + "t" * 22 in to["972521112222"]
    assert "#1042" in to["+972501234567"] and "/orders/owner/" + TOKEN in to["+972501234567"]

    sent.reset_mock()
    again = run(ot.owner_confirm(TOKEN, None))
    assert again["already"] is True and sent.await_count == 0
    assert orders._transition.await_count == 1


def test_decline_tells_only_the_customer(world):
    order, sent = world
    out = run(ot.owner_decline(TOKEN, None))
    assert out["status"] == "cancelled"
    assert [c.kwargs["to"] for c in sent.await_args_list] == ["972521112222"]
    assert "can't take" in sent.await_args.kwargs["body"]


def test_hebrew_order_gets_hebrew_text(world):
    order, sent = world
    order["lang"] = "he"
    run(ot.owner_confirm(TOKEN, None))
    customer = next(c.kwargs["body"] for c in sent.await_args_list if c.kwargs["to"] == "972521112222")
    assert "אושרה" in customer and "#1042" in customer


def test_bad_or_unknown_token_is_404(world):
    for tok in ("short", "x" * 22):
        with pytest.raises(HTTPException) as e:
            run(ot.owner_order(tok, None))
        assert e.value.status_code == 404


def test_old_order_without_number_uses_id_tail():
    assert ot.order_no({"_id": "abcdef123456"}) == "#123456"


def test_sender_by_country(monkeypatch):
    monkeypatch.setenv("TWILIO_SMS_FROM", "+15550001111")
    monkeypatch.setenv("TWILIO_SMS_FROM_IL", "MyIsrael")
    assert sms._sender_for("972521112222") == "MyIsrael"
    assert sms._sender_for("12125551234") == "+15550001111"
    monkeypatch.delenv("TWILIO_SMS_FROM_IL")
    assert sms._sender_for("972521112222") == "+15550001111"


def test_not_configured_sends_nothing(monkeypatch):
    for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM", "TWILIO_SMS_FROM_IL"):
        monkeypatch.delenv(k, raising=False)
    assert run(sms.send_sms(to="+972521112222", body="hi")) is False


def test_text_goes_when_whatsapp_did_not(monkeypatch):
    texted = AsyncMock(return_value=True)
    monkeypatch.setattr(orders, "db", type("DB", (), {"users": Coll([{"id": "u1"}])})())
    with patch("routes.marketplace.gigs.gig_whatsapp_number", AsyncMock(return_value="+972501234567")), \
         patch("utils.whatsapp.send_new_order_notification", AsyncMock(return_value=False)), \
         patch.object(ot, "text_owner_new_order", texted):
        run(orders.alert_business_on_whatsapp({"_id": "g1"}, "u1", "Dani", "2 x board", "/dashboard", "order", order_id="o1"))
    texted.assert_awaited_once_with("o1", "+972501234567")

    texted.reset_mock()
    with patch("routes.marketplace.gigs.gig_whatsapp_number", AsyncMock(return_value="+972501234567")), \
         patch("utils.whatsapp.send_new_order_notification", AsyncMock(return_value=True)), \
         patch.object(ot, "text_owner_new_order", texted):
        run(orders.alert_business_on_whatsapp({"_id": "g1"}, "u1", "Dani", "2 x board", "/dashboard", "order", order_id="o1"))
    texted.assert_not_awaited()

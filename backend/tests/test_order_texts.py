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
    db.businesses = Coll([{"_id": "b1", "name": "Blazin Boards", "owner_user_id": "u1", "order_settings": {"text_on": True}}])
    db.users = Coll([{"id": "u1", "preferred_language": "en"}])
    db.marketplace_gigs = Coll([{"_id": "g1", "business_id": "b1"}])
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


def test_customer_is_emailed_the_decision(world, monkeypatch):
    order, _ = world
    order["customer_email"] = "dani@x.com"
    mail = AsyncMock()
    monkeypatch.setattr(orders, "_email", mail)
    run(ot.owner_confirm(TOKEN, None))
    assert mail.await_args.args[0] == "dani@x.com" and "#1042" in mail.await_args.args[1]
    assert "/orders/track/" in mail.await_args.kwargs["button"][1]

    order["status"] = "new"
    mail.reset_mock()
    run(ot.owner_decline(TOKEN, None))
    assert "Sorry" in mail.await_args.args[2] and mail.await_args.kwargs["button"] is None


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


def test_israel_goes_through_cellact_when_set(monkeypatch):
    import httpx
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC1")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "t")
    monkeypatch.setenv("TWILIO_SMS_FROM", "+15550001111")
    monkeypatch.setenv("CELLACT_API_KEY", "k")
    monkeypatch.setenv("CELLACT_SENDER", "MyIsraelRnt")
    monkeypatch.delenv("SMS_DRY_RUN", raising=False)
    assert sms._request_for("972521112222", "hi")["url"] == sms.CELLACT_URL
    assert "twilio" in sms._request_for("12125551234", "hi")["url"]

    def answer(body):
        return AsyncMock(return_value=httpx.Response(200, json=body, request=httpx.Request("POST", sms.CELLACT_URL)))

    with patch.object(httpx.AsyncClient, "post", answer({"result": True, "id": "x"})) as post:
        assert run(sms.send_sms(to="052-111-2222", body="hi")) is True
    assert post.call_args.kwargs["json"] == {"to_s": ["+972521112222"], "text": "hi", "sender": "MyIsraelRnt"}
    assert post.call_args.kwargs["headers"] == {"Authorization": "Bearer k"}
    # Cellact refuses with a 200 and result false.
    with patch.object(httpx.AsyncClient, "post", answer({"result": False, "errorCode": 10})):
        assert run(sms.send_sms(to="+972521112222", body="hi")) is False


def test_not_configured_sends_nothing(monkeypatch):
    for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM", "TWILIO_SMS_FROM_IL",
              "CELLACT_API_KEY", "CELLACT_SENDER"):
        monkeypatch.delenv(k, raising=False)
    assert run(sms.send_sms(to="+972521112222", body="hi")) is False


def test_text_goes_when_whatsapp_did_not(monkeypatch):
    texted = AsyncMock(return_value=True)
    monkeypatch.setattr(orders, "db", type("DB", (), {"users": Coll([{"id": "u1"}])})())
    with patch("routes.marketplace.gigs.gig_whatsapp_number", AsyncMock(return_value="+972501234567")), \
         patch("utils.whatsapp.send_new_order_notification", AsyncMock(return_value=False)), \
         patch.object(ot, "text_owner_new_order", texted):
        run(orders.alert_business_on_whatsapp({"_id": "g1"}, "u1", "Dani", "2 x board", "/dashboard", "order", order_id="o1"))
    texted.assert_awaited_once_with("o1")

    texted.reset_mock()
    with patch("routes.marketplace.gigs.gig_whatsapp_number", AsyncMock(return_value="+972501234567")), \
         patch("utils.whatsapp.send_new_order_notification", AsyncMock(return_value=True)), \
         patch.object(ot, "text_owner_new_order", texted):
        run(orders.alert_business_on_whatsapp({"_id": "g1"}, "u1", "Dani", "2 x board", "/dashboard", "order", order_id="o1"))
    texted.assert_not_awaited()

    # No WhatsApp number at all: the texting number may still be set.
    with patch("routes.marketplace.gigs.gig_whatsapp_number", AsyncMock(return_value="")), \
         patch.object(ot, "text_owner_new_order", texted):
        run(orders.alert_business_on_whatsapp({"_id": "g1"}, "u1", "Dani", "2 x board", "/dashboard", "order", order_id="o1"))
    texted.assert_awaited_once_with("o1")


def test_chosen_text_number_beats_whatsapp(world):
    order, sent = world
    ot.db.businesses.docs[0]["order_settings"] = {"text_number": "055-337-8799"}
    run(ot.owner_confirm(TOKEN, None))
    to = [c.kwargs["to"] for c in sent.await_args_list]
    assert "055-337-8799" in to and "+972501234567" not in to


def test_switch_and_booking_text(world):
    order, sent = world
    biz = ot.db.businesses.docs[0]
    biz["order_settings"] = {}
    assert ot.texts_on(biz) is False
    gig = {"_id": "g1", "business_id": "b1"}
    assert run(ot.text_owner_new_booking(gig, "Dani", "Haircut", "tok", "u1")) is False
    assert sent.await_count == 0

    # On with no number of its own: the WhatsApp number.
    biz["order_settings"] = {"text_on": True}
    assert ot.texts_on(biz) is True
    run(ot.text_owner_new_booking(gig, "Dani", "Haircut", "tok", "u1"))
    assert sent.await_args.kwargs["to"] == "+972501234567" and "Haircut" in sent.await_args.kwargs["body"]
    assert "/bookings/owner/tok" in sent.await_args.kwargs["body"]
    # A number chosen before the switch existed counts as on.
    assert ot.texts_on({"order_settings": {"text_number": "055-337-8799"}}) is True


def test_guest_booking_answer_goes_by_text(world):
    _, sent = world
    b = {"contact_phone": "052-111-2222", "track_token": "t" * 22, "lang": "en", "gig_id": "g1"}
    run(ot.text_customer_booking(b, "accepted", "Haircut"))
    assert sent.await_args.kwargs["to"] == "052-111-2222"
    assert "confirmed" in sent.await_args.kwargs["body"] and "/bookings/track/" in sent.await_args.kwargs["body"]
    run(ot.text_customer_booking({**b, "lang": "he"}, "declined", "Haircut"))
    assert "מצטערים" in sent.await_args.kwargs["body"]
    sent.reset_mock()
    run(ot.text_customer_booking({"track_token": "t" * 22}, "accepted", "Haircut"))
    assert sent.await_count == 0


def test_owner_token_answers_a_booking_only_while_waiting(world, monkeypatch):
    b = {"_id": "bk1", "owner_token": "k" * 22, "status": "pending", "provider_user_id": "u1", "gig_id": "g1"}
    ot.db.marketplace_bookings = Coll([b])

    async def move(bid, patch, user):
        assert user == {"user_id": "u1"}
        b["status"] = patch.status
    from routes.marketplace import gigs
    monkeypatch.setattr(gigs, "update_booking", AsyncMock(side_effect=move))
    out = run(ot.owner_booking_confirm("k" * 22, None))
    assert out["status"] == "accepted" and out["already"] is False
    again = run(ot.owner_booking_decline("k" * 22, None))
    assert again["status"] == "accepted" and again["already"] is True
    assert gigs.update_booking.await_count == 1
    with pytest.raises(HTTPException):
        run(ot.owner_booking("short", None))


def test_dashboard_decision_tells_the_customer_only(world):
    order, sent = world
    order["source"] = "website"
    run(ot.customer_told_of_decision(order, "preparing"))
    assert [c.kwargs["to"] for c in sent.await_args_list] == ["972521112222"]
    assert "confirmed" in sent.await_args.kwargs["body"]

    sent.reset_mock()
    run(ot.customer_told_of_decision(order, "cancelled"))
    assert "can't take" in sent.await_args.kwargs["body"]

    # Not a first decision, or an order the business typed in: nothing.
    sent.reset_mock()
    run(ot.customer_told_of_decision({**order, "status": "preparing"}, "ready"))
    run(ot.customer_told_of_decision({**order, "source": "manual"}, "preparing"))
    assert sent.await_count == 0


def test_customer_told_order_arrived(world):
    order, sent = world
    biz = {"name": "Blazin Boards", "order_settings": {"text_on": True}}
    run(ot.text_customer_received(order, biz))
    body = sent.await_args.kwargs["body"]
    assert sent.await_args.kwargs["to"] == "972521112222"
    assert "#1042" in body and "confirm" in body and "/orders/track/" in body
    sent.reset_mock()
    run(ot.text_customer_received({**order, "table": 4}, biz))
    assert sent.await_count == 0


def test_app_link_opens_the_app():
    from utils.whatsapp_link import build_whatsapp_app_link
    assert build_whatsapp_app_link("052-111-2222", "a b") == "whatsapp://send?phone=972521112222&text=a%20b"
    assert build_whatsapp_app_link("", "a") is None


def test_search_finds_number_name_and_phone():
    o = {"_id": "abcdef123456", "order_no": 1042, "customer_name": "Dani Cohen",
         "customer_phone": "052-111-2222", "customer_phone_e164": "972521112222", "customer_email": "dani@x.com"}
    for q in ("1042", "#1042", "dani", "Cohen", "052-111-2222", "0521112222", "+972 52 111 2222", "1112222", "dani@x"):
        assert ot.matches(o, q), q
    for q in ("1043", "Moshe", "0529999999", "104"):
        assert not ot.matches(o, q), q
    # An old order without a number is found by the code it shows.
    assert ot.matches({"_id": "abcdef123456"}, "#123456")


def test_staff_view_never_carries_the_confirm_key():
    out = orders._public({"_id": "o1", "order_no": 1042, "owner_token": TOKEN, "customer_name": "Dani"})
    assert "owner_token" not in out and out["order_no"] == "#1042"


class Orders(Coll):
    """Stand-in with the (business_id, order_no) unique index."""
    def __init__(self, docs=()):
        super().__init__(docs)

    async def insert_one(self, d):
        from pymongo.errors import DuplicateKeyError
        if any(x["business_id"] == d["business_id"] and x.get("order_no") == d["order_no"] for x in self.docs):
            raise DuplicateKeyError("E11000 duplicate key error index: business_id_1_order_no_1")
        self.docs.append(dict(d))

    async def find_one(self, q, proj=None, sort=None):
        rows = [d for d in self.docs if d["business_id"] == q["business_id"] and "order_no" in d]
        return max(rows, key=lambda d: d["order_no"]) if rows else None


class Counters:
    def __init__(self):
        self.n = {}

    async def find_one_and_update(self, q, upd, upsert=False, return_document=None):
        self.n[q["_id"]] = self.n.get(q["_id"], 0) + upd["$inc"]["n"]
        return {"n": self.n[q["_id"]]}

    async def update_one(self, q, upd, upsert=False):
        self.n[q["_id"]] = max(self.n.get(q["_id"], 0), upd["$max"]["n"])


def test_numbers_never_repeat_even_if_the_counter_was_reset(monkeypatch):
    db = type("DB", (), {})()
    db.store_orders = Orders([{"_id": "old", "business_id": "b1", "order_no": 1001},
                              {"_id": "old2", "business_id": "b1", "order_no": 1002}])
    db.counters = Counters()          # reset: would hand out 1001 again
    monkeypatch.setattr(ot, "db", db)
    new = {"_id": "n1", "business_id": "b1"}
    run(ot.insert_order(new))
    assert new["order_no"] == 1003
    other = {"_id": "n2", "business_id": "b2"}
    run(ot.insert_order(other))
    assert other["order_no"] == 1001  # each store counts its own
    nums = [d["order_no"] for d in db.store_orders.docs if d["business_id"] == "b1"]
    assert len(nums) == len(set(nums))


def test_price_request_texts_both_only_with_texts_on(world, monkeypatch):
    _, sent = world
    monkeypatch.setattr(ot, "_business_text_number", AsyncMock(return_value="+972501234567"))
    gig = {"_id": "g1", "business_id": "b1", "provider_user_id": "u1"}
    q = {"name": "Dani", "description": "Balloons for a party"}
    ot.db.businesses.docs[0]["order_settings"] = {}
    run(ot.text_owner_new_quote(gig, q))
    run(ot.text_customer_request(gig, "0521112222", "/quotes/abc", False))
    assert sent.await_count == 0
    ot.db.businesses.docs[0]["order_settings"] = {"text_on": True}
    run(ot.text_owner_new_quote(gig, q))
    run(ot.text_customer_request(gig, "0521112222", "/quotes/abc", False))
    assert sent.await_count == 2
    assert "Balloons for a party" in sent.await_args_list[0].kwargs["body"]
    assert "/quotes/abc" in sent.await_args_list[1].kwargs["body"]


def test_switch_off_sends_no_text_at_all(world):
    """Texts go only to a business that turned them on (Tzvi, 6 Nov 2026)."""
    order, sent = world
    biz = ot.db.businesses.docs[0]
    biz["order_settings"] = {"text_on": False}
    run(ot.text_owner_new_order(order["_id"]))
    run(ot.text_customer_received(order, biz))
    run(ot._texts_after(order, biz, True))
    run(ot.text_customer_booking({"contact_phone": "0521112222", "track_token": "t" * 22, "gig_id": "g1"}, "accepted", "Board"))
    assert sent.await_count == 0
    biz["order_settings"] = {"text_on": True}
    run(ot.text_customer_received(order, biz))
    run(ot.text_customer_booking({"contact_phone": "0521112222", "track_token": "t" * 22, "gig_id": "g1"}, "accepted", "Board"))
    assert sent.await_count == 2

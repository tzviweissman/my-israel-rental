"""The owner taps Confirm / Decline on the WhatsApp new-order message.

No network, no database: `db` is a small in-memory stand-in and the two
senders are mocks, so this runs without the sending half being merged.
"""
import asyncio
import hashlib
import hmac
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from routes import whatsapp_webhook as wh  # noqa: E402
from routes.marketplace import orders  # noqa: E402

OWNER = "972501234567"


class Coll:
    def __init__(self, docs=()):
        self.docs = list(docs)

    async def find_one(self, q, proj=None):
        for d in self.docs:
            if all(d.get(k) == v for k, v in q.items()):
                return d
        return None

    async def insert_one(self, d):
        if any(x["_id"] == d["_id"] for x in self.docs):
            raise DuplicateKeyError("dup")
        self.docs.append(d)

    async def find_one_and_update(self, q, upd, return_document=None):
        d = await self.find_one(q)
        if d:
            d.update(upd["$set"])
        return d


class Req:
    def __init__(self, body: bytes, sig: str):
        self._b, self.headers = body, {"X-Hub-Signature-256": sig}

    async def body(self):
        return self._b

    async def json(self):
        return json.loads(self._b)


def _sign(raw: bytes, secret="s3cret"):
    return "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


def _body(payload, msg_id="wamid.1", sender=OWNER):
    msg = {"id": msg_id, "from": sender, "type": "button", "button": {"payload": payload}}
    return json.dumps({"entry": [{"changes": [{"value": {"messages": [msg]}}]}]}).encode()


@pytest.fixture
def world(monkeypatch):
    monkeypatch.setenv("WHATSAPP_APP_SECRET", "s3cret")
    monkeypatch.setenv("WHATSAPP_VERIFY_TOKEN", "verify-me")
    order = {"_id": "o1", "business_id": "b1", "gig_id": "g1", "status": "new", "fulfilment": "pickup",
             "customer_name": "Dani", "customer_phone_e164": "972521112222", "track_token": "t" * 20}
    db = type("DB", (), {})()
    db.store_orders = Coll([order])
    db.businesses = Coll([{"_id": "b1", "name": "Blazin", "owner_user_id": "u1"}])
    db.users = Coll([{"id": "u1", "preferred_language": "en"}])
    db.marketplace_gigs = Coll([{"_id": "g1", "provider_user_id": "u1"}])
    db.whatsapp_webhook_events = Coll()
    customer, text = AsyncMock(return_value=True), AsyncMock(return_value=True)
    with patch.object(wh, "db", db), patch.object(orders, "db", db), \
            patch("routes.marketplace.gigs.gig_whatsapp_number", AsyncMock(return_value="050-123-4567")), \
            patch("utils.whatsapp.send_order_confirmed_to_customer", customer, create=True), \
            patch("utils.whatsapp.send_whatsapp_text", text, create=True), \
            patch("routes.marketplace.automations.fire_in_background"), \
            patch("routes.marketplace.dropship.on_supplier_status", AsyncMock()):
        yield order, customer, text


def _post(raw, sig=None):
    return asyncio.run(wh.receive_webhook(Req(raw, _sign(raw) if sig is None else sig)))


def test_handshake():
    with patch.dict("os.environ", {"WHATSAPP_VERIFY_TOKEN": "verify-me"}):
        r = asyncio.run(wh.verify_webhook("subscribe", "verify-me", "123"))
        assert r.body == b"123"
        for mode, tok in (("subscribe", "nope"), ("other", "verify-me")):
            with pytest.raises(HTTPException) as e:
                asyncio.run(wh.verify_webhook(mode, tok, "123"))
            assert e.value.status_code == 403


def test_bad_signature_is_refused(world):
    with pytest.raises(HTTPException) as e:
        _post(_body("order_confirm:o1"), sig="sha256=bad")
    assert e.value.status_code == 403
    assert world[0]["status"] == "new"


def test_confirm_moves_order_and_tells_both(world):
    order, customer, text = world
    assert _post(_body("order_confirm:o1")) == {"ok": True}
    assert order["status"] == "preparing"
    customer.assert_awaited_once()
    assert customer.await_args.kwargs["recipient_phone"] == "972521112222"
    assert customer.await_args.kwargs["track_url"].endswith("/orders/track/" + "t" * 20)
    text.assert_awaited_once()
    assert text.await_args.kwargs["recipient_phone"] == OWNER


def test_duplicate_message_is_a_noop(world):
    order, customer, text = world
    _post(_body("order_confirm:o1"))
    _post(_body("order_confirm:o1"))
    assert customer.await_count == 1 and text.await_count == 1


def test_stranger_is_ignored(world):
    order, customer, text = world
    _post(_body("order_confirm:o1", sender="972509999999"))
    assert order["status"] == "new"
    customer.assert_not_awaited()
    text.assert_not_awaited()


def test_already_moved_order_is_reported_not_changed(world):
    order, customer, text = world
    order["status"] = "ready"
    _post(_body("order_confirm:o1"))
    assert order["status"] == "ready"
    customer.assert_not_awaited()
    assert "ready" in text.await_args.kwargs["body"]


def test_decline_cancels(world):
    order, customer, text = world
    _post(_body("order_decline:o1"))
    assert order["status"] == "cancelled"
    customer.assert_not_awaited()
    assert text.await_args.kwargs["body"] == "Declined."

"""Sending half of the WhatsApp order confirm: buttons on the owner's alert,
the customer's confirmed message, and the plain acknowledgement text.

No network: httpx's client is replaced and the payload inspected.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import httpx  # noqa: E402
from utils import whatsapp as wa  # noqa: E402

META = {"token": "t", "phone_id": "123", "public_url": "https://x.test", "template": "new_order"}
ORDER = dict(recipient_phone="0501234567", customer_name="Dani", summary="Board",
             path="/dashboard", kind="order", language="en")


def _call(fn, env=None, meta=META, **kw):
    posts = []

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, json=None, headers=None):
            posts.append(json)
            return httpx.Response(200, json={})

    with patch.object(wa, "_meta_config", return_value=dict(meta) if meta else None), \
         patch.object(httpx, "AsyncClient", FakeClient), \
         patch.dict(os.environ, env or {}):
        # Template names come only from `env`, whatever the machine has set.
        for k in ("WHATSAPP_TEMPLATE_NEW_ORDER_CONFIRM", "WHATSAPP_TEMPLATE_ORDER_CONFIRMED"):
            if k not in (env or {}):
                os.environ.pop(k, None)
        ok = asyncio.run(fn(**kw))
    return ok, posts


def test_buttons_sent_when_order_id_and_template_set():
    ok, posts = _call(wa.send_new_order_notification,
                      env={"WHATSAPP_TEMPLATE_NEW_ORDER_CONFIRM": "new_order_confirm"},
                      order_id="abc", **ORDER)
    assert ok
    t = posts[0]["template"]
    assert t["name"] == "new_order_confirm"
    body, b0, b1 = t["components"]
    assert [p["text"] for p in body["parameters"]] == ["order", "Dani", "Board", "https://x.test/dashboard"]
    assert b0 == {"type": "button", "sub_type": "quick_reply", "index": "0",
                  "parameters": [{"type": "payload", "payload": "order_confirm:abc"}]}
    assert b1["index"] == "1" and b1["parameters"][0]["payload"] == "order_decline:abc"


def test_plain_alert_without_order_id_or_template():
    _, p1 = _call(wa.send_new_order_notification,
                  env={"WHATSAPP_TEMPLATE_NEW_ORDER_CONFIRM": "new_order_confirm"}, **ORDER)
    _, p2 = _call(wa.send_new_order_notification, order_id="abc", **ORDER)
    for posts in (p1, p2):
        t = posts[0]["template"]
        assert t["name"] == "new_order" and len(t["components"]) == 1


def test_customer_confirmed_template():
    ok, posts = _call(wa.send_order_confirmed_to_customer, recipient_phone="0501234567",
                      business_name="Blazin", track_url="https://x.test/t/1", language="en")
    assert ok
    t = posts[0]["template"]
    assert t["name"] == "order_confirmed" and t["language"] == {"code": "en"}
    assert [p["text"] for p in t["components"][0]["parameters"]] == ["Blazin", "https://x.test/t/1"]
    _, posts = _call(wa.send_order_confirmed_to_customer, recipient_phone="0501234567",
                     business_name="B", track_url="u",
                     env={"WHATSAPP_TEMPLATE_ORDER_CONFIRMED": "custom"})
    assert posts[0]["template"]["name"] == "custom"


def test_text_message_shape():
    ok, posts = _call(wa.send_whatsapp_text, recipient_phone="0501234567", body="Done")
    assert ok
    assert posts[0]["type"] == "text" and posts[0]["text"] == {"body": "Done"}
    assert posts[0]["to"].startswith("972")


def test_unconfigured_or_bad_number_returns_false():
    for fn, kw in ((wa.send_order_confirmed_to_customer,
                    dict(recipient_phone="0501234567", business_name="B", track_url="u")),
                   (wa.send_whatsapp_text, dict(recipient_phone="0501234567", body="x"))):
        ok, posts = _call(fn, meta=None, **kw)
        assert ok is False and posts == []
    ok, posts = _call(wa.send_whatsapp_text, recipient_phone="abc", body="x")
    assert ok is False and posts == []

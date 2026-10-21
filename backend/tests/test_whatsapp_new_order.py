"""The WhatsApp alert a business gets for a new order or booking.

Added 22 Oct 2026, after two real orders sat at "new" for three days with
the owner's email and the bell on the site both unopened.

WHY THESE CHECKS. The message goes out under Meta's approval rules, so the
part that can silently go wrong is not the sending (Twilio's) but what we
hand it: the right template for the owner's language, the variables in the
order the template expects, and a summary short enough to be accepted.
And it must do nothing at all, without raising, when Twilio is not set up,
because the order is already saved and nothing here may undo that.

No network: Twilio's client is never created.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from utils import whatsapp as wa  # noqa: E402

CFG = {
    "sid": "AC", "token": "t", "sender": "whatsapp:+10000000000",
    "public_url": "https://myisraelrental.com",
    "tpl_new_order": "HX_EN", "tpl_new_order_he": "HX_HE",
}


def _run(**kw):
    sent = {}

    async def fake_send(**args):
        sent.update(args)
        return True

    with patch.object(wa, "_config", return_value=dict(CFG)), patch.object(wa, "_send", fake_send):
        ok = asyncio.run(wa.send_new_order_notification(**kw))
    return ok, sent


def test_english_order_uses_the_english_template_with_variables_in_order():
    ok, sent = _run(recipient_phone="050-123-4567", customer_name="Dani",
                    summary="2 × Family board\n1 × Kids board", path="/dashboard?tab=orders",
                    kind="order", language="en")
    assert ok
    assert sent["content_sid_env_key"] == "tpl_new_order"
    v = sent["content_variables"]
    assert v["1"] == "order" and v["2"] == "Dani"
    # One line in a template variable: WhatsApp templates refuse newlines there.
    assert v["3"] == "2 × Family board, 1 × Kids board"
    assert v["4"] == "https://myisraelrental.com/dashboard?tab=orders"


def test_hebrew_owner_gets_the_hebrew_template():
    _, sent = _run(recipient_phone="0501234567", customer_name="דני", summary="מגש",
                   path="/dashboard?tab=appointments", kind="booking", language="he")
    assert sent["content_sid_env_key"] == "tpl_new_order_he"
    assert sent["content_variables"]["1"] == "בקשת תור"


def test_hebrew_falls_back_to_english_template_when_no_hebrew_one_is_set():
    cfg = dict(CFG, tpl_new_order_he=None)
    sent = {}

    async def fake_send(**args):
        sent.update(args)
        return True

    with patch.object(wa, "_config", return_value=cfg), patch.object(wa, "_send", fake_send):
        asyncio.run(wa.send_new_order_notification(recipient_phone="0501234567", customer_name="x",
                                                   summary="y", path="/p", language="he"))
    assert sent["content_sid_env_key"] == "tpl_new_order"


def test_a_long_basket_is_cut_short():
    _, sent = _run(recipient_phone="0501234567", customer_name="x", summary="a" * 2000, path="/p")
    assert len(sent["content_variables"]["3"]) == 300


def test_does_nothing_without_twilio():
    with patch.object(wa, "_config", return_value=None):
        assert asyncio.run(wa.send_new_order_notification(
            recipient_phone="0501234567", customer_name="x", summary="y", path="/p")) is False

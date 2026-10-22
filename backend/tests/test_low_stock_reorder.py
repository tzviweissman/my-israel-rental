"""Reorders when stock runs low (routes/marketplace/reorder.py, automations.py)."""
import pytest
from pydantic import ValidationError

from routes.marketplace.automations import AutomationIn
from routes.marketplace.reorder import _whatsapp, crossed, order_text


def test_fires_once_per_drop():
    assert crossed(11, 10, 10)          # down to the number
    assert crossed(12, 7, 10)           # down through it
    assert not crossed(10, 9, 10)       # already below: no second order
    assert not crossed(20, 15, 10)      # not there yet


def _rule(**kw):
    base = {"name": "Flour", "trigger": {"type": "stock.low", "gig_id": "g", "product_id": "p", "threshold": 10},
            "action": {"type": "order_supplier"}, "supplier": {"name": "Kemach", "email": "orders@kemach.co.il"},
            "template": {"items": "40 kg flour", "fulfilment": "pickup"}}
    base.update(kw)
    return AutomationIn(**base)


def test_supplier_rule_is_valid_and_asks_first():
    r = _rule()
    assert r.ask_first is True and r.partner_business_id is None


def test_supplier_needs_a_way_to_reach_them():
    with pytest.raises(ValidationError):
        _rule(supplier={"name": "Kemach"})


def test_product_and_number_are_required():
    with pytest.raises(ValidationError):
        _rule(trigger={"type": "stock.low", "gig_id": "g", "product_id": "p"})
    with pytest.raises(ValidationError):
        _rule(trigger={"type": "product.sold", "gig_id": "g", "product_id": "p"})


def test_ask_first_only_for_reorders():
    r = AutomationIn(name="x", trigger={"type": "lead.received"}, action={"type": "notify_me"}, ask_first=True, refill_qty=5)
    assert r.ask_first is False and r.refill_qty is None


def test_order_text_and_whatsapp():
    rule = {"supplier": {"name": "Kemach"}, "template": {"items": "40 kg flour", "fulfilment": "delivery",
                                                        "address": "Herzl 5, Jerusalem", "notes": "Back door"}}
    en = order_text(rule, {"name": "Sara's Bakery"}, "2026-10-23", False)
    assert en.startswith("Hello Kemach,") and "40 kg flour" in en and "Deliver to: Herzl 5" in en and "Needed by: 2026-10-23" in en
    he = order_text(rule, {"name": "Sara's Bakery"}, "2026-10-23", True)
    assert he.startswith("שלום Kemach,") and "משלוח ל:" in he
    assert _whatsapp("054-1234567", "hi").startswith("https://wa.me/972541234567?text=")
    assert _whatsapp(None, "hi") is None

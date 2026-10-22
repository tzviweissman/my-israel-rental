"""Payment requests by message (routes/marketplace/payment_requests.py)."""
from routes.marketplace.payment_requests import _can_take_payment, _money, message_text


def _r(**kw):
    return {"amount": 120.0, "description": "Deep clean, 3 rooms", "token": "abc", "customer_name": "Dana Cohen", "lang": "en", **kw}


def test_message_english_and_hebrew():
    en = message_text("Sparkle", _r())
    assert en.startswith("Hello Dana,") and "₪120" in en and "/pay/abc" in en
    he = message_text("Sparkle", _r(lang="he", customer_name=None))
    assert he.startswith("שלום,") and "על סך ₪120" in he


def test_money():
    assert _money(120) == "₪120" and _money(99.5) == "₪99.50" and _money(1500) == "₪1,500"


def test_needs_a_way_to_pay():
    assert not _can_take_payment({})
    assert _can_take_payment({"payment_note": "Cash is fine"})
    assert _can_take_payment({"payment_links": [{"url": "https://www.bitpay.co.il/app/me/x", "label": "Bit"}]})
    # a link that is not on the allowlist is not a way to pay
    assert not _can_take_payment({"payment_links": [{"url": "https://evil-paybox.co.il/x", "label": "PayBox"}]})

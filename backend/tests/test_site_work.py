"""The join page's live line of real work (routes/site_visits.site_work): each text or email becomes one of the
few kinds the page names, a declined order is never shown, and no row carries a name, number or address."""
from routes.site_visits import _work_kind


def test_kinds():
    assert _work_kind("business", "order_new") == "order_alert"
    assert _work_kind("business", "booking_new") == "order_alert"
    assert _work_kind("business", "quote_new") == "order_alert"
    assert _work_kind("customer", "order_received") == "received"
    assert _work_kind("customer", "order_confirmed") == "confirmed"
    assert _work_kind("customer", "order_review") == "review_asked"
    assert _work_kind("customer", "booking_reminder") == "reminder_sent"


def test_left_out():
    assert _work_kind("customer", "order_declined") is None
    assert _work_kind("business", "something_else") is None
    assert _work_kind("", "") is None

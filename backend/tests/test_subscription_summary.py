"""The account settings plan card reads /subscription/me
(routes/marketplace/subscription.py subscription_summary)."""
from routes.marketplace.subscription import subscription_summary


def test_no_paid_plan_shows_no_card():
    assert subscription_summary(None)["state"] == "none"
    assert subscription_summary({"subscription_status": "trial"})["state"] == "none"


def test_active_plan():
    s = subscription_summary({"paypal_subscription_id": "I-1", "subscription_status": "active",
                              "paypal_subscription_status": "ACTIVE", "subscribed_until": "2026-11-13T00:00:00Z",
                              "plan_months": 12, "plan_monthly_price": 25.0})
    assert s["state"] == "active" and s["until"] == "2026-11-13T00:00:00Z" and s["monthly_price"] == 25.0


def test_cancelled_keeps_access_until_the_period_ends():
    s = subscription_summary({"paypal_subscription_id": "I-1", "subscription_status": "active",
                              "paypal_subscription_status": "CANCELLED", "subscribed_until": "2026-11-13T00:00:00Z"})
    assert s["state"] == "cancelled" and s["until"]


def test_checkout_never_finished_is_pending():
    assert subscription_summary({"paypal_subscription_id": "I-1", "subscription_status": "trial",
                                 "paypal_subscription_status": "APPROVAL_PENDING"})["state"] == "pending"


def test_expired():
    assert subscription_summary({"paypal_subscription_id": "I-1", "subscription_status": "expired",
                                 "paypal_subscription_status": "EXPIRED"})["state"] == "ended"

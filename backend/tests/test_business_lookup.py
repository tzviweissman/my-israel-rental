"""Find your business on Google (new sign-up funnel, 9 Nov 2026): the parts that need no Google call."""
import asyncio

from routes.marketplace.product_extract import _hours, lookup_business


def test_google_hours_become_one_window_a_day():
    out = _hours([
        {"open": {"day": 0, "hour": 9}, "close": {"day": 0, "hour": 17, "minute": 30}},
        {"open": {"day": 5, "hour": 8}, "close": {"day": 5, "hour": 13}},
        {"open": {"day": 1, "hour": 0}},  # open around the clock: no close, skipped
    ])
    assert out["sun"] == [{"start": "09:00", "end": "17:30"}]
    assert out["fri"] == [{"start": "08:00", "end": "13:00"}]
    assert out["mon"] == [] and set(out) == {"sun", "mon", "tue", "wed", "thu", "fri", "sat"}


def test_short_search_costs_nothing():
    assert asyncio.run(lookup_business(None, q="ab")) == {"results": []}


def test_google_types_pick_the_most_specific_category():
    from routes.marketplace.product_extract import _google_category
    assert _google_category("plumber", ["plumber", "point_of_interest"]) == ("home-services-repair", "plumbing")
    assert _google_category("", ["bakery", "cafe", "food", "store"]) == ("shops-products", "")
    assert _google_category("insurance_agency", []) == ("insurance", "")
    assert _google_category("", ["point_of_interest", "establishment"]) == ("", "")


def test_finish_your_page_email_names_the_business_and_links_back():
    from routes.marketplace.signup_drafts import _email_html
    subject, page = _email_html(False, "Cohen & Sons", "https://x.test/businesses/add?draft=abc")
    assert subject == "Your page for Cohen & Sons is almost ready"
    assert "Cohen &amp; Sons" in page and "draft=abc" in page
    assert _email_html(True, "", "l")[0] == "הדף של העסק שלכם כמעט מוכן"


def test_weekly_ad_email_and_optout_token():
    from routes.marketplace.weekly_ads import OPT_OUT_PURPOSE, email_html, optout_token
    from utils.notification_tokens import verify_notification_token
    subject, page = email_html(False, "Dani <Movers>", "Box set", "https://x/dashboard?item=Box+set", "https://x/off?t=1")
    assert subject == "Your ad for Box set is ready"
    assert "Dani &lt;Movers&gt;" in page and "https://x/dashboard?item=Box+set" in page and "https://x/off?t=1" in page
    he_subject, he_page = email_html(True, "דני", "קופסה", "https://x", "https://x/off")
    assert "קופסה" in he_subject and 'dir="rtl"' in he_page
    assert verify_notification_token(optout_token("u1"), OPT_OUT_PURPOSE)["user_id"] == "u1"

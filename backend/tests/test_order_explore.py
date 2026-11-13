"""Keep exploring under an order (order_explore.py): more from the same business,
and other businesses that go with it, never the same kind. No database."""
import asyncio

import routes.marketplace.order_explore as ex

GIG = {"_id": "g1", "category": "food", "products": [
    {"id": "p1", "name": "Challah", "price": 20},
    {"id": "p2", "name": "Babka", "price": 45, "images": ["https://img/babka.jpg"]},
    {"id": "p3", "name": "Old", "price": 5, "hidden": True},
    {"id": "p4", "name": "Gone", "price": 5, "sold_out": True},
    {"id": "p5", "name": "Rugelach", "price": 30},
]}
ORDER = {"_id": "o1", "business_id": "b1", "gig_id": "g1", "lines": [{"product_id": "p1", "qty": 2}]}


def test_more_from_leaves_out_the_order_hidden_and_sold_out_and_puts_photos_first():
    rows = ex.more_from(GIG, ORDER)
    assert [r["name"] for r in rows] == ["Babka", "Rugelach"]
    assert rows[0]["href"] == "/order/g1?items=p2~1"


def _pool(monkeypatch, gigs):
    async def fake():
        return gigs
    monkeypatch.setattr(ex, "_pool", fake)


def test_others_go_with_the_order_and_are_never_the_same_kind_or_business(monkeypatch):
    _pool(monkeypatch, [
        {"id": "x1", "title": "Other bakery", "category": "food", "area": "Jerusalem", "business_id": "b2", "photo": "p", "title_he": None},
        {"id": "x2", "title": "Own second listing", "category": "events-catering", "area": "Jerusalem", "business_id": "b1", "photo": "p", "title_he": None},
        {"id": "x3", "title": "Florist far", "category": "shops-products", "area": "Haifa", "business_id": "b3", "photo": "p", "title_he": None},
        {"id": "x4", "title": "Caterer near", "category": "events-catering", "area": "Jerusalem", "business_id": "b4", "photo": "p", "title_he": None},
        {"id": "x5", "title": "Plumber", "category": "plumbing", "area": "Jerusalem", "business_id": "b5", "photo": "p", "title_he": None},
        {"id": "x6", "title": "Caterer two", "category": "events-catering", "area": "Haifa", "business_id": "b4", "photo": "p", "title_he": None},
    ])
    rows = asyncio.run(ex.others_for(ORDER, "food", "Jerusalem"))
    titles = [r["title"] for r in rows]
    assert "Other bakery" not in titles and "Own second listing" not in titles
    assert titles[0] == "Caterer near"                      # related kind and the same area first
    assert titles.count("Caterer near") + titles.count("Caterer two") == 1   # one card per business
    assert all(r["href"].endswith("?src=orders") for r in rows)
    assert rows == asyncio.run(ex.others_for(ORDER, "food", "Jerusalem"))   # the same for one order on every reload


def test_test_listings_never_shown():
    assert ex._TEST.search("TEST_web challot") and ex._TEST.search("Board House 1790206626607")
    assert not ex._TEST.search("Blazin' Boards") and not ex._TEST.search("Testimonial Cakes")


def test_email_rows_link_to_the_site_and_escape_names(monkeypatch):
    async def fake(o):
        return {"more": [{"name": "Babka <b>", "href": "/order/g1?items=p2~1"}],
                "others": [{"title": "Emek Catering", "title_he": None, "area": "Bet Shemesh", "href": "/businesses/x4?src=orders"}]}
    import routes.marketplace.orders as om
    monkeypatch.setattr(ex, "suggestions", fake)
    monkeypatch.setattr(om, "_frontend_url", lambda: "https://site.test")
    html = asyncio.run(ex.email_html(ORDER, {"name": "Bakery"}, "en"))
    assert "https://site.test/order/g1?items=p2~1" in html and "Babka &lt;b&gt;" in html
    assert "https://site.test/businesses/x4?src=orders" in html and "Discover more on MyIsraelRental" in html


def test_email_rows_never_break_the_email(monkeypatch):
    async def broken(o):
        raise RuntimeError("db down")
    monkeypatch.setattr(ex, "suggestions", broken)
    assert asyncio.run(ex.email_html(ORDER, {}, "he")) == ""

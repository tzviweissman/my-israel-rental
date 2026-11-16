"""Reading a business's own website at sign-up (routes/marketplace/product_extract.py, 12 Nov 2026): the pages worth
reading after the home page, the pictures offered to keep, and the website a social bio names. No network."""
from routes.marketplace.product_extract import _links_in, _pictures, _same_site_links

PAGE = """
<html><head><meta property="og:image" content="/img/hero.jpg">
<link rel="apple-touch-icon" href="/icon-180.png"></head><body>
<img class="site-logo" src="/img/logo.png" alt="Noa">
<a href="/menu">Our menu</a> <a href="/he/מחירון">מחירון</a> <a href="/about/">About us</a>
<a href="https://other.example.com/menu">Their menu</a> <a href="/blog/post-1">News</a> <a href="/">Home</a>
<a href="/files/menu.pdf">Menu PDF</a> <a href="/contact#form">Contact</a>
<img src="/img/arrow-down.png"> <img src="/img/cake.jpg" width="800"> <img src="/img/tiny.jpg" width="40">
<img data-src="/img/bread.webp"> <img src="data:image/png;base64,xx"> <img src="/img/icon-cart.png">
</body></html>"""
BASE = "https://www.noa.co.il/"


def test_pages_on_the_same_site():
    links = _same_site_links(PAGE, BASE)
    assert links[0] == "https://www.noa.co.il/menu"
    assert "https://www.noa.co.il/about/" in links and "https://www.noa.co.il/contact" in links
    assert not any("other.example" in u or u.endswith(".pdf") or "blog" in u for u in links)
    assert len(links) <= 4


def test_pictures():
    p = _pictures(PAGE, BASE)
    assert p["logo"] == "https://www.noa.co.il/img/logo.png"
    assert p["cover"] == "https://www.noa.co.il/img/hero.jpg"
    assert p["photos"] == ["https://www.noa.co.il/img/cake.jpg", "https://www.noa.co.il/img/bread.webp"]


def test_no_pictures_is_none_not_the_page():
    p = _pictures("<html><body>nothing</body></html>", BASE)
    assert p == {"logo": "", "cover": "", "photos": []}


def test_site_in_a_bio():
    assert _links_in("Fresh bread daily. Order: noabakery.co.il or wa.me/97250 · instagram.com/x") == ["https://noabakery.co.il"]
    assert _links_in("linktr.ee/noabakery") == ["https://linktr.ee/noabakery"]


def test_each_product_gets_only_its_own_photos():
    """Tzvi, 15 Nov 2026: the right photos on the right product, and all of them."""
    from routes.marketplace.product_extract import _assign_photos, _labelled_photos, _ld_products, _same_name
    items = [{"name": "A"}, {"name": "B"}, {"name": "C"}]
    _assign_photos(items, [[1, 2, 3], [3, 4], ["5", 99, None]], [f"u{i}" for i in range(1, 6)])
    # several photos for one product; a photo two products claim goes to neither; numbers not on the list ignored
    assert [i["photos"] for i in items] == [["u1", "u2"], ["u4"], ["u5"]]
    assert _same_name("Classic Board", "The Classic Board - serves 6") and not _same_name("Kid", "Kids board")
    page = ('<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"Family Board",'
            '"image":["/img/f1.jpg","https://cdn.x.com/f2.jpg"]}]}</script>')
    assert _ld_products(page, "https://s.com/p") == [{"name": "Family Board", "photos": ["https://s.com/img/f1.jpg", "https://cdn.x.com/f2.jpg"]}]
    lab = _labelled_photos('<img src="/i/c.jpg" alt="Classic"><h3>Classic Board</h3>180<img src="/logo.png" class="logo">', "https://s.com/")
    assert len(lab) == 1 and "Classic Board 180" in lab[0][1]


# ---- A shop's own settings, pages and sections (Burnt Meatboards, set up by hand on 16 Nov 2026) ----

SHOP = "https://shop.example.com"
SHOP_JSON = {
    f"{SHOP}/products.json?limit=250": {"products": [
        {"id": 1, "title": "Taster Meat Board", "product_type": "", "body_html": "<p>Serves 2</p>",
         "variants": [{"price": "75.00"}], "images": [{"src": "https://cdn.example.com/t1.jpg"}]},
        {"id": 2, "title": "Glass bottle of coke", "product_type": "", "body_html": "",
         "variants": [{"price": "5.00"}], "images": [{"src": "https://cdn.example.com/coke.jpg"}]},
        {"id": 3, "title": "Wine", "product_type": "Drinks", "body_html": "", "variants": [{"price": "35"}], "images": []},
    ]},
    f"{SHOP}/meta.json": {"name": "Burnt Meatboards", "city": "Lakewood", "province": "New Jersey", "country": "US",
                          "currency": "USD", "ships_to_countries": ["IL"]},
    f"{SHOP}/collections.json?limit=250": {"collections": [
        {"handle": "meatboards", "title": "Meatboards"}, {"handle": "alcohol", "title": "Add-ons"}]},
    f"{SHOP}/collections/alcohol/products.json?limit=250": {"products": [{"id": 2}]},
    f"{SHOP}/pages.json": {"pages": [
        {"handle": "about-us", "title": "About Us", "body_html": "<p>" + "We craft high-quality meat boards. " * 3 + "</p>"},
        {"handle": "faq", "title": "FAQ", "body_html": ""},
        {"handle": "kashrus", "title": "Kashrus", "body_html": None},
        {"handle": "../admin", "title": "Not a page", "body_html": None},
    ]},
}
RENDERED = {
    f"{SHOP}/pages/faq": "<nav>Shop Boards Kashrus About Us</nav><main><h1>FAQ</h1><details><summary>Do you offer free "
                         "delivery?</summary>Yes, delivery is free within Jerusalem.</details></main><footer>2026</footer>",
    f"{SHOP}/pages/kashrus": "<main><p>Our entire operation is under the strict supervision of Rabbi Dershowitz.</p></main>",
}


def _read_shop():
    import asyncio
    from unittest.mock import patch

    import routes.marketplace.product_extract as pe

    async def fake_json(url):
        return SHOP_JSON.get(url)

    async def fake_page(url):
        return RENDERED.get(url, ""), url
    with patch.object(pe, "_fetch_json", fake_json), patch.object(pe, "_fetch", fake_page):
        return asyncio.run(pe._shop_catalog(SHOP + "/"))


def test_shop_products_keep_their_add_on_section():
    """Shopify's product_type was blank on all 38 products; the "Add-ons" section is where the Coke was."""
    shop = _read_shop()
    rows = {r["name"]: r for r in shop["products"]}
    assert rows["Glass bottle of coke"]["group"] == "Add-ons"
    assert rows["Wine"]["group"] == "Drinks"
    assert rows["Taster Meat Board"]["group"] is None
    assert rows["Taster Meat Board"]["price"] == 75 and rows["Taster Meat Board"]["currency"] == "USD"
    assert rows["Taster Meat Board"]["photos"] == ["https://cdn.example.com/t1.jpg"]


def test_shop_pages_fall_back_to_the_page_itself():
    """FAQ accordions and the Kashrus page have no body in pages.json: read the page's <main>, not its menu."""
    pages = dict(_read_shop()["pages"])
    assert set(pages) == {"About Us", "FAQ", "Kashrus"}
    assert "free within Jerusalem" in pages["FAQ"] and "Shop Boards" not in pages["FAQ"] and "2026" not in pages["FAQ"]
    assert "Rabbi Dershowitz" in pages["Kashrus"]


def test_shop_name_and_place_over_the_guess():
    """Named after the shop, not its owner; a billing city abroad is not where it serves."""
    from routes.marketplace.product_extract import _shop_facts
    meta = _read_shop()["meta"]
    fields = {"business_name": "Moshe Rube", "area": "Lakewood, NJ",
              "delivery_areas": [{"city": "Jerusalem", "fee": 15.0}, {"city": "Modi'in", "fee": 30.0}]}
    _shop_facts(fields, meta)
    assert fields["business_name"] == "Burnt Meatboards" and fields["area"] == "Jerusalem"
    kept = {"area": "Beit Shemesh", "delivery_areas": [{"city": "Jerusalem", "fee": None}]}
    _shop_facts(kept, meta)
    assert kept["area"] == "Beit Shemesh"
    home = {"area": "Haifa"}
    _shop_facts(home, {"name": "Noa", "country": "IL", "city": "Haifa"})
    assert home == {"area": "Haifa", "business_name": "Noa"}


def test_faqs_and_delivery_areas_are_checked():
    from routes.marketplace.product_extract import _delivery_areas, _faqs
    assert _faqs([{"q": "Returns?", "a": "No."}, {"q": "Half", "a": ""}, "junk", {"q": " ", "a": "x"}]) == [
        {"q": "Returns?", "a": "No."}]
    assert _faqs(None) == []
    assert len(_faqs([{"q": "Weekly discount?", "a": "Yes."}, {"q": "weekly discount?", "a": "Absolutely!"}])) == 1
    assert _delivery_areas([{"city": "Jerusalem", "fee": "15"}, {"city": "Tel Aviv", "fee": "ask"}, {"fee": 3},
                            {"city": "Holon", "fee": -1}]) == [
        {"city": "Jerusalem", "fee": 15.0}, {"city": "Tel Aviv", "fee": None}, {"city": "Holon", "fee": None}]


def test_from_price_is_a_main_product():
    """The card read "from $5", a bottle of Coke; it is "from" the cheapest board."""
    from routes.marketplace.shared import _cheapest_tier_price
    gig = {"gig_type": "store", "products": [
        {"name": "Coke", "price": 5, "currency": "ILS", "group": "Add-ons"},
        {"name": "Wine", "price": 35, "currency": "ILS", "group": "Drinks"},
        {"name": "Board", "price": 75, "currency": "ILS", "group": "Meatboards"}]}
    assert _cheapest_tier_price(gig) == 75
    assert _cheapest_tier_price({"gig_type": "store", "products": gig["products"][:1]}) == 5


def test_a_picture_too_big_for_cloudinary_is_shrunk_and_sent():
    """A 17 MB 4974x3247 PNG was refused and the photo silently lost."""
    import asyncio
    import io
    from unittest.mock import patch

    from PIL import Image

    import utils.cloud_storage as cs
    png = io.BytesIO()
    Image.new("RGBA", (4974, 3247), (200, 80, 20, 0)).save(png, "PNG")
    small = cs.shrink_picture(png.getvalue())
    img = Image.open(io.BytesIO(small))
    assert img.format == "JPEG" and max(img.size) == 2500 and img.getpixel((5, 5)) == (255, 255, 255)

    sent = []

    def upload(src, **_):
        sent.append(src)
        if isinstance(src, str):
            raise RuntimeError("File size too large. Got 17000000. Maximum is 10485760.")
        return {"secure_url": "https://res.cloudinary.com/x/image/upload/v1/a.jpg", "public_id": "a", "etag": "e"}
    with patch.object(cs, "CLOUDINARY_ENABLED", True), patch.object(cs.cloudinary.uploader, "upload", upload), \
            patch.object(cs, "_shrunk_picture", lambda url: b"jpeg-bytes"):
        res = asyncio.run(cs.mirror_url_to_cloudinary("https://cdn.example.com/huge.png"))
    assert sent == ["https://cdn.example.com/huge.png", b"jpeg-bytes"]
    assert res["url"].endswith("/a.jpg")


def test_a_picture_with_too_many_pixels_is_not_decoded():
    """A small file can hold a huge picture: 12000x12000 took 772 MB to shrink."""
    import io

    import pytest
    from PIL import Image

    import utils.cloud_storage as cs
    png = io.BytesIO()
    Image.new("1", (8000, 6000)).save(png, "PNG")
    with pytest.raises(ValueError):
        cs.shrink_picture(png.getvalue())


def test_what_the_reader_returns_is_tidied():
    """A shop that also caters is still a shop; a long title ends on a whole word; "1:00–3:00" is "1:00 to 3:00"."""
    import asyncio
    import json as _json
    from unittest.mock import patch

    import routes.marketplace.product_extract as pe
    reply = _json.dumps({"gig_type": "deliverable", "business_name": "Moshe Rube",
                         "title": "Kosher premium meat boards and charcuterie gift boards delivered across Israel",
                         "delivery_note": "Fridays 1:00–3:00 pm — order by Wednesday", "items": []})

    class Chat:
        def __init__(self, **_):
            pass

        def with_model(self, *_):
            return self

        async def send_message(self, _):
            return reply
    with patch("utils.llm.LlmChat", Chat):
        fields = asyncio.run(pe._read_ad("text", [], {"user_id": "t"}))
    assert fields["title"] == "Kosher premium meat boards and charcuterie gift boards delivered"
    assert fields["delivery_note"] == "Fridays 1:00 to 3:00 pm, order by Wednesday"

    async def no_copy(url, **_):
        return {"url": url}
    with patch("utils.cloud_storage.mirror_url_to_cloudinary", no_copy):
        asyncio.run(pe._product_photos(fields, [{"name": "Board", "price": 75, "photos": ["https://c.com/b.jpg"]}], []))
    assert fields["gig_type"] == "store" and fields["items"][0]["images"] == ["https://c.com/b.jpg"]


def test_delivery_fees_are_filed_by_city_slug():
    """The fees a shop's delivery page lists become its order settings, keyed as checkout reads them."""
    from routes.marketplace.businesses import fees_by_area
    from routes.marketplace.shared import normalize_service_areas
    areas = normalize_service_areas(["Jerusalem", "Tel Aviv"])
    got = fees_by_area({"Jerusalem": 15, "Tel Aviv": 50, "Haifa": 40, "Nowhere": 5, "jerusalem": -1}, areas)
    assert got == {areas[0]: 15.0, areas[1]: 50.0}  # a city not served, unknown, or a bad fee is dropped


def _real_shop(json_by_path):
    import asyncio
    from unittest.mock import patch

    import routes.marketplace.product_extract as pe

    async def fake_json(url):
        return json_by_path(url.split("://", 1)[1].split("/", 1)[1])

    async def fake_page(url):
        return "", url
    with patch.object(pe, "_fetch_json", fake_json), patch.object(pe, "_fetch", fake_page):
        return asyncio.run(pe._shop_catalog("https://burntmeatboards.com/"))["products"]


def test_every_size_of_a_real_shop_product():
    """Burnt Meatboards' own products.json (16 Nov 2026): every size kept, not only the first one at its price."""
    import json
    from pathlib import Path

    from routes.marketplace.shared import ProductItem
    data = json.loads((Path(__file__).parent / "fixtures" / "burnt-meatboards-products.json").read_text(encoding="utf-8"))
    rows = {r["name"]: r for r in _real_shop(lambda p: data if p.startswith("products.json") else None)}
    assert len(rows) == 38
    oyster = rows["Oyster steak"]
    assert len(oyster["options"]) == 8 and oyster["options"][0] == {"name": "Eat, 0.5 lb", "price": 40.0, "in_stock": True}
    assert next(o for o in oyster["options"] if o["name"] == "Eat, 2 lb")["in_stock"] is False
    assert "Eat: cooked to perfection." in oyster["description"]
    assert len(rows["Smoked Rib Roast"]["options"]) == 16  # 24 sizes: the sold-out ones go first
    assert all(o["in_stock"] for o in rows["Smoked Rib Roast"]["options"])
    beef = rows["Roast beef"]
    assert beef["price"] == min(o["price"] for o in beef["options"] if o["in_stock"]) != 19.99  # not a sold-out raw size
    taster = rows["Taster Meat Board"]
    assert taster["in_stock"] is False and taster["price"] == 75  # every size sold out
    assert len(rows["Grilled Chicken board"]["options"]) == 6
    assert rows["Oyster steak"]["description"].count("\n") >= 1  # the text keeps its lines
    one = next(r for r in rows.values() if r["name"] == "Glass bottle of coke")
    assert one["options"] == []  # one "Default Title" variant is no choice
    for r in rows.values():
        # What the form saves: a product with no price ("Coming soon!") goes in at 0 as before.
        ProductItem(**{**{k: v for k, v in r.items() if k not in ("photos", "duration_minutes", "photo_box", "page")},
                       "price": r["price"] or 0})


def test_woocommerce_variations_are_sizes():
    shop = {
        "wp-json/wc/store/v1/products?per_page=100": [
            {"name": "Cake", "prices": {"price": "5000", "currency_minor_unit": 2, "currency_code": "ILS"},
             "variations": [{"id": 11, "attributes": [{"name": "Size", "value": "Small"}]},
                            {"id": 12, "attributes": [{"name": "Size", "value": "Large"}]}]},
            {"name": "Card", "prices": {"price": "1000", "currency_minor_unit": 2, "currency_code": "ILS"}, "variations": []}],
        "wp-json/wc/store/v1/products/11": {"prices": {"price": "5000", "currency_minor_unit": 2}, "is_in_stock": False},
        "wp-json/wc/store/v1/products/12": {"prices": {"price": "9000", "currency_minor_unit": 2}, "is_in_stock": True},
    }
    rows = {r["name"]: r for r in _real_shop(shop.get)}
    assert rows["Cake"]["options"] == [{"name": "Small", "price": 50.0, "in_stock": False},
                                       {"name": "Large", "price": 90.0, "in_stock": True}]
    assert rows["Cake"]["price"] == 90 and rows["Cake"]["in_stock"] is True
    assert rows["Card"]["options"] == [] and rows["Card"]["price"] == 10


def test_shop_list_photos_stay_on_their_product():
    """A product with no real name (an entity like &nbsp;) is dropped without moving the next product's photos."""
    from routes.marketplace.product_extract import _clean_catalog
    rows = [{"name": "&nbsp;", "price": "1", "photos": ["https://c.com/a.jpg"]},
            {"name": "Cheese Board", "price": "180", "photos": ["https://c.com/x1.jpg"]},
            {"name": "Fruit Board", "price": "150", "photos": ["https://c.com/x2.jpg"]}]
    assert [(r["name"], r["photos"]) for r in _clean_catalog(rows, "https://s.com/")] == [
        ("Cheese Board", ["https://c.com/x1.jpg"]), ("Fruit Board", ["https://c.com/x2.jpg"])]

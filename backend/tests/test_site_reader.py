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

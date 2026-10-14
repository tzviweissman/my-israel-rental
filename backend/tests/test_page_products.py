"""A designed page's catalogue follows the shop (routes/marketplace/page_edits.py).

GET /business/<slug>/page-edits carries the business's store products, in
their order, with section, price range and stock, so the page can show an
item out of stock the moment the owner switches it off in the dashboard
(frontend/public/pages/mir-catalog.js draws it).
"""
import sys
from pathlib import Path

import pytest
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture
def fake(monkeypatch):
    db = AsyncMongoMockClient()["test_db"]
    import routes.marketplace.page_edits as pe
    monkeypatch.setattr(pe, "db", db, raising=False)
    import routes.deps as deps
    monkeypatch.setattr(deps, "db", db, raising=False)
    for name, module in list(sys.modules.items()):
        if name.startswith("routes") and getattr(module, "db", None) is not None:
            monkeypatch.setattr(module, "db", db, raising=False)
    return db


async def _seed(db, products, status="published"):
    await db.businesses.insert_one({"_id": "gb", "slug": "the-gift-boutique", "name": "The Gift Boutique", "active": True})
    await db.marketplace_gigs.insert_one({
        "_id": "g1", "business_id": "gb", "gig_type": "store", "status": status, "title": "Gifts", "products": products,
    })


@pytest.mark.asyncio
async def test_products_carry_stock_section_and_range(fake):
    from routes.marketplace.page_edits import get_page_edits
    await _seed(fake, [
        {"id": "a", "name": "White Vase", "price": 55, "currency": "USD", "images": ["https://x/vase.jpg"], "group": "Bowls and vases"},
        {"id": "b", "name": "Bottle Opener", "price": 45, "price_to": 80, "currency": "usd", "in_stock": False},
        {"id": "c", "name": "No price", "price": None},
    ])
    out = await get_page_edits("the-gift-boutique")
    names = [p["name"] for p in out["products"]]
    assert names == ["White Vase", "Bottle Opener"]          # order kept, unpriced dropped
    vase, opener = out["products"]
    assert vase["in_stock"] is True and vase["group"] == "Bowls and vases" and vase["image"] == "https://x/vase.jpg"
    assert opener["in_stock"] is False and opener["price_to"] == 80 and opener["currency"] == "USD"
    assert opener["group"] is None
    assert vase["id"] == "a" and vase["gig_id"] == "g1"


@pytest.mark.asyncio
async def test_a_hidden_shop_shows_nothing(fake):
    from routes.marketplace.page_edits import get_page_edits
    await _seed(fake, [{"id": "a", "name": "White Vase", "price": 55}], status="draft")
    out = await get_page_edits("the-gift-boutique")
    assert out["products"] == []


def test_a_product_can_carry_a_price_range():
    from routes.marketplace.shared import ProductItem as Product
    p = Product(name="Gold Edged Bowl", price=35, price_to=38, currency="USD", group="Bowls and vases", in_stock=False)
    d = p.model_dump()
    assert d["price_to"] == 38 and d["in_stock"] is False and d["group"] == "Bowls and vases"

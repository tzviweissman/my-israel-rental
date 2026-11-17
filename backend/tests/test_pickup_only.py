"""A product sold for pickup only (17 Nov 2026, American Crust's pickup bundle): the dashboard keeps the switch and the
order form's product list carries it, so orders.py can refuse a delivery with it."""
from routes.marketplace.orders import _products_for_order
from routes.marketplace.shared import ProductItem


def test_pickup_only_is_kept_and_sent():
    assert ProductItem(name="Bundle", price=105, pickup_only=True).pickup_only is True
    assert not ProductItem(name="Dough", price=30).pickup_only
    gig = {"products": [{"id": "a", "name": "Bundle", "price": 105, "pickup_only": True}, {"id": "b", "name": "Dough", "price": 30}]}
    got = {p["id"]: p["pickup_only"] for p in _products_for_order(gig)}
    assert got == {"a": True, "b": False}


def test_site_products_script_keeps_every_setting():
    import sys
    sys.path.insert(0, "scripts")
    from add_site_products import new_product
    plan = {"name": "Pickup bundle", "price": 105, "pickup_only": True, "serves": 4, "group": "Deals",
            "images": ["https://myisraelrental.com/pages/american-crust/assets/bundle.webp"], "not_a_field": 1}
    got = new_product({"_id": "g1"}, plan)
    assert got["pickup_only"] is True and got["serves"] == 4 and got["group"] == "Deals" and got["images"] == plan["images"]
    assert "not_a_field" not in got and len(got["id"]) == 12

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

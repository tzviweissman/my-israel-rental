"""Products a partner supplies (routes/marketplace/dropship.py).

End to end through the real app against an in-memory Mongo
(mongomock_motor, as test_jobs_end_to_end.py does): a store marks a product
"supplied by" a connected partner, a customer orders, the partner gets the
order, and the partner moving it moves the customer's tracking link.
"""
import sys
from datetime import date, timedelta
from pathlib import Path

import jwt
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.auth import JWT_SECRET  # noqa: E402

STORE_OWNER, SUPPLIER_OWNER, STRANGER = "store-owner", "supplier-owner", "stranger"


def _auth(uid: str) -> dict[str, str]:
    tok = jwt.encode({"user_id": uid, "email": f"{uid}@example.test", "role": "owner"}, JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


@pytest_asyncio.fixture
async def env(monkeypatch):
    fake = AsyncMongoMockClient()["test_db"]
    import routes.deps as deps
    monkeypatch.setattr(deps, "db", fake)
    for name, module in list(sys.modules.items()):
        if (name.startswith("routes") or name.startswith("utils")) and getattr(module, "db", None) is not None:
            monkeypatch.setattr(module, "db", fake, raising=False)
    import routes.marketplace.orders as om

    async def _quiet(*a, **k):
        return None

    monkeypatch.setattr(om, "_email", _quiet)
    monkeypatch.setattr(om, "_notify", _quiet)
    monkeypatch.setenv("DISABLE_RATE_LIMIT", "1")

    for uid in (STORE_OWNER, SUPPLIER_OWNER, STRANGER):
        await fake.users.insert_one({"id": uid, "email": f"{uid}@example.test", "role": "owner"})
    await fake.businesses.insert_many([
        {"_id": "store", "name": "Gift Baskets", "owner_user_id": STORE_OWNER, "active": True, "serves_nationwide": True,
         "order_settings": {"delivery_on": True}},
        {"_id": "bakery", "name": "The Bakery", "owner_user_id": SUPPLIER_OWNER, "active": True},
        {"_id": "other", "name": "Not Connected", "owner_user_id": STRANGER, "active": True},
    ])
    await fake.business_connections.insert_one({"_id": "c1", "a_id": "bakery", "b_id": "store", "status": "accepted"})
    await fake.marketplace_gigs.insert_one({
        "_id": "gig1", "business_id": "store", "provider_user_id": STORE_OWNER, "gig_type": "store", "status": "published",
        "title": "Baskets", "products": [
            {"id": "basket", "name": "Basket", "price": 100, "currency": "ILS"},
            {"id": "challah", "name": "Challah", "price": 30, "currency": "ILS"},
        ],
    })
    import server
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as c:
        yield c, fake


def _order(fulfilment="delivery", lines=(("challah", 2),)):
    return {"lines": [{"product_id": p, "qty": q} for p, q in lines], "fulfilment": fulfilment,
            "date": (date.today() + timedelta(days=3)).isoformat(), "address": "Herzl 1, Jerusalem",
            "customer_name": "Dana", "customer_phone": "0501234567"}


@pytest.mark.asyncio
async def test_only_a_connected_partner_can_supply(env):
    c, _ = env
    r = await c.put("/api/marketplace/gigs/gig1/suppliers", json={"suppliers": {"challah": "other"}}, headers=_auth(STORE_OWNER))
    assert r.status_code == 400
    r = await c.put("/api/marketplace/gigs/gig1/suppliers", json={"suppliers": {"challah": "bakery"}}, headers=_auth(STRANGER))
    assert r.status_code == 403
    r = await c.get("/api/marketplace/gigs/gig1/suppliers", headers=_auth(STORE_OWNER))
    assert [p["id"] for p in r.json()["partners"]] == ["bakery"]


@pytest.mark.asyncio
async def test_supplier_is_not_on_the_public_listing(env):
    c, _ = env
    await c.put("/api/marketplace/gigs/gig1/suppliers", json={"suppliers": {"challah": "bakery"}}, headers=_auth(STORE_OWNER))
    form = (await c.get("/api/marketplace/order-form/gig1")).json()
    assert "bakery" not in str(form)


@pytest.mark.asyncio
async def test_order_goes_to_the_supplier_and_tracking_follows(env):
    c, db = env
    await c.put("/api/marketplace/gigs/gig1/suppliers", json={"suppliers": {"challah": "bakery"}}, headers=_auth(STORE_OWNER))
    placed = (await c.post("/api/marketplace/order-form/gig1/orders", json=_order())).json()
    store_order = await db.store_orders.find_one({"business_id": "store"})
    sup = await db.store_orders.find_one({"business_id": "bakery"})
    assert sup["items"] == "2 × Challah" and sup["total"] is None
    assert sup["address"] == "Herzl 1, Jerusalem" and sup["customer_name"] == "Dana"
    assert sup["automation"]["from_business_name"] == "Gift Baskets"
    assert store_order["supplied_parts"][0]["order_id"] == sup["_id"]

    for status in ("preparing", "ready", "done"):
        r = await c.patch(f"/api/marketplace/orders/{sup['_id']}/status", json={"status": status}, headers=_auth(SUPPLIER_OWNER))
        assert r.status_code == 200, r.text
    track = (await c.get(f"/api/marketplace/orders/track/{placed['track_token']}")).json()
    assert track["status"] == "done"
    assert track["parts"][0]["status"] == "done"
    assert "Bakery" not in str(track)


@pytest.mark.asyncio
async def test_mixed_order_leaves_the_store_status_to_the_store(env):
    c, db = env
    await c.put("/api/marketplace/gigs/gig1/suppliers", json={"suppliers": {"challah": "bakery"}}, headers=_auth(STORE_OWNER))
    placed = (await c.post("/api/marketplace/order-form/gig1/orders",
                           json=_order(lines=(("challah", 1), ("basket", 1))))).json()
    sup = await db.store_orders.find_one({"business_id": "bakery"})
    assert sup["items"] == "1 × Challah"
    await c.patch(f"/api/marketplace/orders/{sup['_id']}/status", json={"status": "preparing"}, headers=_auth(SUPPLIER_OWNER))
    track = (await c.get(f"/api/marketplace/orders/track/{placed['track_token']}")).json()
    assert track["status"] == "new"
    assert track["parts"][0]["status"] == "preparing"


@pytest.mark.asyncio
async def test_no_supplier_no_extra_order(env):
    c, db = env
    await c.post("/api/marketplace/order-form/gig1/orders", json=_order())
    assert await db.store_orders.count_documents({}) == 1


# ---- the two small fixes and the catalogue (13 Oct 2026) -------------------

@pytest_asyncio.fixture
async def env2(env, monkeypatch):
    c, db = env
    import routes.marketplace.orders as om
    sent = []

    async def _rec(to, subject, *a, **k):
        sent.append((to, subject))

    monkeypatch.setattr(om, "_email", _rec)
    await db.marketplace_gigs.insert_one({
        "_id": "bakgig", "business_id": "bakery", "provider_user_id": SUPPLIER_OWNER, "gig_type": "store",
        "status": "published", "title": "Bread", "products": [
            {"id": "rye", "name": "Rye loaf", "price": 25, "currency": "ILS", "description": "Sourdough rye", "images": ["https://x/rye.jpg"]},
        ],
    })
    yield c, db, sent


@pytest.mark.asyncio
async def test_supplier_is_emailed(env2):
    c, db, sent = env2
    await c.put("/api/marketplace/gigs/gig1/suppliers", json={"suppliers": {"challah": "bakery"}}, headers=_auth(STORE_OWNER))
    await c.post("/api/marketplace/order-form/gig1/orders", json=_order())
    assert ("supplier-owner@example.test", "Gift Baskets needs you to supply an order") in sent


@pytest.mark.asyncio
async def test_typed_in_order_sent_by_hand_and_followed(env2):
    c, db, _ = env2
    await db.store_orders.insert_one({
        "_id": "typed", "business_id": "store", "owner_user_id": STORE_OWNER, "customer_name": "Avi",
        "items": "3 challot", "fulfilment": "delivery", "address": "Jaffa 5", "status": "new",
        "history": [], "track_token": "t" * 22, "needed_by": "2030-01-01",
    })
    r = await c.post("/api/marketplace/orders/typed/send-to-supplier",
                     json={"supplier_business_id": "other", "items": "3 challot"}, headers=_auth(STORE_OWNER))
    assert r.status_code == 400
    r = await c.post("/api/marketplace/orders/typed/send-to-supplier",
                     json={"supplier_business_id": "bakery", "items": "3 challot", "whole": True}, headers=_auth(STORE_OWNER))
    assert r.status_code == 200, r.text
    sup = await db.store_orders.find_one({"business_id": "bakery"})
    assert sup["items"] == "3 challot" and sup["address"] == "Jaffa 5"
    await c.patch(f"/api/marketplace/orders/{sup['_id']}/status", json={"status": "preparing"}, headers=_auth(SUPPLIER_OWNER))
    assert (await db.store_orders.find_one({"_id": "typed"}))["status"] == "preparing"
    r = await c.post("/api/marketplace/orders/typed/send-to-supplier",
                     json={"supplier_business_id": "bakery", "items": "x"}, headers=_auth(STRANGER))
    assert r.status_code in (403, 404)


@pytest.mark.asyncio
async def test_catalogue_add_price_and_stock(env2):
    c, db, _ = env2
    r = await c.put("/api/marketplace/gigs/bakgig/wholesale", json={"offers": {"rye": 15}}, headers=_auth(SUPPLIER_OWNER))
    assert r.json()["offers"] == {"rye": 15}
    # nothing about the offer on the supplier's public order form
    assert "15" not in str((await c.get("/api/marketplace/order-form/bakgig")).json().get("products"))
    cat = (await c.get("/api/marketplace/businesses/store/supplier-catalog", headers=_auth(STORE_OWNER))).json()["items"]
    assert [(i["name"], i["wholesale_price"], i["supplier"]["name"]) for i in cat] == [("Rye loaf", 15, "The Bakery")]
    # a stranger's store cannot see it
    assert (await c.get("/api/marketplace/businesses/store/supplier-catalog", headers=_auth(STRANGER))).status_code == 403

    r = await c.post("/api/marketplace/gigs/gig1/add-from-supplier",
                     json={"source_gig_id": "bakgig", "product_id": "rye", "price": 35}, headers=_auth(STORE_OWNER))
    assert r.status_code == 200, r.text
    new = r.json()["product"]
    assert new["price"] == 35 and new["images"] == ["https://x/rye.jpg"]
    again = await c.post("/api/marketplace/gigs/gig1/add-from-supplier",
                         json={"source_gig_id": "bakgig", "product_id": "rye", "price": 35}, headers=_auth(STORE_OWNER))
    assert again.status_code == 409

    await c.post("/api/marketplace/order-form/gig1/orders", json=_order(lines=((new["id"], 2),)))
    sup = await db.store_orders.find_one({"business_id": "bakery"})
    assert sup["total"] == 30 and sup["lines"][0]["price"] == 15   # wholesale, not the customer's 35

    # the supplier runs out: the store's copy cannot be ordered
    await c.patch("/api/marketplace/gigs/bakgig", json={"products": [
        {"id": "rye", "name": "Rye loaf", "price": 25, "in_stock": False}]}, headers=_auth(SUPPLIER_OWNER))
    store_gig = await db.marketplace_gigs.find_one({"_id": "gig1"})
    assert next(p for p in store_gig["products"] if p["id"] == new["id"])["in_stock"] is False
    r = await c.post("/api/marketplace/order-form/gig1/orders", json=_order(lines=((new["id"], 1),)))
    assert r.status_code == 400

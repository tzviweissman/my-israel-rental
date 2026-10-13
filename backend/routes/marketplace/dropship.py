"""Products a partner supplies and ships (Tzvi, 13 Oct 2026: "is there a way
we can allow drop shipping like shopify ... build 1 and 3").

A store marks a product "Supplied by" one of its connected partners
(connections.py: an ACCEPTED connection, checked when it is set and again
when an order is placed). When a customer orders it from the store:

  1. The partner gets its own order for those lines, with the customer's
     delivery details, in its Orders tab (or straight to "preparing" when it
     accepts this store's orders automatically: automations._auto_accept_for).
     The store's order keeps the full list and its own prices; the partner's
     order carries no price, because what the store pays its supplier is
     agreed between them, not on the customer's page.
  2. As the partner moves its order along (preparing, out for delivery,
     delivered), the store's order follows, so the customer's tracking link
     (GET /orders/track/{token}) moves without the store retyping anything.
     When the order also has lines the store makes itself, the store's own
     status is left to the store and the tracking page shows each part.

Who supplies what lives in its own collection, `product_suppliers`, and
never on the listing: the public listing and order form must not reveal a
store's suppliers. The customer sees "part of your order comes separately",
never the supplier's name.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, logger, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

RANK = {"new": 0, "preparing": 1, "ready": 2, "done": 3}


def _now() -> str:
    return datetime.now(UTC).isoformat()


async def _connected(x: str, y: str) -> bool:
    from .automations import connected
    return await connected(x, y)


async def _own_store_gig(gig_id: str, user: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Listing not found")
    if gig.get("provider_user_id") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your listing")
    biz = await db.businesses.find_one({"_id": gig.get("business_id")}) if gig.get("business_id") else None
    if not biz:
        raise HTTPException(status_code=400, detail="This listing is not part of a business yet")
    return gig, biz


async def supplier_map(gig_id: str) -> dict[str, str]:
    """{product_id: supplier business id} for one listing."""
    return {d["product_id"]: d["supplier_business_id"]
            async for d in db.product_suppliers.find({"gig_id": gig_id})}


# ---------------------------------------------------------------------------
# setting it: the store's product editor
# ---------------------------------------------------------------------------

class SuppliersIn(BaseModel):
    # product id -> supplier business id, or null for "we stock it ourselves"
    suppliers: dict[str, Optional[str]] = Field(default_factory=dict)


@router.get("/gigs/{gig_id}/suppliers")
async def get_suppliers(gig_id: str, user=Depends(verify_token)):
    """The current choices and who can be chosen: accepted partners only."""
    gig, biz = await _own_store_gig(gig_id, user)
    conns = await db.business_connections.find({
        "$or": [{"a_id": biz["_id"]}, {"b_id": biz["_id"]}], "status": "accepted",
    }).to_list(500)
    ids = [c["b_id"] if c["a_id"] == biz["_id"] else c["a_id"] for c in conns]
    partners = [{"id": b["_id"], "name": b.get("name") or "", "name_he": b.get("name_he")}
                async for b in db.businesses.find({"_id": {"$in": ids}, "active": {"$ne": False}})]
    partners.sort(key=lambda p: p["name"].lower())
    return {"suppliers": await supplier_map(gig_id), "partners": partners}


@router.put("/gigs/{gig_id}/suppliers")
async def put_suppliers(gig_id: str, payload: SuppliersIn, user=Depends(verify_token)):
    gig, biz = await _own_store_gig(gig_id, user)
    product_ids = {p.get("id") for p in gig.get("products") or [] if p.get("id")}
    for pid, sup in payload.suppliers.items():
        if pid not in product_ids:
            raise HTTPException(status_code=400, detail="One of those products is not on this listing")
        if sup is None:
            await db.product_suppliers.delete_one({"gig_id": gig_id, "product_id": pid})
            continue
        if sup == biz["_id"]:
            raise HTTPException(status_code=400, detail="A product cannot be supplied by its own business")
        if not await _connected(biz["_id"], sup):
            raise HTTPException(status_code=400, detail="Choose a business you are connected with")
        await db.product_suppliers.update_one(
            {"gig_id": gig_id, "product_id": pid},
            {"$set": {"supplier_business_id": sup, "business_id": biz["_id"], "updated_at": _now()}},
            upsert=True,
        )
    return {"suppliers": await supplier_map(gig_id)}


# ---------------------------------------------------------------------------
# 1. an order comes in: the supplied lines go to their suppliers
# ---------------------------------------------------------------------------

async def route_order(order: dict[str, Any]) -> list[dict[str, Any]]:
    """Send each supplier its lines of a new store order. Never raises: the
    customer's order already exists, and a supplier that cannot be reached
    is reported to the store, not to the customer."""
    try:
        return await _route_order(order)
    except Exception:  # noqa: BLE001
        logger.exception("dropship: routing order %s failed", order.get("_id"))
        return []


async def _wholesale_price(mapping: dict[str, Any]) -> Optional[float]:
    """What the supplier charges the store, when the product came from the
    supplier's catalogue (step 2); None when the two agreed it themselves."""
    if not mapping.get("source_gig_id"):
        return None
    w = await db.wholesale_offers.find_one(
        {"gig_id": mapping["source_gig_id"], "product_id": mapping["source_product_id"]})
    return float(w["price"]) if w and w.get("price") is not None else None


async def _route_order(order: dict[str, Any]) -> list[dict[str, Any]]:
    from routes.marketplace import orders as om

    if not order.get("gig_id") or not order.get("lines"):
        return []
    maps = {d["product_id"]: d async for d in db.product_suppliers.find({"gig_id": order["gig_id"]})}
    groups: dict[str, list[dict[str, Any]]] = {}
    for ln in order["lines"]:
        m = maps.get(ln.get("product_id"))
        if m:
            line = {"product_id": ln["product_id"], "name": ln["name"], "qty": ln["qty"]}
            price = await _wholesale_price(m)
            if price is not None:
                line["price"] = price
            groups.setdefault(m["supplier_business_id"], []).append(line)
    if not groups:
        return []

    store = await db.businesses.find_one({"_id": order["business_id"]}) or {}
    parts = [await _create_supplier_order(order, store, sup_id, lines=lines) for sup_id, lines in groups.items()]
    await db.store_orders.update_one({"_id": order["_id"]}, {"$set": {"supplied_parts": parts}})
    await _tell_store_not_sent(order, parts)
    return parts


async def _tell_store_not_sent(order: dict[str, Any], parts: list[dict[str, Any]]) -> None:
    from routes.marketplace import orders as om
    if any(p["status"] == "not_sent" for p in parts):
        names = ", ".join(p["business_name"] or "a partner" for p in parts if p["status"] == "not_sent")
        await om._notify(order["owner_user_id"], type_="order_new",
                         message=f"Could not send part of an order to {names}: you are no longer connected. Arrange it yourself.",
                         action_url="/dashboard?tab=orders", order_id=order["_id"])


async def _create_supplier_order(order: dict[str, Any], store: dict[str, Any], sup_id: str, *,
                                 lines: Optional[list[dict[str, Any]]] = None, items: Optional[str] = None,
                                 whole: bool = False) -> dict[str, Any]:
    """The supplier's own order for its part of `order`, with the customer's
    delivery details; returns the part as the store's order records it.
    Rings the supplier's bell and emails its owner."""
    from routes.marketplace import orders as om
    from routes.marketplace.automations import _auto_accept_for

    supplier = await db.businesses.find_one({"_id": sup_id})
    if lines:
        items = "\n".join(f"{ln['qty']} × {ln['name']}" for ln in lines)
    part = {"business_id": sup_id, "business_name": (supplier or {}).get("name") or "", "items": items,
            "product_ids": [ln["product_id"] for ln in lines or []], "whole": whole}
    if not supplier or not supplier.get("active", True) or not await _connected(store.get("_id", ""), sup_id):
        part.update({"order_id": None, "status": "not_sent"})
        return part

    priced = bool(lines) and all(ln.get("price") is not None for ln in lines)
    total = round(sum(ln["price"] * ln["qty"] for ln in lines), 2) if priced else None
    delivery = order.get("fulfilment") == "delivery"
    land = await _auto_accept_for(supplier, store["_id"], total)
    now = _now()
    history = [{"status": "new", "at": now, "by": "supplied-for"}]
    if land:
        history.append({"status": land, "at": now, "by": "supplied-for", "note": "accepted automatically"})
    note = (f"Supplied for {store.get('name')}: deliver straight to their customer." if delivery
            else f"Supplied for {store.get('name')}: they collect it for their customer.")
    doc = {
        "_id": str(uuid.uuid4()),
        "business_id": sup_id,
        "owner_user_id": supplier["owner_user_id"],
        # Delivery goes to the customer; a pickup order is the store's to
        # collect, so the store is the customer of this one.
        "customer_name": order.get("customer_name") if delivery else store.get("name"),
        "customer_phone": order.get("customer_phone") if delivery else None,
        "customer_phone_e164": order.get("customer_phone_e164") if delivery else None,
        "items": items,
        "lines": lines or None,
        # The wholesale total when every line has a catalogue price; the
        # customer's price is the store's and never reaches the supplier.
        "total": total,
        "currency": order.get("currency") or "ILS",
        "needed_by": order.get("needed_by"),
        "window": order.get("window"),
        "fulfilment": "delivery" if delivery else "pickup",
        "city": order.get("city") if delivery else None,
        "address": order.get("address") if delivery else None,
        "notes": note,
        "status": land or "new",
        "source": "supplied",
        # The shape automated partner orders already use, so the
        # supplier's Orders tab says where it came from ("from <store>").
        "automation": {
            "automation_id": None,
            "from_business_id": store["_id"],
            "from_business_name": store.get("name"),
            "source_order_id": order["_id"],
            "auto_accepted": bool(land),
            "dropship": True,
        },
        "placed_by_business_id": store["_id"],
        "courier": None,
        "assigned_at": None,
        "created_by": "supplied-for",
        "created_at": now,
        "updated_at": now,
        "status_changed_at": now,
        "history": history,
        "track_token": secrets.token_urlsafe(16),
    }
    await db.store_orders.insert_one(doc)
    part.update({"order_id": doc["_id"], "status": doc["status"]})
    try:
        await om.auto_assign(doc, supplier)
        await om._notify(supplier["owner_user_id"], type_="order_new",
                         message=f"{store.get('name')} needs you to supply: {om._order_line(doc)}",
                         action_url="/dashboard?tab=orders", order_id=doc["_id"])
        # By email too: a supplier who does not have the dashboard open
        # would otherwise not know (Tzvi, 13 Oct 2026).
        owner = await db.users.find_one({"id": supplier["owner_user_id"]}, {"_id": 0, "email": 1})
        when = (doc.get("needed_by") or "").replace("T", " ")
        where = f"Deliver to {om._esc(doc['address'])}" if delivery and doc.get("address") else f"{om._esc(store.get('name'))} collects it"
        await om._email(
            (owner or {}).get("email"), f"{store.get('name')} needs you to supply an order",
            f"<p><strong>{om._esc(store.get('name'))}</strong> sold something you supply:</p>"
            f"<p>{om._esc_ml(items)}</p><p>{where}" + (f" · {om._esc(when)}" if when else "") + "</p>"
            + ("<p>Accepted automatically.</p>" if land else "<p>Accept it in your orders.</p>"),
            tag="order-supplied", button=("Open my orders", f"{om._frontend_url()}/dashboard?tab=orders"),
        )
    except Exception:  # noqa: BLE001 - the order exists; a lost bell is not a lost order
        logger.exception("dropship: supplier order %s created, notify failed", doc["_id"])
    return part


class SendToSupplierIn(BaseModel):
    supplier_business_id: str = Field(..., max_length=64)
    items: str = Field(..., min_length=1, max_length=2000)
    # The supplier delivers everything, so the customer's order follows it.
    whole: bool = False


@router.post("/orders/{order_id}/send-to-supplier")
async def send_to_supplier(order_id: str, payload: SendToSupplierIn, user=Depends(verify_token)):
    """An order typed in by the store, or taken by WhatsApp, sent to a
    supplier by hand (Tzvi, 13 Oct 2026). Same order, same tracking."""
    from routes.marketplace import orders as om
    order = await om._owned_order(order_id, user)
    if order["status"] not in om.OPEN_STATUSES:
        raise HTTPException(status_code=409, detail="This order is closed")
    if (order.get("automation") or {}).get("dropship"):
        raise HTTPException(status_code=400, detail="This order was sent to you to supply")
    store = await db.businesses.find_one({"_id": order["business_id"]}) or {}
    if payload.supplier_business_id == store.get("_id"):
        raise HTTPException(status_code=400, detail="Choose another business")
    if not await _connected(store.get("_id", ""), payload.supplier_business_id):
        raise HTTPException(status_code=400, detail="Choose a business you are connected with")
    part = await _create_supplier_order(order, store, payload.supplier_business_id,
                                        items=payload.items.strip(), whole=payload.whole)
    await db.store_orders.update_one({"_id": order_id}, {"$push": {"supplied_parts": part}})
    fresh = await db.store_orders.find_one({"_id": order_id})
    return om._public(fresh)


# ---------------------------------------------------------------------------
# 3. the supplier moves its order: the store's order and the customer follow
# ---------------------------------------------------------------------------

async def on_supplier_status(supplier_order: dict[str, Any]) -> None:
    """Called after any status change. Never raises."""
    try:
        await _on_supplier_status(supplier_order)
    except Exception:  # noqa: BLE001
        logger.exception("dropship: following order %s failed", supplier_order.get("_id"))


async def _on_supplier_status(o: dict[str, Any]) -> None:
    from routes.marketplace import orders as om

    auto = o.get("automation") or {}
    if not auto.get("dropship") or not auto.get("source_order_id"):
        return
    src = await db.store_orders.find_one({"_id": auto["source_order_id"]})
    if not src:
        return
    status = o["status"]
    delivery = o.get("delivery") or {}
    parts = src.get("supplied_parts") or []
    for p in parts:
        if p.get("order_id") == o["_id"]:
            p.update({
                "status": status,
                "out_for_delivery": bool(o.get("fulfilment") == "delivery" and status == "ready" and o.get("courier")),
                "delivered_at": delivery.get("delivered_at") if status == "done" else None,
                "photo_url": delivery.get("photo_url") if status == "done" else None,
            })
    sets: dict[str, Any] = {"supplied_parts": parts, "updated_at": _now()}

    name = next((p.get("business_name") for p in parts if p.get("order_id") == o["_id"]), "")
    if status in ("cancelled", "failed"):
        await db.store_orders.update_one({"_id": src["_id"]}, {"$set": sets})
        word = "cancelled" if status == "cancelled" else "could not deliver"
        await om._notify(src["owner_user_id"], type_="order_new",
                         message=f"{name or 'Your supplier'} {word} part of "
                                 f"{src.get('customer_name')}'s order: {o.get('items')}. Arrange it another way.",
                         action_url="/dashboard?tab=orders", order_id=src["_id"])
        return

    # The store's own status follows only when the whole order is supplied
    # and every part has got at least this far; with lines of its own, the
    # store moves its order itself and the tracking page shows the parts.
    supplied_ids = {pid for p in parts for pid in p.get("product_ids") or []}
    # A pickup order is the store's to collect and hand over, so its status
    # stays the store's: "ready" from the supplier means ready for the store.
    all_supplied = src.get("fulfilment") == "delivery" and (
        any(p.get("whole") for p in parts)
        or (bool(src.get("lines")) and all(ln.get("product_id") in supplied_ids for ln in src["lines"])))
    ranks = [RANK.get(p.get("status"), -1) for p in parts]
    target = None
    if all_supplied and ranks and min(ranks) >= 0:
        target = next(s for s, r in RANK.items() if r == min(ranks))
    if target and RANK[target] > RANK.get(src["status"], 99):
        now = _now()
        sets.update({"status": target, "status_changed_at": now})
        if target == "done" and len(parts) == 1 and delivery.get("delivered_at"):
            sets["delivery"] = {**(src.get("delivery") or {}), "delivered_at": delivery["delivered_at"],
                                "photo_url": delivery.get("photo_url"), "by": "supplier"}
        await db.store_orders.update_one(
            {"_id": src["_id"], "status": src["status"]},
            {"$set": sets, "$push": {"history": {"status": target, "at": now, "by": "supplier"}}},
        )
    else:
        await db.store_orders.update_one({"_id": src["_id"]}, {"$set": sets})


def public_parts(order: dict[str, Any]) -> Optional[list[dict[str, Any]]]:
    """What the customer's tracking page shows: each separate part, its
    items and where it is. Never the supplier's name."""
    parts = order.get("supplied_parts")
    if not parts:
        return None
    return [{
        "items": p.get("items"),
        "status": p.get("status") if p.get("status") in RANK or p.get("status") in ("cancelled", "failed") else "new",
        "out_for_delivery": bool(p.get("out_for_delivery")),
        "delivered_at": p.get("delivered_at"),
        "photo_url": p.get("photo_url") if p.get("status") == "done" else None,
    } for p in parts if p.get("status") != "not_sent"]


# ---------------------------------------------------------------------------
# 2. the supplier's catalogue (Tzvi, 13 Oct 2026: "then step 2")
# ---------------------------------------------------------------------------
#
# A supplier offers products of its own store listing to its partners at a
# wholesale price (`wholesale_offers`, private like `product_suppliers`). A
# partner store browses the catalogues of the businesses it is connected
# with and adds a product to its own listing in one step, at its own price:
# name, description and photos are copied, and the product is marked
# "supplied by" that supplier with a link back to the original. From then
# on the supplier's stock is the store's stock: out of stock, paused or
# removed at the supplier, and the store's copy cannot be ordered either.

class WholesaleIn(BaseModel):
    # product id -> wholesale price, or null to stop offering it
    offers: dict[str, Optional[float]] = Field(default_factory=dict)


@router.get("/gigs/{gig_id}/wholesale")
async def get_wholesale(gig_id: str, user=Depends(verify_token)):
    await _own_store_gig(gig_id, user)
    return {"offers": {d["product_id"]: d["price"] async for d in db.wholesale_offers.find({"gig_id": gig_id})}}


@router.put("/gigs/{gig_id}/wholesale")
async def put_wholesale(gig_id: str, payload: WholesaleIn, user=Depends(verify_token)):
    gig, biz = await _own_store_gig(gig_id, user)
    products = {p.get("id"): p for p in gig.get("products") or [] if p.get("id")}
    for pid, price in payload.offers.items():
        if pid not in products:
            raise HTTPException(status_code=400, detail="One of those products is not on this listing")
        if price is None:
            await db.wholesale_offers.delete_one({"gig_id": gig_id, "product_id": pid})
            continue
        if not (0 <= float(price) <= 1_000_000):
            raise HTTPException(status_code=400, detail="Enter a price")
        await db.wholesale_offers.update_one(
            {"gig_id": gig_id, "product_id": pid},
            {"$set": {"price": round(float(price), 2), "currency": products[pid].get("currency") or "ILS",
                      "business_id": biz["_id"], "updated_at": _now()}},
            upsert=True,
        )
    return await get_wholesale(gig_id, user)


async def _partner_ids(business_id: str) -> list[str]:
    conns = await db.business_connections.find({
        "$or": [{"a_id": business_id}, {"b_id": business_id}], "status": "accepted",
    }).to_list(500)
    return [c["b_id"] if c["a_id"] == business_id else c["a_id"] for c in conns]


@router.get("/businesses/{business_id}/supplier-catalog")
async def supplier_catalog(business_id: str, user=Depends(verify_token)):
    """Everything this business's partners offer it, with the wholesale
    price and whether it is in stock now."""
    from .automations import _owned
    await _owned(business_id, user)
    partners = {b["_id"]: b async for b in db.businesses.find(
        {"_id": {"$in": await _partner_ids(business_id)}, "active": {"$ne": False}})}
    offers = await db.wholesale_offers.find({"business_id": {"$in": list(partners)}}).to_list(2000)
    gigs = {g["_id"]: g async for g in db.marketplace_gigs.find({"_id": {"$in": list({o["gig_id"] for o in offers})}})}
    added = {(d.get("source_gig_id"), d.get("source_product_id")) async for d in db.product_suppliers.find(
        {"business_id": business_id, "source_gig_id": {"$ne": None}})}
    out = []
    for o in offers:
        g = gigs.get(o["gig_id"])
        p = next((x for x in (g or {}).get("products") or [] if x.get("id") == o["product_id"]), None)
        if not g or not p:
            continue
        sup = partners[o["business_id"]]
        out.append({
            "supplier": {"id": sup["_id"], "name": sup.get("name") or "", "name_he": sup.get("name_he")},
            "gig_id": g["_id"], "product_id": p["id"], "name": p.get("name"),
            "description": p.get("description") or "", "images": p.get("images") or ([p["image"]] if p.get("image") else []),
            "wholesale_price": o["price"], "currency": o.get("currency") or "ILS",
            "retail_price": p.get("price"),
            "in_stock": bool(p.get("in_stock", True) and g.get("status", "published") == "published"),
            "added": (g["_id"], p["id"]) in added,
        })
    out.sort(key=lambda r: (r["supplier"]["name"].lower(), (r["name"] or "").lower()))
    return {"items": out}


class AddFromSupplierIn(BaseModel):
    source_gig_id: str = Field(..., max_length=64)
    product_id: str = Field(..., max_length=64)
    price: float = Field(..., ge=0, le=1_000_000)


@router.post("/gigs/{gig_id}/add-from-supplier")
async def add_from_supplier(gig_id: str, payload: AddFromSupplierIn, user=Depends(verify_token)):
    gig, biz = await _own_store_gig(gig_id, user)
    if (gig.get("gig_type") or "") != "store":
        raise HTTPException(status_code=400, detail="Products can only be added to a store listing")
    offer = await db.wholesale_offers.find_one({"gig_id": payload.source_gig_id, "product_id": payload.product_id})
    src = await db.marketplace_gigs.find_one({"_id": payload.source_gig_id})
    p = next((x for x in (src or {}).get("products") or [] if x.get("id") == payload.product_id), None)
    if not offer or not p:
        raise HTTPException(status_code=404, detail="That product is no longer offered")
    if offer["business_id"] == biz["_id"] or not await _connected(biz["_id"], offer["business_id"]):
        raise HTTPException(status_code=400, detail="You are not connected with this supplier")
    if await db.product_suppliers.find_one({"gig_id": gig_id, "source_gig_id": payload.source_gig_id,
                                            "source_product_id": payload.product_id}):
        raise HTTPException(status_code=409, detail="This product is already in your store")
    new_id = uuid.uuid4().hex[:12]
    product = {
        "id": new_id, "name": p.get("name"), "price": round(payload.price, 2),
        "currency": p.get("currency") or "ILS", "description": p.get("description") or "",
        "image": None, "images": p.get("images") or ([p["image"]] if p.get("image") else []),
        "in_stock": bool(p.get("in_stock", True) and src.get("status", "published") == "published"),
        **{k: p.get(k) for k in ("group", "serves", "width_cm", "length_cm") if p.get(k) is not None},
    }
    await db.marketplace_gigs.update_one({"_id": gig_id}, {"$push": {"products": product}, "$set": {"updated_at": _now()}})
    await db.product_suppliers.update_one(
        {"gig_id": gig_id, "product_id": new_id},
        {"$set": {"supplier_business_id": offer["business_id"], "business_id": biz["_id"],
                  "source_gig_id": payload.source_gig_id, "source_product_id": payload.product_id, "updated_at": _now()}},
        upsert=True,
    )
    return {"product": product}


async def sync_from_supplier(gig: Optional[dict[str, Any]], gig_id: str) -> int:
    """After a supplier saves, pauses or deletes a listing: every store copy
    of its catalogue products takes the supplier's stock. Never raises."""
    try:
        links = await db.product_suppliers.find({"source_gig_id": gig_id}).to_list(2000)
        if not links:
            return 0
        live = bool(gig) and gig.get("status", "published") == "published"
        stock = {p.get("id"): bool(p.get("in_stock", True)) for p in (gig or {}).get("products") or []}
        n = 0
        for ln in links:
            ok = live and stock.get(ln["source_product_id"], False)
            r = await db.marketplace_gigs.update_one(
                {"_id": ln["gig_id"], "products": {"$elemMatch": {"id": ln["product_id"], "in_stock": {"$ne": ok}}}},
                {"$set": {"products.$.in_stock": ok}},
            )
            n += r.modified_count
        return n
    except Exception:  # noqa: BLE001
        logger.exception("dropship: stock sync from %s failed", gig_id)
        return 0


async def ensure_dropship_indexes() -> None:
    await db.product_suppliers.create_index([("gig_id", 1), ("product_id", 1)], unique=True)
    await db.product_suppliers.create_index("supplier_business_id")
    await db.product_suppliers.create_index("source_gig_id")
    await db.wholesale_offers.create_index([("gig_id", 1), ("product_id", 1)], unique=True)
    await db.wholesale_offers.create_index("business_id")

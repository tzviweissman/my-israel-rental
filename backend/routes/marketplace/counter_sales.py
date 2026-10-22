"""Walk-in sales at the counter (Tzvi, 19 Oct 2026; item 5 of "fully run
their business from our site").

A shop's in-person sales were invisible to the site: totals, stock and the
customer list only knew about orders that came in online or were typed in
as orders to prepare. A counter sale is recorded in one step and is already
finished: it is a `store_orders` row with `source: "counter"`, status
`done`, the lines and total, and how it was paid. That one shape is why
everything else counts it with no change: the sales summary (total), stock
(taken here, through stock.take), the customer list (only when a name or
phone is given; an anonymous sale adds no customer), and the orders board.

Prices come from the store's own list, like a website order. An item that
is not on the list can be added by name and price. A mistake is undone by
"Cancel sale", which puts counted stock back.

Who: the owner, or staff with the "orders" area, the same as entering an
order.
"""
from __future__ import annotations

import secrets
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, logger, verify_token

from .orders import _now_iso, _owned_business, _owned_order, _phone_fields, _products_for_order, _public

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

MAX_LINES = 60


class CounterLine(BaseModel):
    product_id: Optional[str] = Field(None, max_length=80)
    option_id: Optional[str] = Field(None, max_length=40)
    # An item not on the store's list: name and price typed at the counter.
    name: Optional[str] = Field(None, max_length=120)
    price: Optional[float] = Field(None, ge=0, le=100_000)
    qty: int = Field(1, ge=1, le=999)


class CounterSaleIn(BaseModel):
    gig_id: Optional[str] = Field(None, max_length=80)
    lines: list[CounterLine] = Field(..., min_length=1, max_length=MAX_LINES)
    method: str = Field(..., pattern="^(cash|card|bit|other)$")
    customer_name: str = Field("", max_length=120)
    customer_phone: str = Field("", max_length=40)
    notes: str = Field("", max_length=500)


async def _stores(business_id: str) -> list[dict[str, Any]]:
    return [g async for g in db.marketplace_gigs.find(
        {"business_id": business_id, "gig_type": "store", "status": "published"}, {"title": 1, "title_he": 1, "products": 1})]


@router.get("/businesses/{business_id}/counter")
async def counter_catalogue(business_id: str, user=Depends(verify_token)):
    """The store's list for the counter screen, with stock left."""
    await _owned_business(business_id, user)
    return {"stores": [{"id": g["_id"], "title": g.get("title"), "title_he": g.get("title_he"),
                        "products": _products_for_order(g)} for g in await _stores(business_id)]}


@router.post("/businesses/{business_id}/counter-sales")
async def record_sale(business_id: str, payload: CounterSaleIn, user=Depends(verify_token)):
    biz = await _owned_business(business_id, user)
    gig, products = None, {}
    if any(ln.product_id for ln in payload.lines):
        gig = next((g for g in await _stores(business_id) if g["_id"] == payload.gig_id), None)
        if not gig:
            raise HTTPException(status_code=400, detail="Choose which shop the items are from")
        products = {p["id"]: p for p in _products_for_order(gig)}

    lines, total = [], 0.0
    currencies: set[str] = set()
    for ln in payload.lines:
        if ln.product_id:
            prod = products.get(ln.product_id)
            if not prod:
                raise HTTPException(status_code=400, detail="One of those items is not in the shop's list any more")
            price, name, opt = float(prod.get("price") or 0), prod["name"], None
            if prod.get("options"):
                opt = next((o for o in prod["options"] if o["id"] == ln.option_id), None)
                if not opt:
                    raise HTTPException(status_code=400, detail=f"Pick a choice for {prod['name']}")
                if opt.get("price") is not None:
                    price = float(opt["price"])
                name = f"{prod['name']} ({opt['name']})"
            lines.append({"product_id": prod["id"], "name": name, "price": price, "qty": ln.qty,
                          **({"option_id": opt["id"], "option": opt["name"]} if opt else {})})
            currencies.add((prod.get("currency") or "ILS").upper())
        else:
            name = (ln.name or "").strip()
            if len(name) < 1 or ln.price is None:
                raise HTTPException(status_code=400, detail="An item not on the list needs a name and a price")
            lines.append({"product_id": None, "name": name, "price": float(ln.price), "qty": ln.qty})
        total += lines[-1]["price"] * ln.qty
    if len(currencies) > 1:
        raise HTTPException(status_code=400, detail="Those items are priced in different currencies; record them separately")
    currency = next(iter(currencies), "ILS")
    total = round(total, 2)

    stock_taken: list[dict[str, Any]] = []
    if gig:
        from .stock import OutOfStock, take
        try:
            stock_taken = await take(gig["_id"], [x for x in lines if x["product_id"]], products)
        except OutOfStock as e:
            raise HTTPException(status_code=409, detail=f"Only {e.left} of {e.name} left in stock") from e

    now = _now_iso()
    doc = {
        "_id": str(uuid.uuid4()),
        "business_id": business_id,
        "owner_user_id": biz["owner_user_id"],
        "gig_id": gig["_id"] if gig else None,
        "customer_name": payload.customer_name.strip(),
        **_phone_fields(payload.customer_phone.strip() or None),
        "items": ", ".join(f"{x['qty']}× {x['name']}" for x in lines),
        "lines": lines,
        "subtotal": total,
        "total": total,
        "currency": currency,
        # The moment of the sale, so it sits under Today on the board, in
        # today's money strip, and in Print and Export, which all go by it.
        "needed_by": now[:16],
        "fulfilment": "pickup",
        "address": None,
        "notes": payload.notes.strip(),
        "status": "done",
        "source": "counter",
        "payment": {"method": payload.method, "amount": total, "at": now, "by": user["user_id"]},
        "stock_taken": stock_taken,
        "courier": None,
        "assigned_at": None,
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now,
        "status_changed_at": now,
        "history": [{"status": "done", "at": now, "by": user["user_id"], "event": "counter_sale"}],
        "track_token": secrets.token_urlsafe(16),
    }
    await db.store_orders.insert_one(doc)
    from .reorder import in_background, products_sold
    in_background(products_sold(business_id, doc.get("gig_id"), lines))
    logger.info("[counter] sale: business=%s order=%s total=%s", business_id, doc["_id"], total)
    return _public(doc)


@router.post("/orders/{order_id}/cancel-sale")
async def cancel_sale(order_id: str, user=Depends(verify_token)):
    """Undo a counter sale recorded by mistake; counted stock goes back."""
    order = await _owned_order(order_id, user)
    if order.get("source") != "counter":
        raise HTTPException(status_code=400, detail="Only a counter sale can be cancelled this way")
    if order.get("status") == "cancelled":
        return _public(order)
    now = _now_iso()
    res = await db.store_orders.update_one(
        {"_id": order_id, "status": "done"},
        {"$set": {"status": "cancelled", "updated_at": now, "status_changed_at": now},
         "$push": {"history": {"status": "cancelled", "at": now, "by": user["user_id"], "event": "sale_cancelled"}}})
    if res.modified_count:
        from .stock import give_back
        await give_back(order)
    return _public(await db.store_orders.find_one({"_id": order_id}))

"""Stock counts on store products (Tzvi, 15 Oct 2026: "do it all", from
the Shopify list: "the business enters how many it has; it shows sold
out on its own and the owner is told when it runs low").

A product counts stock only when the business gives it a number
(`ProductItem.stock`); None means it does not count, and nothing here
touches it. A website order takes its quantities when it is placed and
gives them back if it is cancelled. Orders the owner types on the board
are free text and never touch the count: the owner sets the number.

Every take is one conditional update (`stock >= qty`), so two customers
ordering the last loaf at once cannot both get it.
"""
from __future__ import annotations

from typing import Any

from routes.deps import db, logger


class OutOfStock(Exception):
    def __init__(self, name: str, left: int):
        super().__init__(name)
        self.name, self.left = name, left


async def take(gig_id: str, lines: list[dict[str, Any]], products: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Take each counted line's quantity. All or nothing: on a shortfall
    what was taken is put back and OutOfStock says which and how many are left.
    Returns what was taken, for the order to keep."""
    want: dict[str, int] = {}
    for ln in lines:
        p = products.get(ln["product_id"])
        if p and p.get("stock") is not None:
            want[ln["product_id"]] = want.get(ln["product_id"], 0) + int(ln["qty"])
    taken: list[dict[str, Any]] = []
    for pid, qty in want.items():
        r = await db.marketplace_gigs.update_one(
            {"_id": gig_id, "products": {"$elemMatch": {"id": pid, "stock": {"$gte": qty}}}},
            {"$inc": {"products.$.stock": -qty}})
        if not r.modified_count:
            await _put_back(gig_id, taken)
            fresh = await db.marketplace_gigs.find_one({"_id": gig_id}, {"products": 1}) or {}
            left = next((int(p.get("stock") or 0) for p in fresh.get("products") or [] if p.get("id") == pid), 0)
            raise OutOfStock(products[pid].get("name") or "", left)
        taken.append({"product_id": pid, "qty": qty})
    if taken:
        await _after_change(gig_id, taken)
    return taken


async def _put_back(gig_id: str, taken: list[dict[str, Any]]) -> None:
    for t in taken:
        await db.marketplace_gigs.update_one(
            {"_id": gig_id, "products.id": t["product_id"]},
            {"$inc": {"products.$.stock": t["qty"]}, "$set": {"products.$.in_stock": True}})


async def give_back(order: dict[str, Any]) -> None:
    """A cancelled website order returns what it took. Once only: the
    order's record of it is cleared in the same filter."""
    if not order.get("stock_taken") or not order.get("gig_id"):
        return
    r = await db.store_orders.update_one({"_id": order["_id"], "stock_taken": {"$ne": []}}, {"$set": {"stock_taken": []}})
    if r.modified_count:
        await _put_back(order["gig_id"], order["stock_taken"])


async def _after_change(gig_id: str, taken: list[dict[str, Any]]) -> None:
    """Sold out at 0; the owner is emailed when a product reaches its
    low mark or sells out."""
    gig = await db.marketplace_gigs.find_one({"_id": gig_id}, {"products": 1, "business_id": 1, "title": 1})
    if not gig:
        return
    by_id = {p.get("id"): p for p in gig.get("products") or []}
    alerts = []
    for t in taken:
        p = by_id.get(t["product_id"])
        if not p or p.get("stock") is None:
            continue
        left, before = int(p["stock"]), int(p["stock"]) + t["qty"]
        # Reorder rules on this product (reorder.py), in the background:
        # a sale never waits on, or fails because of, a supplier.
        from .reorder import in_background, stock_dropped
        in_background(stock_dropped(gig_id, gig.get("business_id"), p, before, left))
        if left <= 0:
            await db.marketplace_gigs.update_one({"_id": gig_id, "products.id": p["id"]}, {"$set": {"products.$.in_stock": False}})
            alerts.append((p.get("name") or "", 0))
        elif p.get("low_stock_at") and left <= int(p["low_stock_at"]) < before:
            alerts.append((p.get("name") or "", left))
    if not alerts:
        return
    biz = await db.businesses.find_one({"_id": gig.get("business_id")}, {"owner_user_id": 1})
    owner = await db.users.find_one({"id": (biz or {}).get("owner_user_id")}, {"email": 1}) if biz else None
    from .orders import _email, _esc, _frontend_url
    rows = "".join(f"<p><b>{_esc(n)}</b>: {'sold out' if left == 0 else f'{left} left'}</p>" for n, left in alerts)
    logger.info("[stock] alert gig=%s %s", gig_id, alerts)
    await _email((owner or {}).get("email"), "Stock running low" if all(a[1] for a in alerts) else "Sold out on your page",
                 rows + "<p>Update the count on your listing when you restock.</p>",
                 tag="stock-alert", button=("Open my listings", f"{_frontend_url()}/dashboard?tab=my-businesses&services=1"))

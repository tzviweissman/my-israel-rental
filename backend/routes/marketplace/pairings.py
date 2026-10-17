"""'Add to your order' (Tzvi, 16 Oct 2026, from Shopify's "frequently bought
together").

For each product on an order form, up to four others that go with it:
first the ones the business chose (ProductItem.goes_with, set in the
listing editor), then the ones most often ordered together with it on
this listing's website orders over the last six months. The form shows at
most two, for what is already in the basket, never one that is already
there or sold out. A suggestion, never added for the customer.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request, Response

from routes.deps import db
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
MIN_TOGETHER = 2   # ordered together at least this often to count


@router.get("/order-form/{gig_id}/goes-with")
async def goes_with(gig_id: str, request: Request, response: Response):
    check_rate(request, bucket="goes_with", limit=120, window_seconds=600)
    gig = await db.marketplace_gigs.find_one({"_id": gig_id, "gig_type": "store"}, {"products": 1})
    if not gig:
        raise HTTPException(status_code=404, detail="Not found")
    ids = [p.get("id") or f"idx:{i}" for i, p in enumerate(gig.get("products") or [])]
    known = set(ids)
    out: dict[str, list[str]] = {}
    for pid, p in zip(ids, gig.get("products") or []):
        out[pid] = [x for x in (p.get("goes_with") or []) if x in known and x != pid][:4]

    since = (datetime.now(IL) - timedelta(days=183)).isoformat()
    together: dict[str, Counter] = defaultdict(Counter)
    async for o in db.store_orders.find({"gig_id": gig_id, "source": "website", "created_at": {"$gte": since},
                                         "status": {"$ne": "cancelled"}}, {"lines": 1}).limit(2000):
        bought = {ln.get("product_id") for ln in o.get("lines") or [] if ln.get("product_id") in known}
        for a in bought:
            for b in bought:
                if a != b:
                    together[a][b] += 1
    for pid in ids:
        for other, n in together[pid].most_common(4):
            if n >= MIN_TOGETHER and other not in out[pid] and len(out[pid]) < 4:
                out[pid].append(other)
    response.headers["Cache-Control"] = "public, max-age=600"
    return out

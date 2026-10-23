"""Ordering from the table (Tzvi, 16 Oct 2026, from Square, Toast and
Wolt's table ordering).

A restaurant or café switches it on (Orders → Hours, deliveries and
prices → Order from the table) and says how many tables it has. It prints
a sheet with one QR code per table; each opens the usual order form
(/order/<listing>?table=5). A table order needs no phone and no date: it
is for now, it lands on the board marked "Table 5", and it skips the
pickup windows and cutoffs, which are for orders ahead (orders.py).

Each table's link carries its own code (&k=..., an HMAC of the table number
under a key kept on the business), so only someone holding the printed QR
can order to a table; a guessed /order/<listing>?table=5 is refused (Tzvi,
23 Oct 2026, after the 20 Oct audit: anyone with the order link could send
nameless table orders to the kitchen).
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from routes.deps import db, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
DEFAULTS = {"on": False, "tables": 10}


def settings_of(biz: dict[str, Any]) -> dict[str, Any]:
    return {**DEFAULTS, **(biz.get("table_ordering") or {})}


def table_code(biz: dict[str, Any], table: int) -> str:
    """The code printed in table <table>'s QR link; empty until the business has a key."""
    key = (biz.get("table_ordering") or {}).get("key") or ""
    return hmac.new(key.encode(), f"{biz['_id']}:{int(table)}".encode(), hashlib.sha256).hexdigest()[:12] if key else ""


def table_ok(biz: dict[str, Any], table: int, code: Optional[str] = None) -> bool:
    st = settings_of(biz)
    want = table_code(biz, table)
    return (bool(st["on"]) and 1 <= int(table) <= int(st["tables"])
            and bool(want) and hmac.compare_digest(str(code or ""), want))


class TablesIn(BaseModel):
    on: bool
    tables: int = Field(10, ge=1, le=500)


@router.get("/businesses/{business_id}/table-ordering")
async def get_tables(business_id: str, user=Depends(verify_token)):
    from utils.business_access import business_access
    biz = await business_access(db, business_id, user, "orders")
    if not (biz.get("table_ordering") or {}).get("key"):
        key = secrets.token_hex(16)
        await db.businesses.update_one({"_id": business_id}, {"$set": {"table_ordering.key": key}})
        biz = {**biz, "table_ordering": {**(biz.get("table_ordering") or {}), "key": key}}
    store = await db.marketplace_gigs.find_one(
        {"business_id": business_id, "gig_type": "store", "status": "published"}, {"_id": 1})
    st = settings_of(biz)
    return {"on": st["on"], "tables": st["tables"], "store_id": (store or {}).get("_id"),
            "codes": {str(n): table_code(biz, n) for n in range(1, int(st["tables"]) + 1)}}


@router.put("/businesses/{business_id}/table-ordering")
async def put_tables(business_id: str, body: TablesIn, user=Depends(verify_token)):
    from utils.business_access import business_access
    await business_access(db, business_id, user, None)
    # field by field, so the business's table key (and with it the printed codes) survives a change
    await db.businesses.update_one({"_id": business_id}, {"$set": {"table_ordering.on": body.on, "table_ordering.tables": body.tables}})
    return body.model_dump()

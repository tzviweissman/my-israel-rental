"""Ordering from the table (Tzvi, 16 Oct 2026, from Square, Toast and
Wolt's table ordering).

A restaurant or café switches it on (Orders → Hours, deliveries and
prices → Order from the table) and says how many tables it has. It prints
a sheet with one QR code per table; each opens the usual order form
(/order/<listing>?table=5). A table order needs no phone and no date: it
is for now, it lands on the board marked "Table 5", and it skips the
pickup windows and cutoffs, which are for orders ahead (orders.py).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from routes.deps import db, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
DEFAULTS = {"on": False, "tables": 10}


def settings_of(biz: dict[str, Any]) -> dict[str, Any]:
    return {**DEFAULTS, **(biz.get("table_ordering") or {})}


def table_ok(biz: dict[str, Any], table: int) -> bool:
    st = settings_of(biz)
    return bool(st["on"]) and 1 <= int(table) <= int(st["tables"])


class TablesIn(BaseModel):
    on: bool
    tables: int = Field(10, ge=1, le=500)


@router.get("/businesses/{business_id}/table-ordering")
async def get_tables(business_id: str, user=Depends(verify_token)):
    from utils.business_access import business_access
    biz = await business_access(db, business_id, user, "orders")
    store = await db.marketplace_gigs.find_one(
        {"business_id": business_id, "gig_type": "store", "status": "published"}, {"_id": 1})
    return {**settings_of(biz), "store_id": (store or {}).get("_id")}


@router.put("/businesses/{business_id}/table-ordering")
async def put_tables(business_id: str, body: TablesIn, user=Depends(verify_token)):
    from utils.business_access import business_access
    await business_access(db, business_id, user, None)
    await db.businesses.update_one({"_id": business_id}, {"$set": {"table_ordering": body.model_dump()}})
    return body.model_dump()

"""Super Admin → Ads (Tzvi, 2 Nov 2026: "make me an area to create ads and
edit them to send on whatsapp").

MyIsraelRental's own ads, drawn in the browser (components/admin/AdStudio.jsx)
from a design and the words and pictures typed into it. The server only
keeps each ad's fields, so an ad can be opened and changed later.
"""
from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.deps import db, verify_token

router = APIRouter()

DESIGNS = ("chat", "showcase", "photo")


def _admin(payload: dict) -> None:
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")


class AdIn(BaseModel):
    id: str | None = None
    name: str
    design: str
    lang: str = "en"
    fields: dict[str, Any]


@router.get("/admin/ads")
async def list_ads(payload: dict = Depends(verify_token)) -> dict:
    _admin(payload)
    rows = await db.admin_ads.find({}, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return {"ads": rows}


@router.post("/admin/ads")
async def save_ad(body: AdIn, payload: dict = Depends(verify_token)) -> dict:
    _admin(payload)
    if body.design not in DESIGNS:
        raise HTTPException(status_code=400, detail="Unknown design.")
    # Words and picture links only; a picture itself is uploaded first.
    if len(json.dumps(body.fields)) > 20000:
        raise HTTPException(status_code=400, detail="This ad has too much in it to save.")
    now = datetime.now(UTC).isoformat()
    doc = {"name": body.name.strip()[:80] or "Untitled ad", "design": body.design,
           "lang": "he" if body.lang == "he" else "en", "fields": body.fields, "updated_at": now}
    if body.id:
        res = await db.admin_ads.update_one({"id": body.id}, {"$set": doc})
        if not res.matched_count:
            raise HTTPException(status_code=404, detail="That ad no longer exists.")
        return {"id": body.id, **doc}
    ad_id = uuid.uuid4().hex
    await db.admin_ads.insert_one({"id": ad_id, "created_at": now, "created_by": payload.get("user_id"), **doc})
    return {"id": ad_id, **doc}


@router.delete("/admin/ads/{ad_id}")
async def delete_ad(ad_id: str, payload: dict = Depends(verify_token)) -> dict:
    _admin(payload)
    await db.admin_ads.delete_one({"id": ad_id})
    return {"ok": True}

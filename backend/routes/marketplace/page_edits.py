"""Owner edits to a hand-built business page (Tzvi, 9 Oct 2026).

A hand-built page (scripts/publish-page.mjs, docs/hand-built-pages.md) is
static HTML. Its owner edits it in the dashboard the way Claude Design
works: click text to change it, drag text or a photo to move it, click a
photo to replace it, resize, align, hide. publish-page.mjs gives every
editable element a `data-mir-key`; the editor saves changes against those
keys here, and frontend/server.js applies them when it serves the page, so a
visitor never sees the old version first.

Shape of `edits` (every part optional):

    text:  {key: "<limited html>"}     new content of a text element
    img:   {key: "https://..."}        new photo
    style: {key: {"d": {...}, "m": {...}}}  per device, d = laptop, m = phone:
           x, y   move in px (translate), s  scale, a  align l/c/r, h  hidden
"""
from __future__ import annotations

import re
from datetime import UTC, datetime
from html import escape
from html.parser import HTMLParser
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.deps import db, verify_token
from .businesses import _owned, _resolve

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

KEY = re.compile(r"^[ti]-[0-9a-z]{4,12}-\d{1,3}$")
MAX_KEYS = 600
MAX_TEXT = 3000
# The inline formatting a heading or line may keep (a script-font span, a
# line break, bold). Nothing that runs, links out or loads anything.
ALLOWED_TAGS = {"b", "strong", "i", "em", "u", "small", "span", "br", "sup", "sub", "a"}
# A link inside a line (a phone number, an email) keeps working: only these.
HREF_RE = re.compile(r"^(?:https://|tel:|mailto:|#|/)[^\s\"'<>]{0,300}$")
CLASS_RE = re.compile(r"^[A-Za-z0-9_ -]{0,80}$")


class _Clean(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.open: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "template", "noscript"):
            self.skip += 1
            return
        if tag not in ALLOWED_TAGS:
            return
        if tag == "br":
            self.out.append("<br>")
            return
        cls = next((v for k, v in attrs if k == "class" and v and CLASS_RE.match(v)), None)
        extra = f' class="{escape(cls)}"' if cls else ""
        if tag == "a":
            href = next((v for k, v in attrs if k == "href" and v and HREF_RE.match(v)), None)
            if href:
                extra += f' href="{escape(href)}"'
        self.out.append(f"<{tag}{extra}>")
        self.open.append(tag)

    def handle_endtag(self, tag):
        if tag in ("script", "style", "template", "noscript"):
            self.skip = max(0, self.skip - 1)
            return
        if tag in self.open:
            while self.open:
                t = self.open.pop()
                self.out.append(f"</{t}>")
                if t == tag:
                    break

    def handle_data(self, data):
        if self.skip:
            return
        self.out.append(escape(data, quote=False))

    def result(self) -> str:
        while self.open:
            self.out.append(f"</{self.open.pop()}>")
        return "".join(self.out)


def clean_html(s: str) -> str:
    p = _Clean()
    p.feed(s or "")
    p.close()
    return p.result()


def _num(v: Any, lo: float, hi: float) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f:  # NaN
        return None
    return round(max(lo, min(hi, f)), 3)


def _style(v: Any) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if not isinstance(v, dict):
        return out
    for dev in ("d", "m"):
        s = v.get(dev)
        if not isinstance(s, dict):
            continue
        o: dict[str, Any] = {}
        for k, lo, hi in (("x", -3000, 3000), ("y", -6000, 6000), ("s", 0.4, 3)):
            n = _num(s.get(k), lo, hi)
            if n is not None:
                o[k] = n
        if s.get("a") in ("l", "c", "r"):
            o["a"] = s["a"]
        if s.get("h") is True:
            o["h"] = True
        if o:
            out[dev] = o
    return out


def clean_edits(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise HTTPException(status_code=422, detail="edits must be an object")
    text, img, style = {}, {}, {}
    for k, v in (raw.get("text") or {}).items():
        if KEY.match(k) and k.startswith("t-") and isinstance(v, str):
            if len(v) > MAX_TEXT:
                raise HTTPException(status_code=422, detail="A text is too long")
            text[k] = clean_html(v)
    for k, v in (raw.get("img") or {}).items():
        if KEY.match(k) and k.startswith("i-") and isinstance(v, str) and re.match(r"^https://[^\s\"'<>]{8,600}$", v):
            img[k] = v
    for k, v in (raw.get("style") or {}).items():
        if KEY.match(k):
            s = _style(v)
            if s:
                style[k] = s
    if len(text) + len(img) + len(style) > MAX_KEYS:
        raise HTTPException(status_code=422, detail="Too many edits")
    return {"text": text, "img": img, "style": style}


class EditsBody(BaseModel):
    edits: dict[str, Any]


@router.get("/business/{slug_or_id}/page-edits")
async def get_page_edits(slug_or_id: str):
    """The saved edits, public: they are what the live page shows anyway."""
    biz = await _resolve(slug_or_id)
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    doc = await db.page_edits.find_one({"_id": biz["_id"]}) or {}
    # The prices of what they sell, by the names in their listings: the page
    # shows these (frontend/server.js, pages/<slug>/prices.json), so a price
    # changed in the dashboard changes on the designed page too.
    prices: dict[str, float] = {}
    async for g in db.marketplace_gigs.find({"business_id": biz["_id"], "status": "published"}, {"products": 1, "tiers": 1}):
        for row in (g.get("products") or []) + (g.get("tiers") or []):
            name = (row.get("name") or row.get("title") or "").strip()
            try:
                price = float(row.get("price"))
            except (TypeError, ValueError):
                continue
            if name and price >= 0 and name not in prices:
                prices[name] = price
    return {
        "edits": doc.get("edits") or {"text": {}, "img": {}, "style": {}},
        "updated_at": doc.get("updated_at"),
        "prices": prices,
    }


@router.put("/businesses/{business_id}/page-edits")
async def put_page_edits(business_id: str, body: EditsBody, user=Depends(verify_token)):
    biz = await _owned(business_id, user)
    edits = clean_edits(body.edits)
    now = datetime.now(UTC).isoformat()
    await db.page_edits.update_one(
        {"_id": biz["_id"]},
        {"$set": {"edits": edits, "slug": biz.get("slug"), "updated_at": now, "updated_by": user["user_id"]}},
        upsert=True,
    )
    return {"edits": edits, "updated_at": now}


@router.delete("/businesses/{business_id}/page-edits")
async def delete_page_edits(business_id: str, user=Depends(verify_token)):
    """Back to the page as it was designed."""
    biz = await _owned(business_id, user)
    await db.page_edits.delete_one({"_id": biz["_id"]})
    return {"ok": True}

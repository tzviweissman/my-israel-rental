"""Keep exploring after an order (Tzvi, 12 Nov 2026: "i want more people looking at
our site so businesses and listers see that we get a lot of traffic").

Under the order, on the "Order sent" screen, the customer's order page and in the
order emails:
- more from the same business: its other products, each opening the order form
  with that one chosen, and
- a few other businesses on MyIsraelRental that go with what was ordered. Never
  the same kind of business, so a bakery's customer is not sent to another bakery.
  Their links carry ?src=orders, so the visit counts in that business's "Where
  they came from" (view_tracking.source_of).

Only real listings with a real photo; test and demo listings are left out. The
choice is stable for one order (seeded by its id), so a reload shows the same.
"""
from __future__ import annotations

import random
import re
import time
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request

from routes.deps import db
from routes.home_tiles import gig_photo
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

# What goes with what. A category not listed gets the general mix.
GOES_WITH: dict[str, tuple[str, ...]] = {
    "food": ("events-catering", "shops-products", "travel-tourism"),
    "events-catering": ("food", "shops-products", "personal-care"),
    "shops-products": ("food", "events-catering", "personal-care"),
    "personal-care": ("health-fitness", "shops-products", "events-catering"),
    "health-fitness": ("personal-care", "food", "shops-products"),
    "travel-tourism": ("transportation", "food", "events-catering"),
    "transportation": ("travel-tourism", "moving-relocation", "food"),
    "moving": ("cleaning-services", "home-services-repair", "handyman"),
    "moving-relocation": ("cleaning-services", "home-services-repair", "handyman"),
    "cleaning": ("home-services-repair", "moving-relocation", "handyman"),
    "cleaning-services": ("home-services-repair", "moving-relocation", "handyman"),
}
MIX = ("food", "events-catering", "shops-products", "personal-care", "travel-tourism")
# TEST_web challot, "Bun Intended (test store)", "Board House 1790206626607"
_TEST = re.compile(r"^\s*(test|demo|seed)[_ -]|\btest (store|shop|listing|business)\b|\(test\b|\b\d{10,}\b", re.I)
_STOCK = re.compile(r"picsum\.photos|placehold|unsplash\.it|dummyimage", re.I)   # seed and placeholder pictures, not a real business

_POOL: dict[str, Any] = {"at": 0.0, "gigs": []}
_TTL = 600


async def _pool() -> list[dict[str, Any]]:
    """Every published listing with a photo, kept ten minutes: the order pages are opened often."""
    now = time.time()
    if now - _POOL["at"] > _TTL:
        gigs = await db.marketplace_gigs.find(
            {"status": "published", "is_hidden": {"$ne": True}, "demo_marker": {"$exists": False}},
            {"_id": 1, "title": 1, "title_he": 1, "category": 1, "area": 1, "business_id": 1,
             "gallery": 1, "products": {"$slice": 3}, "tiers": {"$slice": 2}},
        ).to_list(3000)
        ids = list({g["business_id"] for g in gigs if g.get("business_id")})
        names = {b["_id"]: b async for b in db.businesses.find({"_id": {"$in": ids}}, {"name": 1, "name_he": 1})}
        pool = []
        for g in gigs:
            photo = gig_photo(g)
            b = names.get(g.get("business_id")) or {}
            title = b.get("name") or g.get("title")   # the business, not one listing's title
            if photo and title and not _STOCK.search(photo) and not _TEST.search(title) and not _TEST.search(g.get("title") or ""):
                # title_he: the business's own Hebrew name, never a listing's title under the business's name
                pool.append({"id": g["_id"], "title": title, "title_he": b.get("name_he") if b else g.get("title_he"), "category": g.get("category"),
                             "area": (g.get("area") or "").split(" - ")[-1].strip(), "business_id": g.get("business_id"), "photo": photo})
        _POOL.update(at=now, gigs=pool)
    return _POOL["gigs"]


def _first_photo(p: dict[str, Any]) -> Optional[str]:
    for u in (p.get("images") or []) + [p.get("image")]:
        if isinstance(u, str) and u.startswith("http"):
            return u
    return None


def more_from(gig: dict[str, Any], o: dict[str, Any], n: int = 4) -> list[dict[str, Any]]:
    """The business's other products, photos first; never what is already in this order."""
    ordered = {ln.get("product_id") for ln in o.get("lines") or []}
    out = []
    for p in gig.get("products") or []:
        if not p.get("id") or p["id"] in ordered or p.get("hidden") or p.get("sold_out") or not p.get("name"):
            continue
        out.append({"name": p["name"], "name_he": p.get("name_he"), "price": p.get("price"), "price_kind": p.get("price_kind"), "currency": p.get("currency"),
                    "image": _first_photo(p), "href": f"/order/{quote(gig['_id'])}?items={quote(p['id'], safe='')}~1"})
    out.sort(key=lambda r: r["image"] is None)   # stable: photos first, the business's own order kept
    return out[:n]


async def others_for(o: dict[str, Any], category: Optional[str], area: str, n: int = 3) -> list[dict[str, Any]]:
    """Other businesses that go with this order: related kinds, the same area first."""
    kinds = GOES_WITH.get(category or "", MIX)
    # Only kinds that go with it (or the general mix): a cleaner is no suggestion after a cheese board.
    pool = [g for g in await _pool() if g["business_id"] != o.get("business_id") and g["category"] != category
            and (g["category"] in kinds or g["category"] in MIX)]
    rnd = random.Random(o.get("_id") or "")
    rnd.shuffle(pool)
    rank = {k: i for i, k in enumerate(kinds)}
    pool.sort(key=lambda g: (g["category"] not in rank, not (area and g["area"] == area), rank.get(g["category"], 99)))
    out, seen = [], set()
    for g in pool:
        name = g["title"].strip().lower()
        if g["business_id"] in seen or name in seen:   # one card per business, even one listed twice
            continue
        seen.update((g["business_id"], name))
        out.append({"title": g["title"], "title_he": g["title_he"], "photo": g["photo"], "area": g["area"],
                    "href": f"/businesses/{quote(g['id'])}?src=orders"})
        if len(out) == n:
            break
    return out


async def suggestions(o: dict[str, Any]) -> dict[str, Any]:
    gig = await db.marketplace_gigs.find_one({"_id": o.get("gig_id")}, {"products": 1, "category": 1, "area": 1}) if o.get("gig_id") else None
    gig = gig or {}
    area = (gig.get("area") or "").split(" - ")[-1].strip()
    return {"more": more_from(gig, o) if gig else [], "others": await others_for(o, gig.get("category"), area)}


@router.get("/orders/track/{token}/explore")
async def explore(token: str, request: Request):
    check_rate(request, bucket="orders_explore", limit=120, window_seconds=600)
    if not token or len(token) < 16:
        raise HTTPException(status_code=404, detail="This link is not valid")
    o = await db.store_orders.find_one({"track_token": token}, {"_id": 1, "business_id": 1, "gig_id": 1, "lines": 1})
    if not o:
        raise HTTPException(status_code=404, detail="This link is not valid")
    return await suggestions(o)


async def email_html(o: dict[str, Any], biz: dict[str, Any], lang: str) -> str:
    """The same two rows for the bottom of a customer's order email: names and links, no
    pictures (mail clients block them). Empty when there is nothing real. Never raises."""
    from routes.marketplace.orders import _esc, _frontend_url
    try:
        s = await suggestions(o)
    except Exception:  # noqa: BLE001 - an email never waits on its extras
        return ""
    he, site = lang == "he", _frontend_url()
    link = 'style="color:#167AB8;text-decoration:none;"'
    out = ""
    more = s["more"][:3]
    if more:
        name = (biz.get("name_he") if he and biz.get("name_he") else biz.get("name")) or ""
        rows = "".join(f'<li style="margin:0 0 6px;"><a href="{_esc(site + p["href"])}" {link}>{_esc((he and p.get("name_he")) or p["name"])}</a></li>'
                       for p in more)
        out += (f'<p style="margin:22px 0 6px;font-weight:600;color:#111827;">{_esc(("עוד אצל " if he else "More from ") + name)}</p>'
                f'<ul style="margin:0;padding-inline-start:18px;">{rows}</ul>')
    if s["others"]:
        rows = "".join(f'<li style="margin:0 0 6px;"><a href="{_esc(site + g["href"])}" {link}>{_esc((he and g.get("title_he")) or g["title"])}</a>'
                       + (f' <span style="color:#666;">· {_esc(g["area"])}</span>' if g.get("area") else "") + "</li>"
                       for g in s["others"])
        out += (f'<p style="margin:22px 0 6px;font-weight:600;color:#111827;">{"עוד עסקים ב-MyIsraelRental" if he else "Discover more on MyIsraelRental"}</p>'
                f'<ul style="margin:0;padding-inline-start:18px;">{rows}</ul>'
                f'<p style="margin:8px 0 0;"><a href="{_esc(site)}/services?src=orders" {link}>{"לכל מה שיש באתר" if he else "See everything on the site"}</a></p>')
    return out

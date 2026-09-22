"""Price alerts and cheaper-option tips for businesses that order from others.

Tzvi, 22 Sep 2026: people should be told when a supplier their automations
order from goes up or down in price, and should be pointed at a cheaper
business - a new one, one that dropped its price, or one running a deal.

TWO THINGS, deliberately different in how loud they are:

  * PRICE ALERTS are about a business you already order from. Always on:
    a supplier raising the price of what your weekly order buys is
    operational news, not marketing. One bell and one email per change,
    naming each line that moved and every automation of yours that orders
    from them.

  * CHEAPER-OPTION TIPS are about a business you do NOT order from. They
    are a suggestion, so they are capped (TIPS_PER_WEEK), never repeated
    for the same listing, never about a business you are already
    connected to, and can be switched off (`price_tips: false` on the
    business).

WHAT "CHEAPER" MEANS HERE, and why it is only this: two listings are
compared only when they are in the same category AND serve the same place
(`resolve_area_id`), and the number compared is each one's STARTING price
- its lowest tier or product. That is the only like-for-like figure the
site has; "a cleaner from ₪120" and "a cleaner from ₪150" are comparable,
a cleaner's deep clean against another's quick tidy are not. So the tip
says "from", names both prices, and never claims the same job costs less.
A deal (active_discount) counts as a reason on its own, whatever the price.

Nothing here is estimated. Every figure is read off a listing.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Optional

from routes.deps import db, logger

TIPS_PER_WEEK = 3

_background: set = set()


# ---------------------------------------------------------------------------
# reading prices off a listing
# ---------------------------------------------------------------------------

def price_lines(gig: dict[str, Any]) -> dict[str, tuple[str, float]]:
    """Every priced line on a listing: key -> (what a person calls it, price).
    Keyed by product id where there is one, so a renamed product is the
    same line; tiers have no id, so by name."""
    out: dict[str, tuple[str, float]] = {}
    for t in gig.get("tiers") or []:
        if isinstance(t, dict) and isinstance(t.get("price"), (int, float)) and t["price"] > 0:
            out[f"tier:{t.get('name') or ''}"] = (t.get("name") or gig.get("title") or "", float(t["price"]))
    for p in gig.get("products") or []:
        if isinstance(p, dict) and isinstance(p.get("price"), (int, float)) and p["price"] > 0:
            out[f"product:{p.get('id') or p.get('name')}"] = (p.get("name") or "", float(p["price"]))
    return out


def starting_price(gig: dict[str, Any]) -> Optional[float]:
    prices = [v for _, v in price_lines(gig).values()]
    return min(prices) if prices else None


def changes(old: dict[str, Any], new: dict[str, Any]) -> list[dict[str, Any]]:
    """Lines whose price moved. A line added or removed is not a price
    change - the menu changed, and the partner will see it on the page."""
    a, b = price_lines(old), price_lines(new)
    return [{"name": b[k][0], "old": a[k][1], "new": b[k][1]}
            for k in a.keys() & b.keys() if a[k][1] != b[k][1]]


def _money(v: float) -> str:
    return f"₪{v:,.0f}" if float(v).is_integer() else f"₪{v:,.2f}"


def _pct(old: float, new: float) -> str:
    p = round((new - old) / old * 100)
    return f"{'+' if p > 0 else ''}{p}%"


# ---------------------------------------------------------------------------
# who is affected
# ---------------------------------------------------------------------------

async def _businesses_of(gig: dict[str, Any]) -> list[str]:
    from routes.marketplace.automations import _businesses_for_gig
    return await _businesses_for_gig(gig)


async def _ordering_from(business_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
    """business that orders -> its enabled rules that send orders to any of
    these businesses."""
    out: dict[str, list[dict[str, Any]]] = {}
    async for r in db.business_automations.find({
        "partner_business_id": {"$in": business_ids}, "enabled": True,
        "$or": [{"action.type": "send_order"}, {"action": {"$exists": False}}],
    }, {"business_id": 1, "name": 1, "template": 1, "partner_business_id": 1}):
        out.setdefault(r["business_id"], []).append(r)
    return out


async def _tell(business_id: str, *, type_: str, message: str, subject: str,
                body_html: str, action_url: str) -> None:
    from routes.marketplace import orders as om
    biz = await db.businesses.find_one({"_id": business_id}, {"owner_user_id": 1})
    if not biz:
        return
    await om._notify(biz["owner_user_id"], type_=type_, message=message[:500], action_url=action_url)
    owner = await db.users.find_one({"id": biz["owner_user_id"]}, {"_id": 0, "email": 1})
    if owner and owner.get("email"):
        await om._email(owner["email"], subject, body_html, tag=type_, button=("Open", action_url))


# ---------------------------------------------------------------------------
# 1. price alerts
# ---------------------------------------------------------------------------

async def alert_price_change(old: dict[str, Any], new: dict[str, Any]) -> int:
    """Tell every business that orders from this listing's business."""
    from routes.marketplace import orders as om
    moved = changes(old, new)
    if not moved:
        return 0
    sellers = await _businesses_of(new)
    if not sellers:
        return 0
    seller = await db.businesses.find_one({"_id": sellers[0]}, {"name": 1, "slug": 1})
    name = (seller or {}).get("name") or new.get("title") or "A supplier"
    lines = [f"{m['name']}: {_money(m['old'])} → {_money(m['new'])} ({_pct(m['old'], m['new'])})" for m in moved]
    await db.price_changes.insert_one({
        "_id": str(uuid.uuid4()), "gig_id": new.get("_id"), "business_ids": sellers,
        "category": new.get("category"), "changes": moved, "at": datetime.now(UTC).isoformat(),
    })
    told = 0
    for buyer, rules in (await _ordering_from(sellers)).items():
        if buyer in sellers:
            continue
        up = sum(1 for m in moved if m["new"] > m["old"])
        verb = "raised" if up == len(moved) else "lowered" if up == 0 else "changed"
        rule_names = ", ".join(r.get("name") or "" for r in rules)
        stale = [r for r in rules if (r.get("template") or {}).get("total") is not None]
        msg = f"{name} {verb} prices: " + "; ".join(lines)
        html = (f"<p>{om._esc(name)} {verb} prices:</p><ul>"
                + "".join(f"<li>{om._esc(line)}</li>" for line in lines)
                + f"</ul><p>Your automations that order from them: {om._esc(rule_names)}.</p>"
                + ("<p>Some of them carry a price you set yourself. It has not been changed; "
                   "check it still matches.</p>" if stale else ""))
        await _tell(buyer, type_="price_change", message=msg, subject=f"{name} {verb} prices",
                    body_html=html, action_url="/dashboard?tab=network&view=automations")
        told += 1
    return told


# ---------------------------------------------------------------------------
# 2. cheaper-option tips
# ---------------------------------------------------------------------------

async def _where(gig: dict[str, Any]) -> Optional[str]:
    from utils.area_filter import resolve_area_id
    return gig.get("area_id") or resolve_area_id(gig.get("area"))


async def tip_about(candidate: dict[str, Any], reason: str) -> int:
    """`candidate` just became interesting: new, cheaper, or on a deal.
    Tell businesses that order the same kind of thing, in the same place,
    from someone dearer. Capped, never twice for one listing, opt-out."""
    from routes.marketplace import orders as om
    from routes.marketplace.gigs import active_discount
    if candidate.get("status") != "published":
        return 0
    cat, place = candidate.get("category"), await _where(candidate)
    cand_from = starting_price(candidate)
    deal = active_discount(candidate)
    if not cat or not place or (cand_from is None and not deal):
        return 0
    cand_biz = set(await _businesses_of(candidate))

    # Who orders this kind of thing here, and what they pay "from".
    peers = [g async for g in db.marketplace_gigs.find(
        {"category": cat, "status": "published", "_id": {"$ne": candidate.get("_id")}})]
    by_seller: dict[str, dict[str, Any]] = {}
    for g in peers:
        if await _where(g) != place:
            continue
        for b in await _businesses_of(g):
            if b not in cand_biz:
                by_seller[b] = g
    if not by_seller:
        return 0

    week_ago = (datetime.now(UTC) - timedelta(days=7)).isoformat()
    cand_name = (await db.businesses.find_one({"_id": next(iter(cand_biz), None)}, {"name": 1}) or {}).get("name") \
        or candidate.get("title") or "A business"
    sent = 0
    for buyer, rules in (await _ordering_from(list(by_seller))).items():
        if buyer in cand_biz:
            continue
        me = await db.businesses.find_one({"_id": buyer}, {"price_tips": 1})
        if (me or {}).get("price_tips") is False:
            continue
        # Already working with them: not a tip, they know.
        from routes.marketplace.automations import connected
        if any([await connected(buyer, c) for c in cand_biz]):
            continue
        if await db.price_tips.find_one({"business_id": buyer, "gig_id": candidate.get("_id")}, {"_id": 1}):
            continue
        if await db.price_tips.count_documents({"business_id": buyer, "at": {"$gte": week_ago}}) >= TIPS_PER_WEEK:
            continue
        # What they pay "from" at the suppliers they order this from.
        theirs = [by_seller[r["partner_business_id"]] for r in rules if r.get("partner_business_id") in by_seller]
        their_from = min((p for p in (starting_price(g) for g in theirs) if p is not None), default=None)
        cheaper = cand_from is not None and their_from is not None and cand_from < their_from
        if not cheaper and not deal:
            continue
        bits = []
        if cheaper:
            bits.append(f"from {_money(cand_from)}, where you order from {_money(their_from)}")
        if deal:
            bits.append(f"{deal['percent']}% off" + (f" until {deal['ends_at']}" if deal.get("ends_at") else ""))
        why = {"new": "is new on the site", "cheaper": "lowered its prices", "deal": "has an offer"}[reason]
        msg = f"{cand_name} {why}: " + ", ".join(bits)
        url = f"/services/gig/{candidate.get('_id')}"
        await _tell(buyer, type_="price_tip", message=msg, subject=f"A possible option: {cand_name}",
                    body_html=(f"<p>{om._esc(msg)}.</p><p>Prices are each business's starting price for "
                               f"{om._esc(cat)}; check what is included before you switch.</p>"),
                    action_url=url)
        await db.price_tips.insert_one({"_id": str(uuid.uuid4()), "business_id": buyer,
                                        "gig_id": candidate.get("_id"), "reason": reason,
                                        "at": datetime.now(UTC).isoformat()})
        sent += 1
    return sent


# ---------------------------------------------------------------------------
# the one call gigs.py makes
# ---------------------------------------------------------------------------

async def _after_save(old: Optional[dict[str, Any]], new: dict[str, Any]) -> None:
    from routes.marketplace.gigs import active_discount
    try:
        if old is None:
            await tip_about(new, "new")
            return
        await alert_price_change(old, new)
        o_from, n_from = starting_price(old), starting_price(new)
        if o_from is not None and n_from is not None and n_from < o_from:
            await tip_about(new, "cheaper")
        elif active_discount(new) and not active_discount(old):
            await tip_about(new, "deal")
        elif old.get("status") != "published" and new.get("status") == "published":
            await tip_about(new, "new")
    except Exception:  # noqa: BLE001 - a listing save must never fail on this
        logger.exception("price_watch failed for gig %s", new.get("_id"))


def listing_saved(old: Optional[dict[str, Any]], new: dict[str, Any]) -> None:
    """In the background: saving a listing answers at once."""
    task = asyncio.create_task(_after_save(old, new))
    _background.add(task)
    task.add_done_callback(_background.discard)

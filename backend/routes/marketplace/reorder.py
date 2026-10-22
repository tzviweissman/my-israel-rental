"""Reorder from a supplier when a product runs low (Tzvi, 22 Oct 2026: "send
an order to a supplier when they know they are running low").

Two WHENs for the automations engine (automations.py), on one product of
one of the business's shop listings:

  stock.low     the counted product drops to `threshold` (or below). It
                fires when the count CROSSES the number, so it fires once
                per drop and is ready again only after the count has gone
                back above it (a delivery, the owner's own update).
  product.sold  every `every_n` of the product sold, on the website or at
                the counter, for a business that does not count stock.
                One order sends at most one reorder, however many it sold.

and one more DO, for a supplier who is not on the site:

  order_supplier  emailed to the supplier, from the business's name, with
                  replies going to the owner; or, with only a phone, a
                  WhatsApp message the owner sends with one tap (we send no
                  WhatsApp ourselves).

ASK ME FIRST (on by default): the order waits in "What automations did"
with Send and Skip, and the owner gets a bell and an email. A supplier with
only a phone always waits, because only the owner's phone can send it.

REFILL: with `refill_qty`, the delivery is counted back into the product:
automatically when a partner on the site marks the order done, or when the
owner taps "Arrived" for a supplier who is not. Once per order.

Every firing is an `automation_runs` row like any other, so the business
can always see why an order went out.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException

from routes.deps import db, logger, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

_background: set = set()


def _now() -> str:
    return datetime.now(UTC).isoformat()


async def check_product(business_id: str, gig_id: Optional[str], product_id: Optional[str]) -> dict[str, Any]:
    gig = await db.marketplace_gigs.find_one({"_id": gig_id, "business_id": business_id}, {"products": 1})
    prod = next((p for p in (gig or {}).get("products") or [] if p.get("id") == product_id), None)
    if not prod:
        raise HTTPException(status_code=400, detail="Pick one of your products")
    return prod


def crossed(before: int, left: int, threshold: int) -> bool:
    """Down through the number, not merely below it. Pure."""
    return before > threshold >= left


async def _owner(biz_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    biz = await db.businesses.find_one({"_id": biz_id}) or {}
    user = await db.users.find_one({"id": biz.get("owner_user_id")}, {"_id": 0, "email": 1, "phone": 1, "preferred_language": 1}) or {}
    return biz, user


def order_text(rule: dict[str, Any], biz: dict[str, Any], needed_by: str, he: bool) -> str:
    """The order as a supplier reads it, for email and WhatsApp. Pure."""
    tpl = rule.get("template") or {}
    sup = (rule.get("supplier") or {}).get("name") or ""
    name = biz.get("name") or ""
    lines = [f"שלום {sup}," if he else f"Hello {sup},",
             f"הזמנה מ-{name}:" if he else f"An order from {name}:", tpl.get("items") or ""]
    if tpl.get("fulfilment") == "delivery" and tpl.get("address"):
        lines.append((f"משלוח ל: {tpl['address']}" if he else f"Deliver to: {tpl['address']}"))
    else:
        lines.append("איסוף" if he else "Pickup")
    lines.append((f"נדרש עד: {needed_by}" if he else f"Needed by: {needed_by}"))
    if tpl.get("notes"):
        lines.append(tpl["notes"])
    lines.append("תודה" if he else "Thank you")
    return "\n".join(x for x in lines if x)


def _whatsapp(phone: Optional[str], text: str) -> Optional[str]:
    from utils.whatsapp_link import normalize_whatsapp_number
    e164 = normalize_whatsapp_number(phone) if phone else None
    return f"https://wa.me/{e164.lstrip('+')}?text={quote(text)}" if e164 else None


async def order_supplier(rule: dict[str, Any], event: dict[str, Any], *, needed_by: Optional[str] = None,
                         via: str = "auto", extra: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """Send the order to a supplier who is not on the site. `via`:
    "auto" emails it if there is an address, else waits for the owner's
    WhatsApp tap; "whatsapp" records that the owner sent it."""
    from . import automations as am
    biz, owner = await _owner(rule["business_id"])
    if not biz:
        return await am._record(rule, result="failed", event=event, error="business no longer exists")
    sup = rule.get("supplier") or {}
    he = str(owner.get("preferred_language") or "").startswith("he")
    due = needed_by or am._default_needed_by()
    text = order_text(rule, biz, due, he)
    base = {"supplier_name": sup.get("name"), "whatsapp": _whatsapp(sup.get("phone"), text), **(extra or {})}
    if via == "whatsapp":
        return await am._record(rule, result="sent_whatsapp", event=event, extra=base)
    if not sup.get("email"):
        return await am._record(rule, result="awaiting", event=event, extra=base)
    from utils import email as em
    body = (f'<p style="white-space:pre-line;font-size:15px;line-height:1.7;color:#111827;">{em._esc(text)}</p>')
    ok = await em.send_email(sup["email"], f"{'הזמנה מ-' if he else 'Order from '}{biz.get('name') or ''}",
                             em._wrap(body, preheader=(rule.get("template") or {}).get("items") or "", lang="he" if he else "en"),
                             tag="supplier-order", from_name=biz.get("name"), reply_to=owner.get("email"))
    if not ok:
        return await am._record(rule, result="failed", event=event, error="the email could not be sent", extra=base)
    return await am._record(rule, result="emailed", event=event, extra=base)


async def _send(rule: dict[str, Any], event: dict[str, Any], extra: dict[str, Any], via: str = "auto") -> dict[str, Any]:
    from . import automations as am
    kind = (rule.get("action") or {}).get("type") or "send_order"
    if kind == "order_supplier":
        return await order_supplier(rule, event, via=via, extra=extra)
    if kind == "notify_me":
        await _tell_owner(rule, extra.get("why") or rule.get("name") or "", waiting=False)
        return await am._record(rule, result="notified", event=event, extra=extra)
    run = await am._create_partner_order(rule, source=None, needed_by=None, event=event, ctx={})
    if extra:
        await db.automation_runs.update_one({"_id": run["_id"]}, {"$set": extra})
        run.update(extra)
    return run


async def _dispatch(rule: dict[str, Any], why: str, event: dict[str, Any]) -> dict[str, Any]:
    """Send now, or hold for the owner's Send (ask first)."""
    from . import automations as am
    extra: dict[str, Any] = {"why": why}
    if rule.get("refill_qty"):
        t = rule.get("trigger") or {}
        extra["refill"] = {"gig_id": t.get("gig_id"), "product_id": t.get("product_id"), "qty": int(rule["refill_qty"])}
    kind = (rule.get("action") or {}).get("type") or "send_order"
    if rule.get("ask_first") and kind != "notify_me":
        sup = rule.get("supplier") or {}
        if kind == "order_supplier":
            biz, owner = await _owner(rule["business_id"])
            he = str(owner.get("preferred_language") or "").startswith("he")
            extra.update(supplier_name=sup.get("name"),
                         whatsapp=_whatsapp(sup.get("phone"), order_text(rule, biz, am._default_needed_by(), he)))
        run = await am._record(rule, result="awaiting", event=event, extra=extra)
        await _tell_owner(rule, why, waiting=True)
        return run
    run = await _send(rule, event, extra)
    if run["result"] == "awaiting":      # WhatsApp only: the owner has to send it
        await _tell_owner(rule, why, waiting=True)
    return run


async def _tell_owner(rule: dict[str, Any], why: str, waiting: bool) -> None:
    from . import orders as om
    biz, owner = await _owner(rule["business_id"])
    if not biz:
        return
    he = str(owner.get("preferred_language") or "").startswith("he")
    msg = (f"{why}. ההזמנה \"{rule.get('name')}\" מחכה לאישור שלכם." if he
           else f"{why}. Your order \"{rule.get('name')}\" is ready: tap Send.") if waiting else why
    where = "/dashboard?tab=network&view=automations"
    await om._notify(biz["owner_user_id"], type_="automation", message=msg[:500], action_url=where)
    if owner.get("email"):
        await om._email(owner["email"], rule.get("name") or ("הזמנה חוזרת" if he else "Reorder"),
                        f"<p>{om._esc(msg)}</p>", tag="reorder-ask",
                        button=(("לשליחה" if he else "Open and send"), where))


def _why_low(name: str, left: int, he: bool) -> str:
    if he:
        return f"{name}: נשאר {left}" if left else f"{name} אזל"
    return f"{name}: {left} left" if left else f"{name} sold out"


async def stock_dropped(gig_id: str, business_id: Optional[str], product: dict[str, Any], before: int, left: int) -> None:
    """Called by stock.py after a sale takes from a counted product."""
    try:
        async for rule in db.business_automations.find({"enabled": True, "trigger.type": "stock.low",
                                                        "business_id": business_id, "trigger.gig_id": gig_id,
                                                        "trigger.product_id": product.get("id")}):
            if not crossed(before, left, int(rule["trigger"].get("threshold") or 0)):
                continue
            _, owner = await _owner(rule["business_id"])
            he = str(owner.get("preferred_language") or "").startswith("he")
            ev = {"type": "stock.low", "product_id": product.get("id"), "left": left, "source_id": str(uuid.uuid4())}
            await _dispatch(rule, _why_low(product.get("name") or "", left, he), ev)
    except Exception:  # noqa: BLE001 - a reorder must never break a sale
        logger.exception("reorder: stock_dropped gig=%s", gig_id)


async def products_sold(business_id: Optional[str], gig_id: Optional[str], lines: list[dict[str, Any]]) -> None:
    """Called after a website order or a counter sale is saved."""
    try:
        sold: dict[str, int] = {}
        names: dict[str, str] = {}
        for ln in lines or []:
            if ln.get("product_id"):
                sold[ln["product_id"]] = sold.get(ln["product_id"], 0) + int(ln.get("qty") or 0)
                names[ln["product_id"]] = ln.get("name") or ""
        if not sold or not business_id:
            return
        async for rule in db.business_automations.find({"enabled": True, "trigger.type": "product.sold",
                                                        "business_id": business_id, "trigger.gig_id": gig_id,
                                                        "trigger.product_id": {"$in": list(sold)}}):
            pid = rule["trigger"]["product_id"]
            n = int(rule["trigger"].get("every_n") or 1)
            fresh = await db.business_automations.find_one_and_update(
                {"_id": rule["_id"]}, {"$inc": {"sold_since": sold[pid]}}, return_document=True)
            total = int((fresh or {}).get("sold_since") or 0)
            if total < n:
                continue
            # Claim the reorder: only the writer who sees this exact count
            # resets it, so two sales at once cannot both send one.
            claimed = await db.business_automations.update_one(
                {"_id": rule["_id"], "sold_since": total}, {"$set": {"sold_since": total % n}})
            if not claimed.modified_count:
                continue
            _, owner = await _owner(rule["business_id"])
            he = str(owner.get("preferred_language") or "").startswith("he")
            why = (f"נמכרו {n} {names[pid]} מאז ההזמנה הקודמת" if he else f"{n} {names[pid]} sold since the last reorder")
            ev = {"type": "product.sold", "product_id": pid, "source_id": str(uuid.uuid4())}
            await _dispatch(rule, why, ev)
    except Exception:  # noqa: BLE001
        logger.exception("reorder: products_sold business=%s", business_id)


def in_background(coro) -> None:
    task = asyncio.create_task(coro)
    _background.add(task)
    task.add_done_callback(_background.discard)


async def refill_for_run(run_id: str) -> bool:
    """Add the delivery to the product's count, once per run."""
    run = await db.automation_runs.find_one_and_update(
        {"_id": run_id, "refill": {"$ne": None}, "refilled_at": None},
        {"$set": {"refilled_at": _now()}})
    if not run or not run.get("refill"):
        return False
    r = run["refill"]
    res = await db.marketplace_gigs.update_one(
        {"_id": r["gig_id"], "products": {"$elemMatch": {"id": r["product_id"], "stock": {"$ne": None}}}},
        {"$inc": {"products.$.stock": int(r["qty"])}, "$set": {"products.$.in_stock": True}})
    logger.info("[reorder] refill run=%s +%s counted=%s", run_id, r["qty"], bool(res.modified_count))
    return True


# ---------------------------------------------------------------------------
# the owner's buttons on a waiting reorder
# ---------------------------------------------------------------------------

async def _my_run(run_id: str, user: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    run = await db.automation_runs.find_one({"_id": run_id})
    biz = run and await db.businesses.find_one({"_id": run["business_id"]}, {"owner_user_id": 1})
    if not run or not biz or (biz.get("owner_user_id") != user["user_id"] and user.get("role") != "admin"):
        raise HTTPException(status_code=404, detail="Not found")
    rule = await db.business_automations.find_one({"_id": run["automation_id"]})
    if not rule:
        raise HTTPException(status_code=404, detail="This automation was deleted")
    return run, rule


@router.post("/automation-runs/{run_id}/send")
async def send_waiting(run_id: str, via: str = "auto", user=Depends(verify_token)):
    """Send: the order goes out now. `via=whatsapp` after the owner opened
    the WhatsApp message (we cannot see whether they pressed send there)."""
    run, rule = await _my_run(run_id, user)
    claimed = await db.automation_runs.update_one({"_id": run_id, "result": "awaiting"}, {"$set": {"result": "sending"}})
    if not claimed.modified_count:
        raise HTTPException(status_code=409, detail="This was already sent or skipped")
    extra = {k: run[k] for k in ("why", "refill") if run.get(k)}
    done = await _send(rule, {**(run.get("trigger_event") or {}), "by": user["user_id"]}, extra,
                       via="whatsapp" if via == "whatsapp" else "auto")
    # The send wrote its own run; this one becomes the record that it was sent.
    await db.automation_runs.update_one({"_id": run_id}, {"$set": {"result": "sent_on", "sent_run_id": done["_id"]}})
    if done["result"] in ("failed", "skipped"):
        await db.automation_runs.update_one({"_id": run_id}, {"$set": {"result": "awaiting"}})
        raise HTTPException(status_code=409, detail=done.get("error") or "That could not be sent")
    if done["result"] == "awaiting":
        # A WhatsApp-only supplier: the new run is the one waiting now.
        await db.automation_runs.update_one({"_id": run_id}, {"$set": {"result": "sent_on"}})
    return {"result": done["result"], "whatsapp": done.get("whatsapp")}


@router.post("/automation-runs/{run_id}/skip")
async def skip_waiting(run_id: str, user=Depends(verify_token)):
    await _my_run(run_id, user)
    r = await db.automation_runs.update_one({"_id": run_id, "result": "awaiting"}, {"$set": {"result": "dismissed"}})
    if not r.modified_count:
        raise HTTPException(status_code=409, detail="This was already sent or skipped")
    return {"result": "dismissed"}


@router.post("/automation-runs/{run_id}/arrived")
async def arrived(run_id: str, user=Depends(verify_token)):
    """The delivery is in: add it to the product's count (once)."""
    await _my_run(run_id, user)
    if not await refill_for_run(run_id):
        raise HTTPException(status_code=409, detail="Already counted")
    return {"ok": True}

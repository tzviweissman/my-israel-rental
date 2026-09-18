"""Automations between connected businesses (docs/business-network-spec.md, Phase 2).

A rule belongs to one business and targets one of its accepted partners:
WHEN something happens, CREATE AN ORDER for the partner. The canonical
case is the shop and its courier: the shop marks an order ready, and a
delivery order appears in the courier's own Orders tab without anyone
retyping it. If the courier has told the site to accept that shop's
orders automatically, it lands already accepted.

Phase 2 ships two triggers:
  * `order.status_changed` - one of my orders reaches a given status;
  * `manual.reorder`       - a saved order I send with one tap
                             ("the usual" from my supplier).

THE RULES THAT MAKE IT SAFE TO LEAVE RUNNING
  * A rule can only point at an ACCEPTED connection, checked when it is
    saved and again every time it fires. Disconnecting pauses it
    (connections.disconnect).
  * Auto-accept is granted by the RECEIVING business, for one named
    sender, with optional caps. Nobody can grant it to themselves.
  * Every firing writes an `automation_runs` row - created, auto-accepted,
    skipped or failed - and every order it makes carries where it came
    from, so a business can always see WHY an order appeared.
  * A rule fires at most once per source order. An order that goes
    ready -> preparing -> ready again does not send the courier two jobs.
  * An automated order never bounces back to the business that sent it,
    so two partners with mirror-image rules cannot ping-pong forever.
  * `fire()` never raises into its caller. A broken rule must not stop a
    shop marking its own order ready.

WHERE AN AUTOMATED ORDER COMES FROM is kept in `automation` on the order,
not by changing `source`: `source` is a plain string every existing
screen reads ("manual", "website", "standing"...), and turning it into an
object for one new kind would break all of them. `source` is simply
"automation".
"""
from __future__ import annotations

import asyncio
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator, model_validator

from routes.deps import db, logger, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

_IL_TZ = ZoneInfo("Asia/Jerusalem")
FIRES_ON = ("preparing", "ready", "done")     # a status worth handing on
MAX_RULES = 50


# ---------------------------------------------------------------------------
# models
# ---------------------------------------------------------------------------

class TriggerIn(BaseModel):
    type: Literal["order.status_changed", "manual.reorder"]
    status: Optional[str] = None

    @model_validator(mode="after")
    def _status_for_orders(self):
        if self.type == "order.status_changed":
            if self.status not in FIRES_ON:
                raise ValueError(f"status must be one of {list(FIRES_ON)}")
        else:
            self.status = None
        return self


class TemplateIn(BaseModel):
    items: str = Field("", max_length=2000)
    notes: str = Field("", max_length=1000)
    fulfilment: Literal["pickup", "delivery"] = "pickup"
    address: Optional[str] = Field(None, max_length=400)
    total: Optional[float] = Field(None, ge=0, le=1_000_000)
    # Take the customer, items, address and time from the order that
    # triggered the rule. The courier case: the delivery IS that order.
    copy_from_source: bool = False

    @field_validator("items", "notes", "address")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


class AutomationIn(BaseModel):
    partner_business_id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=120)
    enabled: bool = True
    trigger: TriggerIn
    template: TemplateIn

    @model_validator(mode="after")
    def _coherent(self):
        manual = self.trigger.type == "manual.reorder"
        if manual and self.template.copy_from_source:
            raise ValueError("A saved reorder has no source order to copy from")
        if not self.template.copy_from_source and not self.template.items:
            raise ValueError("Say what to order")
        if (not self.template.copy_from_source and self.template.fulfilment == "delivery"
                and not self.template.address):
            raise ValueError("A delivery needs an address")
        return self


class AutomationPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    enabled: Optional[bool] = None


class RunIn(BaseModel):
    needed_by: Optional[str] = None


class AutoAcceptEntry(BaseModel):
    business_id: str = Field(min_length=1, max_length=100)
    max_amount: Optional[float] = Field(None, gt=0, le=1_000_000)
    max_per_day: Optional[int] = Field(None, ge=1, le=500)
    land_in_status: Literal["preparing", "ready"] = "preparing"


class AutoAcceptIn(BaseModel):
    auto_accept_from: list[AutoAcceptEntry] = Field(default_factory=list, max_length=100)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(UTC).isoformat()


async def _owned(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """Owner or admin - the rule every business route applies (see
    connections._owned for why each router keeps its own copy)."""
    biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    if biz.get("owner_user_id") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your business")
    return biz


async def connected(x: str, y: str) -> bool:
    a_id, b_id = (x, y) if x < y else (y, x)
    return bool(await db.business_connections.find_one(
        {"a_id": a_id, "b_id": b_id, "status": "accepted"}, {"_id": 1},
    ))


async def _rule_owned(rule_id: str, user: dict[str, Any]) -> dict[str, Any]:
    rule = await db.business_automations.find_one({"_id": rule_id})
    if not rule:
        raise HTTPException(status_code=404, detail="Automation not found")
    biz = await db.businesses.find_one({"_id": rule["business_id"]}, {"owner_user_id": 1})
    if not biz or (biz.get("owner_user_id") != user["user_id"] and user.get("role") != "admin"):
        # 404: a rule id is not public, and naming it would confirm it.
        raise HTTPException(status_code=404, detail="Automation not found")
    return rule


def _rule_out(rule: dict[str, Any], partner: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    return {
        "id": rule["_id"],
        "business_id": rule["business_id"],
        "partner_business_id": rule["partner_business_id"],
        "partner_name": (partner or {}).get("name"),
        "name": rule.get("name"),
        "enabled": bool(rule.get("enabled")),
        "paused_reason": rule.get("paused_reason"),
        "trigger": rule.get("trigger") or {},
        "template": rule.get("template") or {},
        "run_count": rule.get("run_count", 0),
        "last_run_at": rule.get("last_run_at"),
        "created_at": rule.get("created_at"),
    }


def _default_needed_by() -> str:
    """Tomorrow, as a date. A saved reorder has no natural time; the
    supplier's board orders by it and a date is honest about that."""
    return (datetime.now(_IL_TZ).date() + timedelta(days=1)).isoformat()


async def _record(rule: dict[str, Any], *, result: str, event: dict[str, Any],
                  order_id: Optional[str] = None, error: Optional[str] = None) -> dict[str, Any]:
    run = {
        "_id": str(uuid.uuid4()),
        "automation_id": rule["_id"],
        "automation_name": rule.get("name"),
        "business_id": rule["business_id"],
        "partner_business_id": rule["partner_business_id"],
        "trigger_event": event,
        "result": result,
        "created_order_id": order_id,
        "error": error,
        "created_at": _now(),
    }
    await db.automation_runs.insert_one(run)
    if result in ("created", "auto_accepted"):
        await db.business_automations.update_one(
            {"_id": rule["_id"]}, {"$inc": {"run_count": 1}, "$set": {"last_run_at": run["created_at"]}},
        )
    return run


async def _auto_accept_for(partner: dict[str, Any], from_id: str, total: Optional[float]) -> Optional[str]:
    """The status an automated order from `from_id` should land in at the
    partner, or None to land as `new` and wait for a person.

    Granted only by the partner, per sender, and capped: over the amount
    cap, or past the day's count, it falls back to waiting."""
    entry = next((e for e in partner.get("auto_accept_from") or [] if e.get("business_id") == from_id), None)
    if not entry:
        return None
    cap = entry.get("max_amount")
    if cap is not None and total is not None and total > cap:
        return None
    per_day = entry.get("max_per_day")
    if per_day:
        today_start = datetime.combine(datetime.now(_IL_TZ).date(), datetime.min.time(), tzinfo=_IL_TZ)
        n = await db.store_orders.count_documents({
            "business_id": partner["_id"],
            "automation.from_business_id": from_id,
            "automation.auto_accepted": True,
            "created_at": {"$gte": today_start.astimezone(UTC).isoformat()},
        })
        if n >= per_day:
            return None
    return entry.get("land_in_status") or "preparing"


async def _create_partner_order(rule: dict[str, Any], *, source: Optional[dict[str, Any]],
                                needed_by: Optional[str], event: dict[str, Any]) -> dict[str, Any]:
    """Build the partner's order, insert it, notify, and log the run."""
    from routes.marketplace import orders as om   # lazy: orders imports this module

    me = await db.businesses.find_one({"_id": rule["business_id"]})
    partner = await db.businesses.find_one({"_id": rule["partner_business_id"]})
    if not me or not partner or not partner.get("active", True):
        return await _record(rule, result="failed", event=event, error="partner business no longer exists")
    if not await connected(rule["business_id"], rule["partner_business_id"]):
        await db.business_automations.update_one(
            {"_id": rule["_id"]}, {"$set": {"enabled": False, "paused_reason": "disconnected", "updated_at": _now()}},
        )
        return await _record(rule, result="skipped", event=event, error="not connected")

    tpl = rule.get("template") or {}
    if tpl.get("copy_from_source") and source:
        fields = {
            "customer_name": source.get("customer_name"),
            "customer_phone": source.get("customer_phone"),
            "customer_phone_e164": source.get("customer_phone_e164"),
            "items": source.get("items"),
            "total": source.get("total"),
            "needed_by": source.get("needed_by") or needed_by or _default_needed_by(),
            "fulfilment": source.get("fulfilment") or "pickup",
            "address": source.get("address"),
            "notes": "\n".join(x for x in (tpl.get("notes"), source.get("notes")) if x),
        }
    else:
        fields = {
            # The customer of a reorder is the business placing it.
            "customer_name": me.get("name") or "Partner",
            **om._phone_fields(None),
            "items": tpl.get("items"),
            "total": tpl.get("total"),
            "needed_by": needed_by or _default_needed_by(),
            "fulfilment": tpl.get("fulfilment") or "pickup",
            "address": tpl.get("address") if tpl.get("fulfilment") == "delivery" else None,
            "notes": tpl.get("notes") or "",
        }

    land = await _auto_accept_for(partner, me["_id"], fields.get("total"))
    now = om._now_iso()
    order_id = str(uuid.uuid4())
    history = [{"status": "new", "at": now, "by": "automation"}]
    if land:
        history.append({"status": land, "at": now, "by": "automation", "note": "accepted automatically"})
    doc = {
        "_id": order_id,
        "business_id": partner["_id"],
        "owner_user_id": partner["owner_user_id"],
        **fields,
        "currency": "ILS",
        "status": land or "new",
        "source": "automation",
        "automation": {
            "automation_id": rule["_id"],
            "from_business_id": me["_id"],
            "from_business_name": me.get("name"),
            "source_order_id": (source or {}).get("_id"),
            "auto_accepted": bool(land),
        },
        "placed_by_business_id": me["_id"],
        "courier": None,
        "assigned_at": None,
        "created_by": "automation",
        "created_at": now,
        "updated_at": now,
        "status_changed_at": now,
        "history": history,
        "track_token": secrets.token_urlsafe(16),
    }
    await db.store_orders.insert_one(doc)
    run = await _record(rule, result="auto_accepted" if land else "created", event=event, order_id=order_id)
    await db.store_orders.update_one({"_id": order_id}, {"$set": {"automation.run_id": run["_id"]}})

    try:
        await om.auto_assign(doc, partner)
        what = om._order_line(doc)
        msg = (f"{me.get('name')} sent an order (accepted automatically): {what}" if land
               else f"New order from {me.get('name')}: {what}")
        await om._notify(partner["owner_user_id"], type_="order_new", message=msg,
                         action_url="/dashboard?tab=orders", order_id=order_id)
    except Exception:  # noqa: BLE001 - the order exists; a lost bell is not a failed run
        logger.exception("automation %s: order %s created, notify failed", rule["_id"], order_id)
    return run


# ---------------------------------------------------------------------------
# the engine
# ---------------------------------------------------------------------------

async def fire(trigger_type: str, event: dict[str, Any]) -> list[dict[str, Any]]:
    """Run every enabled rule matching this event. Never raises."""
    runs: list[dict[str, Any]] = []
    try:
        if trigger_type != "order.status_changed":
            return runs
        order = event.get("order") or {}
        status = event.get("status")
        q = {
            "business_id": order.get("business_id"),
            "enabled": True,
            "trigger.type": "order.status_changed",
            "trigger.status": status,
        }
        async for rule in db.business_automations.find(q):
            ev = {"type": trigger_type, "order_id": order.get("_id"), "status": status}
            try:
                # Never back to whoever sent this order: mirror-image rules
                # on two partners would otherwise ping-pong forever.
                if (order.get("automation") or {}).get("from_business_id") == rule["partner_business_id"]:
                    runs.append(await _record(rule, result="skipped", event=ev, error="would send the order back to its sender"))
                    continue
                # Once per source order, whatever the status does next.
                if await db.automation_runs.find_one({
                    "automation_id": rule["_id"], "trigger_event.order_id": order.get("_id"),
                    "result": {"$in": ["created", "auto_accepted"]},
                }, {"_id": 1}):
                    continue
                runs.append(await _create_partner_order(rule, source=order, needed_by=None, event=ev))
            except Exception as e:  # noqa: BLE001
                logger.exception("automation %s failed", rule.get("_id"))
                runs.append(await _record(rule, result="failed", event=ev, error=str(e)[:300]))
    except Exception:  # noqa: BLE001
        logger.exception("automation engine failed for %s", trigger_type)
    return runs


_background: set = set()


def fire_in_background(trigger_type: str, event: dict[str, Any]) -> None:
    """For the order hot path: the status change answers at once, the
    handoff happens a moment later. A strong reference is held until the
    task ends, or the event loop may collect it half-way."""
    task = asyncio.create_task(fire(trigger_type, event))
    _background.add(task)
    task.add_done_callback(_background.discard)


# ---------------------------------------------------------------------------
# endpoints
# ---------------------------------------------------------------------------

@router.get("/businesses/{business_id}/automations")
async def list_automations(business_id: str, user=Depends(verify_token)):
    await _owned(business_id, user)
    rules = await db.business_automations.find({"business_id": business_id}).sort("created_at", -1).to_list(MAX_RULES)
    names = {b["_id"]: b async for b in db.businesses.find(
        {"_id": {"$in": [r["partner_business_id"] for r in rules]}}, {"name": 1},
    )}
    return {"automations": [_rule_out(r, names.get(r["partner_business_id"])) for r in rules]}


@router.post("/businesses/{business_id}/automations")
async def create_automation(business_id: str, payload: AutomationIn, user=Depends(verify_token)):
    await _owned(business_id, user)
    if payload.partner_business_id == business_id:
        raise HTTPException(status_code=400, detail="Pick a partner business")
    if not await connected(business_id, payload.partner_business_id):
        raise HTTPException(status_code=400, detail="You can only automate with a business you are connected to")
    if await db.business_automations.count_documents({"business_id": business_id}) >= MAX_RULES:
        raise HTTPException(status_code=400, detail=f"Up to {MAX_RULES} automations per business")
    now = _now()
    rule = {
        "_id": str(uuid.uuid4()),
        "business_id": business_id,
        "partner_business_id": payload.partner_business_id,
        "name": payload.name.strip(),
        "enabled": payload.enabled,
        "trigger": payload.trigger.model_dump(),
        "template": payload.template.model_dump(),
        "run_count": 0, "last_run_at": None,
        "created_at": now, "updated_at": now,
    }
    await db.business_automations.insert_one(rule)
    partner = await db.businesses.find_one({"_id": payload.partner_business_id}, {"name": 1})
    return _rule_out(rule, partner)


@router.patch("/automations/{rule_id}")
async def update_automation(rule_id: str, payload: AutomationPatch, user=Depends(verify_token)):
    rule = await _rule_owned(rule_id, user)
    upd: dict[str, Any] = {"updated_at": _now()}
    if payload.name is not None:
        upd["name"] = payload.name.strip()
    if payload.enabled is not None:
        if payload.enabled and not await connected(rule["business_id"], rule["partner_business_id"]):
            raise HTTPException(status_code=400, detail="Reconnect with this business before switching it back on")
        upd["enabled"] = payload.enabled
        if payload.enabled:
            upd["paused_reason"] = None
    await db.business_automations.update_one({"_id": rule_id}, {"$set": upd})
    fresh = await db.business_automations.find_one({"_id": rule_id})
    partner = await db.businesses.find_one({"_id": fresh["partner_business_id"]}, {"name": 1})
    return _rule_out(fresh, partner)


@router.delete("/automations/{rule_id}")
async def delete_automation(rule_id: str, user=Depends(verify_token)):
    await _rule_owned(rule_id, user)
    # The run log stays: it is the record of orders that were really made.
    await db.business_automations.delete_one({"_id": rule_id})
    return {"deleted": True}


@router.post("/automations/{rule_id}/run")
async def run_automation(rule_id: str, payload: RunIn = RunIn(), user=Depends(verify_token)):
    """Send a saved reorder now. This IS the "Order again" button."""
    rule = await _rule_owned(rule_id, user)
    if (rule.get("trigger") or {}).get("type") != "manual.reorder":
        raise HTTPException(status_code=400, detail="Only a saved reorder can be sent by hand")
    needed_by = None
    if payload.needed_by:
        from routes.marketplace.orders import _clean_needed_by
        try:
            needed_by = _clean_needed_by(payload.needed_by)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
    run = await _create_partner_order(rule, source=None, needed_by=needed_by,
                                      event={"type": "manual.reorder", "by": user["user_id"]})
    if run["result"] in ("failed", "skipped"):
        raise HTTPException(status_code=409, detail=run.get("error") or "That could not be sent")
    return {k: run[k] for k in ("_id", "result", "created_order_id", "created_at")} | {"id": run["_id"]}


@router.get("/businesses/{business_id}/automations/runs")
async def list_runs(business_id: str, limit: int = Query(50, ge=1, le=200), user=Depends(verify_token)):
    """What automations did, from either side. The receiving business sees
    runs that sent it orders - that is how it learns why an order arrived."""
    await _owned(business_id, user)
    rows = await db.automation_runs.find(
        {"$or": [{"business_id": business_id}, {"partner_business_id": business_id}]},
    ).sort("created_at", -1).limit(limit).to_list(limit)
    ids = {r["business_id"] for r in rows} | {r["partner_business_id"] for r in rows}
    names = {b["_id"]: b.get("name") async for b in db.businesses.find({"_id": {"$in": list(ids)}}, {"name": 1})}
    return {"runs": [{
        "id": r["_id"],
        "automation_name": r.get("automation_name"),
        "direction": "sent" if r["business_id"] == business_id else "received",
        "from_business": names.get(r["business_id"]),
        "to_business": names.get(r["partner_business_id"]),
        "result": r["result"],
        "created_order_id": r.get("created_order_id"),
        "error": r.get("error") if r["business_id"] == business_id else None,
        "created_at": r["created_at"],
    } for r in rows]}


@router.get("/businesses/{business_id}/orders/auto-accept")
async def get_auto_accept(business_id: str, user=Depends(verify_token)):
    biz = await _owned(business_id, user)
    return {"auto_accept_from": biz.get("auto_accept_from") or []}


@router.put("/businesses/{business_id}/orders/auto-accept")
async def put_auto_accept(business_id: str, payload: AutoAcceptIn, user=Depends(verify_token)):
    """Which partners' automated orders skip the waiting step.

    A separate endpoint from PUT /orders/settings, deliberately. That one
    REPLACES the whole settings object, and a screen that saves windows and
    cutoffs without knowing about this list would wipe it on every save -
    the exact failure that once blanked a business's hours. Stored on the
    business document, as the brief asks.
    """
    await _owned(business_id, user)
    entries = []
    seen = set()
    for e in payload.auto_accept_from:
        if e.business_id in seen:
            continue
        seen.add(e.business_id)
        if not await connected(business_id, e.business_id):
            raise HTTPException(status_code=400, detail="You can only auto-accept from a business you are connected to")
        entries.append(e.model_dump())
    await db.businesses.update_one({"_id": business_id}, {"$set": {"auto_accept_from": entries}})
    return {"auto_accept_from": entries}


async def ensure_automation_indexes() -> None:
    await db.business_automations.create_index([("business_id", 1), ("enabled", 1), ("trigger.type", 1)], background=True)
    await db.automation_runs.create_index([("business_id", 1), ("created_at", -1)], background=True)
    await db.automation_runs.create_index([("partner_business_id", 1), ("created_at", -1)], background=True)
    await db.automation_runs.create_index([("automation_id", 1), ("trigger_event.order_id", 1)], background=True)

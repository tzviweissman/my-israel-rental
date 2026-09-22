"""Automations between connected businesses (docs/business-network-spec.md, Phase 2).

A rule belongs to one business and targets one of its accepted partners:
WHEN something happens, CREATE AN ORDER for the partner. The canonical
case is the shop and its courier: the shop marks an order ready, and a
delivery order appears in the courier's own Orders tab without anyone
retyping it. If the courier has told the site to accept that shop's
orders automatically, it lands already accepted.

A rule is one sentence: WHEN this happens, DO that. Since 21 Sep 2026 the
two lists are (Tzvi: never pre-write automations, grow the vocabulary):

  WHEN  `order.status_changed`   one of my orders reaches a status
        `manual.reorder`         I tap Send ("the usual" from my supplier)
        `appointment.booked`     someone books one of my gigs
        `appointment.cancelled`  a booking is cancelled
        `lead.received`          a customer taps WhatsApp on my gig
        `schedule`               every week on given days at a time
                                 (Asia/Jerusalem; see schedule_loop)
        `booking.confirmed`      a guest stay on my listing is confirmed
        `booking.cancelled`      ...or cancelled (its jobs are withdrawn)
  DO    `send_order`             an order appears at a partner (below)
        `notify_me`              a bell and an email to me
        `message_customer`       my words to the order's / booking's
                                 customer, by email and bell

Only `send_order` needs a partner. A lead has no customer to message; a
schedule has no customer either. The validator says so in the form's
words.

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

class ScheduleIn(BaseModel):
    """Every week on these days at this time, Asia/Jerusalem. Weekdays are
    Python's: 0 is Monday, 6 is Sunday."""
    weekdays: list[int] = Field(min_length=1, max_length=7)
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")

    @field_validator("weekdays")
    @classmethod
    def _days(cls, v):
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("weekdays are 0 (Monday) to 6 (Sunday)")
        return sorted(set(v))


class TriggerIn(BaseModel):
    type: Literal["order.status_changed", "manual.reorder", "appointment.booked",
                  "appointment.cancelled", "lead.received", "schedule",
                  "booking.confirmed", "booking.cancelled"]
    status: Optional[str] = None
    schedule: Optional[ScheduleIn] = None
    # A guest booking on ONE of my listings; None means any of them. The
    # host with three flats and two cleaners needs this; everyone else
    # leaves it empty.
    property_id: Optional[str] = Field(None, max_length=100)

    @model_validator(mode="after")
    def _shape(self):
        if self.type == "order.status_changed":
            if self.status not in FIRES_ON:
                raise ValueError(f"status must be one of {list(FIRES_ON)}")
        else:
            self.status = None
        if self.type == "schedule":
            if not self.schedule:
                raise ValueError("Pick the days and the time")
        else:
            self.schedule = None
        if not self.type.startswith("booking."):
            self.property_id = None
        return self


class ActionIn(BaseModel):
    """What happens. `send_order` is the original (and the default, so
    every rule saved before actions existed still reads the same)."""
    type: Literal["send_order", "notify_me", "message_customer"] = "send_order"
    text: str = Field("", max_length=1000)

    @field_validator("text")
    @classmethod
    def _strip(cls, v):
        return v.strip()


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
    partner_business_id: Optional[str] = Field(None, max_length=100)
    name: str = Field(min_length=1, max_length=120)
    enabled: bool = True
    trigger: TriggerIn
    action: ActionIn = Field(default_factory=ActionIn)
    template: Optional[TemplateIn] = None

    @model_validator(mode="after")
    def _coherent(self):
        t, a = self.trigger.type, self.action.type
        if a == "send_order":
            if not self.partner_business_id:
                raise ValueError("Pick a partner business")
            if self.template is None:
                raise ValueError("Say what to order")
            tpl = self.template
            if tpl.copy_from_source and t != "order.status_changed":
                # Only an order can be sent on as it is; a reorder, a
                # schedule or an appointment has no source order.
                raise ValueError("Only an order can be sent on as it is")
            if not tpl.copy_from_source and not tpl.items:
                raise ValueError("Say what to order")
            # A guest booking brings its own address: the listing's.
            if (not tpl.copy_from_source and tpl.fulfilment == "delivery" and not tpl.address
                    and not t.startswith("booking.")):
                raise ValueError("A delivery needs an address")
        else:
            self.partner_business_id = None
            self.template = None
            if a == "message_customer":
                if not self.action.text:
                    raise ValueError("Write the message")
                if t not in ("order.status_changed", "appointment.booked", "appointment.cancelled",
                             "booking.confirmed", "booking.cancelled"):
                    raise ValueError("Only an order, an appointment or a guest booking has a customer to message")
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
        "action": rule.get("action") or {"type": "send_order", "text": ""},
        "template": rule.get("template") or {},
        "run_count": rule.get("run_count", 0),
        "last_run_at": rule.get("last_run_at"),
        "next_run_at": rule.get("next_run_at"),
        "created_at": rule.get("created_at"),
    }


def next_run(schedule: dict[str, Any], after: Optional[datetime] = None) -> str:
    """The next moment this schedule fires, as UTC ISO. Computed in
    Asia/Jerusalem so "Sunday 08:00" stays Sunday 08:00 across the clock
    change; stored in UTC so the loop compares plain strings."""
    now = after or datetime.now(_IL_TZ)
    hh, mm = (int(x) for x in schedule["time"].split(":"))
    days = set(schedule["weekdays"])
    for d in range(8):
        cand = (now + timedelta(days=d)).replace(hour=hh, minute=mm, second=0, microsecond=0)
        if cand.weekday() in days and cand > now:
            return cand.astimezone(UTC).isoformat()
    raise ValueError("no weekday in schedule")   # the model forbids an empty list


DID_SOMETHING = ("created", "auto_accepted", "notified", "messaged")


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
    if result in DID_SOMETHING:
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


async def _next_arrival(rental: dict[str, Any]) -> Optional[dict[str, Any]]:
    """The next confirmed stay on the same listing after this one ends: the
    cleaner's real deadline. Pending requests do not count - they may never
    happen, and a cleaner rushing for a stay that was declined is worse than
    one told nothing."""
    return await db.bookings.find_one(
        {"property_id": rental.get("property_id"), "status": "confirmed",
         "id": {"$ne": rental.get("id")}, "start_date": {"$gte": rental.get("end_date") or ""}},
        {"_id": 0, "start_date": 1}, sort=[("start_date", 1)],
    )


async def _rental_fields(rule: dict[str, Any], me: dict[str, Any], ctx: dict[str, Any]) -> dict[str, Any]:
    """A job for a partner, timed by a guest booking: due when the guests
    leave, at the listing's address, with the next arrival as the deadline.
    The guest's name and phone are NOT passed on - the cleaner needs the
    flat and the time, not who slept there."""
    from routes.marketplace import orders as om
    tpl = rule.get("template") or {}
    rental, prop = ctx["rental"], ctx.get("property") or {}
    out_day = (rental.get("end_date") or "")[:10]
    due = f"{out_day}T{prop['checkout_time']}" if out_day and prop.get("checkout_time") else out_day
    lines = [f"{prop.get('title') or 'Listing'}: guests leave {out_day}"
             + (f" at {prop['checkout_time']}" if prop.get("checkout_time") else "")]
    nxt = await _next_arrival(rental)
    if nxt:
        lines.append(f"Next guests arrive {nxt['start_date'][:10]}"
                     + (f" at {prop['checkin_time']}" if prop.get("checkin_time") else ""))
    if tpl.get("notes"):
        lines.append(tpl["notes"])
    return {
        "customer_name": me.get("name") or "Partner",
        **om._phone_fields(None),
        "items": tpl.get("items") or "Cleaning between guests",
        "total": tpl.get("total"),
        "needed_by": due or _default_needed_by(),
        "fulfilment": "delivery",
        "address": tpl.get("address") or prop.get("address") or prop.get("area"),
        "notes": "\n".join(lines),
    }


async def _create_partner_order(rule: dict[str, Any], *, source: Optional[dict[str, Any]],
                                needed_by: Optional[str], event: dict[str, Any],
                                ctx: Optional[dict[str, Any]] = None) -> dict[str, Any]:
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
    if ctx and ctx.get("rental"):
        fields = await _rental_fields(rule, me, ctx)
    elif tpl.get("copy_from_source") and source:
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
            # So a cancelled stay can take its cleaning job back with it.
            "source_booking_id": ((ctx or {}).get("rental") or {}).get("id"),
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
# the other two actions
# ---------------------------------------------------------------------------

def _describe(ctx: dict[str, Any]) -> str:
    """One line a person would recognise: what the event was about."""
    from routes.marketplace import orders as om
    if ctx.get("order"):
        return om._order_line(ctx["order"])
    if ctx.get("booking"):
        b, g = ctx["booking"], ctx.get("gig") or {}
        when = " ".join(x for x in (b.get("preferred_date"), b.get("time_slot")) if x)
        return " - ".join(x for x in (g.get("title"), when) if x) or "an appointment"
    if ctx.get("gig"):
        return ctx["gig"].get("title") or "your listing"
    if ctx.get("rental"):
        r, p = ctx["rental"], ctx.get("property") or {}
        return f"{p.get('title') or 'Your listing'}: {(r.get('start_date') or '')[:10]} to {(r.get('end_date') or '')[:10]}"
    return ""


def _where(ctx: dict[str, Any]) -> str:
    if ctx.get("order"):
        return "/dashboard?tab=orders"
    if ctx.get("booking"):
        return f"/dashboard?tab=appointments&highlight={ctx['booking'].get('_id')}"
    if ctx.get("gig"):
        return "/dashboard?tab=my-gigs"
    if ctx.get("rental"):
        return "/dashboard?tab=bookings"
    return "/dashboard?tab=network&view=automations"


async def _notify_me(rule: dict[str, Any], ctx: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
    """A bell and an email to the business's owner. Their own words if
    they wrote any, otherwise the rule's name and what it was about."""
    from routes.marketplace import orders as om
    biz = await db.businesses.find_one({"_id": rule["business_id"]}, {"owner_user_id": 1, "name": 1})
    if not biz:
        return await _record(rule, result="failed", event=event, error="business no longer exists")
    text = (rule.get("action") or {}).get("text") or ""
    about = _describe(ctx)
    msg = text or ": ".join(x for x in (rule.get("name"), about) if x)
    await om._notify(biz["owner_user_id"], type_="automation", message=msg[:500], action_url=_where(ctx))
    owner = await db.users.find_one({"id": biz["owner_user_id"]}, {"_id": 0, "email": 1})
    if owner and owner.get("email"):
        body = f"<p>{om._esc(msg)}</p>" + (f"<p>{om._esc(about)}</p>" if text and about else "")
        await om._email(owner["email"], rule.get("name") or "Automation", body, tag="automation_notify",
                        button=("Open", _where(ctx)))
    return await _record(rule, result="notified", event=event)


async def _message_customer(rule: dict[str, Any], ctx: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
    """The owner's words to the customer of this order or appointment: an
    email where there is an address, a bell where there is an account.
    Neither means the run is skipped and says why - a message nobody
    could receive must not count as sent."""
    from routes.marketplace import orders as om
    text = (rule.get("action") or {}).get("text") or ""
    biz = await db.businesses.find_one({"_id": rule["business_id"]}, {"name": 1})
    sender = (biz or {}).get("name") or "A business"
    email = user_id = None
    if ctx.get("order"):
        email, user_id = ctx["order"].get("customer_email"), ctx["order"].get("customer_user_id")
    elif ctx.get("booking"):
        email, user_id = ctx["booking"].get("contact_email"), ctx["booking"].get("client_user_id")
    elif ctx.get("rental"):
        user_id = ctx["rental"].get("renter_id")
        guest = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1}) if user_id else None
        email = (guest or {}).get("email")
    if not email and not user_id:
        return await _record(rule, result="skipped", event=event, error="no email or account for this customer")
    if user_id:
        await om._notify(user_id, type_="business_message", message=f"{sender}: {text}"[:500], action_url=_where(ctx))
    if email:
        await om._email(email, f"A message from {sender}", f"<p>{om._esc_ml(text)}</p>", tag="automation_message")
    return await _record(rule, result="messaged", event=event)


async def _run(rule: dict[str, Any], ctx: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
    kind = (rule.get("action") or {}).get("type") or "send_order"
    if kind == "notify_me":
        return await _notify_me(rule, ctx, event)
    if kind == "message_customer":
        return await _message_customer(rule, ctx, event)
    return await _create_partner_order(rule, source=ctx.get("order"), needed_by=None, event=event, ctx=ctx)


# ---------------------------------------------------------------------------
# the engine
# ---------------------------------------------------------------------------

async def _businesses_for_gig(gig: dict[str, Any]) -> list[str]:
    """Rules belong to a business; a gig belongs to a provider, and only
    newer gigs carry business_id. Fall back to every business the provider
    owns, so a provider whose gigs predate the field is not left out."""
    if gig.get("business_id"):
        return [gig["business_id"]]
    if not gig.get("provider_user_id"):
        return []
    return [b["_id"] async for b in db.businesses.find(
        {"owner_user_id": gig["provider_user_id"], "active": {"$ne": False}}, {"_id": 1})]


async def fire(trigger_type: str, event: dict[str, Any]) -> list[dict[str, Any]]:
    """Run every enabled rule matching this event. Never raises."""
    runs: list[dict[str, Any]] = []
    try:
        q: dict[str, Any] = {"enabled": True, "trigger.type": trigger_type}
        if trigger_type == "order.status_changed":
            order = event.get("order") or {}
            ctx = {"order": order}
            q["business_id"] = order.get("business_id")
            q["trigger.status"] = event.get("status")
            ev = {"type": trigger_type, "order_id": order.get("_id"), "source_id": order.get("_id"), "status": event.get("status")}
        elif trigger_type in ("appointment.booked", "appointment.cancelled"):
            booking, gig = event.get("booking") or {}, event.get("gig") or {}
            ctx = {"booking": booking, "gig": gig}
            q["business_id"] = {"$in": await _businesses_for_gig(gig)}
            ev = {"type": trigger_type, "booking_id": booking.get("_id"), "source_id": booking.get("_id")}
        elif trigger_type in ("booking.confirmed", "booking.cancelled"):
            rental = event.get("rental") or {}
            prop = event.get("property") or await db.properties.find_one(
                {"id": rental.get("property_id")}, {"_id": 0}) or {}
            ctx = {"rental": rental, "property": prop}
            owned = [b["_id"] async for b in db.businesses.find(
                {"owner_user_id": rental.get("owner_id"), "active": {"$ne": False}}, {"_id": 1})]
            q["business_id"] = {"$in": owned}
            q["$or"] = [{"trigger.property_id": None}, {"trigger.property_id": rental.get("property_id")}]
            ev = {"type": trigger_type, "rental_id": rental.get("id"), "source_id": rental.get("id")}
        elif trigger_type == "lead.received":
            gig = event.get("gig") or {}
            ctx = {"gig": gig}
            q["business_id"] = {"$in": await _businesses_for_gig(gig)}
            ev = {"type": trigger_type, "gig_id": gig.get("_id"), "source_id": event.get("lead_id")}
        else:
            return runs
        async for rule in db.business_automations.find(q):
            try:
                order = ctx.get("order") or {}
                # Never back to whoever sent this order: mirror-image rules
                # on two partners would otherwise ping-pong forever.
                sender = (order.get("automation") or {}).get("from_business_id") if order else None
                if sender and sender == rule.get("partner_business_id"):
                    runs.append(await _record(rule, result="skipped", event=ev, error="would send the order back to its sender"))
                    continue
                # Once per source, whatever its status does next.
                if ev.get("source_id") and await db.automation_runs.find_one({
                    "automation_id": rule["_id"], "trigger_event.source_id": ev["source_id"],
                    "result": {"$in": list(DID_SOMETHING)},
                }, {"_id": 1}):
                    continue
                runs.append(await _run(rule, ctx, ev))
            except Exception as e:  # noqa: BLE001
                logger.exception("automation %s failed", rule.get("_id"))
                runs.append(await _record(rule, result="failed", event=ev, error=str(e)[:300]))
    except Exception:  # noqa: BLE001
        logger.exception("automation engine failed for %s", trigger_type)
    return runs


async def withdraw_for_booking(rental: dict[str, Any]) -> int:
    """A stay was cancelled: take back the jobs it sent. A cleaner must not
    turn up for guests who are not coming. Only jobs nobody has finished
    are cancelled (compare-and-swap on the status, like every other status
    write); the partner is told either way. Never raises."""
    from routes.marketplace import orders as om
    withdrawn = 0
    try:
        async for o in db.store_orders.find({"automation.source_booking_id": rental.get("id")}):
            now = om._now_iso()
            done = await db.store_orders.find_one_and_update(
                {"_id": o["_id"], "status": {"$in": ["new", "preparing"]}},
                {"$set": {"status": "cancelled", "status_changed_at": now, "updated_at": now},
                 "$push": {"history": {"status": "cancelled", "at": now, "by": "automation",
                                       "note": "the stay was cancelled"}}},
            )
            if done:
                withdrawn += 1
            what = om._order_line(o)
            await om._notify(o["owner_user_id"], type_="order_cancelled",
                             message=(f"Cancelled, the stay it was for was cancelled: {what}" if done
                                      else f"The stay this job was for was cancelled: {what}"),
                             action_url="/dashboard?tab=orders", order_id=o["_id"])
    except Exception:  # noqa: BLE001
        logger.exception("withdraw_for_booking %s failed", rental.get("id"))
    return withdrawn


def booking_changed(rental: dict[str, Any], status: str) -> None:
    """The one call the property-booking routes make. In the background:
    a host confirming a stay must not wait on, or fail because of, a rule."""
    async def _go():
        if status == "cancelled":
            await withdraw_for_booking(rental)
        await fire(f"booking.{status}", {"rental": rental})
    task = asyncio.create_task(_go())
    _background.add(task)
    task.add_done_callback(_background.discard)


async def run_due_schedules() -> int:
    """Fire every schedule whose time has come. The next time is written
    with a compare-and-swap on the old one first, so two replicas waking
    together cannot both send Sunday's order."""
    now_iso = datetime.now(UTC).isoformat()
    fired = 0
    async for rule in db.business_automations.find(
        {"enabled": True, "trigger.type": "schedule", "next_run_at": {"$lte": now_iso}},
    ):
        try:
            nxt = next_run(rule["trigger"]["schedule"])
            claimed = await db.business_automations.find_one_and_update(
                {"_id": rule["_id"], "next_run_at": rule["next_run_at"]},
                {"$set": {"next_run_at": nxt, "updated_at": _now()}},
            )
            if not claimed:
                continue
            ev = {"type": "schedule", "due": rule["next_run_at"]}
            try:
                await _run(rule, {}, ev)
            except Exception as e:  # noqa: BLE001
                logger.exception("scheduled automation %s failed", rule.get("_id"))
                await _record(rule, result="failed", event=ev, error=str(e)[:300])
            fired += 1
        except Exception:  # noqa: BLE001
            logger.exception("schedule loop: rule %s", rule.get("_id"))
    return fired


async def schedule_loop() -> None:
    """Once a minute. The first real scheduler on the site (spec, Phase 3):
    standing orders still generate on read, and folding them in is a
    separate change."""
    while True:
        await asyncio.sleep(60)
        try:
            await run_due_schedules()
        except Exception as e:  # noqa: BLE001
            logger.warning("automation schedule loop crashed: %s", e)


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
    sends = payload.action.type == "send_order"
    if sends:
        if payload.partner_business_id == business_id:
            raise HTTPException(status_code=400, detail="Pick a partner business")
        if not await connected(business_id, payload.partner_business_id):
            raise HTTPException(status_code=400, detail="You can only automate with a business you are connected to")
    if await db.business_automations.count_documents({"business_id": business_id}) >= MAX_RULES:
        raise HTTPException(status_code=400, detail=f"Up to {MAX_RULES} automations per business")
    now = _now()
    trigger = payload.trigger.model_dump()
    rule = {
        "_id": str(uuid.uuid4()),
        "business_id": business_id,
        "partner_business_id": payload.partner_business_id,
        "name": payload.name.strip(),
        "enabled": payload.enabled,
        "trigger": trigger,
        "action": payload.action.model_dump(),
        "template": payload.template.model_dump() if payload.template else None,
        "next_run_at": next_run(trigger["schedule"]) if trigger["type"] == "schedule" else None,
        "run_count": 0, "last_run_at": None,
        "created_at": now, "updated_at": now,
    }
    await db.business_automations.insert_one(rule)
    partner = await db.businesses.find_one({"_id": payload.partner_business_id}, {"name": 1}) if sends else None
    return _rule_out(rule, partner)


@router.patch("/automations/{rule_id}")
async def update_automation(rule_id: str, payload: AutomationPatch, user=Depends(verify_token)):
    rule = await _rule_owned(rule_id, user)
    upd: dict[str, Any] = {"updated_at": _now()}
    if payload.name is not None:
        upd["name"] = payload.name.strip()
    if payload.enabled is not None:
        if payload.enabled and rule.get("partner_business_id") and not await connected(rule["business_id"], rule["partner_business_id"]):
            raise HTTPException(status_code=400, detail="Reconnect with this business before switching it back on")
        upd["enabled"] = payload.enabled
        if payload.enabled:
            upd["paused_reason"] = None
            # A schedule switched back on fires at its NEXT time, not at
            # once for every time it slept through.
            if (rule.get("trigger") or {}).get("type") == "schedule":
                upd["next_run_at"] = next_run(rule["trigger"]["schedule"])
    await db.business_automations.update_one({"_id": rule_id}, {"$set": upd})
    fresh = await db.business_automations.find_one({"_id": rule_id})
    partner = await db.businesses.find_one({"_id": fresh["partner_business_id"]}, {"name": 1}) if fresh.get("partner_business_id") else None
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
    # A schedule can be sent early by hand too: "the Sunday order, today".
    if (rule.get("trigger") or {}).get("type") not in ("manual.reorder", "schedule"):
        raise HTTPException(status_code=400, detail="Only a saved reorder or a schedule can be sent by hand")
    needed_by = None
    if payload.needed_by:
        from routes.marketplace.orders import _clean_needed_by
        try:
            needed_by = _clean_needed_by(payload.needed_by)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
    ev = {"type": "manual.reorder", "by": user["user_id"]}
    if (rule.get("action") or {}).get("type", "send_order") == "send_order":
        run = await _create_partner_order(rule, source=None, needed_by=needed_by, event=ev)
    else:
        run = await _run(rule, {}, ev)
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
    ids = {r["business_id"] for r in rows} | {r["partner_business_id"] for r in rows if r.get("partner_business_id")}
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


class PriceTipsIn(BaseModel):
    enabled: bool


@router.get("/businesses/{business_id}/price-tips")
async def get_price_tips(business_id: str, user=Depends(verify_token)):
    """Cheaper-option tips (price_watch.py). On unless switched off; price
    alerts about your own suppliers are not covered by this and always on."""
    biz = await _owned(business_id, user)
    return {"enabled": biz.get("price_tips") is not False}


@router.put("/businesses/{business_id}/price-tips")
async def put_price_tips(business_id: str, payload: PriceTipsIn, user=Depends(verify_token)):
    await _owned(business_id, user)
    await db.businesses.update_one({"_id": business_id}, {"$set": {"price_tips": payload.enabled}})
    return {"enabled": payload.enabled}


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
    await db.automation_runs.create_index([("automation_id", 1), ("trigger_event.source_id", 1)], background=True)
    await db.business_automations.create_index([("trigger.type", 1), ("enabled", 1), ("next_run_at", 1)], background=True)
    await db.business_automations.create_index([("partner_business_id", 1), ("enabled", 1)], background=True)
    await db.price_tips.create_index([("business_id", 1), ("gig_id", 1)], background=True)
    await db.price_tips.create_index([("business_id", 1), ("at", -1)], background=True)

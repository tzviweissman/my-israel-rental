"""Memberships: a gym, studio or any business that sells by the month
(Tzvi, 14 Oct 2026: "a gym can have people sign up and eventually pay and
it will keep track of their membership").

Four pieces, payments deliberately not among them yet (the provider is
being chosen; see docs/grow-partner-message.md):

  * Plans. The business sets them: monthly, yearly, or a class pack, with
    a price and, optionally, how many visits it includes.
  * Sign-up without an account. Same rule as orders: a customer never
    signs in. They give a name and a phone, and get a link to their
    membership (the pass, with the QR the door scans).
  * The member list. New sign-ups wait for the business to mark them paid
    and active; from then the list shows who is active, who is due to
    renew, and who has lapsed.
  * Check-in at the door. The business opens a door link once on the
    phone or tablet at the entrance (no sign-in, like the orders staff
    link). Staff scan a member's QR with that device's camera, or type
    the member's short code, and the visit is recorded and checked.

Tokens follow the orders pattern: `manage_token` (the member's own link)
and `checkin_code` (in the QR) are separate, so the QR a member holds up
at the door is not the key to their membership page.
"""
from __future__ import annotations

import calendar
import secrets
import uuid
from datetime import date, datetime
from typing import Any, Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from routes.deps import db, logger, optional_user, verify_token
from utils.rate_limit import check_rate

# The orders module already owns the site's escaped-email and bell
# helpers; one implementation of escaping is the point of them.
from .custom_fields import check_answers, public_fields
from .orders import _email, _esc, _frontend_url, _notify, _subject

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

IL = ZoneInfo("Asia/Jerusalem")
PERIODS = ("month", "year", "pack", "card")
STATUSES = ("pending", "active", "paused", "cancelled", "expired")
# Letters and digits that cannot be misread when typed from a phone screen.
_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _now_iso() -> str:
    return datetime.now(IL).isoformat(timespec="seconds")


def _today() -> date:
    return datetime.now(IL).date()


def _add_months(d: date, n: int) -> date:
    """31 January + 1 month = 28/29 February, never 3 March."""
    m = d.month - 1 + n
    y, m = d.year + m // 12, m % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def _period_end(start: date, period: str, months: Optional[int] = None) -> Optional[date]:
    if period == "month":
        return _add_months(start, 1)
    if period == "year":
        return _add_months(start, 12)
    # A class pack runs out by visits; an expiry is optional. A punch
    # card never ends.
    if period == "card":
        return None
    return _add_months(start, months) if months else None


async def ensure_membership_indexes() -> None:
    await db.membership_plans.create_index("business_id")
    await db.business_members.create_index([("business_id", 1), ("status", 1)])
    await db.business_members.create_index("manage_token", unique=True, sparse=True)
    await db.business_members.create_index("checkin_code", unique=True, sparse=True)
    await db.business_members.create_index([("business_id", 1), ("short_code", 1)], unique=True, sparse=True)
    await db.businesses.create_index("members_door_token", unique=True, sparse=True)


async def _owned_business(business_id: str, user: dict[str, Any], perm: str = "members") -> dict[str, Any]:
    """The owner, an admin, or staff with the Members area (utils/business_access.py).
    perm="checkin": also staff who only check people in at the door."""
    from utils.business_access import business_access
    return await business_access(db, business_id, user, perm)


def _biz_public(biz: dict[str, Any]) -> dict[str, Any]:
    return {"id": biz["_id"], "name": biz.get("name") or "", "name_he": biz.get("name_he"),
            "logo_url": biz.get("logo_url"), "slug": biz.get("slug"),
            "birthday_on": bool((biz.get("birthday_settings") or {}).get("on"))}


# ---------------------------------------------------------------------------
# plans
# ---------------------------------------------------------------------------

class PlanIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = Field(None, max_length=400)
    # "card" is a punch card: every `visits` visits earn `reward`.
    period: Literal["month", "year", "pack", "card"] = "month"
    price: float = Field(..., ge=0, le=100000)
    # Visits included: per period for month/year, in total for a pack.
    # None = unlimited (a pack must say how many).
    visits: Optional[int] = Field(None, ge=1, le=1000)
    # A pack can expire this many months after it starts.
    valid_months: Optional[int] = Field(None, ge=1, le=36)
    # A punch card's reward, in the business's words ("a free coffee").
    reward: Optional[str] = Field(None, max_length=80)
    active: bool = True


def _plan_out(p: dict[str, Any]) -> dict[str, Any]:
    return {"id": p["_id"], "business_id": p["business_id"], "name": p["name"], "description": p.get("description"),
            "period": p["period"], "price": p["price"], "currency": p.get("currency", "ILS"),
            "visits": p.get("visits"), "valid_months": p.get("valid_months"), "reward": p.get("reward"),
            "active": p.get("active", True)}


def _check_plan(body: PlanIn) -> None:
    if body.period == "pack" and not body.visits:
        raise HTTPException(status_code=422, detail="A class pack needs a number of visits")
    if body.period == "card" and (not body.visits or not (body.reward or "").strip()):
        raise HTTPException(status_code=422, detail="A punch card needs the number of visits and the reward")


@router.get("/businesses/{business_id}/membership-plans")
async def list_plans(business_id: str, user=Depends(verify_token)):
    await _owned_business(business_id, user)
    rows = await db.membership_plans.find({"business_id": business_id, "deleted": {"$ne": True}}).sort("created_at", 1).to_list(100)
    return [_plan_out(p) for p in rows]


@router.post("/businesses/{business_id}/membership-plans")
async def create_plan(business_id: str, body: PlanIn, user=Depends(verify_token)):
    biz = await _owned_business(business_id, user)
    _check_plan(body)
    if await db.membership_plans.count_documents({"business_id": business_id, "deleted": {"$ne": True}}) >= 30:
        raise HTTPException(status_code=400, detail="A business can have up to 30 plans")
    doc = {"_id": str(uuid.uuid4()), "business_id": business_id, "owner_user_id": biz["owner_user_id"],
           **body.model_dump(), "currency": "ILS", "created_at": _now_iso()}
    await db.membership_plans.insert_one(doc)
    return _plan_out(doc)


@router.put("/businesses/{business_id}/membership-plans/{plan_id}")
async def update_plan(business_id: str, plan_id: str, body: PlanIn, user=Depends(verify_token)):
    """Members keep the plan they joined on (a copy is stored with each
    member), so a price change applies to new sign-ups only."""
    await _owned_business(business_id, user)
    _check_plan(body)
    r = await db.membership_plans.find_one_and_update(
        {"_id": plan_id, "business_id": business_id, "deleted": {"$ne": True}},
        {"$set": {**body.model_dump(), "updated_at": _now_iso()}}, return_document=True)
    if not r:
        raise HTTPException(status_code=404, detail="Plan not found")
    return _plan_out(r)


@router.delete("/businesses/{business_id}/membership-plans/{plan_id}")
async def delete_plan(business_id: str, plan_id: str, user=Depends(verify_token)):
    """Hidden, not erased: members on it still need to know what they bought."""
    await _owned_business(business_id, user)
    r = await db.membership_plans.update_one({"_id": plan_id, "business_id": business_id},
                                             {"$set": {"deleted": True, "active": False, "updated_at": _now_iso()}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"ok": True}


async def _public_business(slug_or_id: str) -> dict[str, Any]:
    biz = await db.businesses.find_one({"$or": [{"_id": slug_or_id}, {"slug": slug_or_id.lower()}]})
    if not biz or not biz.get("active", True):
        raise HTTPException(status_code=404, detail="Business not found")
    return biz


@router.get("/memberships/{slug_or_id}")
async def public_plans(slug_or_id: str):
    """The sign-up page: the business and its live plans."""
    biz = await _public_business(slug_or_id)
    rows = await db.membership_plans.find({"business_id": biz["_id"], "active": True, "deleted": {"$ne": True}}).sort("price", 1).to_list(50)
    return {"business": _biz_public(biz), "plans": [_plan_out(p) for p in rows], "fields": public_fields(biz, "membership")}


# ---------------------------------------------------------------------------
# joining (no account)
# ---------------------------------------------------------------------------

class JoinIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    phone: str = Field(..., min_length=7, max_length=20)
    email: Optional[str] = Field(None, max_length=200)
    start_date: Optional[date] = None
    note: Optional[str] = Field(None, max_length=500)
    lang: Literal["en", "he"] = "en"
    # Answers to the business's own questions (custom_fields.py).
    answers: dict[str, Any] = Field(default_factory=dict)
    # A discount code the business made (discounts.py), off the plan price.
    discount_code: Optional[str] = Field(None, max_length=40)
    # "MM-DD", optional, for the birthday treat (birthdays.py).
    birthday: Optional[str] = Field(None, pattern=r"^\d{2}-\d{2}$")


async def _new_short_code(business_id: str) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_CODE_CHARS) for _ in range(5))
        if not await db.business_members.find_one({"business_id": business_id, "short_code": code}, {"_id": 1}):
            return code
    raise HTTPException(status_code=500, detail="Could not make a member code")


def _plan_copy(p: dict[str, Any]) -> dict[str, Any]:
    return {k: p.get(k) for k in ("name", "period", "price", "currency", "visits", "valid_months", "reward")}


@router.post("/memberships/plan/{plan_id}/join")
async def join(plan_id: str, body: JoinIn, request: Request, viewer=Depends(optional_user)):
    check_rate(request, bucket="memberships_join", limit=20, window_seconds=600)
    plan = await db.membership_plans.find_one({"_id": plan_id, "active": True, "deleted": {"$ne": True}})
    if not plan:
        raise HTTPException(status_code=404, detail="This plan is not available")
    biz = await db.businesses.find_one({"_id": plan["business_id"]})
    if not biz or not biz.get("active", True):
        raise HTTPException(status_code=404, detail="This plan is not available")
    phone = "".join(ch for ch in body.phone if ch.isdigit() or ch == "+")
    if len(phone.lstrip("+")) < 9:
        raise HTTPException(status_code=422, detail="Please check the phone number")
    answers = check_answers(biz, "membership", body.answers)
    discount = None
    if body.discount_code and body.discount_code.strip():
        from .discounts import CodeRefused, evaluate, redeem
        try:
            code_doc, off = await evaluate(biz["_id"], body.discount_code, "memberships", float(plan.get("price") or 0), phone)
        except CodeRefused as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        if not await redeem(code_doc, off, phone):
            raise HTTPException(status_code=400, detail="This code has been used up")
        discount = {"code": code_doc["code"], "amount": off, "price_after": round(float(plan.get("price") or 0) - off, 2)}
    start = body.start_date or _today()
    if start < _today():
        start = _today()
    doc = {
        "_id": str(uuid.uuid4()), "business_id": biz["_id"], "owner_user_id": biz["owner_user_id"],
        "plan_id": plan["_id"], "plan": _plan_copy(plan),
        "name": body.name.strip(), "phone": phone, "email": (body.email or "").strip() or None,
        "customer_user_id": (viewer or {}).get("user_id"), "note": body.note, "lang": body.lang, "answers": answers, "discount": discount,
        # Pending until the business confirms payment: nothing is charged here.
        "status": "pending", "start_date": start.isoformat(), "renews_on": None, "visits_left": None,
        "manage_token": secrets.token_urlsafe(16), "checkin_code": secrets.token_urlsafe(12),
        "short_code": await _new_short_code(biz["_id"]),
        "visits": 0, "last_visit_at": None, "source": "website",
        "created_at": _now_iso(), "history": [{"at": _now_iso(), "event": "joined"}],
    }
    # A free punch card has nothing to pay for, so it starts at once.
    free_card = plan["period"] == "card" and not float(plan.get("price") or 0)
    if free_card:
        doc.update(_activation(doc["plan"], start))
    await db.business_members.insert_one(doc)
    from .birthdays import remember
    await remember(biz["_id"], doc["email"], doc["name"], body.birthday, body.lang, "membership")
    url = f"{_frontend_url()}/members/{doc['manage_token']}"
    if free_card:
        from .member_messages import on_activated
        await on_activated(biz["_id"], doc)
    logger.info("[memberships] join business=%s plan=%s", biz["_id"], plan["_id"])
    await _notify(biz["owner_user_id"], type_="membership_join",
                  message=f"New member sign-up: {doc['name']} ({plan['name']})",
                  action_url="/dashboard?tab=members")
    owner = await db.users.find_one({"id": biz["owner_user_id"]}, {"email": 1})
    await _email((owner or {}).get("email"), f"New member: {doc['name']}, {plan['name']}",
                 f"<p><b>{_esc(doc['name'])}</b> signed up for <b>{_esc(plan['name'])}</b>, starting {_esc(start.isoformat())}.</p>"
                 f"<p>Phone: {_esc(phone)}</p>"
                 + (f"<p>Discount code {_esc(discount['code'])}: ₪{discount['amount']:g} off, ₪{discount['price_after']:g} to pay.</p>" if discount else "")
                 + "".join(f"<p>{_esc(a['label'])}: {_esc('Yes' if a['value'] is True else 'No' if a['value'] is False else a['value'])}</p>" for a in answers)
                 + ("<p>Their punch card is ready to use.</p>" if free_card else "<p>Once they have paid, mark them active in your member list.</p>"),
                 tag="membership-join", button=("Open members", "/dashboard?tab=members"))
    if doc["email"] and not free_card:   # a free card got its welcome above
        he = body.lang == "he"
        await _email(doc["email"],
                     _subject(f"{biz.get('name')}: {'ההרשמה התקבלה' if he else 'your membership sign-up'}"),
                     (f"<p>שלום {_esc(doc['name'])},</p><p>ההרשמה ל{_esc(plan['name'])} ב{_esc(biz.get('name'))} התקבלה. "
                      f"העסק ייצור איתך קשר לגבי התשלום ויפעיל את המנוי.</p>"
                      if he else
                      f"<p>Hi {_esc(doc['name'])},</p><p>Your sign-up for {_esc(plan['name'])} at {_esc(biz.get('name'))} "
                      f"has been received. The business will be in touch about payment and will then activate it.</p>"),
                     tag="membership-join-customer",
                     button=("לכרטיס המנוי" if he else "Your membership", url))
    return {"member_id": doc["_id"], "manage_token": doc["manage_token"], "manage_url": url, "status": doc["status"]}


def _member_state(m: dict[str, Any]) -> dict[str, Any]:
    """Whether this member may come in today, and why not if they can't."""
    today = _today().isoformat()
    st = m.get("status")
    if st != "active":
        return {"ok": False, "reason": st}
    if m.get("start_date") and m["start_date"] > today:
        return {"ok": False, "reason": "not_started"}
    if m.get("renews_on") and m["renews_on"] <= today and m["plan"]["period"] != "pack":
        return {"ok": False, "reason": "due"}
    if m.get("renews_on") and m["renews_on"] <= today and m["plan"]["period"] == "pack":
        return {"ok": False, "reason": "expired"}
    if m.get("visits_left") is not None and m["visits_left"] <= 0:
        return {"ok": False, "reason": "no_visits"}
    return {"ok": True, "reason": None}


@router.get("/memberships/me/{token}")
async def my_membership(token: str, request: Request):
    """The member's own page: their pass. The token is the credential."""
    check_rate(request, bucket="memberships_me", limit=300, window_seconds=600)
    if not token or len(token) < 16:
        raise HTTPException(status_code=404, detail="This link is not valid")
    m = await db.business_members.find_one({"manage_token": token})
    if not m:
        raise HTTPException(status_code=404, detail="This link is not valid")
    biz = await db.businesses.find_one({"_id": m["business_id"]}) or {"_id": m["business_id"]}
    return {
        "business": _biz_public(biz), "name": m["name"], "plan": m["plan"], "status": m["status"],
        "start_date": m.get("start_date"), "renews_on": m.get("renews_on"), "visits_left": m.get("visits_left"),
        "visits": m.get("visits", 0), "last_visit_at": m.get("last_visit_at"),
        "stamps": m.get("stamps", 0), "rewards": m.get("rewards", 0),
        "checkin_url": f"{_frontend_url()}/members/checkin/{m['checkin_code']}",
        "short_code": m["short_code"], "state": _member_state(m), "discount": m.get("discount"),
    }


# ---------------------------------------------------------------------------
# the business's member list
# ---------------------------------------------------------------------------

def _member_out(m: dict[str, Any]) -> dict[str, Any]:
    return {"id": m["_id"], "name": m["name"], "phone": m.get("phone"), "email": m.get("email"), "note": m.get("note"),
            "plan_id": m.get("plan_id"), "plan": m["plan"], "status": m["status"], "start_date": m.get("start_date"),
            "renews_on": m.get("renews_on"), "visits_left": m.get("visits_left"), "visits": m.get("visits", 0),
            "last_visit_at": m.get("last_visit_at"), "short_code": m.get("short_code"),
            "state": _member_state(m), "created_at": m.get("created_at"), "source": m.get("source"),
            "answers": m.get("answers") or [], "discount": m.get("discount"),
            "stamps": m.get("stamps", 0), "rewards": m.get("rewards", 0)}


@router.get("/businesses/{business_id}/members")
async def list_members(business_id: str, status: Optional[str] = Query(None, pattern="^(pending|active|paused|cancelled|expired|due)$"),
                       user=Depends(verify_token)):
    from utils.business_access import can
    await _owned_business(business_id, user, "checkin")
    full = await can(db, business_id, user, "members")
    rows = await db.business_members.find({"business_id": business_id}).sort("created_at", -1).to_list(2000)
    out = [_member_out(m) for m in rows]
    if not full:
        # Check-in only: who they are and whether they may come in.
        keep = ("id", "name", "plan", "status", "renews_on", "visits_left", "visits", "last_visit_at", "short_code", "state", "stamps")
        out = [{k: m[k] for k in keep} for m in out]
    counts: dict[str, int] = {s: 0 for s in (*STATUSES, "due")}
    for m in out:
        counts[m["status"]] = counts.get(m["status"], 0) + 1
        if m["status"] == "active" and m["state"]["reason"] in ("due", "expired", "no_visits"):
            counts["due"] += 1
    if status == "due":
        out = [m for m in out if m["status"] == "active" and m["state"]["reason"] in ("due", "expired", "no_visits")]
    elif status:
        out = [m for m in out if m["status"] == status]
    return {"members": out, "counts": counts}


class MemberAddIn(BaseModel):
    """A member the business adds by hand (someone who joined at the desk)."""
    plan_id: str
    name: str = Field(..., min_length=2, max_length=80)
    phone: str = Field(..., min_length=7, max_length=20)
    email: Optional[str] = Field(None, max_length=200)
    start_date: Optional[date] = None
    active: bool = True


def _activation(plan: dict[str, Any], start: date) -> dict[str, Any]:
    end = _period_end(start, plan["period"], plan.get("valid_months"))
    # A punch card counts up to its reward instead of down.
    card = plan["period"] == "card"
    return {"status": "active", "start_date": start.isoformat(), "renews_on": end.isoformat() if end else None,
            "visits_left": None if card else plan.get("visits")}


@router.post("/businesses/{business_id}/members")
async def add_member(business_id: str, body: MemberAddIn, user=Depends(verify_token)):
    biz = await _owned_business(business_id, user)
    plan = await db.membership_plans.find_one({"_id": body.plan_id, "business_id": business_id, "deleted": {"$ne": True}})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    start = body.start_date or _today()
    pc = _plan_copy(plan)
    doc = {
        "_id": str(uuid.uuid4()), "business_id": business_id, "owner_user_id": biz["owner_user_id"],
        "plan_id": plan["_id"], "plan": pc, "name": body.name.strip(),
        "phone": "".join(ch for ch in body.phone if ch.isdigit() or ch == "+"), "email": body.email or None,
        "status": "pending", "start_date": start.isoformat(), "renews_on": None, "visits_left": None,
        **(_activation(pc, start) if body.active else {}),
        "manage_token": secrets.token_urlsafe(16), "checkin_code": secrets.token_urlsafe(12),
        "short_code": await _new_short_code(business_id), "visits": 0, "last_visit_at": None, "source": "manual",
        "created_at": _now_iso(), "history": [{"at": _now_iso(), "event": "added"}],
    }
    await db.business_members.insert_one(doc)
    if doc["status"] == "active":
        from .member_messages import on_activated
        await on_activated(business_id, doc)
    return {**_member_out(doc), "manage_url": f"{_frontend_url()}/members/{doc['manage_token']}"}


class MemberActionIn(BaseModel):
    action: Literal["activate", "renew", "pause", "resume", "cancel"]
    start_date: Optional[date] = None


@router.post("/businesses/{business_id}/members/{member_id}/action")
async def member_action(business_id: str, member_id: str, body: MemberActionIn, user=Depends(verify_token)):
    """activate: they paid, the membership starts. renew: they paid the next
    period (it continues from where the last one ended, or from today if it
    had lapsed). pause/resume/cancel do what they say."""
    await _owned_business(business_id, user)
    m = await db.business_members.find_one({"_id": member_id, "business_id": business_id})
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    plan, today, sets = m["plan"], _today(), {}
    if body.action == "activate":
        start = body.start_date or (date.fromisoformat(m["start_date"]) if m.get("start_date") else today)
        sets = _activation(plan, max(start, today) if m["status"] == "pending" else start)
    elif body.action == "renew":
        cur = date.fromisoformat(m["renews_on"]) if m.get("renews_on") else today
        start = cur if cur > today else today
        end = _period_end(start, plan["period"], plan.get("valid_months"))
        sets = {"status": "active", "renews_on": end.isoformat() if end else None, "visits_left": plan.get("visits")}
        if plan["period"] == "pack" and m.get("visits_left") and plan.get("visits"):
            sets["visits_left"] = m["visits_left"] + plan["visits"]   # unused visits carry over
    elif body.action == "pause":
        sets = {"status": "paused"}
    elif body.action == "resume":
        sets = {"status": "active"}
    elif body.action == "cancel":
        sets = {"status": "cancelled"}
    m = await db.business_members.find_one_and_update(
        {"_id": member_id}, {"$set": {**sets, "updated_at": _now_iso()},
                             "$push": {"history": {"at": _now_iso(), "event": body.action}}}, return_document=True)
    if body.action == "activate":
        # The welcome message (member_messages.py): the business can switch
        # it off or reword it; it carries the membership pass.
        from .member_messages import on_activated
        await on_activated(business_id, m)
    return _member_out(m)


@router.get("/businesses/{business_id}/members/{member_id}/link")
async def member_link(business_id: str, member_id: str, user=Depends(verify_token)):
    """The member's own link, for the business to send on WhatsApp."""
    await _owned_business(business_id, user)
    m = await db.business_members.find_one({"_id": member_id, "business_id": business_id}, {"manage_token": 1})
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"url": f"{_frontend_url()}/members/{m['manage_token']}"}


# ---------------------------------------------------------------------------
# check-in at the door
# ---------------------------------------------------------------------------

async def _checkin(biz: dict[str, Any], m: Optional[dict[str, Any]], by: str) -> dict[str, Any]:
    if not m or m["business_id"] != biz["_id"]:
        return {"ok": False, "reason": "not_found"}
    state = _member_state(m)
    base = {"name": m["name"], "plan": m["plan"]["name"], "renews_on": m.get("renews_on")}
    if not state["ok"]:
        return {**base, "ok": False, "reason": state["reason"], "visits_left": m.get("visits_left")}
    inc: dict[str, int] = {"visits": 1}
    card = m["plan"]["period"] == "card"
    if card:
        inc["stamps"] = 1
    elif m.get("visits_left") is not None:
        inc["visits_left"] = -1
    m = await db.business_members.find_one_and_update(
        {"_id": m["_id"]}, {"$inc": inc, "$set": {"last_visit_at": _now_iso()}}, return_document=True)
    reward = None
    need = int(m["plan"].get("visits") or 0)
    if card and need and m.get("stamps", 0) >= need:
        # The visit that fills the card earns the reward and starts a new
        # card. Conditional, so two scans at once cannot earn it twice.
        r = await db.business_members.find_one_and_update(
            {"_id": m["_id"], "stamps": {"$gte": need}}, {"$inc": {"stamps": -need, "rewards": 1}}, return_document=True)
        if r:
            m, reward = r, m["plan"].get("reward") or "reward"
    await db.member_checkins.insert_one({"_id": str(uuid.uuid4()), "business_id": biz["_id"], "member_id": m["_id"],
                                         "at": _now_iso(), "by": by})
    # A class they booked around now is marked attended (classes.py).
    from .classes import mark_attended
    cls = await mark_attended(m["_id"])
    return {**base, "ok": True, "reason": None, "visits_left": m.get("visits_left"), "visits": m.get("visits"), "class": cls,
            "stamps": m.get("stamps") if card else None, "stamps_needed": need if card else None, "reward": reward}


@router.get("/businesses/{business_id}/members-door-link")
async def get_door_link(business_id: str, user=Depends(verify_token)):
    biz = await _owned_business(business_id, user, "checkin")
    t = biz.get("members_door_token")
    return {"token": t, "url": f"{_frontend_url()}/members/door/{t}" if t else None}


@router.post("/businesses/{business_id}/members-door-link")
async def make_door_link(business_id: str, rotate: bool = False, user=Depends(verify_token)):
    """Create the door link, or return it. rotate=true replaces it and the
    old one stops working at once (a staff member left)."""
    biz = await _owned_business(business_id, user)
    t = biz.get("members_door_token")
    if not t or rotate:
        t = secrets.token_urlsafe(24)
        await db.businesses.update_one({"_id": business_id}, {"$set": {"members_door_token": t}})
    return {"token": t, "url": f"{_frontend_url()}/members/door/{t}"}


async def _door_business(token: str) -> dict[str, Any]:
    if not token or len(token) < 20:
        raise HTTPException(status_code=404, detail="This link is not valid")
    biz = await db.businesses.find_one({"members_door_token": token})
    if not biz or not biz.get("active", True):
        raise HTTPException(status_code=404, detail="This link is not valid")
    return biz


@router.get("/memberships/door/{token}")
async def door(token: str, request: Request):
    check_rate(request, bucket="memberships_door", limit=600, window_seconds=600)
    biz = await _door_business(token)
    today = _today().isoformat()
    n = await db.member_checkins.count_documents({"business_id": biz["_id"], "at": {"$gte": today}})
    return {"business": _biz_public(biz), "checkins_today": n}


class DoorCheckinIn(BaseModel):
    code: str = Field(..., min_length=4, max_length=40)


@router.post("/memberships/door/{token}/checkin")
async def door_checkin(token: str, body: DoorCheckinIn, request: Request):
    """`code` is the QR's check-in code or the 5-letter code a member reads out."""
    check_rate(request, bucket="memberships_door", limit=600, window_seconds=600)
    biz = await _door_business(token)
    code = body.code.strip()
    if len(code) <= 6:
        m = await db.business_members.find_one({"business_id": biz["_id"], "short_code": code.upper()})
    else:
        m = await db.business_members.find_one({"checkin_code": code})
    return await _checkin(biz, m, "door")


@router.post("/businesses/{business_id}/members/{member_id}/checkin")
async def owner_checkin(business_id: str, member_id: str, user=Depends(verify_token)):
    biz = await _owned_business(business_id, user, "checkin")
    m = await db.business_members.find_one({"_id": member_id, "business_id": business_id})
    return await _checkin(biz, m, user["user_id"])

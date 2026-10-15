"""Staff accounts (Tzvi, 15 Oct 2026: the Shopify idea, "staff accounts").

The owner invites someone by email and picks the areas they may open
(utils/business_access.py PERMS): a manager gets them all, front desk gets
Orders and Members, or any mix. The invite is a link; the person signs in
or creates an account with THAT email and accepts. From then their
dashboard shows those areas for that business, and nothing else of it.

Only the owner manages staff. Staff never see this list, the business's
own details, or each other's permissions. Removing someone takes effect on
their next request: every staff check reads this collection, nothing is
cached in their sign-in.
"""
from __future__ import annotations

import html
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from routes.deps import db, logger, verify_token
from utils.business_access import PERMS, business_access
from utils.rate_limit import check_rate

from .orders import _email, _frontend_url

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
MAX_STAFF = 20


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_perms(perms: list[str]) -> list[str]:
    want = set(perms)
    if "messages" in want:
        want.add("customers")       # the email composer lives in the customer list
    if "members" in want:
        want.discard("checkin")     # already part of members
    out = [p for p in PERMS if p in want]
    if not out:
        raise HTTPException(status_code=422, detail="Choose at least one area they can open")
    return out


def _out(s: dict[str, Any], user: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    return {"id": s["_id"], "email": s["email"], "name": (user or {}).get("name") or s.get("name"),
            "permissions": s.get("permissions") or [], "status": s.get("status"),
            "invited_at": s.get("invited_at"), "accepted_at": s.get("accepted_at")}


class InviteIn(BaseModel):
    email: str = Field(..., min_length=5, max_length=200)
    name: Optional[str] = Field(None, max_length=80)
    permissions: list[str] = Field(..., min_length=1, max_length=len(PERMS))
    lang: str = Field("en", pattern="^(en|he)$")


class PermsIn(BaseModel):
    permissions: list[str] = Field(..., min_length=1, max_length=len(PERMS))


@router.get("/businesses/{business_id}/staff")
async def list_staff(business_id: str, user=Depends(verify_token)):
    await business_access(db, business_id, user, None)
    rows = await db.business_staff.find({"business_id": business_id, "status": {"$ne": "removed"}}).sort("invited_at", 1).to_list(100)
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": [r["user_id"] for r in rows if r.get("user_id")]}}, {"id": 1, "name": 1})}
    return [_out(r, users.get(r.get("user_id"))) for r in rows]


@router.post("/businesses/{business_id}/staff")
async def invite_staff(business_id: str, body: InviteIn, user=Depends(verify_token)):
    biz = await business_access(db, business_id, user, None)
    email = body.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="Please check the email address")
    owner = await db.users.find_one({"id": biz["owner_user_id"]}, {"email": 1})
    if (owner or {}).get("email", "").lower() == email:
        raise HTTPException(status_code=400, detail="That is your own email: you already have every area")
    perms = _clean_perms(body.permissions)
    if await db.business_staff.count_documents({"business_id": business_id, "status": {"$ne": "removed"}}) >= MAX_STAFF:
        raise HTTPException(status_code=400, detail=f"A business can have up to {MAX_STAFF} staff")
    existing = await db.business_staff.find_one({"business_id": business_id, "email": email, "status": {"$ne": "removed"}})
    if existing:
        raise HTTPException(status_code=409, detail="This person is already on your staff list")
    token = secrets.token_urlsafe(24)
    doc = {"_id": str(uuid.uuid4()), "business_id": business_id, "email": email, "name": (body.name or "").strip() or None,
           "permissions": perms, "status": "invited", "invite_token": token, "invited_by": user["user_id"],
           "invited_at": _now(), "user_id": None, "lang": body.lang}
    await db.business_staff.insert_one(doc)
    link = f"{_frontend_url()}/staff/join/{token}"
    he = body.lang == "he"
    name = html.escape(biz.get("name") or "")
    await _email(email, f"{biz.get('name')}: {'הזמנה לצוות' if he else 'you are invited to join the team'}",
                 (f"<p>{name} הזמינו אתכם להצטרף לצוות שלהם ב-MyIsraelRental.</p><p>היכנסו או צרו חשבון עם כתובת המייל הזו ואשרו את ההזמנה.</p>"
                  if he else
                  f"<p>{name} invited you to join their team on MyIsraelRental.</p><p>Sign in or create an account with this email address and accept the invite.</p>"),
                 tag="staff-invite", button=("לאישור ההזמנה" if he else "Accept the invite", link))
    logger.info("[staff] invite business=%s perms=%s", business_id, perms)
    return {**_out(doc), "invite_url": link}


@router.patch("/businesses/{business_id}/staff/{staff_id}")
async def update_staff(business_id: str, staff_id: str, body: PermsIn, user=Depends(verify_token)):
    await business_access(db, business_id, user, None)
    r = await db.business_staff.find_one_and_update(
        {"_id": staff_id, "business_id": business_id, "status": {"$ne": "removed"}},
        {"$set": {"permissions": _clean_perms(body.permissions), "updated_at": _now()}}, return_document=True)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    return _out(r)


@router.delete("/businesses/{business_id}/staff/{staff_id}")
async def remove_staff(business_id: str, staff_id: str, user=Depends(verify_token)):
    """Effective at once: their next request is refused."""
    await business_access(db, business_id, user, None)
    r = await db.business_staff.update_one({"_id": staff_id, "business_id": business_id},
                                           {"$set": {"status": "removed", "removed_at": _now()}, "$unset": {"invite_token": ""}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


async def _invite(token: str) -> dict[str, Any]:
    if not token or len(token) < 20:
        raise HTTPException(status_code=404, detail="This invite is not valid")
    s = await db.business_staff.find_one({"invite_token": token, "status": {"$in": ["invited", "active"]}})
    if not s:
        raise HTTPException(status_code=404, detail="This invite is not valid")
    return s


@router.get("/staff/invite/{token}")
async def invite_info(token: str, request: Request):
    check_rate(request, bucket="staff_invite", limit=60, window_seconds=600)
    s = await _invite(token)
    biz = await db.businesses.find_one({"_id": s["business_id"]}, {"name": 1, "name_he": 1, "logo_url": 1}) or {}
    return {"business": {"name": biz.get("name"), "name_he": biz.get("name_he"), "logo_url": biz.get("logo_url")},
            "email": s["email"], "permissions": s["permissions"], "status": s["status"]}


@router.post("/staff/invite/{token}/accept")
async def accept_invite(token: str, request: Request, user=Depends(verify_token)):
    check_rate(request, bucket="staff_invite", limit=60, window_seconds=600)
    s = await _invite(token)
    me = await db.users.find_one({"id": user["user_id"]}, {"email": 1}) or {}
    if (me.get("email") or "").lower() != s["email"]:
        # The link alone is not enough: it is for the person it was sent to.
        raise HTTPException(status_code=403, detail=f"This invite is for {s['email']}. Sign in with that email to accept it.")
    if s["status"] != "active":
        await db.business_staff.update_one({"_id": s["_id"]}, {"$set": {"status": "active", "user_id": user["user_id"], "accepted_at": _now()}})
    return {"ok": True, "business_id": s["business_id"]}


@router.get("/my-workplaces")
async def my_workplaces(perm: Optional[str] = Query(None, max_length=20), user=Depends(verify_token)):
    """The businesses this person can open `perm` on: their own (every
    area) and those they are staff at with that area. What each dashboard
    tab lists in its business picker."""
    out = []
    async for b in db.businesses.find({"owner_user_id": user["user_id"]}, {"name": 1, "name_he": 1, "slug": 1, "active": 1, "logo_url": 1}):
        out.append({"id": b["_id"], "name": b.get("name"), "name_he": b.get("name_he"), "slug": b.get("slug"),
                    "active": b.get("active", True), "role": "owner", "permissions": list(PERMS)})
    staff = await db.business_staff.find({"user_id": user["user_id"], "status": "active"}).to_list(100)
    from utils.business_access import has
    ids = [s["business_id"] for s in staff if not perm or has(perm, s.get("permissions") or [])]
    perms = {s["business_id"]: s.get("permissions") or [] for s in staff}
    async for b in db.businesses.find({"_id": {"$in": ids}, "active": {"$ne": False}}, {"name": 1, "name_he": 1, "slug": 1, "logo_url": 1}):
        out.append({"id": b["_id"], "name": b.get("name"), "name_he": b.get("name_he"), "slug": b.get("slug"),
                    "active": True, "role": "staff", "permissions": perms[b["_id"]]})
    return out


async def staff_summary(user_id: str) -> list[str]:
    """Every area this person has as staff, anywhere: which dashboard tabs to show."""
    perms: set[str] = set()
    async for s in db.business_staff.find({"user_id": user_id, "status": "active"}, {"permissions": 1}):
        perms.update(s.get("permissions") or [])
    return sorted(perms)


async def ensure_staff_indexes() -> None:
    await db.business_staff.create_index([("business_id", 1), ("email", 1)])
    await db.business_staff.create_index([("user_id", 1), ("status", 1)])
    await db.business_staff.create_index("invite_token", unique=True, sparse=True)

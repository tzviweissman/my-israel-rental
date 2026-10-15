"""A business's customer list (Tzvi, 15 Oct 2026: the Shopify customer list).

One row per person who has dealt with the business, however they came:

  * orders     (store_orders)
  * members    (business_members, memberships.py)
  * bookings   (marketplace_bookings on this business's listings)
  * imported   (store_customers, the CSV import in orders.py)

People are matched by phone number (normalised to +972...), else email,
else name, so "Dana 054-1234567" who ordered a cake and later joined the
gym is one customer. Nothing is copied: the list is worked out from those
records each time, and the only thing stored here is what the business
adds itself (a note and tags), kept on the same `store_customers`
document the import uses, keyed the same way.

Only ever this business's own records. There is no lookup across
businesses: a customer of the bakery is not visible to the gym next door.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from routes.deps import db, verify_token
from utils.whatsapp_link import normalize_whatsapp_number

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

_TAG = re.compile(r"^[^\s,][^,]{0,29}$")


async def _owned(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """The owner, an admin, or staff with the Customers area (utils/business_access.py)."""
    from utils.business_access import business_access
    return await business_access(db, business_id, user, "customers")


def customer_key(phone: Optional[str], email: Optional[str], name: Optional[str]) -> Optional[str]:
    """Same key the import uses: the +972 number, else the email, else the
    lowercased name."""
    e164 = normalize_whatsapp_number(phone) if phone else None
    if e164:
        return e164
    if email and "@" in email:
        return email.strip().lower()
    return (name or "").strip().lower() or None


def _blank(key: str) -> dict[str, Any]:
    return {"key": key, "name": None, "phone": None, "email": None, "address": None,
            "orders": 0, "spent": 0.0, "currency": "ILS", "last_order_at": None,
            "membership": None, "bookings": 0, "last_booking_at": None,
            "first_seen": None, "last_seen": None, "note": None, "tags": [], "imported": False}


def _seen(c: dict[str, Any], at: Optional[str]) -> None:
    if not at:
        return
    if not c["first_seen"] or at < c["first_seen"]:
        c["first_seen"] = at
    if not c["last_seen"] or at > c["last_seen"]:
        c["last_seen"] = at


async def _gig_ids(business_id: str) -> list[str]:
    return [g["_id"] async for g in db.marketplace_gigs.find({"business_id": business_id}, {"_id": 1})]


async def build_customers(business_id: str) -> dict[str, dict[str, Any]]:
    people: dict[str, dict[str, Any]] = {}

    def get(key: str) -> dict[str, Any]:
        if key not in people:
            people[key] = _blank(key)
        return people[key]

    async for o in db.store_orders.find({"business_id": business_id, "status": {"$ne": "cancelled"}},
                                        {"customer_name": 1, "customer_phone": 1, "customer_email": 1, "address": 1,
                                         "total": 1, "currency": 1, "created_at": 1}).sort("created_at", 1):
        key = customer_key(o.get("customer_phone"), o.get("customer_email"), o.get("customer_name"))
        if not key:
            continue
        c = get(key)
        c["name"] = o.get("customer_name") or c["name"]          # the latest wins
        c["phone"] = o.get("customer_phone") or c["phone"]
        c["email"] = o.get("customer_email") or c["email"]
        c["address"] = o.get("address") or c["address"]
        c["orders"] += 1
        c["spent"] += float(o.get("total") or 0)
        c["currency"] = o.get("currency") or c["currency"]
        c["last_order_at"] = o.get("created_at")
        _seen(c, o.get("created_at"))

    async for m in db.business_members.find({"business_id": business_id}).sort("created_at", 1):
        key = customer_key(m.get("phone"), m.get("email"), m.get("name"))
        if not key:
            continue
        c = get(key)
        c["name"] = c["name"] or m.get("name")
        c["phone"] = c["phone"] or m.get("phone")
        c["email"] = c["email"] or m.get("email")
        # Their most recent membership is the one that matters.
        c["membership"] = {"status": m.get("status"), "plan": (m.get("plan") or {}).get("name"),
                           "renews_on": m.get("renews_on"), "visits": m.get("visits", 0), "member_id": m["_id"]}
        _seen(c, m.get("created_at"))
        _seen(c, m.get("last_visit_at"))

    gigs = await _gig_ids(business_id)
    if gigs:
        users: dict[str, dict[str, Any]] = {}
        async for b in db.marketplace_bookings.find({"gig_id": {"$in": gigs}}).sort("created_at", 1):
            name, email = b.get("guest_name"), b.get("contact_email")
            if b.get("client_user_id"):
                u = users.get(b["client_user_id"])
                if u is None:
                    u = await db.users.find_one({"id": b["client_user_id"]}, {"name": 1, "email": 1}) or {}
                    users[b["client_user_id"]] = u
                name, email = name or u.get("name"), email or u.get("email")
            key = customer_key(b.get("contact_phone"), email, name)
            if not key:
                continue
            c = get(key)
            c["name"] = c["name"] or name
            c["phone"] = c["phone"] or b.get("contact_phone")
            c["email"] = c["email"] or email
            c["bookings"] += 1
            c["last_booking_at"] = b.get("created_at")
            _seen(c, b.get("created_at"))

    async for s in db.store_customers.find({"business_id": business_id}):
        c = people.get(s["key"])
        if c is None:
            if s.get("source") != "import" and not s.get("note") and not s.get("tags"):
                continue        # a note-holder whose customer has no records left
            c = get(s["key"])
            c["imported"] = s.get("source") == "import"
            _seen(c, s.get("created_at"))
        c["name"] = c["name"] or s.get("customer_name")
        c["phone"] = c["phone"] or s.get("customer_phone")
        c["address"] = c["address"] or s.get("address")
        c["note"] = s.get("note")
        c["tags"] = s.get("tags") or []

    for c in people.values():
        c["spent"] = round(c["spent"], 2)
    return people


def _matches(c: dict[str, Any], q: str, tag: str, kind: str) -> bool:
    if tag and tag not in c["tags"]:
        return False
    if kind == "orders" and not c["orders"]:
        return False
    if kind == "members" and not c["membership"]:
        return False
    if kind == "active_members" and (c["membership"] or {}).get("status") != "active":
        return False
    if kind == "bookings" and not c["bookings"]:
        return False
    if q:
        hay = " ".join(str(c.get(k) or "") for k in ("name", "email", "note")).lower() + " " + " ".join(c["tags"]).lower()
        digits = "".join(ch for ch in q if ch.isdigit())
        if q not in hay and not (digits and len(digits) >= 3 and digits in "".join(ch for ch in (c["phone"] or "") if ch.isdigit())):
            return False
    return True


@router.get("/businesses/{business_id}/customer-list")
async def customer_list(
    business_id: str,
    q: str = Query("", max_length=80),
    tag: str = Query("", max_length=30),
    kind: str = Query("", pattern="^(|orders|members|active_members|bookings)$"),
    sort: str = Query("recent", pattern="^(recent|spent|name)$"),
    user=Depends(verify_token),
):
    await _owned(business_id, user)
    people = list((await build_customers(business_id)).values())
    tags = sorted({t for c in people for t in c["tags"]})
    totals = {"customers": len(people), "with_orders": sum(1 for c in people if c["orders"]),
              "active_members": sum(1 for c in people if (c["membership"] or {}).get("status") == "active"),
              "with_bookings": sum(1 for c in people if c["bookings"])}
    rows = [c for c in people if _matches(c, q.strip().lower(), tag, kind)]
    if sort == "spent":
        rows.sort(key=lambda c: c["spent"], reverse=True)
    elif sort == "name":
        rows.sort(key=lambda c: (c["name"] or "").lower())
    else:
        rows.sort(key=lambda c: c["last_seen"] or "", reverse=True)
    return {"customers": rows[:1000], "count": len(rows), "tags": tags, "totals": totals}


@router.get("/businesses/{business_id}/customer-list/detail")
async def customer_detail(business_id: str, key: str = Query(..., min_length=1, max_length=200), user=Depends(verify_token)):
    """Everything this business has for one customer, newest first."""
    await _owned(business_id, user)
    people = await build_customers(business_id)
    c = people.get(key)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    orders, members, bookings = [], [], []
    async for o in db.store_orders.find({"business_id": business_id}).sort("created_at", -1).limit(500):
        if customer_key(o.get("customer_phone"), o.get("customer_email"), o.get("customer_name")) == key:
            orders.append({"id": o["_id"], "items": o.get("items"), "total": o.get("total"), "currency": o.get("currency") or "ILS",
                           "status": o.get("status"), "needed_by": o.get("needed_by"), "created_at": o.get("created_at"),
                           "answers": o.get("answers") or []})
            if len(orders) >= 30:
                break
    async for m in db.business_members.find({"business_id": business_id}).sort("created_at", -1):
        if customer_key(m.get("phone"), m.get("email"), m.get("name")) == key:
            members.append({"id": m["_id"], "plan": (m.get("plan") or {}).get("name"), "status": m.get("status"),
                            "start_date": m.get("start_date"), "renews_on": m.get("renews_on"), "visits": m.get("visits", 0),
                            "visits_left": m.get("visits_left"), "answers": m.get("answers") or []})
    gigs = await _gig_ids(business_id)
    if gigs:
        async for b in db.marketplace_bookings.find({"gig_id": {"$in": gigs}}).sort("created_at", -1).limit(500):
            name, email = b.get("guest_name"), b.get("contact_email")
            if b.get("client_user_id") and not (name and email):
                u = await db.users.find_one({"id": b["client_user_id"]}, {"name": 1, "email": 1}) or {}
                name, email = name or u.get("name"), email or u.get("email")
            if customer_key(b.get("contact_phone"), email, name) == key:
                bookings.append({"id": b["_id"], "tier_name": b.get("tier_name"), "status": b.get("status"),
                                 "preferred_date": b.get("preferred_date"), "time_slot": b.get("time_slot"),
                                 "created_at": b.get("created_at")})
                if len(bookings) >= 30:
                    break
    return {"customer": c, "orders": orders, "memberships": members, "bookings": bookings}


class CustomerEditIn(BaseModel):
    key: str = Field(..., min_length=1, max_length=200)
    note: Optional[str] = Field(None, max_length=2000)
    tags: Optional[list[str]] = Field(None, max_length=20)


@router.patch("/businesses/{business_id}/customer-list")
async def edit_customer(business_id: str, body: CustomerEditIn, user=Depends(verify_token)):
    """The business's own note and tags for one customer."""
    await _owned(business_id, user)
    sets: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.note is not None:
        sets["note"] = body.note.strip() or None
    if body.tags is not None:
        tags = []
        for t in body.tags:
            t = " ".join(t.split())
            if t and _TAG.match(t) and t not in tags:
                tags.append(t)
        sets["tags"] = tags
    people = await build_customers(business_id)
    c = people.get(body.key)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    import uuid
    await db.store_customers.update_one(
        {"business_id": business_id, "key": body.key},
        {"$set": sets, "$setOnInsert": {"_id": str(uuid.uuid4()), "created_at": sets["updated_at"], "source": "notes",
                                        "customer_name": c["name"], "customer_phone": c["phone"]}},
        upsert=True,
    )
    c.update({k: v for k, v in sets.items() if k in ("note", "tags")})
    return c


@router.get("/businesses/{business_id}/customer-list/export.csv")
async def export_customers(business_id: str, user=Depends(verify_token)):
    await _owned(business_id, user)
    people = sorted((await build_customers(business_id)).values(), key=lambda c: (c["name"] or "").lower())
    buf = io.StringIO()
    buf.write("﻿")   # Excel opens Hebrew correctly only with the BOM
    w = csv.writer(buf)
    w.writerow(["Name", "Phone", "Email", "Address", "Orders", "Spent", "Membership", "Membership status", "Bookings",
                "First seen", "Last seen", "Tags", "Note"])
    for c in people:
        m = c["membership"] or {}
        w.writerow([c["name"] or "", c["phone"] or "", c["email"] or "", c["address"] or "", c["orders"], c["spent"],
                    m.get("plan") or "", m.get("status") or "", c["bookings"], (c["first_seen"] or "")[:10],
                    (c["last_seen"] or "")[:10], ", ".join(c["tags"]), c["note"] or ""])
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv; charset=utf-8",
                             headers={"Content-Disposition": 'attachment; filename="customers.csv"'})

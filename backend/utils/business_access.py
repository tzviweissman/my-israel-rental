"""Who may open a business's screens: its owner, an admin, or a member of
its staff with that area switched on (routes/marketplace/staff.py; Tzvi,
15 Oct 2026: staff accounts).

Areas (one permission each):

    orders      the order board and everything in Orders
    members     membership plans, the member list, check-in, the door link
    checkin     check-in only: open the door screen, find a member and
                check them in. Sees names and membership state, never
                phone numbers, emails or answers. "members" includes it.
    customers   the customer list, notes and tags
    messages    emailing customers
    discounts   discount codes
    summary     the sales summary and order insights

Never a staff permission: managing staff, the business's own details,
deleting it. Those stay with the owner (the owner-only helpers in each
module are unchanged for them).
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import HTTPException

PERMS = ("orders", "members", "checkin", "customers", "messages", "discounts", "summary")
# An area that includes another: whoever manages members can check them in.
_INCLUDES = {"checkin": "members"}


async def staff_perms(db: Any, business_id: str, user_id: str) -> list[str]:
    s = await db.business_staff.find_one({"business_id": business_id, "user_id": user_id, "status": "active"}, {"permissions": 1})
    return list((s or {}).get("permissions") or [])


async def business_access(db: Any, business_id: str, user: dict[str, Any], perm: Optional[str] = None) -> dict[str, Any]:
    """The business, if this user may open `perm` on it; else 404/403.
    perm=None means owner (or admin) only."""
    biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    if biz.get("owner_user_id") == user["user_id"] or user.get("role") == "admin":
        return biz
    if perm and has(perm, await staff_perms(db, business_id, user["user_id"])):
        return biz
    raise HTTPException(status_code=403, detail="Not your business")


def has(perm: str, perms: list[str]) -> bool:
    return perm in perms or (perm in _INCLUDES and _INCLUDES[perm] in perms)


async def can(db: Any, business_id: str, user: dict[str, Any], perm: str) -> bool:
    try:
        await business_access(db, business_id, user, perm)
        return True
    except HTTPException:
        return False

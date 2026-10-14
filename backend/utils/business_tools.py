"""Which business tools a person's dashboard shows (Tzvi, 14 Oct 2026: the
Shopify idea, "turn tools on by type of business").

A gym opens on Members, a bakery on Orders, a cleaner on Appointments;
everything else waits in Dashboard > Tools until they switch it on. The
rule for each tool, in order:

  1. The person's own choice, if they made one (users.dashboard_tools).
  2. On if it is already in use. Something with records in it is never
     hidden by a guess about what the business is.
  3. On if it suits what they sell: their listings' types (a store
     listing takes orders, an appointment listing takes bookings) and the
     categories of their businesses and listings.

`my-businesses` is not a tool: it is where the business itself lives and
is always shown.
"""
from __future__ import annotations

from typing import Any

TOOLS = ("orders", "members", "appointments", "job-requests", "network")

# What each kind of business usually needs. Categories are the service
# marketplace slugs (routes/marketplace/shared.py CATEGORIES).
_BY_CATEGORY: dict[str, set[str]] = {
    "health-fitness": {"members", "appointments"},
    "education-tutoring": {"members", "appointments"},
    "childcare-babysitting": {"members", "appointments"},
    "personal-care": {"appointments", "members"},
    "events-catering": {"orders", "appointments"},
    "shops-products": {"orders"},
    "home-services-repair": {"appointments", "job-requests"},
    "cleaning-services": {"appointments", "job-requests"},
    "moving-relocation": {"appointments", "job-requests"},
    "it-tech-support": {"appointments", "job-requests"},
    "pet-services": {"appointments", "job-requests"},
    "creative-design": {"appointments", "job-requests"},
    "business-financial": {"appointments", "job-requests"},
    "transportation": {"appointments", "job-requests"},
    "vehicles": {"appointments", "job-requests"},
    "real-estate-services": {"appointments", "job-requests"},
    "travel-tourism": {"appointments", "orders"},
    "insurance": {"appointments"},
    "money-exchange": {"appointments"},
}
_BY_GIG_TYPE = {"store": {"orders"}, "appointment": {"appointments"}, "deliverable": {"job-requests"}}
# Nothing to go on yet (a new business with no category or listing): the
# two tools almost everyone uses.
_FALLBACK = {"orders", "appointments"}


async def business_tools(db: Any, uid: str) -> dict[str, Any]:
    """{"tools": {tool: shown}, "recommended": [...], "in_use": [...], "chosen": {...}}"""
    me = await db.users.find_one({"id": uid}, {"dashboard_tools": 1}) or {}
    chosen = {k: bool(v) for k, v in (me.get("dashboard_tools") or {}).items() if k in TOOLS}

    cats: set[str] = set()
    async for b in db.businesses.find({"owner_user_id": uid}, {"categories": 1}):
        cats.update(b.get("categories") or [])
    types: set[str] = set()
    async for g in db.marketplace_gigs.find({"provider_user_id": uid}, {"category": 1, "gig_type": 1}):
        if g.get("category"):
            cats.add(g["category"])
        if g.get("gig_type"):
            types.add(g["gig_type"])
    rec: set[str] = set()
    for c in cats:
        rec |= _BY_CATEGORY.get(c, set())
    for ty in types:
        rec |= _BY_GIG_TYPE.get(ty, set())
    if not rec:
        rec = set(_FALLBACK)

    used = set()
    if await db.store_orders.count_documents({"owner_user_id": uid}, limit=1):
        used.add("orders")
    if await db.membership_plans.count_documents({"owner_user_id": uid, "deleted": {"$ne": True}}, limit=1) \
            or await db.business_members.count_documents({"owner_user_id": uid}, limit=1):
        used.add("members")
    if await db.marketplace_bookings.count_documents({"provider_user_id": uid}, limit=1):
        used.add("appointments")
    if await db.marketplace_job_applications.count_documents({"provider_user_id": uid}, limit=1):
        used.add("job-requests")
    biz_ids = [b["_id"] async for b in db.businesses.find({"owner_user_id": uid}, {"_id": 1})]
    if biz_ids and await db.business_connections.count_documents(
            {"$or": [{"a_id": {"$in": biz_ids}}, {"b_id": {"$in": biz_ids}}]}, limit=1):
        used.add("network")

    tools = {t: chosen[t] if t in chosen else (t in used or t in rec) for t in TOOLS}
    return {"tools": tools, "recommended": sorted(rec), "in_use": sorted(used), "chosen": chosen}

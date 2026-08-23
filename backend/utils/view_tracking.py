"""View tracking for marketplace entities — services and business pages.

L2 of docs/leads-and-views-spec.md. Properties have had view tracking since
early on; gigs and business pages have never had any, which is why the
"leads and views" dashboard could only ever have answered half the question
for a site whose supply side is mostly not property.

Three decisions, each one avoiding a mistake already made elsewhere in this
codebase:

**One source of truth.** Properties carry BOTH a `properties.views` counter
and a `property_view_events` log, written at the same moment but started at
different times, and they disagree — real data showed all-time 14 against
30-day 93 (see routes/admin/core.py). Every number here is derived from the
event log alone. A counter would be faster to read and is not worth a second
version of the truth.

**`at` is a real datetime, not an ISO string.** `lead_events` stores strings
and `property_view_events` stores datetimes, and mixing the two returns a
confident zero rather than an error — that exact mismatch put `0 new users
in 30 days` on the admin dashboard. Datetime is the correct type; the rule
for anyone reading this collection is that cutoffs are datetimes too.

**The owner's own visits are not recorded.** Not a nicety: an owner checking
their own listing is the single most frequent visitor it has, and counting
them makes the number describe the owner rather than the market. This is
cheaper than the general dedupe problem (L4) because an owner is
authenticated and identifiable, whereas a repeat stranger is not.

**One visitor per entity per day (L4).** A refresh used to be a new view,
which meant a listing looked popular because one person hit reload. The
browser sends an opaque random id (see frontend utils/visitorId) and the
insert is an upsert keyed by entity + visitor + Israel day, made exclusive
by a unique index rather than a read-then-write — two rapid requests would
otherwise both find nothing and both insert.

So the number is VISITORS, not page loads, and the dashboard says visitors.
One person returning on three days still counts three times: that is a real
signal (they came back) and the label is per-period, not "unique people".

A client that sends no id — private mode, storage blocked, an old cached
bundle — is recorded undeduped rather than dropped. A view we cannot
attribute is still a view, and losing it would understate quiet listings
worst of all.
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any, Coroutine, Optional
from zoneinfo import ZoneInfo

from routes.deps import db, logger

# Israel calendar days, matching short-link scans and the leads summary.
# The owner reads these bars in their own timezone.
_IL_TZ = ZoneInfo("Asia/Jerusalem")

ENTITY_GIG = "gig"
ENTITY_BUSINESS = "business"
# Properties keep their OWN, separate stream in `property_view_events` as
# well. That one is deliberately raw — Smart Pricing reads it as a demand
# signal and its own comment says duplicate refreshes are counted on
# purpose, so deduping there would quietly change pricing advice. This
# collection is the owner-facing one: deduped, owner excluded, consistent
# with how services report. Two streams, two different questions.
ENTITY_PROPERTY = "property"
_ENTITY_TYPES = (ENTITY_GIG, ENTITY_BUSINESS, ENTITY_PROPERTY)

COLLECTION = "marketplace_view_events"

# Strong refs so a fire-and-forget write is not garbage collected mid-flight
# (the same trap routes/properties/browse.py documents).
_background_tasks: set = set()


def spawn(coro: Coroutine[Any, Any, Any]) -> None:
    """Fire-and-forget, without letting a failure reach the request."""
    try:
        task = asyncio.create_task(coro)
    except Exception:  # noqa: BLE001 — no running loop (sync test harness)
        coro.close()
        return
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


# An id longer than this is not ours — cap rather than store whatever a
# client chose to send in a header.
_MAX_VISITOR_LEN = 64


async def record_view(
    entity_type: str,
    entity_id: str,
    owner_id: Optional[str],
    viewer_id: Optional[str] = None,
    visitor: Optional[str] = None,
) -> None:
    """Record one visit. Never raises — a lost metric beats a failed page."""
    if entity_type not in _ENTITY_TYPES or not entity_id:
        return
    # The owner looking at their own listing is not demand.
    if viewer_id and owner_id and viewer_id == owner_id:
        return

    now = datetime.now(UTC)
    doc = {
        "entity_type": entity_type,
        "entity_id": entity_id,
        # Denormalised so an owner-scoped query needs no join. The gig or
        # business could later change hands; the event records who owned it
        # when the view happened, which is what an owner's totals should
        # reflect.
        "owner_id": owner_id,
        "at": now,
        "day": il_day_of(now),
    }

    visitor = (visitor or "").strip()[:_MAX_VISITOR_LEN] or None
    try:
        if visitor:
            # Upsert, not check-then-insert: two requests a millisecond
            # apart would both read "absent" and both write. The unique
            # index below is what actually makes this exclusive; the upsert
            # is how we avoid turning that into an error on every refresh.
            await db[COLLECTION].update_one(
                {"entity_id": entity_id, "visitor": visitor, "day": doc["day"]},
                {"$setOnInsert": {**doc, "visitor": visitor}},
                upsert=True,
            )
        else:
            # No id to dedupe on. Recorded anyway — see the module docstring.
            await db[COLLECTION].insert_one({**doc, "visitor": None})
    except Exception:  # noqa: BLE001
        logger.exception("view event insert failed for %s %s", entity_type, entity_id)


def il_day_window(days: int) -> tuple[datetime, list[str]]:
    """(UTC cutoff datetime, Israel day keys oldest-first)."""
    today = datetime.now(_IL_TZ).date()
    start_day = today - timedelta(days=days - 1)
    start_il = datetime.combine(start_day, datetime.min.time(), tzinfo=_IL_TZ)
    keys = [(start_day + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    return start_il.astimezone(UTC), keys


def il_day_of(dt: datetime) -> Optional[str]:
    """The Israel calendar day a stored timestamp falls on."""
    if not isinstance(dt, datetime):
        return None
    if dt.tzinfo is None:          # Mongo hands back naive UTC
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(_IL_TZ).strftime("%Y-%m-%d")


def il_day_of_iso(created_at: object) -> Optional[str]:
    """Israel day for a timestamp stored as an ISO **string**.

    `lead_events` stores strings while this module's own collection stores
    datetimes. Two readers of two collections, one timezone rule — keeping
    the conversion here rather than reimplementing it per caller is how the
    day boundaries stay identical across the panel's two halves.
    """
    try:
        dt = datetime.fromisoformat(str(created_at))
    except (TypeError, ValueError):
        return None
    return il_day_of(dt)


async def view_summary(owner_id: str, days: int, entity_ids: Optional[list[str]] = None) -> dict:
    """Totals, a per-day series and a per-entity breakdown for one owner.

    `entity_ids` restricts to a subset (one business's services, say). An
    empty list means "no entities", which is different from None meaning
    "all of them" — returning everything for an empty filter would silently
    widen the scope the caller asked for.
    """
    base: dict[str, Any] = {"owner_id": owner_id}
    if entity_ids is not None:
        if not entity_ids:
            cutoff, keys = il_day_window(days)
            return {
                "total": 0, "period_total": 0,
                "daily": [{"date": k, "count": 0} for k in keys],
                "since": None, "by_entity": {},
            }
        base["entity_id"] = {"$in": entity_ids}

    total = await db[COLLECTION].count_documents(base)

    since = None
    first = await db[COLLECTION].find(base, {"at": 1}).sort("at", 1).limit(1).to_list(1)
    if first:
        since = il_day_of(first[0].get("at"))

    cutoff, keys = il_day_window(days)
    buckets = {k: 0 for k in keys}
    by_entity: dict[str, int] = {}
    period_total = 0

    cursor = db[COLLECTION].find({**base, "at": {"$gte": cutoff}}, {"at": 1, "entity_id": 1})
    async for ev in cursor:
        day = il_day_of(ev.get("at"))
        # After the UTC→Israel shift an event can fall outside the rendered
        # window; count it only where there is a bar for it.
        if day not in buckets:
            continue
        buckets[day] += 1
        period_total += 1
        eid = ev.get("entity_id")
        if eid:
            by_entity[eid] = by_entity.get(eid, 0) + 1

    return {
        "total": total,
        "period_total": period_total,
        "daily": [{"date": k, "count": buckets[k]} for k in keys],
        "since": since,
        "by_entity": by_entity,
    }


async def ensure_view_indexes() -> None:
    """Indexes matching how this collection is actually queried."""
    await db[COLLECTION].create_index([("owner_id", 1), ("at", -1)], background=True)
    await db[COLLECTION].create_index(
        [("entity_type", 1), ("entity_id", 1), ("at", -1)], background=True,
    )
    # UNIQUE, and the actual guarantee behind "one visit per person per day"
    # — the upsert in record_view is racy on its own. Partial, so the rows
    # with no visitor id (storage blocked, older bundle) are exempt rather
    # than collapsing into a single row per day between them.
    await db[COLLECTION].create_index(
        [("entity_id", 1), ("visitor", 1), ("day", 1)],
        unique=True,
        partialFilterExpression={"visitor": {"$type": "string"}},
        background=True,
    )

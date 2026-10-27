"""How fast a lister answers messages, for the "Usually replies within an
hour" line on a listing (Airbnb's response time).

Read from ``db.messages``: for each conversation (listing + other person),
the time from someone's first unanswered message to the lister's next
message. Automatic away replies (``auto`` set) are not replies. Median of
the last 180 days, shown only from 3 replies on, the same floor the
services badge uses (marketplace/shared.MIN_RESPONSES_FOR_BADGE).
"""
from __future__ import annotations

import statistics
import time
from datetime import UTC, datetime, timedelta

from routes.deps import db

MIN_REPLIES = 3
_CACHE: dict[str, tuple[float, int | None]] = {}
_TTL = 3600  # ponytail: per-process cache, fine at this traffic


def _ts(value) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    try:
        d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=UTC)
    except ValueError:
        return None


def reply_hours(owner_id: str, messages: list[dict]) -> int | None:
    """Median reply time in whole hours (rounded up, minimum 1), or None
    below MIN_REPLIES. ``messages`` sorted oldest first."""
    waiting: dict[tuple, datetime] = {}
    gaps: list[float] = []
    for m in messages:
        at = _ts(m.get("created_at"))
        if at is None:
            continue
        if m.get("sender_id") == owner_id:
            if m.get("auto"):
                continue
            key = (m.get("property_id"), m.get("receiver_id"))
            if key in waiting:
                gaps.append((at - waiting.pop(key)).total_seconds() / 3600)
        else:
            waiting.setdefault((m.get("property_id"), m.get("sender_id")), at)
    if len(gaps) < MIN_REPLIES:
        return None
    return max(1, -int(-statistics.median(gaps) // 1))


async def owner_reply_hours(owner_id: str | None) -> int | None:
    if not owner_id:
        return None
    hit = _CACHE.get(owner_id)
    if hit and time.time() - hit[0] < _TTL:
        return hit[1]
    since = (datetime.now(UTC) - timedelta(days=180)).isoformat()
    msgs = await db.messages.find(
        {"$or": [{"sender_id": owner_id}, {"receiver_id": owner_id}], "created_at": {"$gte": since}},
        {"_id": 0, "sender_id": 1, "receiver_id": 1, "property_id": 1, "created_at": 1, "auto": 1},
    ).sort("created_at", 1).to_list(5000)
    hours = reply_hours(owner_id, msgs)
    _CACHE[owner_id] = (time.time(), hours)
    return hours

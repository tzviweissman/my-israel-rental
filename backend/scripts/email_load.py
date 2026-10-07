"""How many report emails each person would get in one week. Dry run.

Replays one week of the scheduled emails against the database WITHOUT
sending anything or writing anything, using each loop's own selection:

  requests  daily 09:00 UTC, routes/marketplace/requests.py (_match_recipients)
  jobs      daily 09:00 UTC, routes/marketplace/jobs.py (saved searches)
  insights  Monday, routes/weekly_insights.py (run(dry_run=True))
  pricing   Sunday, routes/smart_pricing/insights.py (_build_owner_digest)
  avail     daily, routes/availability_reminders.py (4-6 days before available_to)

Each loop's opt-out is honoured. Refuses anything but a local MongoDB.

    python -m scripts.email_load                    # the 7 days ending now
    python -m scripts.email_load --end 2026-10-01   # the 7 days ending then
"""
import asyncio
import collections
import os
import re
import sys
from datetime import UTC, datetime, time, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
assert any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1")), "local MongoDB only"

from routes import weekly_insights as wi  # noqa: E402
from routes.deps import db  # noqa: E402
from routes.marketplace.requests import REQUESTS_OPT_OUT_FIELD, _match_recipients  # noqa: E402
from routes.smart_pricing.insights import _build_owner_digest  # noqa: E402


async def requests_days(day_ends: list[datetime], prefs: dict) -> dict[str, int]:
    """Per user: on how many of the week's 09:00 runs they'd get the digest.
    Each run covers the requests posted in the 24h before it."""
    out: collections.Counter = collections.Counter()
    for end in day_ends:
        start = end - timedelta(days=1)
        reqs = await db.requests.find({"hidden_by_admin": {"$ne": True},
                                       "created_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}}).to_list(500)
        for uid in (await _match_recipients(reqs)) if reqs else {}:
            if not prefs.get(uid, {}).get(REQUESTS_OPT_OUT_FIELD):
                out[uid] += 1
    return out


async def jobs_days(day_ends: list[datetime], prefs: dict) -> dict[str, int]:
    out: collections.Counter = collections.Counter()
    searches: dict[str, list] = collections.defaultdict(list)
    async for s in db.marketplace_job_searches.find({}):
        searches[s["provider_user_id"]].append(s)
    for uid, ss in searches.items():
        p = prefs.get(uid, {})
        if p.get("jobs_emails_off") or (p.get("mode") or "digest") == "instant":
            continue
        ors = [{"category": s["category"], **({"area": {"$regex": f"^{re.escape(s['area'])}", "$options": "i"}} if s.get("area") else {})} for s in ss]
        for end in day_ends:
            if await db.marketplace_jobs.count_documents({"poster_user_id": {"$ne": uid}, "$or": ors,
                                                         "created_at": {"$gte": (end - timedelta(days=1)).isoformat(), "$lt": end.isoformat()}}, limit=1):
                out[uid] += 1
    return out


async def pricing_week() -> dict[str, int]:
    out = {}
    for uid in await db.properties.distinct("owner_id", {"rental_type": "vacation", "smart_pricing.enabled": True}):
        u = await db.users.find_one({"id": uid}, {"email": 1, "pricing_insights_optout": 1, "email_suppressed": 1}) or {}
        if not u.get("email") or u.get("pricing_insights_optout") or u.get("email_suppressed"):
            continue
        d = await _build_owner_digest(uid)
        if d and (d["week_summary"]["total_delta"] or d["week_summary"]["applied_this_week"]):
            out[uid] = 1
    return out


async def avail_week(day_ends: list[datetime]) -> dict[str, int]:
    out: collections.Counter = collections.Counter()
    async for p in db.properties.find({"rental_type": {"$in": ["vacation", "short-term"]}, "available_to": {"$nin": [None, ""]}},
                                      {"owner_id": 1, "available_to": 1}):
        # One alert per property per 14 days, so at most one in a week.
        if any((e.date() + timedelta(days=4)).isoformat() <= p["available_to"][:10] <= (e.date() + timedelta(days=6)).isoformat() for e in day_ends):
            u = await db.users.find_one({"id": p["owner_id"]}, {"email": 1, "availability_reminders_optout": 1}) or {}
            if u.get("email") and not u.get("availability_reminders_optout"):
                out[p["owner_id"]] += 1
    return out


async def main() -> None:
    end = datetime.combine(datetime.fromisoformat(sys.argv[sys.argv.index("--end") + 1]).date(), time(9), tzinfo=UTC) \
        if "--end" in sys.argv else datetime.now(UTC)
    day_ends = [datetime.combine((end - timedelta(days=k)).date(), time(9), tzinfo=UTC) for k in range(7)]
    day_ends = [d for d in day_ends if d <= end] or day_ends
    prefs = {p["user_id"]: p async for p in db.job_notification_preferences.find({})}

    loops = {
        "requests": await requests_days(day_ends, prefs),
        "jobs": await jobs_days(day_ends, prefs),
        "insights": {r["user_id"]: 1 for r in await wi.run(end, dry_run=True) if r["result"] in ("would_send", "already_sent")},
        "pricing": await pricing_week(),
        "avail": await avail_week(day_ends),
    }
    per_user: collections.Counter = collections.Counter()
    for counts in loops.values():
        for uid, n in counts.items():
            per_user[uid] += n

    print(f"database {db.name} | week ending {end:%Y-%m-%d %H:%M} UTC | dry run, nothing sent")
    for name, counts in loops.items():
        print(f"  {name:9} {len(counts):4} people, {sum(counts.values()):4} emails")
    dist = collections.Counter(min(n, 4) for n in per_user.values())
    print(f"people emailed: {len(per_user)}")
    for n in (1, 2, 3, 4):
        print(f"  {'4+' if n == 4 else n} email{'s' if n > 1 else ''}: {dist.get(n, 0)}")
    both_daily = len(set(loops["requests"]) & set(loops["jobs"]))
    both_weekly = len(set(loops["insights"]) & set(loops["pricing"]))
    print(f"would get both daily digests in the week: {both_daily}")
    print(f"would get weekly insights + pricing: {both_weekly}")


asyncio.run(main())

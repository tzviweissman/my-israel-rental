"""The Monday "how your listings did" email (routes/weekly_insights).

  * someone with activity gets it, in their language
  * a quiet week sends nothing
  * an opted-out person gets nothing, and the opt-out link sets that
  * a second run the same week sends nothing more

Sending is replaced by a recorder, so nothing leaves the machine. The
opt-out is checked through the local API (backend/tests/.env.test).
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def test_weekly_insights():
    from routes import weekly_insights as wi
    from routes.deps import db

    tag = uuid.uuid4().hex[:8]
    busy, quiet, off = (f"TEST_wi_{k}_{tag}" for k in ("busy", "quiet", "off"))
    two_days_ago = datetime.now(UTC) - timedelta(days=2)
    sent: list[tuple[str, str]] = []

    async def fake_send(to, subject, html, **_):
        sent.append((to, subject, html))
        return True

    async def go():
        await wi.ensure_indexes()
        await db.users.insert_many([
            {"id": busy, "email": f"{busy}@example.com", "name": "Busy", "preferred_language": "he"},
            {"id": quiet, "email": f"{quiet}@example.com", "name": "Quiet"},
            {"id": off, "email": f"{off}@example.com", "name": "Off"},
        ])
        for uid in (busy, quiet, off):
            await db.marketplace_gigs.insert_one({"_id": f"gig_{uid}", "provider_user_id": uid, "status": "published"})
        for uid in (busy, off):
            await db.marketplace_view_events.insert_one({
                "entity_type": "gig", "entity_id": f"gig_{uid}", "owner_id": uid, "at": two_days_ago,
                "day": wi._il_day(two_days_ago.isoformat()), "visitor": f"v-{uid}"})
        await db.job_notification_preferences.insert_one({"user_id": off, wi.OPT_OUT_FIELD: True})
        who = {busy, quiet, off}
        try:
            dry = {r["user_id"]: r["result"] for r in await wi.run(dry_run=True, only=who)}
            assert dry == {busy: "would_send", quiet: "quiet", off: "opted_out"}
            assert not sent

            wi.send_email, real = fake_send, wi.send_email
            try:
                first = {r["user_id"]: r["result"] for r in await wi.run(only=who)}
                again = {r["user_id"]: r["result"] for r in await wi.run(only=who)}
            finally:
                wi.send_email = real
            assert first[busy] == "sent" and again[busy] == "already_sent"
            assert len(sent) == 1 and sent[0][0] == f"{busy}@example.com"
            assert 'dir="rtl"' in sent[0][2] and "מבקר" in sent[0][1], "in Hebrew, their language"
            # The count is 1 and there is no week before to compare with.
            assert "עלייה" not in sent[0][2] and "ירידה" not in sent[0][2]

            token = wi.create_optout_token(quiet)
            r = requests.post(f"{BASE}/marketplace/insights/emails/opt-out", json={"token": token}, timeout=30)
            assert r.status_code == 200, r.text
            pref = await db.job_notification_preferences.find_one({"user_id": quiet})
            assert pref and pref.get(wi.OPT_OUT_FIELD) is True
            bad = requests.post(f"{BASE}/marketplace/insights/emails/opt-out", json={"token": "x"}, timeout=30)
            assert bad.status_code == 400
        finally:
            await db.users.delete_many({"id": {"$in": list(who)}})
            await db.marketplace_gigs.delete_many({"provider_user_id": {"$in": list(who)}})
            await db.marketplace_view_events.delete_many({"owner_id": {"$in": list(who)}})
            await db.job_notification_preferences.delete_many({"user_id": {"$in": list(who)}})
            await db[wi.SENT].delete_many({"user_id": {"$in": list(who)}})

    asyncio.run(go())

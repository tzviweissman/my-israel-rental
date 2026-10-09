"""A guest who books gets the status link by email, and again when the
business answers (dead-ends audit 2026-10-08 #1). Local MongoDB only; the
email is stubbed, nothing is sent.
    .venv/Scripts/python -m pytest -q tests/test_guest_booking_email.py
"""
import asyncio
import os
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
pytestmark = pytest.mark.skipif(
    not any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1")),
    reason="local MongoDB only",
)

from routes.deps import db  # noqa: E402
from routes.marketplace import gigs  # noqa: E402
from routes.marketplace.shared import BookingIn, BookingPatch  # noqa: E402
from utils import email as em  # noqa: E402


def run(c):
    return asyncio.get_event_loop().run_until_complete(c)


@pytest.mark.parametrize("answer", ["accepted", "declined"])
def test_guest_gets_track_link(monkeypatch, answer):
    monkeypatch.setenv("DISABLE_RATE_LIMIT", "1")
    monkeypatch.delenv("RAILWAY_ENVIRONMENT", raising=False)
    sent = []

    async def capture(to, subject, html, **kw):
        sent.append((to, subject, html))
        return True

    monkeypatch.setattr(em, "send_email", capture)
    tag = uuid.uuid4().hex[:8]
    gig_id, pro = f"gbe-gig-{tag}", f"gbe-pro-{tag}"
    run(db.marketplace_gigs.insert_one({
        "_id": gig_id, "title": "Deep cleaning", "provider_user_id": pro,
        "status": "published", "booking_mode": "in_platform", "gig_type": "deliverable",
    }))
    req = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={})
    try:
        out = run(gigs.book_gig(
            gig_id, BookingIn(tier_name="Basic", guest_name="Dana", contact_email=f"{tag}@local.test"), req, None))
        token = out["track_path"].rsplit("/", 1)[1]
        assert len(sent) == 1 and sent[0][0] == f"{tag}@local.test"
        assert f"{em.FRONTEND_URL}/bookings/track/{token}" in sent[0][2]

        run(gigs.update_booking(out["booking_id"], BookingPatch(status=answer), {"user_id": pro}))
        assert len(sent) == 2
        assert f"/bookings/track/{token}" in sent[1][2]

        # No email given: nothing to send, and booking still works.
        before = len(sent)
        run(gigs.book_gig(gig_id, BookingIn(tier_name="Basic", guest_name="Dana", contact_phone="0501234567", preferred_date="2031-01-01"), req, None))
        assert len(sent) == before
    finally:
        run(db.marketplace_bookings.delete_many({"gig_id": gig_id}))
        run(db.marketplace_gigs.delete_one({"_id": gig_id}))
        run(db.notifications.delete_many({"user_id": pro}))

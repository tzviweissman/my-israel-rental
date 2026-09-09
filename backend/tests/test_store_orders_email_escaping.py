"""What an anonymous visitor types must not become markup in the mail.

The bug (site audit, 8 Sep 2026): `POST /marketplace/order-form/{gig}/orders`
takes `optional_user`, so anybody with no account at all can place an
order. `customer_name`, the free-text items, the address and the notes are
checked for length and nothing else, and the handler spliced them straight
into the HTML body of two real emails - one to the store owner, one to the
customer - sent through this platform's own Postmark identity.

That makes a "New order from ..." notification, which a shop owner has
every reason to trust, into a delivery vehicle for someone else's link,
tracking pixel or fake payment instruction. The businesses this feature
was built for - small local food shops - are a good phishing target, and
the mail arrives looking entirely routine.

`utils/email.py` has escaped exactly this class of input for chat-mention
mail since it was written, with a comment saying why. The order emails
added on 2026-09-07 did not follow it.

These tests drive the real handler in-process against the local Mongo,
with Postmark stubbed, and read the HTML body that would have been sent.
An HTTP-level test cannot see the body, and the body is the finding.

Every test runs seed, order and cleanup inside ONE event loop, and builds
its Motor client inside that loop: a client bound to a loop that has since
closed raises "attached to a different loop" on the next await, which
looks like a product failure and is not one.

Needs MONGO_URL/DB_NAME from backend/.env - a LOCAL mongod (see CLAUDE.md).
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from routes.marketplace import orders as mo  # noqa: E402

# The payload from the finding: a working anchor, in the field a store
# owner reads as "who ordered". Rendered, it is a clickable link inside a
# mail the platform signed.
EVIL_NAME = 'Dani <a href="https://evil.example/pay">Pay now to confirm</a>'
EVIL_ITEMS = '2 challahs <img src="https://evil.example/px.gif">'
EVIL_NOTES = 'Leave at door "><script>alert(1)</script>'


@pytest.fixture()
def sent(monkeypatch):
    """Capture what would have gone to Postmark, body and all."""
    box: list[dict] = []

    async def fake_send(to_email, subject, html_body, **kwargs):
        box.append({"to": to_email, "subject": subject, "html": html_body, **kwargs})
        return True

    monkeypatch.setattr("utils.email.send_email", fake_send)
    return box


class _Req:
    """check_rate only ever reads the client's address off this."""
    client = type("c", (), {"host": "127.0.0.1"})()
    headers: dict = {}


async def _seed(db):
    """A published store gig on an active business, with an owner who has
    an email address, and one product to order."""
    owner_id = f"owner-{uuid.uuid4()}"
    biz_id = f"biz-{uuid.uuid4()}"
    gig_id = f"gig-{uuid.uuid4()}"
    # users.email and businesses.slug are both unique indexes, and a failed
    # run can leave rows behind, so every seeded value is unique.
    owner_email = f"esc-owner-{uuid.uuid4().hex[:12]}@test.local"
    await db.users.insert_one({
        "id": owner_id, "email": owner_email, "name": "Store Owner", "role": "owner",
    })
    await db.businesses.insert_one({
        "_id": biz_id, "owner_user_id": owner_id, "name": "Lechem Emek",
        "slug": f"esc-test-{uuid.uuid4().hex[:12]}",
        "active": True, "serves_nationwide": True, "areas": [],
        "order_settings": {}, "couriers": [],
        "payment_note": "Cash or Bit at the door.",
    })
    await db.marketplace_gigs.insert_one({
        "_id": gig_id, "business_id": biz_id, "gig_type": "store",
        "status": "published", "title": "TEST_esc Friday challah",
        "products": [{"id": "p1", "name": "Challah", "price": 12, "currency": "ILS", "in_stock": True}],
    })
    return {"owner_id": owner_id, "biz_id": biz_id, "gig_id": gig_id, "owner_email": owner_email}


async def _cleanup(db, ids):
    await db.users.delete_one({"id": ids["owner_id"]})
    await db.businesses.delete_one({"_id": ids["biz_id"]})
    await db.marketplace_gigs.delete_one({"_id": ids["gig_id"]})
    await db.store_orders.delete_many({"business_id": ids["biz_id"]})


def _order(box, **over):
    """Place one anonymous order and hand back (captured mails, owner address).

    One loop, one client, cleaned up whatever happens.
    """
    async def go():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        ids = await _seed(db)
        try:
            body = {
                "lines": [{"product_id": "p1", "qty": 2}],
                "extra_items": "", "notes": "", "fulfilment": "pickup",
                "date": (datetime.now(UTC) + timedelta(days=2)).date().isoformat(),
                "customer_name": EVIL_NAME,
                "customer_phone": "0521234567",
                "customer_email": "esc-customer@test.local",
            }
            body.update(over)
            await mo.place_website_order(
                ids["gig_id"], mo.WebsiteOrderIn(**body), _Req(), viewer=None,
            )
        finally:
            await _cleanup(db, ids)
            client.close()
        return ids["owner_email"]

    loop = asyncio.new_event_loop()
    try:
        owner_email = loop.run_until_complete(go())
    finally:
        loop.close()
    assert box, "no email was sent at all - the test would prove nothing"
    return box, owner_email


# ----------------------------------------------------------- the finding


def test_a_name_containing_a_link_arrives_escaped(sent):
    """Both emails: the owner's notification and the customer's receipt."""
    box, _ = _order(sent)
    for mail in box:
        assert '<a href="https://evil.example/pay">' not in mail["html"], (
            f"the injected anchor is live markup in the email to {mail['to']}"
        )
    # And escaped the way html.escape does it, in the owner's mail, which
    # is the one that actually carries the name.
    joined = " ".join(m["html"] for m in box)
    assert "&lt;a href=&quot;https://evil.example/pay&quot;&gt;" in joined


def test_the_owner_still_reads_the_name_as_text(sent):
    """Escaped, not stripped: that text is how the shop recognises the
    order, so the fix must not have deleted it."""
    box, owner_email = _order(sent)
    owner_mail = next(m for m in box if m["to"] == owner_email)
    assert "Dani" in owner_mail["html"]
    assert "Pay now to confirm" in owner_mail["html"]


def test_the_subject_is_a_single_line(sent):
    """A name carrying a newline splices a second line into the subject."""
    box, _ = _order(sent, customer_name="Dani\nBcc: someone@evil.example")
    for mail in box:
        assert "\n" not in mail["subject"] and "\r" not in mail["subject"]


# --------------------------------------- the other anonymous free-text fields


def test_items_and_notes_are_escaped_too(sent):
    box, _ = _order(sent, customer_name="Dani", extra_items=EVIL_ITEMS, notes=EVIL_NOTES)
    for mail in box:
        assert '<img src="https://evil.example/px.gif">' not in mail["html"], (
            "a tracking pixel from the items field renders in the email"
        )
        assert "<script>" not in mail["html"]


def test_line_breaks_in_items_still_render_as_breaks(sent):
    """Escaping must not cost the multi-line item list its formatting -
    that list is the thing the owner actually reads off the mail."""
    box, owner_email = _order(sent, customer_name="Dani", extra_items="one thing\nanother thing")
    owner_mail = next(m for m in box if m["to"] == owner_email)
    assert "one thing<br>another thing" in owner_mail["html"]

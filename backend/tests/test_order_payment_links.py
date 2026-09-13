"""The order system must never serve a payment link the site has withdrawn.

THE FINDING (2026-09-12 site audit, confirmed against source). The rest of the
site renders a business's payment links through
`utils.payment_links.allowed_payment_links`, which re-checks every stored link
against the allowlist on the way out. The store-orders code read
`biz.get("payment_links")` raw in three places — the public order form, the
courier's delivery view, and the customer's confirmation email — so a link
whose provider had been pulled kept reaching customers.

That is not hypothetical. The allowlist gates WRITES, so rows saved while a
domain was accepted stay in the database after it is withdrawn: Zelle was on
the list for part of 27 Aug 2026. `scripts/clean_withdrawn_payment_links.py`
predicted exactly this — "a future feature that reads `payment_links` directly
and has no reason to suspect it holds entries the site refuses to show".

WHY THE BUSINESS IS SEEDED STRAIGHT INTO MONGO. Going through the API would
run `clean_payment_links` on the write and refuse the withdrawn link, so the
test could never plant the state it needs. Writing the document directly is
how that state actually arises: saved while allowed, withdrawn later.

Every surface is checked against the same four links: one that is still
allowed, one whose provider was withdrawn, one that was never valid, and one
on an allowed domain but over plain http. Only the first may appear.
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

GOOD = "https://bitpay.co.il/p/1"
STORED_LINKS = [
    {"label": "Bit", "url": GOOD},
    {"label": "Zelle", "url": "https://zellepay.com/"},        # withdrawn
    {"label": "Pay", "url": "https://evil-paybox.co.il/x"},    # never valid
    {"label": "Old", "url": "http://paybox.co.il/x"},          # plain http
]
# Substrings that must not survive onto any customer- or courier-facing surface.
REFUSED = ("zellepay.com", "evil-paybox.co.il", "http://paybox.co.il")


@pytest.fixture()
def sent(monkeypatch):
    """Capture what would have gone to the mail provider, body and all."""
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
    """A published store on an active business that still has a withdrawn,
    an invalid and an insecure payment link stored alongside a good one."""
    owner_id = f"owner-{uuid.uuid4()}"
    biz_id = f"biz-{uuid.uuid4()}"
    gig_id = f"gig-{uuid.uuid4()}"
    # users.email and businesses.slug are unique indexes, and a failed run can
    # leave rows behind, so every seeded value is unique.
    owner_email = f"paylink-owner-{uuid.uuid4().hex[:12]}@test.local"
    await db.users.insert_one({
        "id": owner_id, "email": owner_email, "name": "Store Owner", "role": "owner",
    })
    await db.businesses.insert_one({
        "_id": biz_id, "owner_user_id": owner_id, "name": "TEST_paylink store",
        "slug": f"paylink-test-{uuid.uuid4().hex[:12]}",
        "active": True, "serves_nationwide": True, "areas": [],
        "order_settings": {}, "couriers": [],
        "payment_note": "Bit at the door.",
        "payment_links": STORED_LINKS,
    })
    await db.marketplace_gigs.insert_one({
        "_id": gig_id, "business_id": biz_id, "gig_type": "store",
        "status": "published", "title": "TEST_paylink challah",
        "products": [{"id": "p1", "name": "Challah", "price": 12, "currency": "ILS", "in_stock": True}],
    })
    return {"owner_id": owner_id, "biz_id": biz_id, "gig_id": gig_id}


async def _cleanup(db, ids):
    await db.users.delete_one({"id": ids["owner_id"]})
    await db.businesses.delete_one({"_id": ids["biz_id"]})
    await db.marketplace_gigs.delete_one({"_id": ids["gig_id"]})
    await db.store_orders.delete_many({"business_id": ids["biz_id"]})


def _run(work):
    """Seed, run `work(ids)` in one fresh event loop, clean up whatever happens."""
    async def go():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        ids = await _seed(db)
        try:
            return await work(ids)
        finally:
            await _cleanup(db, ids)
            client.close()

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(go())
    finally:
        loop.close()


def _urls(links):
    return [l.get("url") for l in links or []]


# ------------------------------------------------------------ the order page


def test_order_form_serves_only_allowed_links():
    """The public page a customer orders from."""
    out = _run(lambda ids: mo.order_form(ids["gig_id"]))
    assert _urls(out["business"]["payment_links"]) == [GOOD], (
        "the order form served a payment link the allowlist refuses"
    )


# ------------------------------------------------------- the customer's email


def test_confirmation_email_omits_withdrawn_links(sent):
    """The receipt. It is a mail the platform signed, so a withdrawn link in
    it carries the site's authority."""
    customer_email = f"paylink-customer-{uuid.uuid4().hex[:12]}@test.local"

    async def place(ids):
        body = mo.WebsiteOrderIn(
            lines=[{"product_id": "p1", "qty": 1}],
            extra_items="", notes="", fulfilment="pickup",
            date=(datetime.now(UTC) + timedelta(days=2)).date().isoformat(),
            customer_name="Dani", customer_phone="0521234567",
            customer_email=customer_email,
        )
        await mo.place_website_order(ids["gig_id"], body, _Req(), viewer=None)

    _run(place)
    receipt = next((m for m in sent if m["to"] == customer_email), None)
    assert receipt, "no confirmation email went to the customer - the test would prove nothing"
    assert GOOD in receipt["html"], "the still-allowed link should appear in the receipt"
    for bad in REFUSED:
        assert bad not in receipt["html"], f"the customer's receipt carries a refused link: {bad}"


# -------------------------------------------------------- the courier's view


def test_courier_view_serves_only_allowed_links():
    """What a courier sees at the door. `_stop` is pure, so no database."""
    order = {"_id": "order-1", "customer_name": "Dani", "status": "ready"}
    biz = {"_id": "biz-1", "name": "TEST_paylink store", "payment_links": STORED_LINKS}
    out = mo._stop(order, biz, reveal_phone=False)
    assert _urls(out["business"]["payment_links"]) == [GOOD], (
        "the courier view served a payment link the allowlist refuses"
    )

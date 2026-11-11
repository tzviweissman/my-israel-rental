"""Order emails with the business's controls (order_emails.py, Tzvi 11 Nov
2026): the switch and address for the business's own emails, the one-tap
Confirm / Decline link, the business's wording and Hebrew for customers,
and Recent emails matched to Postmark's reports. No database or network."""
import asyncio

import routes.marketplace.order_emails as oe
import routes.marketplace.order_texts as ot
import utils.email as email_mod


class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *_a, **_k):
        return self

    def limit(self, *_a):
        return self

    async def to_list(self, _n):
        return self.docs

    def __aiter__(self):
        self._it = iter(self.docs)
        return self

    async def __anext__(self):
        try:
            return next(self._it)
        except StopIteration:
            raise StopAsyncIteration from None


class _Coll:
    def __init__(self, docs=()):
        self.docs = list(docs)
        self.inserted = []

    async def find_one(self, q, *_a, **_k):
        for d in self.docs:
            if all(d.get(k) == v for k, v in q.items()):
                return d
        return None

    def find(self, q, *_a, **_k):
        if "raw.Metadata.log_id" in q:
            ids = q["raw.Metadata.log_id"]["$in"]
            return _Cursor([d for d in self.docs if d["raw"]["Metadata"]["log_id"] in ids])
        return _Cursor([d for d in self.docs if all(d.get(k) == v for k, v in q.items())])

    async def insert_one(self, d):
        self.inserted.append(d)
        self.docs.append(d)


class _Db:
    def __init__(self):
        self.users = _Coll([{"id": "u1", "email": "owner@shop.test", "preferred_language": "he"}])
        self.email_log = _Coll()
        self.email_events = _Coll()


ORDER = {"_id": "o1", "business_id": "b1", "owner_user_id": "u1", "order_no": 1042, "customer_name": "Dani <b>",
         "customer_phone": "0521112222", "customer_email": "dani@mail.test", "items": "2 x Challah", "status": "new",
         "fulfilment": "pickup", "needed_by": "2026-11-12T10:00", "total": 40, "currency": "ILS", "lang": "he",
         "owner_token": "OWN", "track_token": "TRK"}


def _setup(monkeypatch):
    fake_db = _Db()
    sent = []

    async def fake_send(to, subject, html, **kw):
        sent.append({"to": to, "subject": subject, "html": html, **kw})
        return True

    for mod in (oe, ot):
        monkeypatch.setattr(mod, "db", fake_db)
    import routes.marketplace.orders as om
    monkeypatch.setattr(email_mod, "send_email", fake_send)
    monkeypatch.setattr(om, "_frontend_url", lambda: "https://site.test")
    return fake_db, sent


def test_business_gets_confirm_link_in_its_language(monkeypatch):
    fake_db, sent = _setup(monkeypatch)
    asyncio.run(oe.email_owner_new_order(ORDER, {"_id": "b1", "owner_user_id": "u1"}))
    [m] = sent
    assert m["to"] == "owner@shop.test"
    assert "https://site.test/orders/owner/OWN" in m["html"] and "אישור או דחייה" in m["html"]
    assert 'dir="rtl"' in m["html"]
    assert "Dani <b>" not in m["html"]                       # the customer's text arrives escaped
    assert m["metadata"]["log_id"] == fake_db.email_log.inserted[0]["_id"]
    assert fake_db.email_log.inserted[0]["who"] == "business" and fake_db.email_log.inserted[0]["to_end"] == "ow…@shop.test"


def test_switch_off_and_own_address(monkeypatch):
    _, sent = _setup(monkeypatch)
    asyncio.run(oe.email_owner_new_order(ORDER, {"_id": "b1", "owner_user_id": "u1", "order_settings": {"email_on": False}}))
    assert sent == []
    asyncio.run(oe.email_owner_new_order(ORDER, {"_id": "b1", "owner_user_id": "u1", "order_settings": {"email_to": "orders@shop.test"}}))
    assert [m["to"] for m in sent] == ["orders@shop.test"]


def test_customer_gets_business_wording_and_note_even_with_business_emails_off(monkeypatch):
    _, sent = _setup(monkeypatch)
    biz = {"_id": "b1", "name": "Bakery", "name_he": "מאפייה", "order_settings": {
        "email_on": False, "text_note": "Ring the bell",
        "text_templates": {"order_confirmed": {"he": "יש! הזמנה {order} מוכנה בקרוב"}}}}
    asyncio.run(oe.email_customer_decision(ORDER, biz, True))
    [m] = sent
    assert m["to"] == "dani@mail.test" and "מאפייה" in m["subject"]
    assert "יש! הזמנה #1042 מוכנה בקרוב" in m["html"] or "יש! הזמנה 1042 מוכנה בקרוב" in m["html"]
    assert "Ring the bell" in m["html"] and "https://site.test/orders/track/TRK" in m["html"]


def test_received_email_does_not_promise_a_text(monkeypatch):
    _, sent = _setup(monkeypatch)
    asyncio.run(oe.email_customer_received({**ORDER, "lang": "en"}, {"_id": "b1", "name": "Bakery"}))
    [m] = sent
    assert "text you" not in m["html"] and "email you when they confirm" in m["html"]


def test_recent_emails_read_postmark_reports_and_a_bounce_wins(monkeypatch):
    fake_db, _ = _setup(monkeypatch)
    fake_db.email_log.docs = [{"_id": "L1", "business_id": "b1", "who": "customer", "at": "2"},
                              {"_id": "L2", "business_id": "b1", "who": "business", "at": "1"},
                              {"_id": "L3", "business_id": "b1", "who": "business", "at": "0"}]
    fake_db.email_events.docs = [{"record_type": "Delivery", "raw": {"Metadata": {"log_id": "L1"}}},
                                 {"record_type": "Bounce", "raw": {"Metadata": {"log_id": "L2"}}},
                                 {"record_type": "Delivery", "raw": {"Metadata": {"log_id": "L2"}}}]
    rows = asyncio.run(oe.recent_emails("b1"))
    assert [r["status"] for r in rows] == ["delivered", "bounced", "sent"]

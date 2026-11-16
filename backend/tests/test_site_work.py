"""The join page's live line of real work (routes/site_visits.site_work): each text or email becomes one of the
few kinds the page names, a declined order is never shown, and no row carries a name, number or address."""
from routes.site_visits import _work_kind


def test_kinds():
    assert _work_kind("business", "order_new") == "order_alert"
    assert _work_kind("business", "booking_new") == "order_alert"
    assert _work_kind("business", "quote_new") == "order_alert"
    assert _work_kind("customer", "order_received") == "received"
    assert _work_kind("customer", "order_confirmed") == "confirmed"
    assert _work_kind("customer", "order_review") == "review_asked"
    assert _work_kind("customer", "booking_reminder") == "reminder_sent"


def test_ads_and_pages_in_the_stream(monkeypatch):
    """A kept business ad and a page that went live each become a line; a property ad does not."""
    import asyncio
    from datetime import UTC, datetime
    import routes.site_visits as sv

    now = datetime.now(UTC).isoformat()
    data = {
        "saved_ads": [{"target_type": "business", "target_id": "b1", "created_at": now},
                      {"target_type": "property", "target_id": "p1", "created_at": now}],
        "business_page_versions": [{"business_id": "b2", "published_at": now}],
    }

    class Cur:
        def __init__(self, rows): self.rows = rows
        def sort(self, *a): return self
        def limit(self, *a): return self
        def __aiter__(self):
            async def gen():
                for r in self.rows:
                    yield r
            return gen()

    class Coll:
        def __init__(self, name): self.name = name
        def find(self, q, *a):
            rows = data.get(self.name, [])
            if "target_type" in q:
                rows = [r for r in rows if r["target_type"] == q["target_type"]]
            return Cur(rows)

    class DB:
        def __getitem__(self, name): return Coll(name)
        def __getattr__(self, name): return Coll(name)

    monkeypatch.setattr(sv, "db", DB())
    rows = asyncio.run(sv._work_rows())
    assert sorted((r["kind"], r["business_id"]) for r in rows) == [("ad_made", "b1"), ("page_built", "b2")]


def test_left_out():
    assert _work_kind("customer", "order_declined") is None
    assert _work_kind("business", "something_else") is None
    assert _work_kind("", "") is None

"""Approving a Get listed request emails the submitter; rejecting a claim
emails the claimant. No database or network: stand-ins for both."""
import asyncio

import routes.restaurants as r
import utils.email as email_mod


class _Coll:
    def __init__(self, doc):
        self.doc = doc

    async def find_one(self, *_a, **_k):
        return self.doc

    async def update_one(self, *_a, **_k):
        return None


class _Db:
    def __init__(self, sub=None, claim=None, rest=None):
        self.restaurant_submissions = _Coll(sub)
        self.restaurant_claims = _Coll(claim)
        self.restaurants = _Coll(rest)


ADMIN = {"role": "admin", "user_id": "a1"}


def _capture(monkeypatch, ok=True):
    sent = []

    async def fake(to, subject, html, **kw):
        sent.append((to, subject, html, kw))
        if not ok:
            raise RuntimeError("smtp down")
        return True

    monkeypatch.setattr(email_mod, "send_email", fake)
    return sent


def _approve(monkeypatch, email):
    sub = {"id": "s1", "name": "Falafel Bar", "city": "Arad", "certification": "Rabbanut", "contact_email": email}
    monkeypatch.setattr(r, "db", _Db(sub=sub))

    async def fake_add(*_a, **_k):
        return {"id": "mir-1", "name_en": "Falafel Bar", "name_he": None}

    monkeypatch.setattr(r, "admin_add", fake_add)
    return asyncio.run(r.admin_decide("s1", "approve", ADMIN))


def test_approval_emails_submitter_with_link(monkeypatch):
    sent = _capture(monkeypatch)
    out = _approve(monkeypatch, "owner@example.com")
    assert out["ok"]
    assert len(sent) == 1
    to, subject, html, _ = sent[0]
    assert to == "owner@example.com" and "Falafel Bar" in subject
    assert "/restaurants/" in html


def test_approval_without_address_sends_nothing(monkeypatch):
    sent = _capture(monkeypatch)
    assert _approve(monkeypatch, "")["ok"]
    assert sent == []


def test_email_failure_does_not_fail_approval(monkeypatch):
    _capture(monkeypatch, ok=False)
    assert _approve(monkeypatch, "owner@example.com")["ok"]


def test_rejected_claim_emails_claimant(monkeypatch):
    sent = _capture(monkeypatch)
    claim = {"id": "c1", "place_id": "p1", "email": "claimant@example.com", "name": "Dana"}
    monkeypatch.setattr(r, "db", _Db(claim=claim, rest={"contact": {"name_en": "Falafel Bar"}}))
    assert asyncio.run(r.admin_decide_claim("c1", "reject", ADMIN))["ok"]
    assert [s[0] for s in sent] == ["claimant@example.com"]
    assert "not approved" in sent[0][2]

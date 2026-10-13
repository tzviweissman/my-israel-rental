"""Our emails come From no-reply@, and several say "reply to this email".
Every send carries a Reply-To so that reply reaches a real inbox
(dead-ends audit, 11 Oct 2026). No network: the Postmark client is a stand-in.
"""
import asyncio

import utils.email as email


class _Emails:
    def __init__(self):
        self.sent = []

    def send(self, **kw):
        self.sent.append(kw)
        return {"MessageID": "x"}


class _Client:
    def __init__(self):
        self.emails = _Emails()


def _send(monkeypatch, **kw):
    client = _Client()
    monkeypatch.setattr(email, "_get_client", lambda: client)
    ok = asyncio.run(email.send_email("someone@example.com", "Hi", "<p>Hi</p>", skip_suppression_check=True, **kw))
    assert ok
    return client.emails.sent[0]


def test_every_email_has_a_reply_to(monkeypatch):
    assert _send(monkeypatch)["ReplyTo"] == email.EMAIL_REPLY_TO
    assert "no-reply" not in email.EMAIL_REPLY_TO


def test_a_caller_can_route_replies_elsewhere(monkeypatch):
    assert _send(monkeypatch, reply_to="owner@example.com")["ReplyTo"] == "owner@example.com"

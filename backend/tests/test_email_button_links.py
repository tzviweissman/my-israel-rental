"""Email buttons carry a full address: a mail client cannot follow
"/dashboard?...", which is what price alerts and automations passed
(dead ends, 7 Oct 2026). orders._email makes an in-app path absolute.

    .venv/Scripts/python -m pytest -q tests/test_email_button_links.py
"""
import asyncio

from routes.marketplace import orders as om


def test_relative_button_becomes_absolute(monkeypatch):
    sent = {}

    async def fake(to, subject, html, tag=None, **kw):
        sent["html"] = html

    import utils.email as em
    monkeypatch.setattr(em, "send_email", fake)
    monkeypatch.setenv("FRONTEND_URL", "https://example.test/")
    asyncio.run(om._email("a@b.test", "Hi", "<p>x</p>", tag="t", button=("Open", "/dashboard?tab=orders")))
    assert 'href="https://example.test/dashboard?tab=orders"' in sent["html"]
    asyncio.run(om._email("a@b.test", "Hi", "<p>x</p>", tag="t", button=("Open", "https://other.test/x")))
    assert 'href="https://other.test/x"' in sent["html"]

"""The section editor's additions to the composition (utils/page_composition.py):
the "text" section and the hidden switch, through the owner's PATCH and the
public page payload.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_text_section_and_hidden_switch():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"sections-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": "Sections owner", "role": "owner"}, timeout=30)
    owner = r.json()["token"]
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST_sections {stamp}"}, headers=_auth(owner), timeout=30).json()
    url = f"{BASE}/marketplace/businesses/{biz['id']}"
    page = {"theme": {}, "blocks": [
        {"id": "text-1", "type": "text", "variant": "photo", "props": {"heading": "About us", "body": "Line one\nLine two", "image": "cover"}},
        {"id": "facts", "type": "facts", "variant": "list", "props": {}, "hidden": True},
        {"id": "catalog", "type": "services", "variant": "grid", "props": {}},
    ]}
    r = requests.patch(url, json={"page": page}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    pub = requests.get(f"{BASE}/marketplace/business/{biz['slug']}", headers=_auth(owner), timeout=30).json()["page"]["blocks"]
    assert [(b["id"], b["hidden"]) for b in pub] == [("text-1", False), ("facts", True), ("catalog", False)]
    assert pub[0]["props"] == {"heading": "About us", "body": "Line one\nLine two", "image": "cover"}

    bad = {"theme": {}, "blocks": [{"id": "t", "type": "text", "variant": "plain", "props": {"image": "https://evil.example/x.jpg"}}]}
    assert requests.patch(url, json={"page": bad}, headers=_auth(owner), timeout=30).status_code == 422
    long = {"theme": {}, "blocks": [{"id": "t", "type": "text", "variant": "plain", "props": {"body": "x" * 1501}}]}
    assert requests.patch(url, json={"page": long}, headers=_auth(owner), timeout=30).status_code == 422

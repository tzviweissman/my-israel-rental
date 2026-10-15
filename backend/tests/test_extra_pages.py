"""A business's extra pages (utils/page_composition.py ExtraPage, through
businesses.py): stored in order with their own sections, served on the
page, and refused when two share an address, an address is malformed,
a page has no sections, or there are more than eight.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _page(i, slug, title="About us"):
    return {"id": f"page-{i}", "slug": slug, "title": title,
            "blocks": [{"id": "text-1", "type": "text", "variant": "plain", "props": {"heading": title, "body": "Hello"}}]}


def test_extra_pages():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    owner = requests.post(f"{BASE}/auth/register", json={
        "email": f"pages-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": "Pages owner", "role": "owner"}, timeout=30).json()["token"]
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST_pages {stamp}"}, headers=_auth(owner), timeout=30).json()
    url = f"{BASE}/marketplace/businesses/{biz['id']}"
    get = lambda: requests.get(f"{BASE}/marketplace/business/{biz['slug']}", headers=_auth(owner), timeout=30).json()

    pages = [_page(1, "about"), _page(2, "faq", "Questions")]
    assert requests.patch(url, json={"pages": pages}, headers=_auth(owner), timeout=30).status_code == 200
    got = get()["pages"]
    assert [p["slug"] for p in got] == ["about", "faq"] and got[0]["blocks"][0]["props"]["body"] == "Hello"

    def refused(body):
        return requests.patch(url, json={"pages": body}, headers=_auth(owner), timeout=30).status_code == 422
    assert refused([_page(1, "about"), _page(2, "about")])                    # same address
    assert refused([_page(1, "About Us")])                                    # not an address
    assert refused([{**_page(1, "about"), "blocks": []}])                     # no sections
    assert refused([_page(i, f"p{i}") for i in range(1, 10)])                 # nine pages

    assert requests.patch(url, json={"pages": []}, headers=_auth(owner), timeout=30).status_code == 200
    assert get()["pages"] == []

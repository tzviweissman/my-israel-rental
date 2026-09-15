"""Business web addresses: <slug>.myisraelrental.com.

WHY. A slug used to be only a path segment. It is now also a subdomain, which
makes three things load-bearing:

  * reserved words. api.myisraelrental.com resolving to someone's cleaning
    business is an outage, so unique_slug must never mint one, by any path;
  * owner-chosen addresses. A Hebrew name yields no ASCII slug, so owners
    pick their own, and a change must retire the old address rather than
    break every flyer that carries it;
  * one canonical. The same page is served at two URLs, and both the page
    and the link-preview card must name the same one.

The first block needs nothing but the local database. The second drives the
live local API (see backend/tests/.env.test).
"""
from __future__ import annotations

import asyncio
import os
import re
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from routes import short_links  # noqa: E402
from utils import businesses as bz  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")

SPEC_MINIMUM = set("""
www admin api app mail smtp imap pop ftp cdn static assets media img
ns1 ns2 dns mx autodiscover autoconfig webmail dev staging test preview
blog help support docs status dashboard account accounts auth login
p og short link links go my me new signup register business businesses
properties property stays services requests jobs manager chat
""".split())


def _local_db():
    url = os.environ["MONGO_URL"]
    assert "localhost" in url or "127.0.0.1" in url, "refusing to run against a non-local database"
    return AsyncIOMotorClient(url)[os.environ["DB_NAME"]]


# ------------------------------------------------------------ no server needed


def test_reserved_list_covers_the_spec_minimum():
    assert SPEC_MINIMUM <= bz.RESERVED_SLUGS


@pytest.mark.parametrize("candidate, problem", [
    ("cohen-movers", None),
    ("a", None),
    ("a" * 60, None),
    ("a" * 61, "invalid"),
    ("Cohen", "invalid"),       # the API lowercases first; the rule itself does not
    ("-cohen", "invalid"),
    ("cohen-", "invalid"),
    ("co_hen", "invalid"),
    ("co hen", "invalid"),
    ("", "invalid"),
    ("api", "reserved"),
    ("www", "reserved"),
    ("mail", "reserved"),
])
def test_address_problem(candidate, problem):
    assert bz.address_problem(candidate) == problem


def test_unique_slug_never_returns_a_reserved_word():
    names = ["API", "Admin", "WWW", "Mail", "Help", "Stays", "p", "OG"]

    async def go():
        db = _local_db()
        with patch.object(bz, "db", db):
            return {n: await bz.unique_slug(n) for n in names}

    got = asyncio.run(go())
    for name, slug in got.items():
        assert slug not in bz.RESERVED_SLUGS, f"{name!r} minted the reserved slug {slug!r}"
        assert bz.address_problem(slug) is None, f"{name!r} minted {slug!r}, which is not a DNS label"
        assert slug.startswith(bz.slugify(name) + "-"), f"{name!r} -> {slug!r} should fall through to -N"


def test_slug_change_retires_the_old_slug_and_caps_history():
    biz = {"slug": "old", "previous_slugs": [f"s{i}" for i in range(20)]}
    update = bz.slug_change(biz, "new")
    assert update["slug"] == "new"
    assert update["previous_slugs"][-1] == "old"
    assert len(update["previous_slugs"]) == 20

    # Going back to a retired address removes it from the history.
    back = bz.slug_change({"slug": "new", "previous_slugs": ["old"]}, "old")
    assert back == {"slug": "old", "previous_slugs": ["new"]}


def test_canonical_is_the_path_unless_flagged(monkeypatch):
    monkeypatch.delenv("BUSINESS_CANONICAL", raising=False)
    monkeypatch.setenv("PUBLIC_SITE_HOST", "myisraelrental.com")
    assert bz.business_canonical_url("cohen") == "https://myisraelrental.com/business/cohen"
    monkeypatch.setenv("BUSINESS_CANONICAL", "subdomain")
    assert bz.business_canonical_url("cohen") == "https://cohen.myisraelrental.com/"


def test_preview_html_carries_the_canonical():
    meta = {"title": "Cohen", "description": "d", "image": "https://x/y.jpg"}
    html = short_links._preview_html(meta, "https://myisraelrental.com/business/cohen",
                                     refresh=False, canonical="https://myisraelrental.com/business/cohen")
    assert '<link rel="canonical" href="https://myisraelrental.com/business/cohen"/>' in html


# ------------------------------------------------------------ live local API


def _api_up() -> bool:
    try:
        return requests.get(f"{BASE}/health", timeout=5).ok
    except requests.RequestException:
        return False


live = pytest.mark.skipif(not _api_up(), reason="local API on :8001 is not running")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _owner(label: str) -> str:
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"webaddr-{label}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Web Address {label}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


def _business(token: str, name: str) -> dict:
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": name}, headers=_auth(token), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()


def _check(token, biz_id, address):
    r = requests.get(f"{BASE}/marketplace/businesses/{biz_id}/web-address/check",
                     params={"address": address}, headers=_auth(token), timeout=30)
    assert r.ok, r.text
    return r.json()


@live
def test_a_business_named_like_infrastructure_does_not_get_that_address():
    token = _owner("infra")
    biz = _business(token, "API")
    assert biz["slug"] != "api" and biz["slug"] not in bz.RESERVED_SLUGS


@live
def test_choosing_an_address_end_to_end():
    stamp = uuid.uuid4().hex[:8]
    token = _owner("a")
    biz = _business(token, f"Web Address Test {stamp}")
    original = biz["slug"]
    chosen = f"wa-{stamp}"

    # The check endpoint names every refusal.
    assert _check(token, biz["id"], original)["reason"] == "current"
    assert _check(token, biz["id"], "api")["reason"] == "reserved"
    assert _check(token, biz["id"], "no_underscores")["reason"] == "invalid"
    assert _check(token, biz["id"], chosen.upper()) == {"address": chosen, "available": True, "reason": None}

    r = requests.put(f"{BASE}/marketplace/businesses/{biz['id']}/web-address",
                     json={"address": chosen.upper()}, headers=_auth(token), timeout=30)
    assert r.ok, r.text
    body = r.json()
    assert body["slug"] == chosen and body["slug_chosen"] is True

    # Both the new address and the retired one open the same business. As
    # the owner: a business with nothing published is 404 to the public by
    # design (spec B8), and this test business has no services.
    for s in (chosen, original):
        page = requests.get(f"{BASE}/marketplace/business/{s}", headers=_auth(token), timeout=30)
        assert page.ok and page.json()["id"] == biz["id"], s

    # A second owner cannot take either address, live or retired.
    other_token = _owner("b")
    other = _business(other_token, f"Other {stamp}")
    assert _check(other_token, other["id"], chosen)["reason"] == "taken"
    assert _check(other_token, other["id"], original)["reason"] == "taken"
    clash = requests.put(f"{BASE}/marketplace/businesses/{other['id']}/web-address",
                         json={"address": original}, headers=_auth(other_token), timeout=30)
    assert clash.status_code == 409, clash.text

    # Nor can a stranger probe or change this business's address.
    assert requests.get(f"{BASE}/marketplace/businesses/{biz['id']}/web-address/check",
                        params={"address": "x-y"}, headers=_auth(other_token), timeout=30).status_code == 403
    assert requests.put(f"{BASE}/marketplace/businesses/{biz['id']}/web-address",
                        json={"address": "x-y"}, headers=_auth(other_token), timeout=30).status_code == 403

    # Renaming no longer overwrites an address the owner chose.
    renamed = requests.patch(f"{BASE}/marketplace/businesses/{biz['id']}",
                             json={"name": f"Renamed {stamp}"}, headers=_auth(token), timeout=30)
    assert renamed.ok, renamed.text
    assert renamed.json()["slug"] == chosen

    # The preview card fetched by the RETIRED address canonicalises to the live one.
    og = requests.get(f"{BASE}/og/business/{original}", timeout=30)
    assert og.ok
    m = re.search(r'<link rel="canonical" href="([^"]+)"', og.text)
    assert m and m.group(1).endswith(f"/business/{chosen}"), og.text[:400]
    assert f'content="{m.group(1)}"' in og.text, "og:url must match the canonical"


@live
def test_rename_still_moves_an_address_nobody_chose():
    stamp = uuid.uuid4().hex[:8]
    token = _owner("c")
    biz = _business(token, f"Auto Slug {stamp}")
    r = requests.patch(f"{BASE}/marketplace/businesses/{biz['id']}",
                       json={"name": f"Auto Renamed {stamp}"}, headers=_auth(token), timeout=30)
    assert r.ok, r.text
    assert r.json()["slug"] == f"auto-renamed-{stamp}"

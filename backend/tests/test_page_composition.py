"""The composition schema: what it accepts, and what it refuses.

Phase 1 of docs/ai-page-builder-spec.md. There is no AI behind any of
this yet, which is exactly why these tests matter now: the vocabulary is
what a generator will later be constrained to, and every hole in it is a
hole a model will eventually find.

The refusals below are not defensive tidiness. Each one is a way a
generated page could otherwise reach our own origin, next to logged-in
sessions:

  * an unknown block type or variant - a renderer nobody wrote;
  * an unexpected prop - a key riding along in the document until some
    future renderer reads it;
  * a URL in an image slot - a page pulling assets, or a tracking pixel,
    from somewhere that is not this business;
  * a style or class string anywhere - the escape hatch itself.

And one acceptance that matters as much: a block naming a service that
was later deleted still SAVES, because validating ids against a list
that changes underneath would make a business un-saveable over something
it deleted last month. Stale references are skipped when the page is
drawn, not refused when it is written.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"compose-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": "Compose Owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def business(owner):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST compose {stamp}"},
                      headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


@pytest.fixture(scope="module")
def published(owner, business):
    """One published service, so the page exists for a VISITOR too.

    A business with nothing published is not publicly linkable at all
    (spec B8): it would render as a name and an empty heading, with no
    way to make contact. Any test that reads the page anonymously needs
    this, and it is worth stating rather than working around.
    """
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": f"TEST_compose_{stamp}", "description": "compose test listing",
        "category": "home-services-repair", "area": "Tel Aviv", "gig_type": "deliverable",
        "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567",
        "gallery": ["https://example.com/photo.jpg"],
        "tiers": [{"name": "Basic", "price": 200, "currency": "ILS"}],
        "business_id": business,
    }, headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    gig_id = r.json()["id"]
    yield gig_id
    requests.delete(f"{BASE}/marketplace/gigs/{gig_id}", headers=_auth(owner), timeout=30)


def _patch(token, business_id, body):
    return requests.patch(f"{BASE}/marketplace/businesses/{business_id}",
                          json=body, headers=_auth(token), timeout=30)


def _page(business_id, token=None):
    r = requests.get(f"{BASE}/marketplace/business/{business_id}",
                     headers=_auth(token) if token else None, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


VALID = {
    "theme": {"palette": "sea", "type": "serif", "density": "airy",
              "imagery": "full-bleed", "price_prominence": "quiet", "motion": "still"},
    "blocks": [
        {"id": "facts", "type": "facts", "variant": "list", "props": {}},
        {"id": "catalog", "type": "services", "variant": "grid",
         "props": {"source": "all", "limit": 12}},
    ],
}


# ------------------------------------------------------------ the vocabulary


def test_the_vocabulary_is_served_rather_than_duplicated():
    """The client renders these names, so a copy of them exists either
    way. The only question is whether the copy can silently disagree with
    what the API accepts."""
    r = requests.get(f"{BASE}/marketplace/page-vocabulary", timeout=30)
    assert r.status_code == 200, r.text
    v = r.json()
    assert set(v["dials"]) == {
        "palette", "type", "density", "imagery", "price_prominence", "motion",
    }
    assert set(v["blocks"]) == {
        "hero", "rule", "facts", "services", "providers", "cover", "gallery", "contact",
    }
    # Every default must itself be a legal value, or a business that
    # answers nothing gets a page the API would refuse.
    for dial, value in v["dial_defaults"].items():
        assert value in v["dials"][dial], f"{dial} default {value!r} is not one of its own values"


# ------------------------------------------------------------ round trip


def test_a_composition_saves_and_comes_back(owner, business):
    r = _patch(owner, business, {"page": VALID})
    assert r.status_code == 200, r.text
    page = _page(business, owner)["page"]
    assert page["theme"]["density"] == "airy"
    assert [b["id"] for b in page["blocks"]] == ["facts", "catalog"]
    # Props come back FILLED, not as sent: the block's own model supplies
    # every default, so a renderer never has to guess what a missing key
    # meant.
    assert page["blocks"][1]["props"]["source"] == "all"
    assert page["blocks"][1]["props"]["heading"] == ""


def test_null_clears_the_design(owner, business):
    """"Put it back how it was" is one click and must not need us."""
    assert _patch(owner, business, {"page": VALID}).status_code == 200
    assert _patch(owner, business, {"page": None}).status_code == 200
    assert _page(business, owner)["page"] is None


def test_the_brief_is_the_owners_and_not_a_visitors(owner, business, published):
    r = _patch(owner, business, {"page_brief": {
        "showing": "catalogue", "action": "order", "audience": "tourists",
        "pricing": "value", "strengths": ["quality", "kosher"], "note": "Since 1998.",
    }})
    assert r.status_code == 200, r.text
    assert _page(business, owner)["page_brief"]["pricing"] == "value"
    # Where they price themselves and who they sell to is theirs to know.
    # A visitor reads the page, not the reasoning behind it.
    assert "page_brief" not in _page(business)


# ------------------------------------------------------------ the refusals


@pytest.mark.parametrize("bad,why", [
    ({"blocks": [{"id": "a", "type": "iframe", "variant": "band"}]},
     "a block type nobody wrote a renderer for"),
    ({"blocks": [{"id": "a", "type": "hero", "variant": "marquee"}]},
     "a variant that does not exist"),
    ({"blocks": [{"id": "a", "type": "hero", "variant": "band",
                  "props": {"style": "color:red"}}]},
     "a style string"),
    ({"blocks": [{"id": "a", "type": "hero", "variant": "band",
                  "props": {"className": "absolute inset-0"}}]},
     "a class name"),
    ({"blocks": [{"id": "a", "type": "hero", "variant": "band",
                  "props": {"image": "https://evil.example/pixel.png"}}]},
     "a URL where a reference belongs"),
    ({"blocks": [{"id": "a", "type": "gallery", "variant": "carousel",
                  "props": {"images": ["//evil.example/x.jpg"]}}]},
     "a protocol-relative URL in a gallery"),
    ({"blocks": [{"id": "a", "type": "facts", "variant": "list"}], "html": "<b>hi</b>"},
     "markup smuggled at the top level"),
    ({"theme": {"palette": "neon"},
      "blocks": [{"id": "a", "type": "facts", "variant": "list"}]},
     "a dial position that is not on the dial"),
    ({"theme": {"glow": True},
      "blocks": [{"id": "a", "type": "facts", "variant": "list"}]},
     "a seventh dial"),
    ({"blocks": []}, "a page with no blocks"),
    ({"blocks": [{"id": "a", "type": "facts", "variant": "list"},
                 {"id": "a", "type": "rule", "variant": "skyline"}]},
     "two blocks with the same id"),
    ({"blocks": [{"id": "A Block!", "type": "facts", "variant": "list"}]},
     "an id that is not an id"),
])
def test_reject_do_not_repair(owner, business, bad, why):
    """422, naming the field. Never a quietly fixed document.

    Silent repair is how an escape hatch appears, because the repaired
    document is the one nobody reviewed.
    """
    r = _patch(owner, business, {"page": bad})
    assert r.status_code == 422, f"accepted {why}: {r.text[:300]}"


def test_a_refused_page_costs_nothing_else_in_the_save(owner, business):
    """The whole patch fails together, so a bad block cannot half-apply.

    The alternative - drop the page, keep the rest - would leave an owner
    with the accent they picked, no page, and no message saying why.
    """
    assert _patch(owner, business, {"accent": "gold"}).status_code == 200
    r = _patch(owner, business, {
        "accent": "sea",
        "page": {"blocks": [{"id": "a", "type": "nope", "variant": "x"}]},
    })
    assert r.status_code == 422, r.text
    assert _page(business, owner)["accent"] == "gold"


def test_the_block_cap_is_the_models(owner, business):
    many = {"blocks": [
        {"id": f"r{i}", "type": "rule", "variant": "skyline"} for i in range(25)
    ]}
    assert _patch(owner, business, {"page": many}).status_code == 422


# ------------------------------------------------------- stale, not invalid


def test_a_block_may_name_a_service_that_no_longer_exists(owner, business):
    """Tolerated at write, skipped at render.

    Validating ids against the gig list would make a business
    un-saveable because of something it deleted last month. Same
    reasoning as `Collection.service_ids`, and the same tolerance.
    """
    r = _patch(owner, business, {"page": {
        "blocks": [{"id": "picked", "type": "services", "variant": "grid",
                    "props": {"source": "pick", "ids": ["a-gig-that-is-gone"]}}],
    }})
    assert r.status_code == 200, r.text
    assert _page(business, owner)["page"]["blocks"][0]["props"]["ids"] == ["a-gig-that-is-gone"]


def test_someone_else_cannot_design_your_page(owner, business):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"compose-other-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": "Other", "role": "owner",
    }, timeout=30)
    other = r.json()["token"]
    assert _patch(other, business, {"page": VALID}).status_code in (403, 404)

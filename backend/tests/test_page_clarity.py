"""utils/page_clarity: the clarity floor, deterministic, per language."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.page_clarity import check_page  # noqa: E402


def _good(**over):
    b = {
        "name": "Cohen Cleaning", "name_he": "כהן ניקיון", "owner_user_id": "u1",
        "description": "Home cleaning in Jerusalem.", "areas": ["jerusalem"],
        "rating_count": 4, "verified": True, "founded_year": 2015,
        "page_brief": {"action": "message", "strengths": ["quality", "experience"]},
        "listings": [{"title": "Deep clean", "title_he": "ניקיון יסודי", "gig_type": "deliverable",
                      "area": "Jerusalem", "tiers": [{"price": 300, "images": ["x"]}], "category": "cleaning-services"}],
    }
    b.update(over)
    return b


def ids(r):
    return {x["id"]: x["passed"] for x in r["rules"]}


def test_a_clear_page_passes_in_both_languages():
    for lang in ("en", "he"):
        r = check_page(_good(), lang)
        assert r["passed"], r
        assert r["fix_first"] is None


def test_english_only_text_fails_in_hebrew():
    b = _good(name_he=None, listings=[{"title": "Deep clean", "gig_type": "deliverable", "area": "Jerusalem"}])
    assert check_page(b, "en")["passed"]
    he = check_page(b, "he")
    assert not ids(he)["where"] and not ids(he)["offer"]
    assert he["fix_first"].startswith("where")


def test_no_proof_no_brief_fails_with_the_first_thing_to_fix():
    r = check_page(_good(rating_count=0, verified=False, founded_year=None, page_brief=None), "en")
    assert not ids(r)["proof"] and not ids(r)["action"]
    assert r["fix_first"].startswith("proof")


def test_unbacked_strengths_and_impossible_actions_fail():
    r = check_page(_good(page_brief={"action": "order", "strengths": ["kosher"]}), "en")
    assert not ids(r)["action"], "order needs a store listing"
    assert not ids(r)["strengths"], "kosher needs a certificate"
    ok = check_page(_good(kosher_certification={"body": "Badatz"}, categories=["shops-products"],
                          page_brief={"action": "message", "strengths": ["kosher"]}), "en")
    assert ids(ok)["strengths"]


def test_hero_limits_and_empty_states():
    long_hero = {"blocks": [{"type": "hero", "props": {"title": "x" * 81, "lede": "Cleaning homes in Jerusalem."}}]}
    r = check_page(_good(page=long_hero), "en")
    assert not ids(r)["hero"]
    bare = check_page(_good(listings=[{"title": "Deep clean", "gig_type": "deliverable", "area": "J"}], rating_count=0), "en")
    empty = next(x for x in bare["rules"] if x["id"] == "empty_states")
    assert empty["passed"] and "photos" in empty["reason"] and "prices" in empty["reason"] and "reviews" in empty["reason"]

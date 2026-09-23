"""The clarity floor, as a deterministic check. No AI.

docs/ai-page-builder-spec.md, P4a (Tzvi, 23 Sep 2026). Given a business as
the public page loads it (GET /marketplace/business/{slug}: name,
description, areas, listings, rating, credentials, `page`, and `page_brief`
when the caller may see it) and a language, returns pass or fail per rule, a
reason in plain words, and the one thing to fix first.

Used by the upgraded renderer and, later, by the AI generator (each of the
three options in P7d must pass before it is shown; a failing one is
rejected, not repaired). Not shown to owners, not wired to saving.

English and Hebrew are checked separately: a page that answers "what do they
do" only in English fails in Hebrew, because a Hebrew reader cannot answer it.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Optional

_HEBREW = re.compile(r"[֐-׿]")
_LATIN = re.compile(r"[A-Za-z]{2}")
FOOD_CATEGORIES = {"events-catering", "shops-products"}   # frontend utils/businessProof.js
ACTIONS = ("message", "book", "visit", "order")          # "understand" leads nowhere
HERO_LIMITS = {"title": 80, "accent_word": 40, "lede": 200}   # page_composition.HeroProps
ORDER = ("where", "offer", "proof", "action", "strengths", "empty_states", "hero")


def _in_lang(text: Optional[str], lang: str) -> bool:
    text = (text or "").strip()
    if not text:
        return False
    return bool(_HEBREW.search(text)) if lang == "he" else bool(_LATIN.search(text))


def _listing_title(g: dict, lang: str) -> Optional[str]:
    for key in (("title_he", "title") if lang == "he" else ("title_en", "title")):
        if _in_lang(g.get(key), lang):
            return g.get(key)
    return None


def _has_price(g: dict) -> bool:
    items = (g.get("tiers") or []) + (g.get("products") or [])
    return any((i or {}).get("price") for i in items) or bool(g.get("cheapest_price"))


def _has_photo(g: dict) -> bool:
    if g.get("gallery"):
        return True
    for i in (g.get("tiers") or []) + (g.get("products") or []):
        if (i or {}).get("images") or (i or {}).get("image"):
            return True
    return False


def years_in_business(founded_year: Any, now: Optional[datetime] = None) -> Optional[int]:
    if not founded_year:
        return None
    years = (now or datetime.now()).year - int(founded_year)
    return years if years >= 1 else None


def _proof_items(b: dict) -> list[str]:
    known = [g.get("category") for g in b.get("listings") or []] + list(b.get("categories") or [])
    known = [c for c in known if c]
    items = []
    if (b.get("rating_count") or 0) > 0:
        items.append(f"{b.get('rating_count')} reviews")
    if b.get("verified"):
        items.append("verified")
    y = years_in_business(b.get("founded_year"))
    if y:
        items.append(f"{y} years in business")
    cert = b.get("kosher_certification") or {}
    if cert.get("body") and (not known or any(c in FOOD_CATEGORIES for c in known)):
        items.append("kosher")
    return items


def _strength_backed(s: str, b: dict) -> Optional[str]:
    """None when the strength is backed or not checkable; else why not."""
    if s == "kosher" and not (b.get("kosher_certification") or {}).get("body"):
        return "says kosher but has no certificate"
    if s == "experience" and not years_in_business(b.get("founded_year")):
        return "says experience but has no founding year"
    if s == "licensed" and not b.get("license_number"):
        return "says licensed but has no licence number"
    if s == "english" and not any(str(x).lower().startswith("en") for x in (b.get("languages") or [])):
        return "says English but English is not in their languages"
    return None


def check_page(business: dict, lang: str = "en") -> dict:
    """{lang, passed, rules: [{id, passed, reason}], fix_first}."""
    b = business or {}
    listings = [g for g in (b.get("listings") or []) if g]
    brief = b.get("page_brief") or {}
    hero = next(((blk.get("props") or {}) for blk in ((b.get("page") or {}).get("blocks") or [])
                 if (blk or {}).get("type") == "hero"), {})
    out: dict[str, tuple[bool, str]] = {}

    # 1. Where am I? Who, what, where.
    who = (b.get("name_he") if lang == "he" and b.get("name_he") else b.get("name") or "").strip()
    what = next((t for t in (hero.get("lede"), b.get("description")) if _in_lang(t, lang)), None) \
        or next((_listing_title(g, lang) for g in listings if _listing_title(g, lang)), None)
    where = bool(b.get("areas") or b.get("serves_nationwide") or any(g.get("area") for g in listings))
    missing = [n for n, ok in (("a name", bool(who)), ("what they do in this language", bool(what)), ("where they work", where)) if not ok]
    out["where"] = (not missing, "Answers who, what and where." if not missing else f"Missing {', '.join(missing)}.")

    # 2. What do I get? At least one thing named, in this language.
    named = [g for g in listings if _listing_title(g, lang)]
    out["offer"] = (bool(named), f"{len(named)} of {len(listings)} services named in this language." if named
                    else ("No services listed yet." if not listings else "No service has a name in this language."))

    # 3. Why should I care? Real proof only.
    proof = _proof_items(b)
    out["proof"] = (bool(proof), f"Backed by: {', '.join(proof)}." if proof
                    else "Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.")

    # 4. What do I do next? One leading action from the brief, possible here.
    act = brief.get("action")
    possible = {
        "message": bool(b.get("owner_user_id") and listings),
        "book": any(g.get("gig_type") != "store" for g in listings),
        "order": any(g.get("gig_type") == "store" for g in listings),
        "visit": bool(b.get("areas") or any(g.get("area") for g in listings)),
    }
    if act not in ACTIONS:
        out["action"] = (False, "No leading action chosen in the page brief." if not act
                         else "The brief's action ('understand') is not an action a visitor can take.")
    elif not possible[act]:
        out["action"] = (False, f"The brief says '{act}', but nothing on the page supports it.")
    else:
        out["action"] = (True, f"Leads with '{act}'.")

    # 5. At most two strengths, the checkable ones backed by data.
    strengths = list(brief.get("strengths") or [])
    unbacked = [f"'{s}' {why}" for s in strengths if (why := _strength_backed(s, b))]
    if len(strengths) > 2:
        out["strengths"] = (False, f"{len(strengths)} strengths; the limit is 2.")
    elif unbacked:
        out["strengths"] = (False, "Unbacked claim: " + "; ".join(unbacked) + ".")
    else:
        out["strengths"] = (True, f"{len(strengths)} strength(s), all backed or not checkable." if strengths else "No strengths chosen.")

    # 6. Empty states: what the page must show deliberately. Never a
    #    failure of the content; it tells the renderer what to cover.
    empties = [n for n, empty in (("photos", not any(_has_photo(g) for g in listings)),
                                  ("prices", not any(_has_price(g) for g in listings)),
                                  ("reviews", not (b.get("rating_count") or 0))) if empty]
    out["empty_states"] = (True, "Must read as intentional with no " + ", ".join(empties) + "." if empties else "No empty states.")

    # 7. Hero text within HeroProps limits.
    long_ = [f"{k} {len(hero.get(k) or '')}/{n}" for k, n in HERO_LIMITS.items() if len(hero.get(k) or "") > n]
    out["hero"] = (not long_, "Hero text within limits." if not long_ else "Too long: " + ", ".join(long_) + ".")

    rules = [{"id": k, "passed": out[k][0], "reason": out[k][1]} for k in ORDER]
    first = next((r for r in rules if not r["passed"]), None)
    return {"lang": lang, "passed": first is None, "rules": rules,
            "fix_first": f"{first['id']}: {first['reason']}" if first else None}

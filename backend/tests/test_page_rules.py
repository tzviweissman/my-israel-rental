"""utils/page_rules: the rules an AI-built page must pass (docs/page-generation-rules.md).

The fixtures are the golden set: one business per playbook, with a page a
good generator should produce, in English and Hebrew. When a bad page
slips through in real use, it becomes a case here.
"""
from __future__ import annotations

import sys
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.page_rules import check_composition, check_options, check_unique  # noqa: E402

BREAD = (("Sourdough loaf", "לחם מחמצת", 32), ("Challah", "חלה", 45))


def biz(category, gig_type="deliverable", items=BREAD, **over):
    b = {
        "name": "Shira's Kitchen", "name_he": "המטבח של שירה", "owner_user_id": "u1",
        "description": "Sourdough and challah from our home bakery in Beit Shemesh. Orders by Thursday for Shabbat.",
        "areas": ["bet-shemesh"], "rating_count": 0, "verified": False, "founded_year": 2019,
        "cover_url": "https://img/cover.jpg", "logo_url": None, "languages": ["en", "he"],
        "page_brief": {"action": "order" if gig_type == "store" else "book", "pricing": "fair", "strengths": [], "note": ""},
        "listings": [
            {"id": f"g{i + 1}", "title": en, "title_he": he, "category": category, "gig_type": gig_type,
             "area": "Beit Shemesh", "gallery": ["a", "b"] if i == 0 else [],
             "tiers": [{"name": en, "price": price, **({"images": ["c"]} if i == 0 else {})}]}
            for i, (en, he, price) in enumerate(items)
        ],
    }
    b.update(over)
    return b


def page(title, lede, lead="services", theme=None, extra=()):
    blocks = [{"id": "hero", "type": "hero", "variant": "band", "props": {"image": "cover", "title": title, "lede": lede}}]
    order = {"services": [("catalog", "services", "grid", {"heading": ""}), ("facts", "facts", "list", {})],
             "facts": [("facts", "facts", "list", {}), ("catalog", "services", "list", {"heading": ""})],
             "gallery": [("photos", "gallery", "carousel", {"images": ["cover", "listing:g1", "listing:g2"]}),
                         ("catalog", "services", "grid", {"heading": ""}), ("facts", "facts", "list", {})]}[lead]
    blocks += [{"id": i, "type": t, "variant": v, "props": p} for i, t, v, p in order]
    blocks += list(extra)
    blocks.append({"id": "contact", "type": "contact", "variant": "stack", "props": {}})
    return {"theme": {"palette": "stone", **(theme or {})}, "blocks": blocks}


def failed(r):
    return {x["id"] for x in r["rules"] if not x["passed"]}


# One good page per playbook, in both languages: (category, gig_type, lead, their listings, en, he)
GOLDEN = [
    ("shops-products", "store", "services", BREAD,
     ("Sourdough and challah in Beit Shemesh", "Order by Thursday for Shabbat. Two challahs are 45 shekels."),
     ("מחמצת וחלות בבית שמש", "מזמינים עד חמישי לשבת.")),
    ("personal-care", "appointment", "services", (("Haircut and color", "תספורת וצבע", 180),),
     ("Haircuts and color in Beit Shemesh", "Book a time that suits you."),
     ("תספורות וצבע בבית שמש", "קובעים תור בשעה שנוחה לכם.")),
    ("home-services-repair", "deliverable", "facts", (("Home repairs", "תיקונים בבית", 250),),
     ("Repairs around the home in Beit Shemesh", "Tell us what broke and we reply with a quote."),
     ("תיקונים בבית, בבית שמש", "ספרו מה התקלקל ונחזור עם הצעת מחיר.")),
    ("events-catering", "deliverable", "gallery", (("Catering for simchas", "קייטרינג לשמחות", 90), ("Kiddush platters", "מגשי קידוש", 400)),
     ("Catering for simchas in Beit Shemesh", "Menus for small and large events."),
     ("קייטרינג לשמחות בבית שמש", "תפריטים לאירועים קטנים וגדולים.")),
    ("cleaning-services", "appointment", "facts", (("Home cleaning", "ניקיון בית", 300),),
     ("Home cleaning in Beit Shemesh", "Weekly or one-off, you choose."),
     ("ניקיון בתים בבית שמש", "כל שבוע או פעם אחת, לבחירתכם.")),
    ("health-fitness", "appointment", "services", (("Personal training session", "אימון אישי", 200),),
     ("Personal training in Beit Shemesh", "Sessions at your home or in the park."),
     ("אימון אישי בבית שמש", "אימונים בבית או בפארק.")),
    ("travel-tourism", "appointment", "gallery", (("Half-day walking tour", "סיור רגלי חצי יום", 150), ("Family tour", "סיור משפחות", 120)),
     ("Walking tours from Beit Shemesh", "Half-day routes for families."),
     ("סיורים רגליים מבית שמש", "מסלולים של חצי יום למשפחות.")),
]


def test_every_playbook_has_a_page_that_passes_in_both_languages():
    for cat, gtype, lead, items, en, he in GOLDEN:
        b = biz(cat, gtype, items)
        for lang, (title, lede) in (("en", en), ("he", he)):
            r = check_composition(b, page(title, lede, lead), lang)
            assert r["passed"], (cat, lang, r["fix_first"])


def test_invented_numbers_and_unbacked_claims_are_rejected():
    b = biz("shops-products", "store")
    cases = {
        "numbers": ("Bread since 1998 in Beit Shemesh", "Loved by 500 families."),   # 1998, 500 not theirs
        "claims": ("The best bakery in Beit Shemesh", "Kosher sourdough and challah."),
    }
    r = check_composition(b, page(*cases["numbers"]), "en")
    assert "numbers" in failed(r) and "1998" in r["fix_first"] or "500" in str(r)
    r = check_composition(b, page(*cases["claims"]), "en")
    reason = next(x["reason"] for x in r["rules"] if x["id"] == "claims")
    assert "best" in reason and "kosher" in reason
    # the same claims pass once the proof exists or the owner said it
    ok = biz("shops-products", "store", kosher_certification={"body": "Badatz Beit Shemesh"},
             description="The best sourdough in Beit Shemesh, in our words. Orders by Thursday.")
    assert "claims" not in failed(check_composition(ok, page(*cases["claims"]), "en"))
    # a number from their own data is fine: founded 2019, their price 45
    assert check_composition(b, page("Baking since 2019 in Beit Shemesh", "Two challahs, 45 shekels."), "en")["passed"]


def test_reviews_and_licence_claims_need_the_data():
    b = biz("home-services-repair")
    r = check_composition(b, page("Licensed repairs, five-star reviews", "Beit Shemesh and around.", "facts"), "en")
    reason = next(x["reason"] for x in r["rules"] if x["id"] == "claims")
    assert "licence number" in reason and "reviews" in reason
    backed = biz("home-services-repair", license_number="12345", rating_count=7)
    assert "claims" not in failed(check_composition(backed, page("Licensed repairs, five-star reviews", "Beit Shemesh and around.", "facts"), "en"))


def test_urgency_is_never_allowed_and_facts_are_not_urgency():
    b = biz("shops-products", "store", description="Only 3 loaves left most Fridays, honestly.")
    for title in ("Only 3 loaves left today", "Hurry, challah for Shabbat", "נשארו רק 3 חלות"):
        assert "urgency" in failed(check_composition(b, page(title, "Beit Shemesh."), "he" if "ח" in title else "en"))
    assert "urgency" not in failed(check_composition(b, page("Open only on Fridays", "Beit Shemesh."), "en"))


def test_filler_punctuation_and_shouting():
    b = biz("cleaning-services", "appointment")
    assert "generic" in failed(check_composition(b, page("Welcome to Shira's Kitchen", "Home cleaning.", "facts"), "en"))
    assert "punctuation" in failed(check_composition(b, page("Clean homes, every week!", "Beit Shemesh.", "facts"), "en"))
    assert "punctuation" in failed(check_composition(b, page("Clean homes — every week", "Beit Shemesh.", "facts"), "en"))
    assert "punctuation" in failed(check_composition(b, page("SPOTLESS homes every week", "Beit Shemesh.", "facts"), "en"))


def test_language_hero_and_health_claims():
    b = biz("health-fitness", "appointment")
    r = check_composition(b, page("Personal training in Beit Shemesh", "Sessions at home."), "he")
    assert "language" in failed(r), "an English hero on a Hebrew page"
    assert "hero" in failed(check_composition(b, page("Shira's Kitchen", ""), "en")), "headline is only the name"
    assert "claims" in failed(check_composition(b, page("Training for weight loss", "Beit Shemesh."), "en"))
    # "health" is not "heal", "treats" in a bakery is not medicine
    assert "claims" not in failed(check_composition(b, page("Health coaching in Beit Shemesh", "Sessions at home."), "en"))


def test_structure_action_images_prices_and_playbook():
    b = biz("personal-care", "appointment")
    no_catalog = page("Haircuts in Beit Shemesh", "Book a time.")
    no_catalog["blocks"] = [x for x in no_catalog["blocks"] if x["type"] != "services"]
    r = check_composition(b, no_catalog, "en")
    assert {"action", "playbook"} <= failed(r), "book needs the services block; personal care needs services"

    one_photo = biz("events-catering", cover_url="https://img/c.jpg", listings=[{**biz("events-catering")["listings"][1], "id": "g2"}])
    assert "images" in failed(check_composition(one_photo, page("Catering for simchas", "Menus for events.", "gallery"), "en"))

    stranger = page("Haircuts in Beit Shemesh", "Book a time.")
    stranger["blocks"][0]["props"]["image"] = "listing:not-theirs"
    assert "images" in failed(check_composition(b, stranger, "en"))

    no_cover = biz("personal-care", "appointment", cover_url=None)
    assert "images" in failed(check_composition(no_cover, page("Haircuts in Beit Shemesh", "Book a time.", theme={"imagery": "full-bleed"}), "en"))

    premium = biz("personal-care", "appointment", page_brief={"action": "book", "pricing": "premium"})
    assert "prices" in failed(check_composition(premium, page("Haircuts in Beit Shemesh", "Book a time.", theme={"price_prominence": "loud"}), "en"))

    repair = biz("home-services-repair")
    wrong_lead = page("Repairs around the home in Beit Shemesh", "Tell us what broke.", "gallery")
    assert "playbook" in failed(check_composition(repair, wrong_lead, "en")), "repairs lead with services or facts"

    doubled = page("Haircuts in Beit Shemesh", "Book a time.", extra=[{"id": "c2", "type": "contact", "variant": "stack", "props": {}}])
    assert "structure" in failed(check_composition(b, doubled, "en"))


def test_schema_violations_are_rejected_not_repaired():
    b = biz("shops-products", "store")
    bad = page("Sourdough in Beit Shemesh", "Order by Thursday.")
    bad["blocks"][0]["props"]["image"] = "https://evil.example/x.jpg"
    r = check_composition(b, bad, "en")
    assert not r["passed"] and r["fix_first"].startswith("schema")


def test_content_gaps_never_reject_an_option():
    b = biz("shops-products", "store", founded_year=None)  # no reviews, not verified, no founding year: their gap
    r = check_composition(b, page("Sourdough and challah in Beit Shemesh", "Order by Thursday for Shabbat."), "en")
    assert r["passed"]
    assert any(g["id"] == "proof" for g in r["content_gaps"])


def test_three_options_must_really_differ():
    b = biz("shops-products", "store")
    a = page("Sourdough and challah in Beit Shemesh", "Order by Thursday for Shabbat.")
    near_copy = deepcopy(a)
    near_copy["theme"]["density"] = "airy"
    near_copy["blocks"][0]["props"]["title"] = "Challah and sourdough, Beit Shemesh"
    other = page("Challah for Shabbat, from Beit Shemesh", "Two challahs are 45 shekels.", "gallery",
                 theme={"type": "grotesque", "density": "packed"})
    r = check_options(b, [a, near_copy, other], "en")
    assert not r["distinct"] and "options 1 and 2" in r["why_not_distinct"][0]
    third = page("Your Shabbat sourdough loaf", "Order by Thursday.", theme={"type": "geometric", "imagery": "thumbnail"})
    assert check_options(b, [a, other, third], "en")["passed"]
    assert not check_options(b, [a, other], "en")["passed"], "three options, not two"


def test_the_hero_repeats_what_they_sell_and_stays_short():
    b = biz("shops-products", "store")
    r = check_composition(b, page("Something good in Beit Shemesh", "Order by Thursday."), "en")
    assert "congruency" in failed(r), "a place name alone is not the promise"
    assert "congruency" not in failed(check_composition(b, page("Challah for Shabbat", "Order by Thursday."), "en"))
    assert "congruency" not in failed(check_composition(b, page("חלות לשבת", "מזמינים עד חמישי."), "he")), "Hebrew prefixes"
    long_lede = "Order by Thursday and collect on Friday morning from the bakery door, or ask us about a bigger order for a simcha or event."
    assert "hero" in failed(check_composition(b, page("Challah for Shabbat", long_lede), "en"))


def test_each_page_is_unique_among_recent_ones_of_its_kind():
    a = page("Challah for Shabbat", "Order by Thursday.")
    twin = page("Sourdough in Beit Shemesh", "Order by Thursday.", theme={"density": "airy"})
    assert not check_unique(a, [twin])["passed"], "same layout and nearly the same dials"
    different = page("Bread for Shabbat", "Order by Thursday.", "gallery",
                     theme={"type": "grotesque", "density": "packed", "imagery": "thumbnail"})
    assert check_unique(a, [different])["passed"]
    assert check_unique(a, [])["passed"]

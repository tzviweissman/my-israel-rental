"""utils/page_recipes: every recipe, filled from sample businesses, passes
utils/page_rules in English and Hebrew (docs/ai-page-builder-spec.md,
"Category study").

SAMPLES are imaginary local businesses, one per recipe plus the five
situations the study cared most about. scripts/preview-page-recipes.py
seeds the same ones into the LOCAL database to screenshot them.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.page_composition import BLOCKS, DIALS, PageComposition  # noqa: E402
from utils.page_recipes import RECIPES, fill, options, recipe_name  # noqa: E402
from utils.page_rules import check_composition, check_options  # noqa: E402

IMG = "https://img/x.jpg"


def listing(i, en, he, category, price=None, gig_type="appointment", photos=0, products=None, area="Bet Shemesh"):
    g = {"id": f"g{i}", "title": en or he, "title_he": he, "category": category, "gig_type": gig_type, "area": area,
         "gallery": [IMG] * photos}
    if en and he:
        g["title_en"] = en
    if products:
        g["products"] = products
    elif price:
        g["tiers"] = [{"name": en or he, "price": price}]
    if price:
        g["cheapest_price"] = price
    return g


def business(name, name_he, description, description_he, listings, brief, **over):
    b = {"name": name, "name_he": name_he, "owner_user_id": "u1", "description": description,
         "description_he": description_he, "areas": ["bet-shemesh"], "rating_count": 0, "verified": False,
         "cover_url": None, "logo_url": None, "languages": ["he", "en"], "page_brief": brief, "listings": listings}
    b.update(over)
    return b


def brief(showing=None, action=None, pricing=None, audience=None, strengths=()):
    return {"showing": showing, "action": action, "pricing": pricing, "audience": audience,
            "strengths": list(strengths), "note": ""}


BOARDS = [{"name": n, "price": p, "width_cm": w, "length_cm": ln, "images": [IMG]}
          for n, p, w, ln in (("Small", 180, 15, 20), ("Medium", 320, 25, 35), ("Large", 520, 37, 57))]
JOBS = [("Tap repair", "תיקון ברז"), ("Door hanging", "תליית דלת"), ("Shelf mounting", "התקנת מדפים"),
        ("Blind repair", "תיקון תריס"), ("Lock change", "החלפת מנעול"), ("Wall patching", "תיקון קירות"),
        ("TV mounting", "תליית טלוויזיה"), ("Furniture assembly", "הרכבת רהיטים"), ("Caulking", "איטום"),
        ("Toilet repair", "תיקון אסלה"), ("Light fitting", "התקנת גוף תאורה"), ("Curtain rails", "מסילות וילון"),
        ("Cabinet hinges", "צירים לארונות"), ("Drain unblocking", "פתיחת סתימות"), ("Painting touch-ups", "תיקוני צבע"),
        ("Tile repair", "תיקון אריחים"), ("Window handles", "ידיות לחלונות"), ("Mirror hanging", "תליית מראה"),
        ("Gate repair", "תיקון שער"), ("Mailbox repair", "תיקון תיבת דואר"), ("Closet doors", "דלתות ארון"),
        ("Sink install", "התקנת כיור"), ("Shower head", "החלפת ראש מקלחת"), ("Radiator bleeding", "ניקוז רדיאטור"),
        ("Smoke alarm", "התקנת גלאי עשן")]

SAMPLES: dict[str, dict] = {
    # The five situations, each previewed under every recipe.
    "one-service-no-photos": business(
        "Clean Corner", "פינה נקייה",
        "Home cleaning in Bet Shemesh. Weekly or one-off, you choose the day.",
        "ניקיון בתים בבית שמש. כל שבוע או פעם אחת, אתם בוחרים את היום.",
        [listing(1, "Home cleaning", "ניקיון בית", "cleaning-services", 300)],
        brief("services", "book", "fair"), founded_year=2018),
    "twenty-five-services": business(
        "Fix It Home", "מתקנים בבית",
        "Small repairs around the house. Tell us what broke and we reply with a quote.",
        "תיקונים קטנים בבית. ספרו מה התקלקל ונחזור עם הצעת מחיר.",
        [listing(i + 1, en, he, "home-services-repair", 150 + 10 * i if i % 3 else None, photos=1 if i < 4 else 0)
         for i, (en, he) in enumerate(JOBS)],
        brief("services", "message", "quote", strengths=("licensed",)),
        license_number="54321", cover_url=IMG, hours="Sun to Thu, 8:00 to 18:00"),
    "kosher-food": business(
        "Emek Catering", "קייטרינג העמק",
        "Catering for simchas and Shabbat in Bet Shemesh. Menus for small and large events.",
        "קייטרינג לשמחות ולשבת בבית שמש. תפריטים לאירועים קטנים וגדולים.",
        [listing(1, "Kiddush platters", "מגשי קידוש", "events-catering", 400, "deliverable", photos=2),
         listing(2, "Shabbat meals", "ארוחות שבת", "events-catering", 90, "deliverable", photos=1),
         listing(3, "Simcha menus", "תפריטי שמחות", "events-catering", None, "deliverable", photos=1)],
        brief("catalogue", "message", "fair", strengths=("kosher",)),
        kosher_certification={"body": "Badatz Beit Shemesh"}, cover_url=IMG, rating_count=12, rating_avg=4.8),
    "brand-new": business(
        "Park Training", "אימונים בפארק",
        "Personal training in the park or at your home. First session is a chat about what you want.",
        "אימון אישי בפארק או אצלכם בבית. המפגש הראשון הוא שיחה על מה שאתם רוצים.",
        [listing(1, "Personal training session", "אימון אישי", "health-fitness", 200),
         listing(2, "Small group training", "אימון בקבוצה קטנה", "health-fitness", 80)],
        brief("services", "book", "value"), cover_url=IMG, created_at=datetime.now().isoformat()),
    "hebrew-only": business(
        "עוגות של רחלי", "עוגות של רחלי", "עוגות ביתיות לשבת ולאירועים. מזמינים עד יום רביעי.",
        "עוגות ביתיות לשבת ולאירועים. מזמינים עד יום רביעי.",
        [listing(1, None, "עוגת שמרים", "shops-products", 60, "store", photos=1),
         listing(2, None, "עוגת גבינה", "shops-products", 90, "store", photos=1),
         listing(3, None, "עוגיות לשבת", "shops-products", 40, "store", photos=1)],
        brief("catalogue", "order", "fair"), languages=["he"], cover_url=IMG),
    # One more per recipe the five don't choose on their own.
    "board-shop": business(
        "Board House", "בית הקרשים", "Charcuterie boards for Shabbat and simchas. Order by Thursday.",
        "קרשי אירוח לשבת ולשמחות. מזמינים עד חמישי.",
        [listing(1, "Charcuterie boards", "קרשי אירוח", "shops-products", None, "store", photos=1, products=BOARDS)],
        brief("catalogue", "order", "fair"), cover_url=IMG),
    "tour-guide": business(
        "Hills Walks", "סיורי הגבעות", "Walking tours in the hills around Bet Shemesh. Half a day, for families.",
        "סיורים רגליים בגבעות סביב בית שמש. חצי יום, למשפחות.",
        [listing(1, "Half-day walking tour", "סיור רגלי חצי יום", "travel-tourism", 150, photos=3)],
        brief("one-thing", "book", "fair", "tourists", ("english", "licensed")),
        cover_url=IMG, license_number="7788", languages=["en", "he"]),
    "cafe": business(
        "Corner Cafe", "הקפה בפינה", "Coffee and pastries on the main street. Sit in or take away.",
        "קפה ומאפים ברחוב הראשי. לשבת או לקחת.",
        [listing(1, "Coffee and pastries", "קפה ומאפים", "shops-products", 25, "store", photos=2),
         listing(2, "Breakfast plates", "ארוחות בוקר", "shops-products", 55, "store", photos=1)],
        brief("place", "visit", "fair", "locals"), cover_url=IMG, hours="Sun to Fri, 7:00 to 14:00"),
    "host": business(
        "Garden Stays", "אירוח בגינה", "Two apartments with a garden, for short stays and families.",
        "שתי דירות עם גינה, לשהייה קצרה ולמשפחות.",
        [listing(1, "Garden apartment for short stays", "דירת גן לשהייה קצרה", "short-stays", 450, photos=3),
         listing(2, "Family apartment", "דירה למשפחות", "short-stays", 600, photos=2)],
        brief("properties", "message", "fair", "tourists"), cover_url=IMG, verified=True),
}
FIVE = ("one-service-no-photos", "twenty-five-services", "kosher-food", "brand-new", "hebrew-only")


def _failed(r):
    return [x["id"] + ": " + x["reason"] for x in r["rules"] if not x["passed"]]


def test_recipes_are_closed_vocabulary_and_hold_no_urls():
    for name, r in RECIPES.items():
        assert set(r) == {"order", "blocks", "theme"}, name
        assert r["order"][-1] == "contact", f"{name}: a page ends on its action"
        for kind in r["order"]:
            assert kind in BLOCKS and kind not in ("hero", "cover", "rule"), (name, kind)
        for kind, (variant, _props) in r["blocks"].items():
            assert variant in BLOCKS[kind]["variants"], (name, kind, variant)
        for dial, value in r["theme"].items():
            assert value in DIALS[dial], (name, dial, value)
        assert "http" not in json.dumps(r) and "//" not in json.dumps(r), name


def test_each_sample_chooses_the_expected_recipe():
    expected = {"one-service-no-photos": "services", "twenty-five-services": "services", "kosher-food": "food",
                "brand-new": "services", "hebrew-only": "catalogue", "board-shop": "catalogue",
                "tour-guide": "one-thing", "cafe": "place", "host": "properties"}
    assert {k: recipe_name(b) for k, b in SAMPLES.items()} == expected
    assert set(expected.values()) == set(RECIPES), "every recipe has a sample"


def test_every_recipe_passes_the_rules_for_every_sample_in_both_languages():
    """Each recipe, forced onto each sample: the recipe is safe whatever
    business it meets, or it says plainly why it can't write the page."""
    for key, b in SAMPLES.items():
        for name in RECIPES:
            for lang in ("en", "he"):
                out = fill(b, lang, name=name)
                if out["composition"] is None:
                    assert key == "hebrew-only" and lang == "en", (key, name, lang, out["why"])
                    assert "English" in out["why"]
                    continue
                PageComposition(**out["composition"])
                r = check_composition(b, out["composition"], lang)
                assert r["passed"], (key, name, lang, _failed(r))


def test_three_options_pass_and_really_differ():
    for key, b in SAMPLES.items():
        for lang in ("en", "he"):
            opts = options(b, lang)
            if key == "hebrew-only" and lang == "en":
                assert opts == [None, None, None]
                continue
            r = check_options(b, opts, lang)
            assert r["passed"], (key, lang, r["why_not_distinct"], [_failed(o) for o in r["options"]])


def test_hero_text_is_only_their_words():
    b = SAMPLES["kosher-food"]
    en = fill(b, "en")["composition"]["blocks"][0]["props"]
    he = fill(b, "he")["composition"]["blocks"][0]["props"]
    # three listings: two of theirs named as they wrote them, and honestly "and more"
    assert en["title"] == "Kiddush platters, Shabbat meals and more in Bet Shemesh"
    assert he["title"] == "מגשי קידוש, ארוחות שבת ועוד בבית שמש"
    assert en["lede"] == "Catering for simchas and Shabbat in Bet Shemesh."
    assert he["lede"] == "קייטרינג לשמחות ולשבת בבית שמש."
    # the hero shows a photo of what they sell, not the cover the header shows
    assert fill(b, "en")["composition"]["blocks"][0]["props"]["image"] == "listing:g1"
    # one listing: the listing's own name and their area
    one = fill(SAMPLES["one-service-no-photos"], "en")["composition"]["blocks"][0]["props"]
    assert one["title"] == "Home cleaning in Bet Shemesh"
    assert one["lede"] == "Weekly or one-off, you choose the day.", "never the headline said twice"


def test_the_brief_moves_the_recipe():
    b = SAMPLES["cafe"]
    blocks = [x["type"] for x in fill(b, "en")["composition"]["blocks"]]
    # visit: the facts (hours) come right after what the playbook lets lead
    assert blocks[:3] == ["hero", "gallery", "facts"] or blocks[:3] == ["hero", "services", "facts"], blocks
    # a backed strength pulls the facts up; licensed is backed for the guide
    tour = [x["type"] for x in fill(SAMPLES["tour-guide"], "en")["composition"]["blocks"]]
    assert tour.index("facts") == 2, tour
    # premium: airy and quiet, never packed or loud
    prem = dict(SAMPLES["brand-new"], page_brief=brief("services", "book", "premium"))
    t = fill(prem, "en")["composition"]["theme"]
    assert (t["density"], t["price_prominence"]) == ("airy", "quiet")
    # the size ladder appears only with three measured products
    assert "sizes" in [x["type"] for x in fill(SAMPLES["board-shop"], "en")["composition"]["blocks"]]
    assert "sizes" not in [x["type"] for x in fill(SAMPLES["hebrew-only"], "he")["composition"]["blocks"]]
    # no photos: no gallery, no full-bleed
    none = fill(SAMPLES["one-service-no-photos"], "en")["composition"]
    assert "gallery" not in [x["type"] for x in none["blocks"]] and none["theme"]["imagery"] != "full-bleed"

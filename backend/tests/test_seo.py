"""Search engines and AI assistants (routes/seo.py): upgraded business and
rental pages get a readable copy with schema.org data; free pages get
nothing new. Local dev database only."""
import json
import os
import re
import sys
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pymongo import MongoClient  # noqa: E402

API = os.environ.get("TEST_API", "http://localhost:8001/api")
LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
M = "_seo_test"
PAID, FREE = f"{M}-paid", f"{M}-free"
RENT_PAID, RENT_FREE = f"{M}-rent-paid", f"{M}-rent-free"
BOT = {"User-Agent": "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)"}


def _ld(page: str) -> list[dict]:
    return [json.loads(b) for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, re.S)]


def test_business_jsonld_has_prices_rating_and_faq():
    from routes.seo import business_jsonld
    data = {
        "id": "b", "name": "Emek Catering", "description": "Catering in Bet Shemesh.", "areas": ["bet-shemesh"],
        "kosher_certification": {"body": "Badatz"}, "rating_avg": 4.84, "rating_count": 12, "languages": ["he"],
        "listings": [{"title": "Shabbat meals", "tiers": [{"name": "Family meal", "price": 320, "currency": "ILS"}],
                      "faqs": [{"question": "Do you deliver?", "answer": "Yes, Thursday and Friday."},
                               {"question": "Unanswered?", "answer": ""}]}],
    }
    business, faq = business_jsonld(data, "https://x/business/emek", [])
    assert business["@type"] == "FoodEstablishment" and business["servesCuisine"] == "Kosher"
    assert business["aggregateRating"] == {"@type": "AggregateRating", "ratingValue": 4.8, "reviewCount": 12,
                                           "bestRating": 5, "worstRating": 1}
    offer = business["hasOfferCatalog"]["itemListElement"][0]
    assert offer["price"] == 320 and offer["priceCurrency"] == "ILS" and offer["itemOffered"]["name"] == "Family meal"
    assert business["areaServed"] == [{"@type": "City", "name": "Bet Shemesh"}]
    # Only answered questions; an empty answer is not an answer.
    assert faq["@type"] == "FAQPage" and len(faq["mainEntity"]) == 1


def test_owner_text_cannot_close_the_script_tag():
    from routes.seo import render_business
    data = {"id": "b", "slug": "b", "name": "</script><script>alert(1)</script>", "description": "x", "listings": []}
    page = render_business(data, [], "en")
    assert "<script>alert(1)" not in page
    assert _ld(page)[0]["name"] == "</script><script>alert(1)</script>"


def test_hebrew_copy_uses_the_hebrew_text_and_labels():
    from routes.seo import render_business
    data = {"id": "b", "slug": "cakes", "name": "Rachel's Cakes", "name_he": "העוגות של רחלי",
            "description": "Home cakes", "description_he": "עוגות ביתיות", "areas": ["bet-shemesh"],
            "categories": ["shops-products"], "by_appointment": True, "listings": []}
    page = render_business(data, [], "he")
    assert '<html lang="he" dir="rtl">' in page
    assert "<h1>העוגות של רחלי</h1>" in page and "עוגות ביתיות" in page and "בית שמש" in page
    assert "בתיאום מראש בלבד" in page
    assert 'hreflang="he" href="https://myisraelrental.com/business/cakes?lng=he"' in page
    assert '<link rel="canonical" href="https://myisraelrental.com/business/cakes?lng=he"/>' in page


def _api_up():
    try:
        return requests.get(f"{API}/health", timeout=3).ok
    except requests.RequestException:
        return False


live = pytest.mark.skipif(not (LOCAL and _api_up()), reason="needs the local API and the local MongoDB")


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def pages():
    db = _db()
    db.users.insert_many([
        {"id": f"{M}-paid-owner", "email": f"{M}-paid@local.test", "page_upgrade": True, "marker": M},
        {"id": f"{M}-free-owner", "email": f"{M}-free@local.test", "marker": M},
    ])
    for biz, owner, name in ((PAID, f"{M}-paid-owner", "Paid Plumbing"), (FREE, f"{M}-free-owner", "Free Plumbing")):
        db.businesses.insert_one({"_id": biz, "slug": biz, "name": name, "owner_user_id": owner, "marker": M,
                                  "description": f"{name} across Jerusalem.", "areas": ["jerusalem"]})
        db.marketplace_gigs.insert_one({"_id": f"{biz}-gig", "marker": M, "business_id": biz, "provider_user_id": owner,
                                        "status": "published", "title": "Leak repair",
                                        "tiers": [{"name": "Call-out", "price": 250, "currency": "ILS"}]})
    for pid, owner in ((RENT_PAID, f"{M}-paid-owner"), (RENT_FREE, f"{M}-free-owner")):
        db.properties.insert_one({"id": pid, "owner_id": owner, "title": f"Garden flat {pid}", "area": "Katamon",
                                  "rental_type": "long_term", "property_type": "apartment", "bedrooms": 2,
                                  "monthly_price": 7200, "currency": "ILS", "images": [], "marker": M})
    yield
    for col in ("users", "businesses", "marketplace_gigs", "properties"):
        db[col].delete_many({"marker": M})


@live
def test_upgraded_business_gets_a_readable_page_and_free_does_not(pages):
    r = requests.get(f"{API}/seo/business/{PAID}", headers=BOT, timeout=10)
    assert r.status_code == 200 and "<h1>Paid Plumbing</h1>" in r.text and "₪250" in r.text
    assert _ld(r.text)[0]["@type"] == "LocalBusiness"
    assert requests.get(f"{API}/seo/business/{FREE}", headers=BOT, timeout=10).status_code == 404


@live
def test_upgraded_rental_gets_a_readable_page_and_free_does_not(pages):
    r = requests.get(f"{API}/seo/property/{RENT_PAID}", headers=BOT, timeout=10)
    assert r.status_code == 200 and "₪7,200 per month" in r.text
    blocks = _ld(r.text)
    assert blocks[0]["@type"] == "Apartment" and blocks[1]["offers"]["price"] == 7200
    assert requests.get(f"{API}/seo/property/{RENT_FREE}", timeout=10).status_code == 404
    # A hidden listing is not offered, upgrade or not.
    _db().properties.update_one({"id": RENT_PAID}, {"$set": {"is_hidden": True}})
    try:
        assert requests.get(f"{API}/seo/property/{RENT_PAID}", timeout=10).status_code == 404
    finally:
        _db().properties.update_one({"id": RENT_PAID}, {"$unset": {"is_hidden": ""}})


@live
def test_sitemap_and_llms_list_only_upgraded_pages(pages):
    urls = [e["url"] for e in requests.get(f"{API}/seo/sitemap-entries", timeout=10).json()["entries"]]
    assert any(u.endswith(f"/business/{PAID}") for u in urls) and any(u.endswith(f"/property/{RENT_PAID}") for u in urls)
    assert not any(FREE in u for u in urls) and not any(RENT_FREE in u for u in urls)
    text = requests.get(f"{API}/seo/llms.txt", timeout=10).text
    assert text.startswith("# MyIsraelRental") and "Paid Plumbing" in text and "Free Plumbing" not in text


@live
def test_a_crawler_visit_is_not_counted_as_a_view(pages):
    db = _db()
    before = db.view_events.count_documents({"entity_id": PAID}) if "view_events" in db.list_collection_names() else 0
    requests.get(f"{API}/seo/business/{PAID}", headers=BOT, timeout=10)
    after = db.view_events.count_documents({"entity_id": PAID}) if "view_events" in db.list_collection_names() else 0
    assert after == before


@live
def test_indexnow_sends_changed_upgraded_pages_only(pages):
    import asyncio
    from routes.seo import changed_urls
    run = asyncio.get_event_loop().run_until_complete
    first = run(changed_urls(""))
    assert any(u.endswith(f"/business/{PAID}") for u in first) and any(u.endswith(f"/property/{RENT_PAID}") for u in first)
    assert not any(FREE in u or RENT_FREE in u for u in first)
    # Nothing changed since now: nothing to send. Then one listing changes.
    assert not any(M in u for u in run(changed_urls("2999-01-01T00:00:00")))
    _db().marketplace_gigs.update_one({"_id": f"{PAID}-gig"}, {"$set": {"updated_at": "2999-06-01T00:00:00"}})
    later = run(changed_urls("2999-01-01T00:00:00"))
    assert any(u.endswith(f"/business/{PAID}") for u in later) and not any(RENT_PAID in u for u in later)


@live
def test_indexnow_key_file_is_absent_without_a_key():
    if os.environ.get("INDEXNOW_KEY"):
        pytest.skip("a key is set locally")
    assert requests.get(f"{API}/seo/indexnow-key.txt", timeout=10).status_code == 404

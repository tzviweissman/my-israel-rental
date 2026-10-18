"""Search engines and AI assistants: readable pages for upgraded listings.

WHY (Tzvi, 18 Oct 2026: "how can we help businesses using our site with SEO
and be found on different LLMs", then "do all 6 but only for upgraded
business or rental pages"). The site is a JavaScript app. Google renders it
slowly and unreliably; ChatGPT, Claude, Perplexity and Bing read the HTML as
served, which for every standard page was "You need to enable JavaScript to
run this app". The business or rental was invisible to them.

What this module gives the small server in front of the build
(frontend/server.js), which decides who gets it:

  * GET /seo/business/{slug}?lng=   the whole page as plain HTML, with
    schema.org data, for a search or AI crawler. Upgraded pages only
    (the paid page upgrade, or a v3 designed page); 404 otherwise, and the
    server then serves what it always did.
  * GET /seo/property/{id}?lng=     the same for a rental whose lister has
    the upgrade.
  * GET /seo/business/{slug}/jsonld the schema.org block alone, which the
    server adds to a hand-built page (those are already plain HTML).
  * GET /seo/sitemap-entries        every upgraded page, in both languages.
  * GET /seo/llms.txt               a short guide for AI assistants.
  * GET /seo/my-checklist           the owner's "Get found" checklist.
  * GET /seo/indexnow-key.txt       IndexNow's proof key; indexnow_loop()
    tells Bing (and through it DuckDuckGo, Yandex and others) within half
    an hour when an upgraded page changes, instead of waiting for a crawl.

Content is exactly what a visitor sees: the business comes from the same
public payload the page loads (public_business), so nothing private can
reach a crawler that the page does not already show.
"""
from __future__ import annotations

import asyncio
import html
import json
import logging
import os
import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, PlainTextResponse

from routes.deps import db, verify_token
from utils.businesses import business_canonical_url, public_site_host
from utils.page_upgrade import has_page_upgrade

router = APIRouter(prefix="/seo", tags=["seo"])

CACHE = {"Cache-Control": "public, max-age=600"}
MAX_REVIEWS = 5

CATEGORY_HE = {
    "real-estate-services": "שירותי נדל״ן", "health-fitness": "בריאות וכושר",
    "personal-care": "טיפוח אישי", "transportation": "הסעות ותחבורה",
    "home-services-repair": "שירותי בית ותיקונים", "travel-tourism": "תיירות ונופש",
    "creative-design": "צילום ועיצוב", "business-financial": "שירותים עסקיים ופיננסיים",
    "moving-relocation": "הובלות ומעבר דירה", "cleaning-services": "שירותי ניקיון",
    "it-tech-support": "מחשבים ותמיכה טכנית", "education-tutoring": "לימודים ושיעורים פרטיים",
    "childcare-babysitting": "טיפול בילדים ובייביסיטר", "pet-services": "שירותים לבעלי חיים",
    "events-catering": "אירועים, מוזיקה וקייטרינג", "shops-products": "חנויות ומוצרים",
    "insurance": "ביטוח", "vehicles": "שירותי רכב", "money-exchange": "המרת מטבע והעברות כספים",
}
AREA_HE = {
    "jerusalem": "ירושלים", "tel-aviv": "תל אביב", "bet-shemesh": "בית שמש", "modiin": "מודיעין",
    "netanya": "נתניה", "haifa": "חיפה", "ashdod": "אשדוד", "beersheba": "באר שבע",
    "herzliya": "הרצליה", "raanana": "רעננה", "rishon": "ראשון לציון", "petah-tikva": "פתח תקווה",
}

LANGUAGE_NAMES = {
    "he": {"en": "Hebrew", "he": "עברית"}, "en": {"en": "English", "he": "אנגלית"},
    "ru": {"en": "Russian", "he": "רוסית"}, "fr": {"en": "French", "he": "צרפתית"},
    "es": {"en": "Spanish", "he": "ספרדית"}, "ar": {"en": "Arabic", "he": "ערבית"},
    "yi": {"en": "Yiddish", "he": "יידיש"}, "am": {"en": "Amharic", "he": "אמהרית"},
}

def _language(value: str, lang: str) -> str:
    """Stored either as a code ("he") or an English name ("Hebrew")."""
    key = str(value or "").strip().lower()
    for code, names in LANGUAGE_NAMES.items():
        if key in (code, names["en"].lower()):
            return names[lang]
    return str(value)


# The page's own words for each label, in both languages.
WORDS = {
    "en": {
        "areas": "Areas served", "nationwide": "Serves all of Israel", "hours": "Hours",
        "by_appointment": "By appointment only", "languages": "Languages", "founded": "Founded",
        "delivery": "Delivery", "lead_time": "Order ahead", "payment": "Payment",
        "kosher": "Kosher", "hechsher": "hechsher from {body}", "licence": "Licence number", "offer": "What we offer",
        "reviews": "Reviews", "rating": "Rated {avg} out of 5 from {n} reviews", "faq": "Questions and answers",
        "contact": "How to order or get in touch",
        "contact_body": "Message, order or book on this page at {url}. No account is needed to order.",
        "on": "On MyIsraelRental", "bedrooms": "Bedrooms", "bathrooms": "Bathrooms", "size": "Size",
        "price": "Price", "guests_label": "Guests", "guests": "Up to {n} guests", "per_month": "per month", "per_night": "per night",
        "amenities": "Amenities", "available": "Available from", "min_stay": "Minimum stay",
        "nights": "{n} nights", "checkin": "Check-in", "checkout": "Check-out", "floor": "Floor",
        "elevator": "Elevator", "shabbat_elevator": "Shabbat elevator", "rental": "Rental in {area}",
        "contact_rental": "Contact the lister or book on this page at {url}.",
    },
    "he": {
        "areas": "אזורי שירות", "nationwide": "בכל הארץ", "hours": "שעות פתיחה",
        "by_appointment": "בתיאום מראש בלבד", "languages": "שפות", "founded": "שנת הקמה",
        "delivery": "משלוחים", "lead_time": "להזמין מראש", "payment": "תשלום",
        "kosher": "כשרות", "hechsher": "בהשגחת {body}", "licence": "מספר רישיון", "offer": "מה אנחנו מציעים",
        "reviews": "ביקורות", "rating": "דירוג {avg} מתוך 5, לפי {n} ביקורות", "faq": "שאלות ותשובות",
        "contact": "איך מזמינים או יוצרים קשר",
        "contact_body": "אפשר לשלוח הודעה, להזמין או לקבוע תור בעמוד הזה: {url}. לא צריך חשבון כדי להזמין.",
        "on": "ב-MyIsraelRental", "bedrooms": "חדרי שינה", "bathrooms": "חדרי רחצה", "size": "שטח",
        "price": "מחיר", "guests_label": "אורחים", "guests": "עד {n} אורחים", "per_month": "לחודש", "per_night": "ללילה",
        "amenities": "מה יש בדירה", "available": "פנויה מ-", "min_stay": "מינימום שהייה",
        "nights": "{n} לילות", "checkin": "צ׳ק-אין", "checkout": "צ׳ק-אאוט", "floor": "קומה",
        "elevator": "מעלית", "shabbat_elevator": "מעלית שבת", "rental": "להשכרה ב{area}",
        "contact_rental": "אפשר לפנות למשכיר או להזמין בעמוד הזה: {url}.",
    },
}


def _site() -> str:
    return f"https://{public_site_host()}"


def _lang(lng: Optional[str]) -> str:
    return "he" if (lng or "").lower().startswith("he") else "en"


def _with_lang(url: str, lang: str) -> str:
    return f"{url}?lng=he" if lang == "he" else url


def _area_label(slug: str, lang: str) -> str:
    if lang == "he" and slug in AREA_HE:
        return AREA_HE[slug]
    from routes.marketplace.shared import LOCATIONS
    for loc in LOCATIONS:
        if loc["slug"] == slug:
            return loc["label"]
    return str(slug).replace("-", " ").title()


def _category_label(slug: str, lang: str) -> str:
    if lang == "he" and slug in CATEGORY_HE:
        return CATEGORY_HE[slug]
    from routes.marketplace.shared import CATEGORIES
    for cat in CATEGORIES:
        if cat["slug"] == slug:
            return cat["label"]
    return str(slug).replace("-", " ").title()


def _pick(doc: dict, field: str, lang: str) -> str:
    """The Hebrew text when the page is Hebrew and the owner wrote one."""
    if lang == "he" and (doc.get(f"{field}_he") or "").strip():
        return str(doc[f"{field}_he"]).strip()
    return str(doc.get(field) or "").strip()


def _money(price: Any, currency: Optional[str]) -> str:
    try:
        value = float(price)
    except (TypeError, ValueError):
        return ""
    symbol = {"ILS": "₪", "USD": "$", "EUR": "€", "GBP": "£"}.get((currency or "ILS").upper(), "")
    shown = f"{value:,.0f}" if value == int(value) else f"{value:,.2f}"
    return f"{symbol}{shown}" if symbol else f"{shown} {currency}"


# ---------------------------------------------------------------- business

async def _business_payload(slug: str, request: Request) -> Optional[dict]:
    """The public payload the page itself loads, as an anonymous visitor.

    The crawler's own user agent is passed through (server.js forwards it),
    so view tracking drops the visit as a bot instead of counting it.
    """
    from routes.marketplace.businesses import public_business
    try:
        return await public_business(slug, request, Response(), viewer=None, pv=None, draft=None)
    except HTTPException:
        return None


async def _upgraded(data: dict) -> bool:
    """The paid page upgrade, or a designed (v3) page switched on for the
    business. The stored switch, not the payload's page_v3, which is also
    gated on the site-wide v3 setting and the page's visual check: the
    business paid for its page either way, and this copy is its words, not
    the design. upgraded_pages() reads the same two things."""
    if data.get("page_upgrade"):
        return True
    return bool(await db.businesses.find_one({"_id": data.get("id"), "page_v3": True}, {"_id": 1}))


async def _reviews(match: dict) -> list[dict]:
    from utils import reviews as rv
    # The site's own reviews only: search engines do not accept review
    # markup for reviews copied from another site (Google, imported).
    try:
        out = await rv.list_reviews(db, {**match, "source": "native"}, source=None, sort="newest", page=1)
    except Exception:  # noqa: BLE001 - a page without reviews beats no page
        return []
    return [r for r in out.get("reviews", []) if (r.get("text") or "").strip()][:MAX_REVIEWS]


def _offers(listing: dict) -> list[tuple[str, str, str]]:
    """(name, price shown, description) for each priced choice in a listing."""
    rows = []
    for item in (listing.get("tiers") or []) + (listing.get("products") or []):
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        rows.append((name, _money(item.get("price"), item.get("currency")), str(item.get("description") or "").strip()))
    return rows


def business_jsonld(data: dict, url: str, reviews: list[dict], lang: str = "en") -> list[dict]:
    """schema.org for one business: who, where, what it costs, what people said."""
    food = bool(data.get("kosher_certification"))
    name = _pick(data, "name", lang) or data.get("name") or ""
    node: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": "FoodEstablishment" if food else "LocalBusiness",
        "@id": f"{url}#business",
        "name": name,
        "url": url,
        "description": _pick(data, "description", lang)[:500] or None,
        "image": data.get("cover_url") or data.get("logo_url") or None,
        "logo": data.get("logo_url") or None,
        "areaServed": (
            [{"@type": "Country", "name": "Israel"}] if data.get("serves_nationwide")
            else [{"@type": "City", "name": _area_label(a, "en")} for a in data.get("areas") or []]
        ) or None,
        "address": (
            {"@type": "PostalAddress", "addressLocality": _area_label(data["areas"][0], "en"), "addressCountry": "IL"}
            if data.get("areas") else {"@type": "PostalAddress", "addressCountry": "IL"}
        ),
        "knowsLanguage": data.get("languages") or None,
        "foundingDate": str(data["founded_year"]) if data.get("founded_year") else None,
        "paymentAccepted": data.get("payment_note") or None,
    }
    if food:
        node["servesCuisine"] = "Kosher"
    if data.get("rating_count"):
        node["aggregateRating"] = {
            "@type": "AggregateRating", "ratingValue": round(float(data.get("rating_avg") or 0), 1),
            "reviewCount": int(data["rating_count"]), "bestRating": 5, "worstRating": 1,
        }
    if reviews:
        node["review"] = [{
            "@type": "Review",
            "author": {"@type": "Person", "name": r.get("author_display_name") or "Customer"},
            "reviewRating": {"@type": "Rating", "ratingValue": r.get("rating"), "bestRating": 5},
            "reviewBody": (r.get("text") or "")[:600],
            **({"datePublished": str(r["date"])[:10]} if r.get("date") else {}),
        } for r in reviews]
    catalog = []
    for listing in data.get("listings") or []:
        for offer_name, shown, desc in _offers(listing):
            item: dict[str, Any] = {"@type": "Offer", "itemOffered": {"@type": "Product" if listing.get("products") else "Service", "name": offer_name}}
            if desc:
                item["itemOffered"]["description"] = desc[:300]
            for src in (listing.get("tiers") or []) + (listing.get("products") or []):
                if src.get("name") == offer_name and src.get("price") is not None:
                    item["price"] = src.get("price")
                    item["priceCurrency"] = (src.get("currency") or "ILS").upper()
                    break
            catalog.append(item)
    if catalog:
        node["hasOfferCatalog"] = {"@type": "OfferCatalog", "name": name, "itemListElement": catalog[:60]}
    out = [{k: v for k, v in node.items() if v not in (None, [], "")}]
    faqs = [f for listing in data.get("listings") or [] for f in (listing.get("faqs") or [])
            if (f.get("question") or "").strip() and (f.get("answer") or "").strip()]
    if faqs:
        out.append({
            "@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": f["question"].strip(),
                            "acceptedAnswer": {"@type": "Answer", "text": f["answer"].strip()}} for f in faqs[:20]],
        })
    return out


def _page(*, lang: str, title: str, description: str, url: str, en_url: str, he_url: str,
          image: Optional[str], jsonld: list[dict], body: str) -> str:
    e = html.escape
    ld = "".join(
        # No "<" at all inside the script, whatever the owner typed: JSON
        # reads < as the same character, and the tag cannot be closed.
        f'<script type="application/ld+json">{json.dumps(block, ensure_ascii=False).replace("<", chr(92) + "u003c")}</script>'
        for block in jsonld
    )
    return f"""<!doctype html>
<html lang="{lang}" dir="{'rtl' if lang == 'he' else 'ltr'}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{e(title)}</title>
<meta name="description" content="{e(description[:300])}"/>
<link rel="canonical" href="{e(url)}"/>
<link rel="alternate" hreflang="en" href="{e(en_url)}"/>
<link rel="alternate" hreflang="he" href="{e(he_url)}"/>
<link rel="alternate" hreflang="x-default" href="{e(en_url)}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="MyIsraelRental"/>
<meta property="og:title" content="{e(title)}"/>
<meta property="og:description" content="{e(description[:300])}"/>
<meta property="og:url" content="{e(url)}"/>
{f'<meta property="og:image" content="{e(image)}"/>' if image else ''}
{ld}
</head>
<body>
{body}
</body>
</html>"""


def _section(heading: str, inner: str) -> str:
    return f"<section><h2>{html.escape(heading)}</h2>{inner}</section>" if inner else ""


def _facts(rows: list[tuple[str, str]]) -> str:
    rows = [(k, v) for k, v in rows if v]
    if not rows:
        return ""
    return "<dl>" + "".join(f"<dt>{html.escape(k)}</dt><dd>{html.escape(v)}</dd>" for k, v in rows) + "</dl>"


def _paras(text: str) -> str:
    return "".join(f"<p>{html.escape(p.strip())}</p>" for p in str(text or "").split("\n") if p.strip())


def render_business(data: dict, reviews: list[dict], lang: str) -> str:
    w = WORDS[lang]
    slug = data.get("slug") or data.get("id")
    en_url = business_canonical_url(slug)
    he_url = _with_lang(en_url, "he")
    url = _with_lang(en_url, lang)
    name = _pick(data, "name", lang) or data.get("name") or ""
    description = _pick(data, "description", lang)
    cats = [_category_label(c, lang) for c in data.get("categories") or []]
    areas = w["nationwide"] if data.get("serves_nationwide") else ", ".join(_area_label(a, lang) for a in data.get("areas") or [])
    where = ", ".join(_area_label(a, lang) for a in (data.get("areas") or [])[:2])
    title = " · ".join(b for b in (name, (cats[0] if cats else ""), where) if b)
    kosher = (data.get("kosher_certification") or {}).get("body") or ""
    facts = _facts([
        (w["areas"], areas),
        (w["hours"], w["by_appointment"] if data.get("by_appointment") else (data.get("hours") or "")),
        (w["languages"], ", ".join(_language(c, lang) for c in data.get("languages") or [])),
        (w["founded"], str(data.get("founded_year") or "")),
        (w["delivery"], data.get("delivery_note") or ""),
        (w["lead_time"], data.get("lead_time") or ""),
        (w["payment"], data.get("payment_note") or ""),
        (w["kosher"], w["hechsher"].format(body=kosher) if kosher else ""),
        (w["licence"], data.get("license_number") or ""),
    ])
    offer_parts = []
    for listing in data.get("listings") or []:
        heading = _pick(listing, "title", lang)
        offers = _offers(listing)
        if len(offers) == 1 and offers[0][0] == heading:
            # One choice named like the listing: its price, not a list of one.
            rows = f"<p>{html.escape(offers[0][1])}</p>" if offers[0][1] else ""
        else:
            rows = "".join(
                f"<li><strong>{html.escape(n)}</strong>{' ' + html.escape(p) if p else ''}{': ' + html.escape(d) if d else ''}</li>"
                for n, p, d in offers
            )
            rows = f"<ul>{rows}</ul>" if rows else ""
        offer_parts.append(
            f"<article><h3>{html.escape(heading)}</h3>{_paras(_pick(listing, 'description', lang))}{rows}</article>"
        )
    review_html = ""
    if data.get("rating_count"):
        review_html += f"<p>{html.escape(w['rating'].format(avg=round(float(data.get('rating_avg') or 0), 1), n=data['rating_count']))}</p>"
    review_html += "".join(
        f"<blockquote><p>{html.escape(r['text'])}</p><footer>{html.escape(r.get('author_display_name') or '')}, {r.get('rating')}/5</footer></blockquote>"
        for r in reviews
    )
    faqs = [f for listing in data.get("listings") or [] for f in (listing.get("faqs") or [])
            if (f.get("question") or "").strip() and (f.get("answer") or "").strip()]
    faq_html = "".join(f"<h3>{html.escape(f['question'])}</h3><p>{html.escape(f['answer'])}</p>" for f in faqs[:20])
    body = (
        f"<header><h1>{html.escape(name)}</h1>"
        f"{'<p>' + html.escape(' · '.join(b for b in (', '.join(cats), areas) if b)) + '</p>' if cats or areas else ''}</header>"
        f"<main>{_paras(description)}{facts}"
        f"{_section(w['offer'], ''.join(offer_parts))}"
        f"{_section(w['reviews'], review_html)}"
        f"{_section(w['faq'], faq_html)}"
        f"{_section(w['contact'], '<p>' + html.escape(w['contact_body'].format(url=url)) + '</p>')}"
        f"</main><footer><p><a href=\"{html.escape(_site())}\">MyIsraelRental</a></p></footer>"
    )
    return _page(
        lang=lang, title=title, description=description or title, url=url, en_url=en_url, he_url=he_url,
        image=data.get("cover_url") or data.get("logo_url"), jsonld=business_jsonld(data, url, reviews, lang), body=body,
    )


@router.get("/business/{slug}", response_class=HTMLResponse)
async def seo_business(slug: str, request: Request, lng: Optional[str] = None):
    data = await _business_payload(slug, request)
    if not data or not await _upgraded(data):
        raise HTTPException(status_code=404, detail="Not an upgraded page")
    reviews = await _reviews({"business_id": data["id"]})
    return HTMLResponse(render_business(data, reviews, _lang(lng)), headers=CACHE)


@router.get("/business/{slug}/jsonld")
async def seo_business_jsonld(slug: str, request: Request):
    """For a hand-built page, which is plain HTML already and needs only this.
    frontend/server.js asks for it only for slugs in its pages.json, so the
    standard free page never gets it."""
    data = await _business_payload(slug, request)
    if not data:
        raise HTTPException(status_code=404, detail="Business not found")
    url = business_canonical_url(data.get("slug") or data["id"])
    reviews = await _reviews({"business_id": data["id"]})
    return Response(json.dumps(business_jsonld(data, url, reviews), ensure_ascii=False),
                    media_type="application/json", headers=CACHE)


# ---------------------------------------------------------------- rental

PROPERTY_FIELDS = {
    "_id": 0, "id": 1, "owner_id": 1, "title": 1, "description": 1, "rental_type": 1, "property_type": 1,
    "bedrooms": 1, "bathrooms": 1, "area": 1, "square_meters": 1, "floor": 1, "has_elevator": 1,
    "is_shabbat_elevator": 1, "max_guests": 1, "amenities": 1, "monthly_price": 1, "nightly_price": 1,
    "currency": 1, "images": 1, "available_from": 1, "minimum_booking_days": 1, "checkin_time": 1,
    "checkout_time": 1, "is_hidden": 1,
}


async def _upgraded_property(property_id: str) -> Optional[dict]:
    prop = await db.properties.find_one({"id": property_id}, PROPERTY_FIELDS)
    if not prop or prop.get("is_hidden") or not await has_page_upgrade(prop.get("owner_id")):
        return None
    return prop


def property_url(property_id: str) -> str:
    return f"{_site()}/property/{property_id}"


def property_jsonld(prop: dict, url: str, reviews: list[dict], summary: Optional[dict]) -> list[dict]:
    kind = "Apartment" if "apartment" in str(prop.get("property_type") or "").lower() else (
        "House" if "house" in str(prop.get("property_type") or "").lower() else "Accommodation")
    node: dict[str, Any] = {
        "@context": "https://schema.org", "@type": kind, "@id": f"{url}#rental", "name": prop.get("title"),
        "url": url, "description": (prop.get("description") or "")[:500] or None,
        "image": (prop.get("images") or [])[:6] or None,
        "address": {"@type": "PostalAddress", "addressLocality": prop.get("area") or None, "addressCountry": "IL"},
        "numberOfBedrooms": prop.get("bedrooms") or None,
        "numberOfBathroomsTotal": prop.get("bathrooms") or None,
        "floorSize": {"@type": "QuantitativeValue", "value": prop["square_meters"], "unitCode": "MTK"} if prop.get("square_meters") else None,
        "occupancy": {"@type": "QuantitativeValue", "maxValue": prop["max_guests"]} if prop.get("max_guests") else None,
        "amenityFeature": [{"@type": "LocationFeatureSpecification", "name": a, "value": True} for a in (prop.get("amenities") or [])[:30]] or None,
    }
    price, unit = (prop.get("monthly_price"), "MON") if prop.get("monthly_price") else (prop.get("nightly_price"), "DAY")
    offer = None
    if price:
        offer = {"@type": "Offer", "url": url, "price": price, "priceCurrency": (prop.get("currency") or "ILS").upper(),
                 "priceSpecification": {"@type": "UnitPriceSpecification", "price": price,
                                        "priceCurrency": (prop.get("currency") or "ILS").upper(), "unitCode": unit},
                 "availability": "https://schema.org/InStock"}
    node = {k: v for k, v in node.items() if v not in (None, [], "")}
    out = [node]
    if offer:
        # An Offer for the place, so the price is read as the rent.
        out.append({"@context": "https://schema.org", "@type": "Product", "name": prop.get("title"), "url": url,
                    "image": (prop.get("images") or [None])[0], "offers": offer,
                    **({"aggregateRating": {"@type": "AggregateRating", "ratingValue": summary["avg"], "reviewCount": summary["count"]}}
                       if summary else {}),
                    **({"review": [{"@type": "Review", "author": {"@type": "Person", "name": r.get("author_display_name") or "Guest"},
                                    "reviewRating": {"@type": "Rating", "ratingValue": r.get("rating"), "bestRating": 5},
                                    "reviewBody": (r.get("text") or "")[:600]} for r in reviews]} if reviews else {})})
    return out


async def _review_summary(match: dict) -> Optional[dict]:
    from utils import reviews as rv
    try:
        native = (await rv.summary(db, match)).get("native") or {}
    except Exception:  # noqa: BLE001
        return None
    # avg is None below the site's minimum count: no average two reviews can swing.
    return {"avg": native["avg"], "count": native["count"]} if native.get("avg") else None


def render_property(prop: dict, reviews: list[dict], summary: Optional[dict], lang: str) -> str:
    w = WORDS[lang]
    en_url = property_url(prop["id"])
    he_url = _with_lang(en_url, "he")
    url = _with_lang(en_url, lang)
    title = prop.get("title") or w["rental"].format(area=prop.get("area") or "")
    price = ""
    if prop.get("monthly_price"):
        price = f"{_money(prop['monthly_price'], prop.get('currency'))} {w['per_month']}"
    elif prop.get("nightly_price"):
        price = f"{_money(prop['nightly_price'], prop.get('currency'))} {w['per_night']}"
    facts = _facts([
        (w["price"], price),
        (w["bedrooms"], str(prop.get("bedrooms") or "").removesuffix(".0")),
        (w["bathrooms"], str(prop.get("bathrooms") or "").removesuffix(".0")),
        (w["size"], f"{prop['square_meters']:.0f} m²" if prop.get("square_meters") else ""),
        (w["floor"], str(prop.get("floor") or "").removesuffix(".0")),
        (w["elevator"], w["shabbat_elevator"] if prop.get("is_shabbat_elevator") else ("✓" if prop.get("has_elevator") else "")),
        (w["guests_label"], w["guests"].format(n=prop["max_guests"]) if prop.get("max_guests") else ""),
        (w["available"], str(prop.get("available_from") or "")[:10]),
        (w["min_stay"], w["nights"].format(n=prop["minimum_booking_days"]) if prop.get("minimum_booking_days") else ""),
        (w["checkin"], prop.get("checkin_time") or ""),
        (w["checkout"], prop.get("checkout_time") or ""),
    ])
    amen = "".join(f"<li>{html.escape(str(a).replace('_', ' '))}</li>" for a in prop.get("amenities") or [])
    review_html = ""
    if summary:
        review_html += f"<p>{html.escape(w['rating'].format(avg=summary['avg'], n=summary['count']))}</p>"
    review_html += "".join(
        f"<blockquote><p>{html.escape(r['text'])}</p><footer>{html.escape(r.get('author_display_name') or '')}, {r.get('rating')}/5</footer></blockquote>"
        for r in reviews
    )
    imgs = "".join(f'<img src="{html.escape(src)}" alt="{html.escape(title)}"/>' for src in (prop.get("images") or [])[:6])
    body = (
        f"<header><h1>{html.escape(title)}</h1><p>{html.escape(prop.get('area') or '')}</p></header>"
        f"<main>{imgs}{_paras(prop.get('description') or '')}{facts}"
        f"{_section(w['amenities'], '<ul>' + amen + '</ul>' if amen else '')}"
        f"{_section(w['reviews'], review_html)}"
        f"<p>{html.escape(w['contact_rental'].format(url=url))}</p>"
        f"</main><footer><p><a href=\"{html.escape(_site())}\">MyIsraelRental</a></p></footer>"
    )
    description = (prop.get("description") or "").strip() or " · ".join(b for b in (title, prop.get("area"), price) if b)
    return _page(lang=lang, title=f"{title} · {prop.get('area')}" if prop.get("area") else title,
                 description=description, url=url, en_url=en_url, he_url=he_url,
                 image=(prop.get("images") or [None])[0], jsonld=property_jsonld(prop, url, reviews, summary), body=body)


@router.get("/property/{property_id}", response_class=HTMLResponse)
async def seo_property(property_id: str, lng: Optional[str] = None):
    prop = await _upgraded_property(property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Not an upgraded page")
    reviews = await _reviews({"listing_id": property_id})
    summary = await _review_summary({"listing_id": property_id})
    return HTMLResponse(render_property(prop, reviews, summary, _lang(lng)), headers=CACHE)


# ---------------------------------------------------------------- lists

async def upgraded_pages() -> dict[str, list[dict]]:
    """Every upgraded business and rental that is public right now."""
    owners = [u["id"] async for u in db.users.find({"page_upgrade": True}, {"_id": 0, "id": 1})]
    businesses = []
    async for b in db.businesses.find(
        {"$or": [{"owner_user_id": {"$in": owners}}, {"page_v3": True}], "active": {"$ne": False}},
        {"name": 1, "slug": 1, "categories": 1, "areas": 1, "serves_nationwide": 1, "description": 1, "updated_at": 1},
    ):
        # Listed only with a published service, like the public page itself.
        if await db.marketplace_gigs.find_one({"business_id": b["_id"], "status": "published"}, {"_id": 1}):
            businesses.append(b)
    rentals = [p async for p in db.properties.find(
        {"owner_id": {"$in": owners}, "is_hidden": {"$ne": True}},
        {"_id": 0, "id": 1, "title": 1, "area": 1, "rental_type": 1, "updated_at": 1},
    )]
    return {"businesses": businesses, "rentals": rentals}


@router.get("/sitemap-entries")
async def sitemap_entries():
    """URLs for the sitemap, each with its Hebrew twin. server.js merges these
    with the fixed pages and the hand-built ones."""
    pages = await upgraded_pages()
    out = []
    for b in pages["businesses"]:
        out.append({"url": business_canonical_url(b.get("slug") or b["_id"]), "lastmod": str(b.get("updated_at") or "")[:10]})
    for p in pages["rentals"]:
        out.append({"url": property_url(p["id"]), "lastmod": str(p.get("updated_at") or "")[:10]})
    return Response(json.dumps({"entries": out}), media_type="application/json", headers=CACHE)


@router.get("/llms.txt", response_class=PlainTextResponse)
async def llms_txt(extra: str = ""):
    """The llmstxt.org format: what the site is, and where to read more.

    `extra`: the hand-built (designed) pages' slugs, which only the web
    server knows (its pages.json). Public businesses, listed like the rest."""
    site = _site()
    pages = await upgraded_pages()
    wanted = [x for x in extra.split(",") if re.fullmatch(r"[a-z0-9-]{2,60}", x)][:50]
    if wanted:
        have = {b.get("slug") for b in pages["businesses"]}
        async for b in db.businesses.find(
            {"slug": {"$in": [w for w in wanted if w not in have]}, "active": {"$ne": False}},
            {"name": 1, "slug": 1, "categories": 1, "areas": 1, "serves_nationwide": 1, "description": 1},
        ):
            pages["businesses"].append(b)
    lines = [
        "# MyIsraelRental",
        "",
        "> Rentals, local businesses and kosher restaurants across Israel. People list places to rent, "
        "services, shops and restaurants; visitors message, order or book on the site. Listing is free, "
        "with no commission. Every page is in English and Hebrew (add ?lng=he for Hebrew).",
        "",
        "## Find something",
        f"- [Stays and rentals]({site}/stays): apartments and homes for short and long stays",
        f"- [Local businesses]({site}/businesses): services, shops and food, by category and city",
        f"- [Kosher restaurants]({site}/restaurants): each with its hechsher, meat or dairy, by city",
        f"- [Requests board]({site}/requests): what people are looking for",
        f"- [Frequently asked questions]({site}/faq)",
        "",
    ]
    if pages["businesses"]:
        lines.append("## Businesses")
        for b in pages["businesses"]:
            bits = [_category_label(c, "en") for c in (b.get("categories") or [])[:2]]
            where = "all of Israel" if b.get("serves_nationwide") else ", ".join(_area_label(a, "en") for a in (b.get("areas") or [])[:3])
            desc = " ".join(str(b.get("description") or "").split())
            if len(desc) > 160:
                desc = desc[:160].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
            meta = ", ".join(x for x in (", ".join(bits), where) if x)
            lines.append(f"- [{b.get('name')}]({business_canonical_url(b.get('slug') or b['_id'])}): {meta}{'. ' + desc if desc else ''}")
        lines.append("")
    if pages["rentals"]:
        lines.append("## Rentals")
        for p in pages["rentals"]:
            lines.append(f"- [{p.get('title')}]({property_url(p['id'])}): {p.get('area') or ''}")
        lines.append("")
    lines += [
        "## About",
        f"- [Contact]({site}/contact)",
        f"- [Privacy policy]({site}/privacy)",
        f"- [Terms of use]({site}/terms)",
        "",
    ]
    return PlainTextResponse("\n".join(lines), headers=CACHE)


# ---------------------------------------------------------------- owner checklist

def _item(key: str, done: bool, **extra: Any) -> dict:
    return {"key": key, "done": bool(done), **extra}


@router.get("/my-checklist")
async def my_checklist(user=Depends(verify_token)):
    """The "Get found" checklist, for an owner with the page upgrade only.

    Each item is something search engines and AI assistants actually read:
    a full description in both languages, where and when, prices, the
    questions customers ask, and reviews. The last two are things only the
    owner can do outside the site, so they are reminders, never ticked.
    """
    from utils import reviews as rv
    uid = user["user_id"]
    if not await has_page_upgrade(uid):
        return {"upgraded": False, "pages": []}
    pages = []
    async for b in db.businesses.find({"owner_user_id": uid, "active": {"$ne": False}}):
        gigs = await db.marketplace_gigs.find({"business_id": b["_id"], "status": "published"},
                                              {"tiers": 1, "products": 1, "faqs": 1, "gallery": 1}).to_list(200)
        priced = any(_offers(g) for g in gigs)
        faq_count = sum(len([f for f in g.get("faqs") or [] if (f.get("answer") or "").strip()]) for g in gigs)
        photos = sum(len(g.get("gallery") or []) for g in gigs) + (1 if b.get("cover_url") else 0)
        reviews = await db.reviews.count_documents(rv.visible_query({"business_id": b["_id"]}))
        pages.append({
            "kind": "business", "id": b["_id"], "name": b.get("name"),
            "url": business_canonical_url(b.get("slug") or b["_id"]),
            "items": [
                _item("description", len((b.get("description") or "").strip()) >= 150),
                _item("hebrew", bool((b.get("description_he") or "").strip())),
                _item("where_when", bool(b.get("areas") or b.get("serves_nationwide")) and bool(b.get("hours") or b.get("by_appointment"))),
                _item("prices", priced),
                _item("faq", faq_count >= 3, count=faq_count),
                _item("photos", photos >= 3, count=photos),
                _item("reviews", reviews >= 3, count=reviews),
                _item("share_link", False, reminder=True),
                _item("google_profile", False, reminder=True),
            ],
        })
    async for p in db.properties.find({"owner_id": uid, "is_hidden": {"$ne": True}}, PROPERTY_FIELDS):
        reviews = await db.reviews.count_documents(rv.visible_query({"listing_id": p["id"]}))
        pages.append({
            "kind": "rental", "id": p["id"], "name": p.get("title"), "url": property_url(p["id"]),
            "items": [
                _item("description", len((p.get("description") or "").strip()) >= 150),
                _item("price", bool(p.get("monthly_price") or p.get("nightly_price"))),
                _item("photos", len(p.get("images") or []) >= 5, count=len(p.get("images") or [])),
                _item("amenities", len(p.get("amenities") or []) >= 3),
                _item("reviews", reviews >= 3, count=reviews),
                _item("share_link", False, reminder=True),
            ],
        })
    return {"upgraded": True, "pages": pages}


# ---------------------------------------------------------------- IndexNow

INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
INDEXNOW_SECONDS = 30 * 60
_indexnow_log = logging.getLogger("seo.indexnow")


def indexnow_key() -> str:
    """Set on Railway only. Without it the loop does nothing, so local and
    preview environments never announce their pages to search engines."""
    key = (os.environ.get("INDEXNOW_KEY") or "").strip()
    return key if re.fullmatch(r"[A-Za-z0-9-]{8,128}", key) else ""


@router.get("/indexnow-key.txt", response_class=PlainTextResponse)
async def indexnow_key_file():
    """Served at https://myisraelrental.com/indexnow-key.txt by
    frontend/server.js: IndexNow checks the key lives on the site's own host."""
    key = indexnow_key()
    if not key:
        raise HTTPException(status_code=404, detail="Not set")
    return PlainTextResponse(key)


def _stamp(value: Any) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value or "")


async def changed_urls(since: str) -> list[str]:
    """Upgraded pages changed after `since` (all of them when it is empty):
    the business record, any of its listings, or the rental itself."""
    pages = await upgraded_pages()
    urls = []
    for b in pages["businesses"]:
        changed = not since or _stamp(b.get("updated_at")) > since or bool(await db.marketplace_gigs.find_one(
            {"business_id": b["_id"], "status": "published", "updated_at": {"$gt": since}}, {"_id": 1}))
        if changed:
            urls.append(business_canonical_url(b.get("slug") or b["_id"]))
    for p in pages["rentals"]:
        if not since or _stamp(p.get("updated_at")) > since:
            urls.append(property_url(p["id"]))
    return urls


async def indexnow_once() -> int:
    """One pass. The first ever pass sends every upgraded page."""
    key = indexnow_key()
    if not key:
        return 0
    from datetime import UTC, datetime
    import httpx
    state = await db.seo_state.find_one({"_id": "indexnow"}) or {}
    started = datetime.now(UTC).isoformat()
    urls = await changed_urls(state.get("last_at") or "")
    if urls:
        host = public_site_host()
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(INDEXNOW_ENDPOINT, json={
                "host": host, "key": key, "keyLocation": f"https://{host}/indexnow-key.txt",
                "urlList": urls[:10000],
            })
        # 200 and 202 are both "received". Anything else: keep last_at, so
        # the same pages go again next pass.
        if r.status_code not in (200, 202):
            _indexnow_log.warning("[indexnow] %s pages refused: HTTP %s", len(urls), r.status_code)
            return 0
    await db.seo_state.update_one({"_id": "indexnow"}, {"$set": {"last_at": started, "last_sent": len(urls)}}, upsert=True)
    return len(urls)


async def indexnow_loop() -> None:
    await asyncio.sleep(600)
    while True:
        try:
            n = await indexnow_once()
            if n:
                _indexnow_log.info("[indexnow] told search engines about %s changed pages", n)
        except Exception as e:  # noqa: BLE001
            _indexnow_log.warning("[indexnow] pass failed: %s", e)
        await asyncio.sleep(INDEXNOW_SECONDS)

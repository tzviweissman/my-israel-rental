"""The goods taxonomy, and the item specifics that hang off it.

SEPARATE FROM SERVICES ON PURPOSE. Items took `category` from the
services taxonomy, so a sofa was offered under "Cleaning Services" and
"IT & Tech Support". A `buy-sell` slug was added to that tree on 28 Aug
2026 and removed hours later with the right note: *do not put items in
the services grid*. Two taxonomies, two purposes. Nothing here aliases,
extends or falls back to `shared.CATEGORIES`, and nothing there should
ever gain a goods slug.

SLUGS ARE PERMANENT. They go in URLs, in saved searches and in stored
documents. Renaming one orphans every listing that carries it. If a
label needs to change, change the label; if a category genuinely has to
go, add a migration map the way `CATEGORY_MIGRATION` does for services.

WHY A SCHEMA AND NOT JUST A LIST. A filter can only exist where a
structured field exists, which is why eBay built item specifics before it
built faceted search. Today an item carries `condition` and nothing else,
so `condition` is the only facet that can be built. Every field below is
declared once, here, with everything the API, the composer and the facet
renderer each need - so a field cannot be a filter in one place and free
text in another.

SCHEMA_VERSION is stamped onto each item at write time. When a field's
meaning changes, the version is what lets a reader tell which rules the
stored value was written under, instead of guessing from its shape.
"""
from __future__ import annotations

from typing import Any

SCHEMA_VERSION = 1

# --------------------------------------------------------------------------
# Categories
# --------------------------------------------------------------------------
# Chosen for liquidity in this audience rather than for completeness. The
# `why` on each is the argument for its existence; a category that cannot
# answer that question is a category that will sit empty and make the
# board look dead.

ITEM_CATEGORIES: list[dict[str, str]] = [
    {"slug": "furniture", "label": "Furniture", "label_he": "ריהוט"},
    {"slug": "appliances", "label": "Appliances", "label_he": "מוצרי חשמל"},
    {"slug": "baby-kids", "label": "Baby & kids", "label_he": "תינוקות וילדים"},
    {"slug": "electronics", "label": "Electronics & computers", "label_he": "אלקטרוניקה ומחשבים"},
    {"slug": "home-kitchen", "label": "Home & kitchen", "label_he": "בית ומטבח"},
    {"slug": "books-judaica", "label": "Books & Judaica", "label_he": "ספרים ויודאיקה"},
    {"slug": "olim-essentials", "label": "Olim essentials", "label_he": "ציוד לעולים"},
    {"slug": "bikes-scooters", "label": "Bikes & scooters", "label_he": "אופניים וקורקינטים"},
    {"slug": "garden-outdoor", "label": "Garden & outdoor", "label_he": "גינה וחוץ"},
    {"slug": "sports-hobby", "label": "Sports & hobby", "label_he": "ספורט ותחביבים"},
    # Always. A taxonomy with no escape hatch does not get cleaner listings,
    # it loses the listing entirely or gets it filed somewhere wrong.
    {"slug": "other", "label": "Something else", "label_he": "משהו אחר"},
]

ITEM_CATEGORY_SLUGS: set[str] = {c["slug"] for c in ITEM_CATEGORIES}

# --------------------------------------------------------------------------
# What may not be sold here
# --------------------------------------------------------------------------
# Refused at the model with a message naming what IS accepted, because a
# bare rejection just gets retried under a different category.
#
#   pets         25.2% of BBB online purchase scams, median loss $660. The
#                highest-fraud category in the data by a distance.
#   tickets      Trivially forged, worthless after the event, and the
#                dispute always arrives when the item can no longer be
#                checked.
#   gift-cards   A gift card IS the payment rail. Selling one is selling
#                money to a stranger, which is the exact shape of the scam
#                the whole board is designed to steer people away from.
#
# Not a category list: these are keyword-matched at write time, because
# nobody posting a banned item picks the banned category.
BANNED_ITEM_TERMS: dict[str, tuple[str, ...]] = {
    "pets": ("puppy", "puppies", "kitten", "kittens", "for adoption", "pedigree",
             "גור", "גורים", "כלבלב", "חתלתול"),
    "tickets": ("ticket", "tickets", "כרטיס", "כרטיסים"),
    "gift cards": ("gift card", "gift-card", "giftcard", "voucher code",
                   "כרטיס מתנה", "שובר"),
}

BANNED_MESSAGE = (
    "Pets, tickets and gift cards cannot be listed here. "
    "This board is for physical second-hand goods: furniture, appliances, "
    "baby and kids' things, electronics, home and kitchen, books and Judaica, "
    "olim essentials, bikes, garden and sports equipment."
)

# --------------------------------------------------------------------------
# Item specifics
# --------------------------------------------------------------------------
# Each field declares everything every consumer needs:
#
#   key       stored key inside `attributes`
#   label     / label_he   what a person reads
#   type      enum | number | text | bool
#   options   for enum; each with its own label pair
#   unit      for number
#   facet     True  -> can be filtered and counted on
#             False -> shown on the listing, never a filter
#   required  at most ONE per category, see the friction rule below
#
# THE FRICTION RULE. None of this may slow listing down. Listing is the
# scarce act. So the photo produces the attributes and the seller
# confirms them: everything is pre-filled and correctable, and at most one
# field beyond photo and category is ever required.


def _enum(key, label, label_he, options, *, facet=False, required=False):
    return {"key": key, "label": label, "label_he": label_he, "type": "enum",
            "options": options, "facet": facet, "required": required}


def _text(key, label, label_he, *, facet=False, required=False):
    return {"key": key, "label": label, "label_he": label_he, "type": "text",
            "facet": facet, "required": required}


def _number(key, label, label_he, unit, *, facet=False, required=False):
    return {"key": key, "label": label, "label_he": label_he, "type": "number",
            "unit": unit, "facet": facet, "required": required}


def _bool(key, label, label_he, *, facet=False, required=False):
    return {"key": key, "label": label, "label_he": label_he, "type": "bool",
            "facet": facet, "required": required}


def _opt(value, label, label_he):
    return {"value": value, "label": label, "label_he": label_he}


# VOLTAGE IS THE MOST VALUABLE FIELD ON THIS SITE, and it costs one enum.
# An oleh arriving with a 110V American appliance, or trying to avoid
# buying one, cannot filter for this anywhere in Israel. Yad2 has no such
# field and a Facebook group structurally cannot have one. It is worth
# more to this audience than to anyone else's.
_VOLTAGE = _enum(
    "voltage", "Voltage", "מתח",
    [_opt("220v", "220V", "220V"), _opt("110v", "110V", "110V"),
     _opt("dual", "Dual voltage", "מתח כפול")],
    facet=True,
)

_PLUG = _enum(
    "plug_type", "Plug type", "סוג תקע",
    [_opt("il", "Israeli", "ישראלי"), _opt("eu", "European", "אירופי"),
     _opt("us", "US", "אמריקאי"), _opt("uk", "UK", "בריטי")],
    facet=True,
)

# Shared by every category. `condition`, `pickup_area` and `delivery` are
# columns on the item itself rather than attributes, so they are not
# repeated here - they are facets already.
SHARED_FIELDS: list[dict[str, Any]] = [
    _text("brand", "Brand", "מותג", facet=True),
    _text("colour", "Colour", "צבע"),
]

CATEGORY_FIELDS: dict[str, list[dict[str, Any]]] = {
    "furniture": [
        _text("dimensions", "Dimensions (W x D x H cm)", "מידות (ר x ע x ג ס\"מ)"),
        _enum("material", "Material", "חומר",
              [_opt("wood", "Wood", "עץ"), _opt("metal", "Metal", "מתכת"),
               _opt("fabric", "Fabric", "בד"), _opt("leather", "Leather", "עור"),
               _opt("glass", "Glass", "זכוכית"), _opt("plastic", "Plastic", "פלסטיק")],
              facet=True),
        _bool("assembly_required", "Needs assembly", "דורש הרכבה"),
        # The question everyone asks second, after the price.
        _bool("fits_through_door", "Fits through a standard door", "עובר בדלת רגילה"),
    ],
    "appliances": [
        _VOLTAGE, _PLUG,
        _text("capacity", "Capacity", "קיבולת"),
        _number("age_years", "Age", "גיל", "years"),
        # Ovens and hotplates only. Asked of a kettle it is noise, which is
        # why it is per-category rather than shared.
        _bool("shabbat_mode", "Shabbat mode", "מצב שבת", facet=True),
    ],
    "electronics": [
        _text("model", "Model", "דגם"),
        _VOLTAGE,
        # A SAFETY CONTROL, NOT A CONVENIENCE. A fence cannot publish a
        # serial number, and it costs an honest seller nothing. Optional -
        # requiring it would punish the honest seller who cannot find the
        # sticker - but its presence is shown and filterable.
        _text("serial_or_imei", "Serial number or IMEI", "מספר סידורי או IMEI"),
        _enum("interface_language", "Interface language", "שפת ממשק",
              [_opt("he", "Hebrew", "עברית"), _opt("en", "English", "אנגלית"),
               _opt("both", "Both", "שתיהן")],
              facet=True),
        _enum("battery_health", "Battery", "סוללה",
              [_opt("good", "Holds a charge well", "מחזיקה טעינה היטב"),
               _opt("fair", "Noticeably weaker", "חלשה יותר"),
               _opt("replace", "Needs replacing", "צריכה החלפה"),
               _opt("na", "Not applicable", "לא רלוונטי")]),
    ],
    "baby-kids": [
        _enum("age_range", "Age range", "טווח גילאים",
              [_opt("0-6m", "0 to 6 months", "0 עד 6 חודשים"),
               _opt("6-24m", "6 to 24 months", "6 עד 24 חודשים"),
               _opt("2-5y", "2 to 5 years", "2 עד 5 שנים"),
               _opt("5-10y", "5 to 10 years", "5 עד 10 שנים"),
               _opt("10y+", "10 years and over", "10 ומעלה")],
              facet=True),
        _text("safety_standard", "Safety standard", "תקן בטיחות"),
        # Car seats expire. This is a genuine safety field, not metadata:
        # a seat past its date should not be sold as if it were fine.
        _text("expiry_date", "Expiry date (car seats)", "תאריך תפוגה (מושבי בטיחות)"),
    ],
    "books-judaica": [
        _enum("language", "Language", "שפה",
              [_opt("he", "Hebrew", "עברית"), _opt("en", "English", "אנגלית"),
               _opt("both", "Both", "שתיהן"), _opt("other", "Other", "אחר")],
              facet=True),
        _number("volumes", "Volumes", "כרכים", "volumes"),
        _enum("nusach", "Nusach", "נוסח",
              [_opt("ashkenaz", "Ashkenaz", "אשכנז"), _opt("sefard", "Sefard", "ספרד"),
               _opt("edot-hamizrach", "Edot HaMizrach", "עדות המזרח"),
               _opt("na", "Not applicable", "לא רלוונטי")],
              facet=True),
        _enum("binding", "Binding", "כריכה",
              [_opt("hardcover", "Hardcover", "קשה"), _opt("softcover", "Softcover", "רכה")]),
    ],
    "olim-essentials": [
        _enum("voltage_in", "Input voltage", "מתח כניסה",
              [_opt("220v", "220V", "220V"), _opt("110v", "110V", "110V")], facet=True),
        _enum("voltage_out", "Output voltage", "מתח יציאה",
              [_opt("220v", "220V", "220V"), _opt("110v", "110V", "110V")], facet=True),
        _number("wattage", "Wattage", "הספק", "W", facet=True),
        _PLUG,
    ],
    "bikes-scooters": [
        _text("frame_size", "Frame size", "מידת שלדה", facet=True),
        _text("wheel_size", "Wheel size", "מידת גלגל"),
        # The other safety control. Frame numbers are the established way
        # a stolen bike is identified, and a thief will not publish one.
        _text("frame_number", "Frame number", "מספר שלדה"),
        _bool("electric", "Electric", "חשמלי", facet=True),
    ],
    "home-kitchen": [
        _VOLTAGE,
        _text("dimensions", "Dimensions (W x D x H cm)", "מידות (ר x ע x ג ס\"מ)"),
    ],
    "garden-outdoor": [
        _text("dimensions", "Dimensions (W x D x H cm)", "מידות (ר x ע x ג ס\"מ)"),
        _enum("material", "Material", "חומר",
              [_opt("wood", "Wood", "עץ"), _opt("metal", "Metal", "מתכת"),
               _opt("plastic", "Plastic", "פלסטיק"), _opt("fabric", "Fabric", "בד")]),
    ],
    "sports-hobby": [
        _text("size", "Size", "מידה"),
    ],
    "other": [],
}

# The two fields whose presence is itself worth showing and filtering on.
# Their VALUE is never a facet - nobody browses by serial number - but
# "this seller published one" is a signal a buyer can act on.
PROVENANCE_FIELDS = ("serial_or_imei", "frame_number")


def fields_for(category: str | None) -> list[dict[str, Any]]:
    """Every field that applies to a category, shared ones first."""
    if not category or category not in ITEM_CATEGORY_SLUGS:
        return list(SHARED_FIELDS)
    return list(SHARED_FIELDS) + list(CATEGORY_FIELDS.get(category, []))


def facet_fields_for(category: str | None) -> list[dict[str, Any]]:
    """Only the fields that may be rendered as a filter.

    A voltage filter on a bookshelf is noise, so facets are asked for per
    category rather than shown as a fixed row.
    """
    return [f for f in fields_for(category) if f.get("facet")]


def _coerce(field: dict[str, Any], raw: Any) -> str | None:
    """One attribute value, validated against its own declaration.

    Returns None for anything that does not belong, and the caller drops
    it. Refusing the whole listing over one bad attribute would punish the
    seller for a stale client; storing it unchecked is how a facet ends up
    counting values no filter can ever match.
    """
    if raw is None:
        return None
    value = str(raw).strip()
    if not value:
        return None

    kind = field["type"]
    if kind == "enum":
        allowed = {o["value"] for o in field.get("options", [])}
        return value.lower() if value.lower() in allowed else None
    if kind == "bool":
        low = value.lower()
        if low in ("true", "yes", "1"):
            return "true"
        if low in ("false", "no", "0"):
            return "false"
        return None
    if kind == "number":
        try:
            num = float(value.replace(",", ""))
        except ValueError:
            return None
        if num < 0 or num > 1_000_000:
            return None
        return str(int(num)) if num.is_integer() else str(num)
    return value[:120]


def normalize_attributes(category: str | None, raw: Any) -> dict[str, str]:
    """Coerce a submitted attribute bag to what the schema allows.

    Unknown keys are DROPPED rather than stored. An attribute nothing can
    read is invisible to search and to the listing page, so keeping it
    only creates a field the seller believes they filled in.
    """
    if not isinstance(raw, dict):
        return {}
    allowed = {f["key"]: f for f in fields_for(category)}
    out: dict[str, str] = {}
    for key, value in raw.items():
        field = allowed.get(str(key))
        if not field:
            continue
        coerced = _coerce(field, value)
        if coerced is not None:
            out[str(key)] = coerced
    return out


def banned_reason(*texts: str | None) -> str | None:
    """Which banned class this listing looks like, if any.

    Matched on the seller's own words rather than on the category they
    picked, because nobody listing a puppy selects a category that says
    pets are refused.
    """
    haystack = " ".join((t or "").lower() for t in texts)
    if not haystack.strip():
        return None
    for label, terms in BANNED_ITEM_TERMS.items():
        for term in terms:
            if term in haystack:
                return label
    return None


def validate_item_category(category: str | None) -> None:
    """Raise if this is not a goods category.

    Deliberately strict about SERVICES slugs in particular: they used to
    be the only thing accepted here, so an old client or a stale draft
    will still send one, and letting it through is how a sofa ends up
    filed under "Cleaning Services" again.
    """
    from fastapi import HTTPException

    if category is None:
        return
    if category not in ITEM_CATEGORY_SLUGS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"'{category}' is not an item category. "
                f"Choose one of: {', '.join(sorted(ITEM_CATEGORY_SLUGS))}"
            ),
        )

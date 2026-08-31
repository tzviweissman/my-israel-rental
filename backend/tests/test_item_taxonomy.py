"""Goods have their own taxonomy, and item specifics are schema-checked.

THE BUG THIS REPLACES. Items took `category` from the SERVICES tree, so a
sofa was offered under "Cleaning Services" and "IT & Tech Support". A
`buy-sell` slug was added to that tree on 28 Aug 2026 and removed hours
later with the correct note: do not put items in the services grid.

The separation is only real if a services slug is REFUSED here, so that
is the first thing asserted - the two trees sharing one storage column is
exactly how they would quietly re-merge.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException  # noqa: E402

from routes.marketplace.item_taxonomy import (  # noqa: E402
    CATEGORY_FIELDS,
    ITEM_CATEGORIES,
    ITEM_CATEGORY_SLUGS,
    PROVENANCE_FIELDS,
    SCHEMA_VERSION,
    banned_reason,
    facet_fields_for,
    fields_for,
    normalize_attributes,
    validate_item_category,
)
from routes.marketplace.shared import CATEGORIES as SERVICE_CATEGORIES  # noqa: E402


# --------------------------------------------------------------------------
# The two trees are separate
# --------------------------------------------------------------------------

def test_no_goods_slug_collides_with_a_services_slug():
    """If one slug existed in both trees, `category` would be ambiguous in
    storage and the separation would be cosmetic."""
    service_slugs = {c["slug"] for c in SERVICE_CATEGORIES}
    overlap = ITEM_CATEGORY_SLUGS & service_slugs
    assert not overlap, f"these slugs exist in BOTH taxonomies: {sorted(overlap)}"


@pytest.mark.parametrize("slug", ["home-services-repair", "creative-design", "money-exchange", "buy-sell"])
def test_a_services_slug_is_refused_as_an_item_category(slug):
    """The actual regression guard. A stale client or an old draft will
    still send one of these."""
    with pytest.raises(HTTPException) as e:
        validate_item_category(slug)
    assert e.value.status_code == 400
    # The message must name what IS accepted, or the seller just guesses again.
    assert "furniture" in e.value.detail


@pytest.mark.parametrize("slug", sorted(ITEM_CATEGORY_SLUGS))
def test_every_goods_slug_is_accepted(slug):
    validate_item_category(slug)


def test_no_category_is_allowed():
    """Optional on items by design: somebody selling a sofa has already
    described it in the title, and forcing a taxonomy choice is how the
    wrong category gets picked at random."""
    validate_item_category(None)


def test_there_is_an_escape_hatch():
    """A taxonomy with no `other` does not get cleaner listings; it loses
    the listing or files it somewhere wrong."""
    assert "other" in ITEM_CATEGORY_SLUGS


def test_every_category_has_both_labels():
    for c in ITEM_CATEGORIES:
        assert c.get("label"), c
        assert c.get("label_he"), f"{c['slug']} has no Hebrew label"


def test_slugs_are_unique():
    slugs = [c["slug"] for c in ITEM_CATEGORIES]
    assert len(slugs) == len(set(slugs))


# --------------------------------------------------------------------------
# What may not be listed
# --------------------------------------------------------------------------

@pytest.mark.parametrize("text,expected", [
    ("Golden retriever puppy, 8 weeks", "pets"),
    ("Two tickets for the game on Thursday", "tickets"),
    ("Unused gift card, 200 shekels", "gift cards"),
    ("גור לבית אוהב", "pets"),
    ("כרטיסים להופעה", "tickets"),
])
def test_banned_classes_are_caught_on_the_sellers_own_words(text, expected):
    """Matched on the text, not the category. Nobody listing a puppy picks
    a category that says pets are refused."""
    assert banned_reason(text, "") == expected


@pytest.mark.parametrize("text", [
    "Three seat sofa, light grey",
    "Step down transformer, 2000W",
    "Bugaboo pram, barely used",
    "Shas, Vilna edition, twenty volumes",
])
def test_ordinary_listings_are_not_caught(text):
    assert banned_reason(text, "") is None


def test_banned_check_survives_empty_input():
    assert banned_reason(None, None) is None
    assert banned_reason("", "") is None


# --------------------------------------------------------------------------
# Item specifics
# --------------------------------------------------------------------------

def test_voltage_is_a_facet_where_it_matters_and_absent_where_it_does_not():
    """The single most valuable field on this site, and the clearest case
    of a facet that must be per-category: a voltage filter on a bookshelf
    is noise."""
    for cat in ("appliances", "electronics", "home-kitchen"):
        keys = {f["key"] for f in fields_for(cat)}
        assert "voltage" in keys, f"{cat} lost its voltage field"
    assert "voltage" in {f["key"] for f in facet_fields_for("appliances")}

    for cat in ("books-judaica", "furniture", "baby-kids"):
        assert "voltage" not in {f["key"] for f in fields_for(cat)}, cat


def test_the_two_safety_fields_exist_where_the_spec_puts_them():
    assert "serial_or_imei" in {f["key"] for f in fields_for("electronics")}
    assert "frame_number" in {f["key"] for f in fields_for("bikes-scooters")}


def test_the_provenance_fields_are_not_themselves_facets():
    """Nobody browses by serial number. What is filterable is that one was
    PROVIDED, which is a presence check, not a value match."""
    for cat in ("electronics", "bikes-scooters"):
        for f in facet_fields_for(cat):
            assert f["key"] not in PROVENANCE_FIELDS, (
                f"{f['key']} is offered as a value facet; only its presence is meaningful"
            )


def test_the_friction_rule_holds_at_most_one_required_field():
    """Listing is the scarce act. The photo produces the attributes and the
    seller confirms them, so no category may demand a form."""
    for cat in sorted(ITEM_CATEGORY_SLUGS):
        required = [f["key"] for f in fields_for(cat) if f.get("required")]
        assert len(required) <= 1, f"{cat} requires {required}"


def test_every_field_declares_both_labels_and_every_enum_option_too():
    for cat in sorted(ITEM_CATEGORY_SLUGS):
        for f in fields_for(cat):
            assert f.get("label") and f.get("label_he"), f"{cat}.{f['key']} is missing a label"
            if f["type"] == "enum":
                assert f.get("options"), f"{cat}.{f['key']} is an enum with no options"
                for o in f["options"]:
                    assert o.get("label") and o.get("label_he"), f"{cat}.{f['key']}={o['value']}"


def test_every_category_with_fields_is_a_real_category():
    unknown = set(CATEGORY_FIELDS) - ITEM_CATEGORY_SLUGS
    assert not unknown, f"fields declared for non-existent categories: {unknown}"


# --------------------------------------------------------------------------
# Attribute coercion
# --------------------------------------------------------------------------

def test_enum_values_outside_the_declaration_are_dropped():
    """Storing one would create a facet value no filter can ever match,
    while looking to the seller like they filled the field in."""
    out = normalize_attributes("appliances", {"voltage": "240v"})
    assert out == {}
    assert normalize_attributes("appliances", {"voltage": "110V"}) == {"voltage": "110v"}


def test_unknown_keys_are_dropped_not_stored():
    out = normalize_attributes("furniture", {"material": "wood", "colour_of_owner": "blue"})
    assert out == {"material": "wood"}


def test_a_field_from_another_category_is_dropped():
    """`nusach` is meaningless on a bicycle."""
    assert normalize_attributes("bikes-scooters", {"nusach": "ashkenaz"}) == {}


def test_booleans_normalise_to_one_spelling():
    for raw in ("true", "TRUE", "yes", "1"):
        assert normalize_attributes("furniture", {"assembly_required": raw}) == {"assembly_required": "true"}
    for raw in ("false", "no", "0"):
        assert normalize_attributes("furniture", {"assembly_required": raw}) == {"assembly_required": "false"}
    assert normalize_attributes("furniture", {"assembly_required": "maybe"}) == {}


def test_numbers_are_bounded_and_cleaned():
    assert normalize_attributes("appliances", {"age_years": "3"}) == {"age_years": "3"}
    assert normalize_attributes("olim-essentials", {"wattage": "2,000"}) == {"wattage": "2000"}
    assert normalize_attributes("appliances", {"age_years": "-4"}) == {}
    assert normalize_attributes("appliances", {"age_years": "banana"}) == {}


def test_text_is_length_capped():
    out = normalize_attributes("furniture", {"dimensions": "x" * 500})
    assert len(out["dimensions"]) <= 120


@pytest.mark.parametrize("junk", [None, [], "string", 5, {"": ""}, {"brand": None}, {"brand": "   "}])
def test_junk_never_raises_and_never_stores_blanks(junk):
    """This runs on a public write path; it must not throw, and an empty
    string stored as a value would render as a blank row on the listing."""
    out = normalize_attributes("furniture", junk)
    assert isinstance(out, dict)
    assert all(v for v in out.values())


def test_the_schema_is_versioned():
    assert isinstance(SCHEMA_VERSION, int) and SCHEMA_VERSION >= 1

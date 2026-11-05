"""Someone who knows a business finds it by name (5 Nov 2026): every word has
to be in the name, in English or Hebrew, and search text stays literal."""
import re

from routes.marketplace.shared import _business_name_filter


def _matches(flt, doc):
    if "_id" in flt:
        return False
    return all(
        any(re.search(c[k]["$regex"], doc.get(k) or "", re.I) for c in w["$or"] for k in c)
        for w in flt["$and"]
    )


def test_every_word_of_the_name():
    doc = {"name": "The Brown Box"}
    assert _matches(_business_name_filter("brown box"), doc)
    assert _matches(_business_name_filter("BOX brown"), doc)
    assert not _matches(_business_name_filter("brown bag"), doc)


def test_hebrew_name():
    assert _matches(_business_name_filter("הבוקס"), {"name": "The Brown Box", "name_he": "הבראון בוקס"}) is False
    assert _matches(_business_name_filter("בראון"), {"name": "The Brown Box", "name_he": "הבראון בוקס"})


def test_empty_search_names_nothing():
    assert _business_name_filter("  ... ") == {"_id": {"$in": []}}


def test_search_text_is_never_a_pattern():
    assert not _matches(_business_name_filter(".*"), {"name": "The Brown Box"})
    assert ".*" not in str(_business_name_filter("a.*b"))

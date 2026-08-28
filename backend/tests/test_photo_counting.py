"""Everything that asks "does this listing have a photo" agrees.

THE BUG. The admin dashboard's attention queue said "18 published
services with no photo" when 2 were genuinely photoless (Tzvi, 28 Aug
2026). It counted an EMPTY `gallery` — which is the normal, correct state
of a store, because the wizard hangs a store's photos off each product,
and of a tiered service, which hangs them off each tier. So the one queue
an admin is meant to work through was ninety percent businesses who had
already done the thing they were about to be nudged about.

This exact mistake had already been made and fixed once, in the business
completeness checklist, and the fix did not travel. The comment there
even explains the failure. That is the argument for a shared constant
rather than a third careful copy: the knowledge was written down and the
next person still got it wrong, because the query was theirs to retype.

WHAT IS PINNED. Not the query's text — that would just be the same
literal written twice. The behaviour: that `HAS_ANY_PHOTO` accepts each
of the three places a photo legitimately lives, and that a listing with
no photo anywhere is still caught. If somebody narrows it back to
`gallery`, the store and tier cases fail here.

No database: these are documents matched against a filter, which is a
pure question about the filter.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.marketplace.gigs import _has_any_photo  # noqa: E402
from routes.marketplace.shared import HAS_ANY_PHOTO  # noqa: E402


# --------------------------------------------------------------------------
# A tiny matcher for the handful of Mongo operators the filter uses.
# --------------------------------------------------------------------------

def _get(doc, dotted):
    """Resolve 'products.images.0', descending into lists like Mongo does."""
    cur = [doc]
    for part in dotted.split("."):
        nxt = []
        for c in cur:
            if isinstance(c, dict):
                if part in c:
                    nxt.append(c[part])
            elif isinstance(c, list):
                if part.isdigit():
                    i = int(part)
                    if i < len(c):
                        nxt.append(c[i])
                else:
                    for item in c:
                        if isinstance(item, dict) and part in item:
                            nxt.append(item[part])
        cur = nxt
        if not cur:
            return []
    return cur


def matches(doc, clause):
    (field, cond), = clause.items()
    values = _get(doc, field)
    if "$exists" in cond:
        return bool(values) == cond["$exists"]
    if "$nin" in cond:
        return any(v not in cond["$nin"] for v in values)
    raise AssertionError(f"unhandled operator in {clause}")


def has_photo(doc):
    """What `$or: HAS_ANY_PHOTO` would select."""
    return any(matches(doc, c) for c in HAS_ANY_PHOTO)


IMG = "https://example.com/a.jpg"

GIG_GALLERY = {"gallery": [IMG]}
STORE_PRODUCT_IMAGES = {"gallery": [], "products": [{"images": [IMG]}]}
STORE_PRODUCT_IMAGE = {"gallery": [], "products": [{"image": IMG}]}
TIERED = {"gallery": [], "tiers": [{"images": [IMG]}]}
PHOTOLESS = {"gallery": [], "products": [{"image": ""}], "tiers": [{"images": []}]}
EMPTY = {}


# --------------------------------------------------------------------------

def test_a_gig_gallery_counts():
    assert has_photo(GIG_GALLERY)


def test_a_store_with_photos_on_its_products_counts():
    """The case that produced the wrong number. A store's `gallery` is
    empty by design — the wizard puts the photos on the products."""
    assert has_photo(STORE_PRODUCT_IMAGES)
    assert has_photo(STORE_PRODUCT_IMAGE)


def test_a_tiered_service_with_photos_on_its_tiers_counts():
    assert has_photo(TIERED)


def test_a_listing_with_no_photo_anywhere_is_still_caught():
    """The other half. A filter that says yes to everything would pass
    every test above and make the queue permanently empty instead of
    permanently full."""
    assert not has_photo(PHOTOLESS)
    assert not has_photo(EMPTY)


def test_it_agrees_with_the_function_that_refuses_publication():
    """`_has_any_photo` in gigs.py decides whether a listing may be
    published at all. If the count and the gate disagree, the dashboard
    flags listings the app itself considers complete — which is exactly
    what it was doing."""
    for doc in (GIG_GALLERY, STORE_PRODUCT_IMAGES, STORE_PRODUCT_IMAGE, TIERED, PHOTOLESS, EMPTY):
        assert has_photo(doc) == _has_any_photo(doc), doc


def test_the_admin_queue_uses_the_shared_list():
    """Reads the source: the assertion is that the dashboard does not
    hand-roll the query again, which is how it drifted the first time."""
    src = (Path(__file__).resolve().parents[1] / "routes/admin/marketplace.py").read_text(encoding="utf-8")
    assert "HAS_ANY_PHOTO" in src, "the admin count no longer uses the shared photo test"
    assert not re.search(r'"gallery":\s*\{"\$size":\s*0\}', src), (
        'the admin count is back to testing an empty `gallery`, which counts '
        "every store and tiered listing as photoless"
    )

"""A renamed business still previews correctly on its old links.

THE BUG. Renaming a business retires its old slug into `previous_slugs`,
and the page lookup falls back to it — so a link shared months ago still
opens the right page. `_preview_meta`, which builds the WhatsApp/OG card
for that SAME url, matched only `_id` and the CURRENT slug.

So the link worked and the card did not: a customer pasting it into a
WhatsApp group got the generic "MyIsraelRental" tile instead of the
business, which is precisely the failure the preview route was built to
fix — landing on the links most likely to be re-shared, because an old
link is by definition one that has been around.

Silent in both directions: the page renders, nothing errors, and the only
symptom is a share card nobody screenshots.

WHAT IS PINNED. That the preview lookup considers the same three keys the
page lookup does, and in the same ORDER — a live slug must beat a retired
one, or a business could be previewed as whichever one used to own its
name. Ordering is why this is three queries rather than one `$or`, which
cannot express preference.
"""
import inspect
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes import short_links  # noqa: E402


def _meta_source() -> str:
    return inspect.getsource(short_links._preview_meta)


def test_the_preview_looks_up_retired_slugs():
    src = _meta_source()
    assert "previous_slugs" in src, (
        "the link-preview card cannot resolve a renamed business, so every "
        "already-shared link previews as the generic site card"
    )


def test_it_checks_the_same_keys_as_the_page():
    """If these two disagree, a url renders one business and previews
    another — or previews nothing."""
    src = _meta_source()
    for key in ('"_id"', '"slug"', '"previous_slugs"'):
        assert key in src, f"the preview lookup ignores {key}"


def test_a_live_slug_wins_over_a_retired_one():
    """Order, not just presence. `unique_slug` will not reissue a retired
    slug to a different business, but if it ever did, a card must show
    the business that holds the name NOW.

    Asserted by position: the fallbacks run in sequence, so the retired
    lookup has to come last.
    """
    src = _meta_source()
    assert src.index('"slug"') < src.index('"previous_slugs"'), (
        "the retired-slug lookup runs before the live one"
    )


def _code_only(src: str) -> str:
    """Source with comment lines dropped.

    The first version of the test below searched the raw source for
    "$or" and matched the COMMENT explaining why $or is not used — a
    test that failed on correct code because of the prose next to it.
    """
    return "\n".join(
        line for line in src.splitlines() if not line.lstrip().startswith("#")
    )


def test_it_is_a_fallback_chain_not_one_or_query():
    """An `$or` matches any clause with no preference between them, which
    is what makes the ordering above unexpressible."""
    code = _code_only(_meta_source())
    biz_block = code[code.index('target_type == "business"'):]
    biz_block = biz_block.split("return")[0]
    assert "$or" not in biz_block, (
        "the business lookup is back to a single $or, which cannot prefer "
        "a live slug over a retired one"
    )
    # Three separate lookups, chained so the first hit wins.
    assert biz_block.count("find_one") >= 3, (
        f"expected three fallback lookups, found {biz_block.count('find_one')}"
    )


def test_the_og_route_shares_the_builder():
    """Both the short link and the raw /business/{slug} card come from
    `_preview_meta`, so this fix reaches both. If the OG route ever grows
    its own lookup, the two can disagree about a renamed business."""
    src = inspect.getsource(short_links.business_link_preview)
    assert "_preview_meta" in src
    assert "db.businesses" not in src, (
        "the OG route queries businesses itself instead of using the shared "
        "metadata builder"
    )

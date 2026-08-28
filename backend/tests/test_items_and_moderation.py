"""Person-to-person items, and the safety that ships with them (N4 + N6).

WHY THESE TWO TOGETHER. The spec is explicit that N6 ships WITH N4 and not
after it: "Classifieds bring scams. Build for that from day one." Opening
person-to-person selling and adding the protections in a later pass means
running a classifieds board unprotected for however long that pass takes,
which is exactly when it gets found.

WHAT IS ASSERTED, AND WHY EACH ONE WOULD OTHERWISE FAIL QUIETLY:

  * `item` is a real request type. The board is the whole mechanism — the
    30-day expire/renew lifecycle already exists and is why there is no
    third product — so if the pattern does not accept it, items cannot be
    posted at all, loudly. That one is not the risk.

  * `item_status` is SEPARATE from `status`. This is the design decision
    most likely to be "simplified" later by somebody who sees two status
    fields and merges them. Marking a sofa sold must not take the post off
    the board: a buyer who followed a link is better served by "sold" than
    by a 404.

  * Sold items leave the DEFAULT view. "A board full of sold items is how
    classifieds sites die" — but the post still resolves.

  * The moderation flag never reaches the public API. `_public` excludes
    rather than whitelists, so every new field is public by default; that
    is how a phone number nearly shipped once already, and `needs_review`
    tells whoever is committing fraud which categories we watch.

  * The daily cap exists and is lower for a new account. A limit that is
    defined and never called is the normal way rate limiting fails.

No database. These are questions about models, filters and wiring, and a
test that needs a seeded Mongo to prove a limit is enforced is a test that
gets skipped in CI and stops protecting anything.
"""
import inspect
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.marketplace import requests as reqs  # noqa: E402


def _item(**over):
    base = dict(
        request_type="item",
        title="IKEA sofa, three seats",
        description="Grey fabric, four years old, collection from Katamon.",
        area="Jerusalem",
        condition="good",
        budget_type="fixed",
        budget_amount=400,
    )
    base.update(over)
    return reqs.RequestIn(**base)


# --------------------------------------------------------------------------
# The item variant
# --------------------------------------------------------------------------

def test_item_is_an_accepted_request_type():
    assert _item().request_type == "item"


def test_the_three_variants_are_the_only_ones():
    for bad in ("job", "gig", "listing", ""):
        with pytest.raises(ValidationError):
            _item(request_type=bad)


def test_an_item_needs_a_condition():
    """The first thing a buyer asks, and the one fact a photo cannot
    settle."""
    with pytest.raises(Exception) as e:
        reqs._validate_variant(_item(condition=None))
    assert "condition" in str(e.value).lower()

    with pytest.raises(Exception):
        reqs._validate_variant(_item(condition="mint"))


def test_an_item_does_not_need_a_category():
    """Deliberately unlike a service. A seeker looking for a plumber must
    name a category or nobody can be matched to them; somebody selling a
    sofa has already described it in the title, and forcing a taxonomy
    choice on a classified ad is how the wrong one gets picked."""
    reqs._validate_variant(_item(category=None))


def test_an_items_category_is_still_validated_when_given():
    with pytest.raises(Exception):
        reqs._validate_variant(_item(category="not-a-real-category"))


def test_photos_are_capped():
    with pytest.raises(ValidationError):
        _item(photos=[f"https://example.com/{i}.jpg" for i in range(reqs.MAX_ITEM_PHOTOS + 1)])


def test_the_price_reuses_the_budget_fields():
    """Not a new field. "₪400" and "up to ₪8,000" are the same shape, and
    one price field is why the board's filters, cards and search work for
    items without a second code path."""
    assert "price" not in reqs.RequestIn.model_fields
    assert _item(budget_amount=400).budget_amount == 400


# --------------------------------------------------------------------------
# Sold — the state the gig model does not have
# --------------------------------------------------------------------------

def test_item_status_is_separate_from_status():
    """If these are ever merged, marking something sold also removes the
    post, and a buyer who followed a link gets a 404 instead of an
    answer."""
    src = inspect.getsource(reqs.mark_sold)
    assert '"item_status"' in src
    assert '"status"' not in src.replace('"item_status"', ""), (
        "mark_sold writes the post's lifecycle status — sold must not "
        "take the post off the board"
    )


def test_sold_is_reversible():
    """A sale falls through. A board where "sold" is one-way teaches
    sellers not to press it."""
    assert reqs.SoldIn(sold=False).sold is False
    src = inspect.getsource(reqs.mark_sold)
    assert '"available"' in src


def test_only_an_item_can_be_marked_sold():
    src = inspect.getsource(reqs.mark_sold)
    assert 'request_type") != "item"' in src


def test_sold_items_leave_the_default_view_but_still_resolve():
    """Hidden from the board, reachable by link — the post is not
    deleted."""
    src = inspect.getsource(reqs.list_requests)
    # Asserted as two facts rather than one exact line: the filter exists
    # and it excludes sold. Matching the literal punctuation would make
    # this fail on a reformat, which teaches people to delete the test.
    assert "include_sold" in src
    assert "item_status" in src and '"$ne": "sold"' in src
    # get_request has no item_status condition at all, which is the point:
    # the post still resolves for somebody who followed a link.
    assert "item_status" not in inspect.getsource(reqs.get_request)


def test_the_board_filters_on_condition_and_price():
    src = inspect.getsource(reqs.list_requests)
    for f in ("condition", "min_price", "max_price"):
        assert f in src, f"the board cannot filter by {f}"


def test_price_filtering_ignores_posts_with_no_price():
    """An "open to offers" post has no number. Treating that as 0 would
    put every one of them at the top of a cheapest-first filter."""
    src = inspect.getsource(reqs.list_requests)
    assert '"budget_amount"' in src


# --------------------------------------------------------------------------
# N6 — the safety that ships with it
# --------------------------------------------------------------------------

def test_the_daily_item_limit_is_enforced_on_create():
    """A limit that is defined and never called is the normal way rate
    limiting fails."""
    assert inspect.iscoroutinefunction(reqs._enforce_item_daily_limit)
    assert "_enforce_item_daily_limit" in inspect.getsource(reqs.create_request)


def test_a_new_account_gets_a_lower_limit():
    assert reqs.MAX_ITEMS_PER_DAY_NEW_ACCOUNT < reqs.MAX_ITEMS_PER_DAY
    src = inspect.getsource(reqs._enforce_item_daily_limit)
    assert "MAX_ITEMS_PER_DAY_NEW_ACCOUNT" in src
    assert "NEW_ACCOUNT_DAYS" in src


def test_the_account_lookup_tries_both_id_keys():
    """`auth.py` writes the user document with `id`; other collections use
    `_id`. Querying one alone found nothing, fell through to the HIGHER
    limit, and the new-account tier silently did not exist — a rate limit
    that is written, called, and answers "fine" every time. Caught by the
    end-to-end check, not by any unit test, which is why it is pinned
    here now."""
    src = inspect.getsource(reqs._enforce_item_daily_limit)
    assert '{"_id": user["user_id"]}' in src
    assert '{"id": user["user_id"]}' in src


def test_an_unreadable_join_date_does_not_lock_someone_out():
    """Falls back to the ordinary limit, not the strict one. A user whose
    record is odd should not silently get a third of the allowance."""
    src = inspect.getsource(reqs._enforce_item_daily_limit)
    assert "except (ValueError, TypeError)" in src


def test_fraud_prone_categories_are_flagged_not_hidden():
    """Flagged for a human, still visible. Hiding a legitimate seller's
    post on suspicion is its own harm."""
    assert "money-exchange" in reqs.MANUAL_REVIEW_CATEGORIES
    src = inspect.getsource(reqs.create_request)
    assert '"needs_review"' in src
    assert '"hidden_by_admin": False' in src


def test_the_moderation_flag_never_reaches_the_public_api():
    out = reqs._public({
        "_id": "r1", "title": "t", "needs_review": True,
        "report_count": 9, "reported_by": ["u"], "hidden_by_admin": True,
        "whatsapp": "+972500000000",
    })
    for leaked in ("needs_review", "report_count", "reported_by", "hidden_by_admin", "whatsapp"):
        assert leaked not in out, f"{leaked} is exposed on the public board"


def test_item_fields_do_reach_the_public_api():
    """The other half — a strip list that took the item fields with it
    would leave every card blank."""
    out = reqs._public({
        "_id": "r1", "title": "t", "condition": "good",
        "item_status": "available", "photos": ["a.jpg"], "pickup_area": "Katamon",
    })
    for kept in ("condition", "item_status", "photos", "pickup_area"):
        assert kept in out


# --------------------------------------------------------------------------
# The queue that reads the reports
# --------------------------------------------------------------------------

def test_there_is_a_moderation_queue():
    """Reports have been written to `request_reports` since the board
    shipped and nothing ever read them. A report button that files into a
    drawer nobody opens is worse than no button — it tells the person who
    pressed it that somebody is looking."""
    from routes.admin import marketplace as admin_mp

    paths = {getattr(r, "path", "") for r in admin_mp.api_router.routes}
    assert "/admin/request-reports" in paths
    assert "/admin/request-reports/{request_id}" in paths


def test_the_queue_shows_the_reasons_not_just_a_count():
    """"Scam" and "wrong category" need different responses, and a bare
    count cannot tell them apart."""
    from routes.admin import marketplace as admin_mp

    src = inspect.getsource(admin_mp.admin_request_reports)
    assert "request_reports" in src
    assert '"reports"' in src


def test_allowing_a_post_clears_the_auto_hide():
    """Three coordinated reports auto-hide a post. That is a holding
    action, not a decision — a human must be able to put it back, and the
    same reports must not immediately re-trigger the threshold."""
    from routes.admin import marketplace as admin_mp

    src = inspect.getsource(admin_mp.admin_moderate_request)
    assert '"hidden_by_admin": False' in src
    assert '"report_count": 0' in src
    assert '"needs_review": False' in src


def test_a_decision_is_recorded_so_the_queue_empties():
    """An admin who looked and decided it was fine must not see it again
    tomorrow, or the queue trains them to ignore it."""
    from routes.admin import marketplace as admin_mp

    assert "moderated_at" in inspect.getsource(admin_mp.admin_moderate_request)
    assert "moderated_at" in inspect.getsource(admin_mp.admin_request_reports)


def test_the_attention_row_counts_moderation():
    from routes.admin import marketplace as admin_mp

    assert "posts_awaiting_moderation" in inspect.getsource(admin_mp.admin_attention)

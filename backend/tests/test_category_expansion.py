"""The 2026-08-28 category expansion (docs/categories-expansion-spec.md N1).

Two things are pinned here, and the second is the point.

FIRST, the five new categories are real: they validate, they are unique,
and they did not displace anything. Ordinary.

SECOND, the two that are NOT shipped stay not-shipped.
`immigration-documents` and `medical-health` each carry a question that is
not a programming question — the line between a directory of other
people's businesses and the discontinued government "paid services"
feature, and defamation exposure on reviews of named clinicians. The spec
asks for a lawyer on both.

`money-exchange` was the third until 28 Aug 2026, when Tzvi released it
after the regulatory note was put to him. It is live, and two things
travel with it and are asserted below: we never claim to handle money,
and a licence number is shown when supplied. Releasing a category is a
decision someone can make; quietly dropping the conditions attached to it
is not, which is why they are tests rather than comments.

Code like that decays in a predictable way: it sits in a list next to
twenty categories that ARE live, and one day somebody tidying the file
moves it up four lines. Nothing fails, nothing is reviewed, and a
regulated category is live. So the boundary is asserted, with the reason
attached, and releasing them means deleting an assertion that says why —
which is a decision rather than a tidy-up.

Deliberately no database here: this is about a list and a flag.
"""
import importlib
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.marketplace import shared  # noqa: E402


NEW = ["buy-sell", "religious-services", "insurance", "vehicles", "money-exchange"]
HELD = ["immigration-documents", "medical-health"]


# --------------------------------------------------------------------------
# The five that shipped
# --------------------------------------------------------------------------

@pytest.mark.parametrize("slug", NEW)
def test_the_new_categories_are_live(slug):
    assert slug in shared._CATEGORY_SLUGS
    shared._validate_category(slug)  # raises if it is not accepted


def test_every_category_has_a_label_and_an_icon():
    """A category with no label renders its slug; one with no icon falls
    back to a generic briefcase. Both look like a bug to a visitor."""
    for c in shared.CATEGORIES:
        assert c.get("label"), f"{c['slug']} has no label"
        assert c.get("icon"), f"{c['slug']} has no icon"


def test_no_duplicate_slugs():
    slugs = [c["slug"] for c in shared.CATEGORIES]
    assert len(slugs) == len(set(slugs)), "a slug is listed twice"


def test_the_new_categories_do_not_collide_with_a_legacy_one():
    """A new slug that is also a MIGRATION key would be remapped away the
    moment somebody used it — the category would exist and silently
    resolve to a different one."""
    for slug in NEW + HELD:
        assert slug not in shared.CATEGORY_MIGRATION, (
            f"{slug} is a legacy slug that migrates to "
            f"{shared.CATEGORY_MIGRATION.get(slug)} — it cannot also be a live category"
        )


def test_migration_targets_all_still_exist():
    """Slugs are permanent once live (a printed QR encodes them), so the
    migration map is append-only and every target must resolve."""
    for old, new in shared.CATEGORY_MIGRATION.items():
        assert new in shared._CATEGORY_SLUGS, (
            f"{old} migrates to {new}, which is not a category any more"
        )


# --------------------------------------------------------------------------
# The two that did not
# --------------------------------------------------------------------------

@pytest.mark.parametrize("slug", HELD)
def test_categories_awaiting_review_are_not_served(slug):
    """If this fails, one of two sensitive categories went live.

    immigration-documents — closest of any to the discontinued government
                            "paid services" (CLAUDE.md, kept off behind
                            DOCUMENT_SERVICES_ENABLED). A directory of
                            other people's businesses is a different
                            thing, which is exactly why the line gets
                            crossed by accident.
    medical-health        — public reviews of named clinicians carry a
                            defamation exposure a plumber review does not.

    Releasing one is fine — after the review the spec asks for. Do it by
    moving the slug into CATEGORIES and out of this list, so the change
    is visible in a diff.
    """
    assert slug not in shared._CATEGORY_SLUGS, (
        f"{slug} is live without the review this test exists to force — "
        "see the docstring"
    )
    assert any(c["slug"] == slug for c in shared.CATEGORIES_PENDING_REVIEW)


def test_the_held_list_is_exactly_the_two():
    assert sorted(c["slug"] for c in shared.CATEGORIES_PENDING_REVIEW) == sorted(HELD)


def test_the_held_ones_are_rejected_by_validation():
    for slug in HELD:
        with pytest.raises(Exception):
            shared._validate_category(slug)


def test_the_flag_actually_releases_them():
    """The other half: the flag is not decoration. If it did nothing, the
    two would be unreachable no matter what was decided, and somebody
    would 'fix' that by moving them into CATEGORIES without review.
    """
    prior = os.environ.get("CATEGORIES_PENDING_REVIEW_ENABLED")
    os.environ["CATEGORIES_PENDING_REVIEW_ENABLED"] = "true"
    try:
        reloaded = importlib.reload(shared)
        for slug in HELD:
            assert slug in reloaded._CATEGORY_SLUGS, (
                f"{slug} stayed hidden with the flag on — the flag does nothing"
            )
    finally:
        if prior is None:
            os.environ.pop("CATEGORIES_PENDING_REVIEW_ENABLED", None)
        else:
            os.environ["CATEGORIES_PENDING_REVIEW_ENABLED"] = prior
        # Reload again so the default state is what every other test in
        # the session sees. Without this, whichever test runs next
        # inherits the extra categories.
        importlib.reload(shared)


def test_the_default_is_off():
    """Belt and braces after the reload dance above: a leaked env var
    from another test would make the held-category assertions pass
    vacuously in the wrong direction."""
    assert os.environ.get("CATEGORIES_PENDING_REVIEW_ENABLED", "").lower() not in (
        "1", "true", "yes",
    )
    for slug in HELD:
        assert slug not in shared._CATEGORY_SLUGS


# --------------------------------------------------------------------------
# The conditions attached to money-exchange
# --------------------------------------------------------------------------

def test_money_exchange_is_live():
    assert "money-exchange" in shared._CATEGORY_SLUGS


def test_money_exchange_carries_the_directory_disclaimer():
    """The category is live on the understanding that we say, on the
    page, that we are a directory and not a money service. Currency
    service providers in Israel are licensed and supervised; listing one
    is not facilitating exchange, and the difference has to be legible to
    a visitor rather than merely true in our heads.

    If somebody removes the category from this set, the listing silently
    stops saying it — nothing errors, nothing looks wrong, and the one
    sentence that draws the line is gone.
    """
    assert "money-exchange" in shared.CATEGORIES_WITH_DISCLAIMER


def test_the_disclaimer_set_only_holds_live_categories():
    """A disclaimer aimed at a category nobody can choose protects
    nothing, and reads as though the rule is handled."""
    for slug in shared.CATEGORIES_WITH_DISCLAIMER:
        assert slug in shared._CATEGORY_SLUGS, (
            f"{slug} carries a disclaimer but is not a live category"
        )


def test_the_business_model_accepts_a_licence_number():
    """The other half of the release: a money changer can state their
    licence. Optional on purpose — we cannot verify it, and requiring it
    would turn a fact the business volunteers into a badge we appear to
    have checked."""
    from routes.marketplace.businesses import BusinessPatch

    assert "license_number" in BusinessPatch.model_fields
    field = BusinessPatch.model_fields["license_number"]
    assert not field.is_required(), "the licence number must stay optional"

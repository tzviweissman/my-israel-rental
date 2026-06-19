"""Regression test for the dedupe signature.

Real-world scenarios this covers:
  • A Jerusalem owner has three flats in "Sanhedria Murchevet 4" —
    2BR ground floor, 3BR floor 2, 4BR penthouse. Old logic flagged all
    three as duplicates of each other; new logic treats them as the
    distinct apartments they are.
  • Sukkot/Pesach pricing lives on a SINGLE listing (holiday_lump_price
    + the per-night toggle), so holiday_tags is intentionally NOT part
    of the dedupe signature — we don't want owners to end up with two
    near-identical listings just to capture holiday premium pricing.
"""
from utils.dedupe import dedupe_signature


def test_same_address_different_bedrooms_NOT_duplicate():
    sig_a = dedupe_signature(
        owner_id="owner-1", address="Sanhedria Murchevet 4",
        rental_type="long-term", bedrooms=2, floor=0,
    )
    sig_b = dedupe_signature(
        owner_id="owner-1", address="Sanhedria Murchevet 4",
        rental_type="long-term", bedrooms=3, floor=0,
    )
    assert sig_a != sig_b


def test_same_address_different_floor_NOT_duplicate():
    sig_a = dedupe_signature(
        owner_id="owner-1", address="Yaffo Rd 1",
        rental_type="vacation", bedrooms=2, floor=1,
    )
    sig_b = dedupe_signature(
        owner_id="owner-1", address="Yaffo Rd 1",
        rental_type="vacation", bedrooms=2, floor=2,
    )
    assert sig_a != sig_b


def test_identical_signature_IS_duplicate():
    sig_a = dedupe_signature(
        owner_id="owner-1", address="King George 12",
        rental_type="long-term", bedrooms=2, floor=3,
    )
    sig_b = dedupe_signature(
        owner_id="owner-1", address="  king george 12  ",
        rental_type="long-term", bedrooms=2, floor=3,
    )
    assert sig_a == sig_b, "Whitespace + case normalization must still collapse"


def test_None_bedrooms_does_not_match_concrete_value():
    sig_a = dedupe_signature(
        owner_id="o", address="x", rental_type="vacation",
        bedrooms=None, floor=None,
    )
    sig_b = dedupe_signature(
        owner_id="o", address="x", rental_type="vacation",
        bedrooms=3, floor=None,
    )
    sig_c = dedupe_signature(
        owner_id="o", address="x", rental_type="vacation",
        bedrooms=None, floor=None,
    )
    assert sig_a != sig_b
    assert sig_a == sig_c


def test_string_numerics_normalized():
    """CSVs come in with stringly-typed numerics — '2' and 2 must hash
    identically so the importer doesn't flag a duplicate as distinct."""
    sig_a = dedupe_signature(
        owner_id="o", address="x", rental_type="vacation",
        bedrooms="2", floor="3",
    )
    sig_b = dedupe_signature(
        owner_id="o", address="x", rental_type="vacation",
        bedrooms=2, floor=3,
    )
    assert sig_a == sig_b


def test_different_rental_type_NOT_duplicate():
    """An owner who lists the same flat as both long-term and vacation
    is doing it on purpose — we don't dedupe across rental_type."""
    sig_a = dedupe_signature(
        owner_id="o", address="x", rental_type="long-term", bedrooms=2, floor=1,
    )
    sig_b = dedupe_signature(
        owner_id="o", address="x", rental_type="vacation",  bedrooms=2, floor=1,
    )
    assert sig_a != sig_b


def test_missing_address_yields_None_signature():
    """No safe dedupe key without an address — better to allow the
    create than block legitimate inputs."""
    assert dedupe_signature(owner_id="o", address=None, rental_type="vacation") is None
    assert dedupe_signature(owner_id="o", address="  ", rental_type="vacation") is None

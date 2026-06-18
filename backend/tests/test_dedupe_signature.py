"""Regression test for the stricter dedupe signature — distinct units
at the same building address (different bedrooms or floor), AND
sukkot/pesach holiday listings of the same apartment, must NOT collide
as duplicates.

Real-world scenarios this covers:
  • A Jerusalem owner has three flats in "Sanhedria Murchevet 4" —
    2BR ground floor, 3BR floor 2, 4BR penthouse. Old logic flagged all
    three as duplicates of each other; new logic treats them as the
    distinct apartments they are.
  • The same apartment is listed twice: $400/night for general vacation,
    $10,000 total for Sukkot. Owners do this on purpose to capture
    holiday premium pricing. Adding `holiday_tags` to the signature
    keeps the two listings as separate sale events.
"""
from utils.dedupe import dedupe_signature, _norm_tags


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
    """Same owner, address, rental_type, bedrooms, floor, holiday_tags → duplicate."""
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
    """Two listings where one specifies bedrooms and the other doesn't
    should NOT collide — we'd rather miss a real duplicate than flag a
    distinct unit. Both-None still match each other (degenerate case)."""
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


# --- Holiday-tag split ---------------------------------------------------

def test_vacation_vs_sukkot_NOT_duplicate():
    """Same apartment, both vacation, but one has holiday_tags=['sukkot']
    and the other has empty tags. These are deliberate dual listings
    (e.g. $400/night normally + $10K lump for Sukkot) — must not collide."""
    base = dict(
        owner_id="o", address="Jaffa 100", rental_type="vacation",
        bedrooms=2, floor=3,
    )
    sig_regular = dedupe_signature(**base, holiday_tags=[])
    sig_sukkot = dedupe_signature(**base, holiday_tags=["sukkot"])
    sig_pesach = dedupe_signature(**base, holiday_tags=["pesach"])
    assert sig_regular != sig_sukkot
    assert sig_regular != sig_pesach
    assert sig_sukkot != sig_pesach


def test_holiday_tags_order_independent():
    """['sukkot','pesach'] must hash the same as ['pesach','sukkot']."""
    base = dict(
        owner_id="o", address="x", rental_type="vacation",
        bedrooms=2, floor=1,
    )
    sig_a = dedupe_signature(**base, holiday_tags=["sukkot", "pesach"])
    sig_b = dedupe_signature(**base, holiday_tags=["pesach", "sukkot"])
    assert sig_a == sig_b


def test_holiday_tags_case_and_whitespace_normalized():
    base = dict(
        owner_id="o", address="x", rental_type="vacation",
        bedrooms=2, floor=1,
    )
    sig_a = dedupe_signature(**base, holiday_tags=["Sukkot"])
    sig_b = dedupe_signature(**base, holiday_tags=["  sukkot  "])
    assert sig_a == sig_b


def test_holiday_tags_None_and_empty_equivalent():
    """A listing with `holiday_tags=None` is the same as `holiday_tags=[]`
    (both = 'no holiday tag')."""
    base = dict(
        owner_id="o", address="x", rental_type="vacation",
        bedrooms=2, floor=1,
    )
    sig_none = dedupe_signature(**base, holiday_tags=None)
    sig_empty = dedupe_signature(**base, holiday_tags=[])
    assert sig_none == sig_empty


def test_holiday_tags_accepts_comma_string():
    """CSV inputs often come as 'sukkot,pesach' — must normalize the
    same as the list form."""
    base = dict(
        owner_id="o", address="x", rental_type="vacation",
        bedrooms=2, floor=1,
    )
    sig_list = dedupe_signature(**base, holiday_tags=["sukkot", "pesach"])
    sig_str = dedupe_signature(**base, holiday_tags="sukkot,pesach")
    assert sig_list == sig_str


def test_norm_tags_helper_directly():
    assert _norm_tags(None) == ()
    assert _norm_tags([]) == ()
    assert _norm_tags(["sukkot"]) == ("sukkot",)
    assert _norm_tags(["sukkot", "sukkot"]) == ("sukkot",)  # dedupe
    assert _norm_tags("Pesach,Sukkot") == ("pesach", "sukkot")  # sorted

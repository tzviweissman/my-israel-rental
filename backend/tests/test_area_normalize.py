"""Unit tests for utils.area_normalize — the write-side area canonicaliser.

Pure logic, no DB. Most of the suite in this directory needs a live MongoDB
and errors at collection time with ``KeyError: 'MONGO_URL'``; this file
deliberately imports nothing that touches ``routes.deps``, so it runs
standalone:

    backend/.venv/Scripts/python.exe -m pytest tests/test_area_normalize.py

What's pinned here:
  * every stored spelling enumerated in ``frontend/src/utils/areaNames.js``
    (AREA_CANONICALS) — the real production drift — normalises to the value
    we expect;
  * "Sanhedria" and "Sanhedria Murchevet" stay distinct (no substring match);
  * unknown values pass through byte-for-byte;
  * None / blank are safe.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make `backend/` importable when running from project root.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.area_normalize import normalize_area  # noqa: E402

J = "Jerusalem"

# Every stored `area` spelling listed in AREA_CANONICALS, mapped to what
# normalize_area must return. Grouped by the real-world place so it's obvious
# which spellings are supposed to collapse together.
#
# A value that maps to ITSELF is an intentional pass-through, for one of three
# reasons, noted per group:
#   (a) not a neighbourhood at all (street name / colloquialism) — folding it
#       up into its neighbourhood would destroy precision the lister typed on
#       purpose (areaNames.js makes the same call);
#   (b) not in the catalogue, i.e. a genuinely unknown area; or
#   (c) a bare name that several cities share, with no evidence which was
#       meant — see _AMBIGUOUS_DEFAULT_CITY in utils/area_normalize.py.
PRODUCTION_VARIANTS: dict[str, str] = {
    # -- the big drift cluster: 3 spellings, ~51 listings ------------------
    "Ramat Eshkol": f"{J} - Ramat Eshkol",
    "Ramat Eshkol, Jerusalem": f"{J} - Ramat Eshkol",
    "Jerusalem - Ramat Eshkol": f"{J} - Ramat Eshkol",
    # -- 4 spellings of one place ------------------------------------------
    "Arzei Habira": f"{J} - Arzei HaBira",
    "Arzei HaBirah": f"{J} - Arzei HaBira",
    "Arzei HaBirah, Jerusalem": f"{J} - Arzei HaBira",
    "Jerusalem - Arzei HaBira": f"{J} - Arzei HaBira",
    # -- transliteration typo ----------------------------------------------
    # The catalogue (and therefore the dropdown, and therefore every area
    # filter) spells this "Murhevet", so that is the stored form even though
    # areaNames.js shows "Murchevet" as the display label.
    "Sanhedria Murchevet": f"{J} - Sanhedria Murhevet",
    "Sanhedria Murhevet": f"{J} - Sanhedria Murhevet",
    # -- a DIFFERENT neighbourhood; must not be swallowed by the above ------
    "Sanhedria": f"{J} - Sanhedria",
    "Sanhedria, Jerusalem": f"{J} - Sanhedria",
    # -- straightforward two/three-spelling clusters ------------------------
    "Geula": f"{J} - Geula",
    "Jerusalem - Geula": f"{J} - Geula",
    "Nachlaot": f"{J} - Nachlaot",
    "Jerusalem - Nachlaot": f"{J} - Nachlaot",
    "Rehavia": f"{J} - Rehavia",
    "Jerusalem - Rehavia": f"{J} - Rehavia",
    "Mekor Baruch": f"{J} - Mekor Baruch",
    "Jerusalem - Mekor Baruch": f"{J} - Mekor Baruch",
    "Maalot Dafna": f"{J} - Maalot Dafna",
    "Jerusalem - Maalot Dafna": f"{J} - Maalot Dafna",
    "Maalot Dafna, Jerusalem": f"{J} - Maalot Dafna",
    "French Hill": f"{J} - French Hill",
    "French Hill, Jerusalem": f"{J} - French Hill",
    "Ramat Shlomo": f"{J} - Ramat Shlomo",
    "Ramat Shlomo, Jerusalem": f"{J} - Ramat Shlomo",
    "Givat Shaul": f"{J} - Givat Shaul",
    "Jerusalem - Givat Shaul": f"{J} - Givat Shaul",
    # Catalogue spells these differently from the DB — canonical output uses
    # the catalogue spelling, since that's what the dropdown and filters use.
    "Givat Hamivtar": f"{J} - Givat HaMivtar",
    "Givat Hamivtar, Jerusalem": f"{J} - Givat HaMivtar",
    "Shaarei Chessed": f"{J} - Shaare Hesed",
    "Jerusalem - Shaare Hesed": f"{J} - Shaare Hesed",
    "Mekor Haim": f"{J} - Mekor Chaim",
    # -- single-spelling, unambiguous: still get a city prefix --------------
    "Baka": f"{J} - Baka",
    "Talbiya": f"{J} - Talbiya",
    "Har Nof": f"{J} - Har Nof",
    "Mamilla": f"{J} - Mamilla",
    # -- (c) shared by several cities, one spelling → left alone -----------
    "Old City": "Old City",
    "City Center": "City Center",
    "Romema": "Romema",
    "German Colony": "German Colony",
    # -- (a) streets inside Ramat Eshkol → precision preserved --------------
    "Machal": "Machal",
    "Machal, Jerusalem": "Machal, Jerusalem",
    "Levi Eshkol": "Levi Eshkol",
    "Mishmar HaGvul": "Mishmar HaGvul",
    # -- (b) not in the catalogue -----------------------------------------
    "Gush 80": "Gush 80",
    "Belz": "Belz",
    "Givat Hamivtar / Ramat Eshkol": "Givat Hamivtar / Ramat Eshkol",
    "Yaffo Street / City Center, Jerusalem": "Yaffo Street / City Center, Jerusalem",
}


class TestProductionVariants:
    def test_every_known_variant_normalises_as_expected(self):
        wrong = {
            raw: (normalize_area(raw), expected)
            for raw, expected in PRODUCTION_VARIANTS.items()
            if normalize_area(raw) != expected
        }
        assert not wrong, f"unexpected normalisation: {wrong}"

    def test_drifted_spellings_collapse_to_one_value(self):
        """The actual point of the exercise: one place, one stored value."""
        for cluster in (
            ["Ramat Eshkol", "Ramat Eshkol, Jerusalem", "Jerusalem - Ramat Eshkol"],
            [
                "Arzei Habira",
                "Arzei HaBirah",
                "Arzei HaBirah, Jerusalem",
                "Jerusalem - Arzei HaBira",
            ],
            ["Sanhedria Murchevet", "Sanhedria Murhevet"],
            ["Maalot Dafna", "Jerusalem - Maalot Dafna", "Maalot Dafna, Jerusalem"],
            ["Shaarei Chessed", "Jerusalem - Shaare Hesed"],
        ):
            results = {normalize_area(v) for v in cluster}
            assert len(results) == 1, f"{cluster} did not collapse: {results}"

    def test_output_is_idempotent(self):
        """Re-saving a listing must not shift its area again."""
        for raw in PRODUCTION_VARIANTS:
            once = normalize_area(raw)
            assert normalize_area(once) == once, raw


class TestNoSubstringCollapse:
    """"Sanhedria" and "Sanhedria Murchevet" are genuinely different places
    (Murhevet is the 1970 northern expansion). A substring match would merge
    them and silently move listings to the wrong neighbourhood."""

    def test_sanhedria_and_murchevet_stay_distinct(self):
        assert normalize_area("Sanhedria") == f"{J} - Sanhedria"
        assert normalize_area("Sanhedria Murchevet") == f"{J} - Sanhedria Murhevet"
        assert normalize_area("Sanhedria") != normalize_area("Sanhedria Murchevet")

    def test_talpiot_and_east_talpiot_stay_distinct(self):
        assert normalize_area("Talpiot") == f"{J} - Talpiot"
        assert normalize_area("East Talpiot") == f"{J} - East Talpiot"

    def test_partial_neighborhood_name_is_not_matched(self):
        # "Sanhedri" is not a place; must not resolve to Sanhedria.
        assert normalize_area("Sanhedri") == "Sanhedri"
        assert normalize_area("Ramat") == "Ramat"


class TestUnknownValuesPassThrough:
    def test_unknown_area_returned_unchanged(self):
        assert normalize_area("Atlantis") == "Atlantis"
        assert normalize_area("Some Brand New Neighbourhood") == "Some Brand New Neighbourhood"

    def test_unknown_is_returned_byte_for_byte(self):
        # Not even trimmed — an unrecognised value is never rewritten at all.
        raw = "  Weird   Place  "
        assert normalize_area(raw) == raw

    def test_free_text_with_a_city_name_but_unknown_neighborhood(self):
        assert normalize_area("Jerusalem - Nowhere") == "Jerusalem - Nowhere"
        assert normalize_area("Nowhere, Jerusalem") == "Nowhere, Jerusalem"

    def test_city_it_does_not_belong_to_is_not_invented(self):
        # Rehavia is Jerusalem-only; don't "fix" a stated city we can't verify.
        assert normalize_area("Haifa - Rehavia") == "Haifa - Rehavia"


class TestEmptyAndNone:
    def test_none_is_safe(self):
        assert normalize_area(None) is None

    def test_blank_strings_are_returned_unchanged(self):
        assert normalize_area("") == ""
        assert normalize_area("   ") == "   "


class TestShapesAndFolding:
    def test_case_and_whitespace_insensitive(self):
        assert normalize_area("  ramat   eshkol  ") == f"{J} - Ramat Eshkol"
        assert normalize_area("RAMAT ESHKOL, JERUSALEM") == f"{J} - Ramat Eshkol"
        assert normalize_area("jerusalem - ramat eshkol") == f"{J} - Ramat Eshkol"

    def test_other_cities_are_not_forced_to_jerusalem(self):
        assert normalize_area("Tel Aviv - Florentin") == "Tel Aviv - Florentin"
        assert normalize_area("Florentin") == "Tel Aviv - Florentin"
        assert normalize_area("Haifa - Ramat Eshkol") == "Haifa - Ramat Eshkol"
        assert normalize_area("Ramat Eshkol, Haifa") == "Haifa - Ramat Eshkol"

    def test_ambiguous_bare_name_keeps_its_city_when_stated(self):
        assert normalize_area("Beersheba - Old City") == "Beersheba - Old City"
        assert normalize_area("Jerusalem - Old City") == f"{J} - Old City"


class TestFilterCompatibility:
    """The canonical stored form must stay matchable by the existing area
    filter, which is what browse links and saved searches send. No filter
    was changed by this work — this test is here to keep it that way."""

    def test_canonical_form_matches_the_dropdown_filter_value(self):
        from utils.area_filter import area_matches

        for stored in ("Ramat Eshkol", "Ramat Eshkol, Jerusalem", f"{J} - Ramat Eshkol"):
            canonical = normalize_area(stored)
            # What FiltersPanel / SavedSearchesTab send is "<City> - <N>".
            assert area_matches(canonical, f"{J} - Ramat Eshkol")
            # …and the pre-normalisation value still matches too, so existing
            # rows keep working without a migration.
            assert area_matches(stored, f"{J} - Ramat Eshkol")

    def test_canonicalising_does_not_leak_across_cities(self):
        from utils.area_filter import area_matches

        assert not area_matches(normalize_area("Ramat Eshkol, Haifa"), f"{J} - Ramat Eshkol")

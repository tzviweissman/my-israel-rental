"""Unit tests for utils.area_filter.

Ensures the area filter:
  * Strips the city prefix so legacy bare-neighborhood data still matches.
  * Keeps the Sanhedria special case (matches "Sanhedria Murhevet" variants).
  * Prevents cross-city bleed for neighborhood names shared by multiple cities
    (Old City, City Center, Ramat Eshkol, Romema, Ramot, etc.).
  * Doesn't over-match on neighborhood-name overlaps like
    Talpiot vs East Talpiot, or Ramot vs Ramot Bet.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make `backend/` importable when running from project root.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.area_filter import area_matches, area_mongo_query, canonicalize_area  # noqa: E402


class TestAreaFilter:
    def test_no_filter_passes_everything(self):
        assert area_matches("Jerusalem - Rehavia", None) is True
        assert area_matches("Jerusalem - Rehavia", "") is True
        assert area_mongo_query(None) is None
        assert area_mongo_query("") is None
        assert area_mongo_query("   ") is None

    def test_canonical_match(self):
        assert area_matches("Jerusalem - Sanhedria", "Jerusalem - Sanhedria")

    def test_case_insensitive(self):
        assert area_matches("jerusalem - sanhedria", "Jerusalem - Sanhedria")

    def test_legacy_bare_neighborhood(self):
        # Data stored without city prefix must still match.
        assert area_matches("Sanhedria", "Jerusalem - Sanhedria")
        assert area_matches("Rehavia", "Jerusalem - Rehavia")

    def test_sanhedria_transliteration_variants(self):
        assert area_matches("Jerusalem - Sanhedria Murhevet", "Jerusalem - Sanhedria")
        assert area_matches("Jerusalem - Sanhedria Murchevet", "Jerusalem - Sanhedria")
        assert area_matches("sanhedria murchevet", "Jerusalem - Sanhedria")

    # --- the core regression: cross-city bleed must NOT happen ---
    def test_cross_city_old_city(self):
        assert not area_matches("Beersheba - Old City", "Jerusalem - Old City")

    def test_cross_city_city_center(self):
        assert not area_matches("Haifa - City Center", "Tel Aviv - City Center")
        assert not area_matches("Beersheba - City Center", "Tel Aviv - City Center")
        assert not area_matches("Netanya - City Center", "Tel Aviv - City Center")

    def test_cross_city_ramat_eshkol(self):
        assert not area_matches("Haifa - Ramat Eshkol", "Jerusalem - Ramat Eshkol")

    def test_cross_city_romema(self):
        assert not area_matches("Haifa - Romema", "Jerusalem - Romema")

    def test_cross_city_german_colony(self):
        assert not area_matches("Haifa - German Colony", "Jerusalem - German Colony")

    def test_cross_city_kiryat_shmuel(self):
        assert not area_matches("Haifa - Kiryat Shmuel", "Jerusalem - Kiryat Shmuel")

    def test_cross_city_ramot(self):
        assert not area_matches("Beersheba - Ramot", "Jerusalem - Ramot")
        assert not area_matches("Beersheba - Ramot Bet", "Jerusalem - Ramot")

    def test_cross_city_neve_shaanan(self):
        assert not area_matches("Haifa - Neve Sha'anan", "Tel Aviv - Neve Sha'anan")

    def test_cross_city_ramat_chen(self):
        assert not area_matches("Netanya - Ramat Chen", "Ramat Gan - Ramat Chen")

    def test_cross_city_dalet_gimmel(self):
        # Beersheba and Ashdod both use Hebrew-letter ward names.
        assert not area_matches("Beersheba - Dalet", "Ashdod - Dalet")
        assert not area_matches("Beersheba - Gimmel", "Ashdod - Gimmel")

    # --- prefix overlap within the same city must NOT bleed ---
    def test_talpiot_vs_east_talpiot(self):
        assert not area_matches("Jerusalem - East Talpiot", "Jerusalem - Talpiot")
        assert area_matches("Jerusalem - East Talpiot", "Jerusalem - East Talpiot")

    def test_kerem_avraham_vs_kerem_hateimanim(self):
        # Different cities, different neighborhoods — must not bleed.
        assert not area_matches(
            "Tel Aviv - Kerem HaTeimanim", "Jerusalem - Kerem Avraham"
        )

    def test_regex_special_chars_in_name(self):
        # "City Center (Lev Ha'Ir)" has parens & apostrophe.
        assert area_matches(
            "Tel Aviv - City Center (Lev Ha'Ir)",
            "Tel Aviv - City Center (Lev Ha'Ir)",
        )

    def test_dash_whitespace_tolerance(self):
        # Stored values may have no spaces around the dash.
        assert area_matches("Jerusalem-Sanhedria", "Jerusalem - Sanhedria")

    # --- Mongo regex shape ---
    def test_mongo_query_shape(self):
        q = area_mongo_query("Jerusalem - Sanhedria")
        assert q is not None
        assert "$regex" in q and "$options" in q
        assert q["$options"] == "i"


class TestCanonicalizeArea:
    """canonicalize_area folds variants → canonical "<City> - <Neighborhood>".

    Drives the Smart Lists locations dropdown: we don't want "Ramat Eshkol",
    "Jerusalem - Ramat Eshkol", and "Levi Eshkol" each as separate entries.
    """

    def test_bare_neighborhood_folded_to_canonical(self):
        assert canonicalize_area("Ramat Eshkol") == "Jerusalem - Ramat Eshkol"
        assert canonicalize_area("Sanhedria") == "Jerusalem - Sanhedria"

    def test_canonical_input_returned_unchanged(self):
        assert canonicalize_area("Jerusalem - Ramat Eshkol") == "Jerusalem - Ramat Eshkol"

    def test_levi_eshkol_alias_folds_to_ramat_eshkol(self):
        # Real-world signal: owners type the street name "Levi Eshkol" instead
        # of the neighborhood "Ramat Eshkol". The dropdown should still show
        # one entry and the filter should match both.
        assert canonicalize_area("Levi Eshkol") == "Jerusalem - Ramat Eshkol"

    def test_case_insensitive(self):
        assert canonicalize_area("levi eshkol") == "Jerusalem - Ramat Eshkol"
        assert canonicalize_area("RAMAT ESHKOL") == "Jerusalem - Ramat Eshkol"

    def test_unknown_value_returns_none(self):
        assert canonicalize_area("Atlantis") is None
        assert canonicalize_area("") is None
        assert canonicalize_area(None) is None


class TestAreaFilterWithAliases:
    """When the admin picks 'Jerusalem - Ramat Eshkol' the regex must also
    match listings stored under any known alias / bare variant."""

    def test_picking_ramat_eshkol_matches_levi_eshkol_listings(self):
        assert area_matches("Levi Eshkol", "Jerusalem - Ramat Eshkol")
        assert area_matches("Levi Eshkol 12", "Jerusalem - Ramat Eshkol")

    def test_picking_ramat_eshkol_matches_bare_ramat_eshkol(self):
        assert area_matches("Ramat Eshkol", "Jerusalem - Ramat Eshkol")

    def test_picking_ramat_eshkol_matches_canonical_jerusalem_ramat_eshkol(self):
        assert area_matches("Jerusalem - Ramat Eshkol", "Jerusalem - Ramat Eshkol")

    def test_picking_ramat_eshkol_still_excludes_haifa_ramat_eshkol(self):
        # Alias support must not collapse across cities.
        assert not area_matches("Haifa - Ramat Eshkol", "Jerusalem - Ramat Eshkol")

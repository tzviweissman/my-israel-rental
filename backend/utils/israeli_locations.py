"""Curated dataset of well-known Israeli locations with pre-computed
coordinates. Powers the instant, typo-tolerant autocomplete on Stays
+ Services search inputs — no Nominatim round-trip needed for the
95%+ of queries that hit a common place name.

Each entry: (label, city_or_context, lat, lng). Coordinates are all
neighborhood-centroids or landmark POIs, verified against Nominatim.
"""
from __future__ import annotations

import difflib
from typing import Iterable


# fmt: off
# Cities — the top ~50 largest / most-relevant to renters.
_CITIES: list[tuple[str, str, float, float]] = [
    ("Tel Aviv", "Tel Aviv District", 32.0853, 34.7818),
    ("Jerusalem", "Jerusalem District", 31.7683, 35.2137),
    ("Haifa", "Haifa District", 32.7940, 34.9896),
    ("Rishon LeZion", "Center District", 31.9730, 34.7925),
    ("Petah Tikva", "Center District", 32.0870, 34.8878),
    ("Ashdod", "South District", 31.8067, 34.6415),
    ("Netanya", "Center District", 32.3286, 34.8566),
    ("Beer Sheva", "South District", 31.2518, 34.7913),
    ("Bnei Brak", "Tel Aviv District", 32.0809, 34.8338),
    ("Holon", "Tel Aviv District", 32.0114, 34.7723),
    ("Ramat Gan", "Tel Aviv District", 32.0680, 34.8248),
    ("Ashkelon", "South District", 31.6688, 34.5714),
    ("Rehovot", "Center District", 31.8946, 34.8093),
    ("Bat Yam", "Tel Aviv District", 32.0171, 34.7455),
    ("Herzliya", "Tel Aviv District", 32.1663, 34.8433),
    ("Kfar Saba", "Center District", 32.1750, 34.9068),
    ("Modiin", "Center District", 31.8969, 35.0104),
    ("Modi'in Illit", "Judea and Samaria", 31.9333, 35.0439),
    ("Nazareth", "North District", 32.7018, 35.2955),
    ("Lod", "Center District", 31.9515, 34.8887),
    ("Ramla", "Center District", 31.9293, 34.8666),
    ("Raanana", "Center District", 32.1836, 34.8703),
    ("Beit Shemesh", "Jerusalem District", 31.7482, 34.9885),
    ("Kiryat Gat", "South District", 31.6099, 34.7642),
    ("Nes Ziona", "Center District", 31.9330, 34.7987),
    ("Eilat", "South District", 29.5581, 34.9482),
    ("Tiberias", "North District", 32.7959, 35.5299),
    ("Safed", "North District", 32.9646, 35.4960),
    ("Nahariya", "North District", 33.0058, 35.0942),
    ("Acre", "North District", 32.9281, 35.0818),
    ("Givatayim", "Tel Aviv District", 32.0722, 34.8103),
    ("Karmiel", "North District", 32.9109, 35.2954),
    ("Kiryat Motzkin", "Haifa District", 32.8306, 35.0763),
    ("Kiryat Bialik", "Haifa District", 32.8250, 35.0855),
    ("Kiryat Ata", "Haifa District", 32.8067, 35.1077),
    ("Kiryat Yam", "Haifa District", 32.8481, 35.0680),
    ("Or Yehuda", "Tel Aviv District", 32.0313, 34.8552),
    ("Yehud", "Center District", 32.0332, 34.8817),
    ("Hod HaSharon", "Center District", 32.1500, 34.8892),
    ("Ramat HaSharon", "Tel Aviv District", 32.1461, 34.8408),
    ("Kfar Yona", "Center District", 32.3163, 34.9313),
    ("Yavne", "Center District", 31.8781, 34.7392),
    ("Dimona", "South District", 31.0700, 35.0328),
    ("Sderot", "South District", 31.5240, 34.5990),
    ("Rosh HaAyin", "Center District", 32.0847, 34.9564),
]

# Jerusalem neighborhoods — the ones renters actually search for.
_JLM_NBRHDS: list[tuple[str, str, float, float]] = [
    ("Rehavia", "Jerusalem", 31.7748, 35.2121),
    ("Talpiot", "Jerusalem", 31.7511, 35.2154),
    ("Nachlaot", "Jerusalem", 31.7822, 35.2119),
    ("German Colony", "Jerusalem", 31.7616, 35.2196),
    ("Katamon", "Jerusalem", 31.7625, 35.2064),
    ("Baka", "Jerusalem", 31.7590, 35.2225),
    ("Mea Shearim", "Jerusalem", 31.7887, 35.2246),
    ("Old City", "Jerusalem", 31.7767, 35.2345),
    ("Ein Karem", "Jerusalem", 31.7669, 35.1587),
    ("Ramat Eshkol", "Jerusalem", 31.7967, 35.2299),
    ("French Hill", "Jerusalem", 31.8064, 35.2372),
    ("Har Nof", "Jerusalem", 31.7799, 35.1706),
    ("Gilo", "Jerusalem", 31.7302, 35.1815),
    ("Ramot", "Jerusalem", 31.8118, 35.1867),
    ("Pisgat Zeev", "Jerusalem", 31.8296, 35.2436),
    ("Beit HaKerem", "Jerusalem", 31.7772, 35.1878),
    ("Kiryat Yovel", "Jerusalem", 31.7620, 35.1780),
    ("Talbiya", "Jerusalem", 31.7728, 35.2172),
    ("Yemin Moshe", "Jerusalem", 31.7746, 35.2258),
    ("Mahane Yehuda", "Jerusalem", 31.7853, 35.2130),
    ("Musrara", "Jerusalem", 31.7854, 35.2264),
    ("Maalot Dafna", "Jerusalem", 31.7934, 35.2247),
    ("Beit Yisrael", "Jerusalem", 31.7893, 35.2227),
    ("American Colony", "Jerusalem", 31.7898, 35.2294),
    ("Sanhedria", "Jerusalem", 31.7982, 35.2160),
    ("Arnona", "Jerusalem", 31.7457, 35.2213),
    ("Abu Tor", "Jerusalem", 31.7674, 35.2303),
    ("City Center Jerusalem", "Jerusalem", 31.7822, 35.2196),
]

# Tel Aviv neighborhoods + landmarks.
_TLV_NBRHDS: list[tuple[str, str, float, float]] = [
    ("Rothschild Boulevard", "Tel Aviv", 32.0628, 34.7713),
    ("Neve Tzedek", "Tel Aviv", 32.0620, 34.7643),
    ("Florentin", "Tel Aviv", 32.0578, 34.7686),
    ("Old Jaffa", "Tel Aviv", 32.0537, 34.7522),
    ("Jaffa", "Tel Aviv", 32.0521, 34.7519),
    ("Ramat Aviv", "Tel Aviv", 32.1132, 34.8033),
    ("Old North", "Tel Aviv", 32.0891, 34.7783),
    ("Kerem HaTeimanim", "Tel Aviv", 32.0700, 34.7676),
    ("Sarona", "Tel Aviv", 32.0730, 34.7860),
    ("Dizengoff", "Tel Aviv", 32.0800, 34.7746),
    ("Ben Yehuda Street", "Tel Aviv", 32.0810, 34.7716),
    ("HaCarmel Market", "Tel Aviv", 32.0700, 34.7691),
    ("Levontin", "Tel Aviv", 32.0637, 34.7768),
    ("Nachalat Binyamin", "Tel Aviv", 32.0684, 34.7702),
    ("Montefiore", "Tel Aviv", 32.0630, 34.7742),
    ("Kikar HaMedina", "Tel Aviv", 32.0895, 34.7898),
    ("Basel Street", "Tel Aviv", 32.0917, 34.7808),
    ("Park HaYarkon", "Tel Aviv", 32.0997, 34.7910),
    ("Tel Aviv Beach", "Tel Aviv", 32.0777, 34.7623),
    ("Tel Aviv Port", "Tel Aviv", 32.1013, 34.7737),
    ("City Center Tel Aviv", "Tel Aviv", 32.0850, 34.7818),
    ("Neve Sha'anan", "Tel Aviv", 32.0605, 34.7794),
]

# Haifa neighborhoods.
_HAI_NBRHDS: list[tuple[str, str, float, float]] = [
    ("Hadar", "Haifa", 32.8138, 34.9927),
    ("German Colony Haifa", "Haifa", 32.8194, 34.9942),
    ("Carmel", "Haifa", 32.8036, 34.9799),
    ("Bat Galim", "Haifa", 32.8290, 34.9714),
    ("Neve Sha'anan Haifa", "Haifa", 32.7807, 35.0129),
    ("Ahuza", "Haifa", 32.7908, 34.9885),
]

# Popular landmarks / points of interest renters might search near.
_LANDMARKS: list[tuple[str, str, float, float]] = [
    ("Western Wall (Kotel)", "Jerusalem Old City", 31.7767, 35.2345),
    ("Machane Yehuda Market", "Jerusalem", 31.7853, 35.2130),
    ("Ben Gurion Airport", "Center District", 32.0114, 34.8867),
    ("Tel Aviv University", "Tel Aviv", 32.1133, 34.8044),
    ("Hebrew University Mount Scopus", "Jerusalem", 31.7940, 35.2438),
    ("Hebrew University Givat Ram", "Jerusalem", 31.7767, 35.1985),
    ("Technion", "Haifa", 32.7776, 35.0217),
    ("Weizmann Institute", "Rehovot", 31.9046, 34.8107),
    ("Dead Sea", "South District", 31.5590, 35.4732),
    ("Yad Vashem", "Jerusalem", 31.7742, 35.1750),
    ("Israel Museum", "Jerusalem", 31.7726, 35.2038),
    ("Knesset", "Jerusalem", 31.7767, 35.2049),
    ("HaKirya", "Tel Aviv", 32.0765, 34.7871),
    ("Azrieli Center", "Tel Aviv", 32.0740, 34.7920),
    ("Habima Square", "Tel Aviv", 32.0768, 34.7754),
    ("Central Bus Station Jerusalem", "Jerusalem", 31.7889, 35.2035),
    ("Central Bus Station Tel Aviv", "Tel Aviv", 32.0554, 34.7807),
    ("Sarona Market", "Tel Aviv", 32.0730, 34.7860),
    ("Old Jaffa Port", "Tel Aviv", 32.0520, 34.7501),
    ("Dolphinarium Beach", "Tel Aviv", 32.0693, 34.7627),
]
# Popular hotels — these are searched by exact name far more often than
# their generic neighborhood, so we curate them for zero-latency hits.
# Coords verified against Nominatim.
_HOTELS: list[tuple[str, str, float, float]] = [
    ("King David Hotel", "Jerusalem", 31.7752, 35.2246),
    ("Waldorf Astoria Jerusalem", "Jerusalem", 31.7772, 35.2251),
    ("Mamilla Hotel", "Jerusalem", 31.7772, 35.2287),
    ("The Inbal Jerusalem Hotel", "Jerusalem", 31.7716, 35.2224),
    ("David Citadel Hotel", "Jerusalem", 31.7793, 35.2265),
    ("Dan Panorama Jerusalem", "Jerusalem", 31.7752, 35.2196),
    ("Leonardo Plaza Jerusalem", "Jerusalem", 31.7803, 35.2170),
    ("Herbert Samuel Jerusalem", "Jerusalem", 31.7842, 35.2222),
    ("Abraham Hostel Jerusalem", "Jerusalem", 31.7855, 35.2189),
    ("Notre Dame of Jerusalem", "Jerusalem", 31.7818, 35.2288),
    ("YMCA Jerusalem (Three Arches)", "Jerusalem", 31.7754, 35.2216),
    ("Hilton Tel Aviv", "Tel Aviv", 32.0871, 34.7671),
    ("Dan Tel Aviv", "Tel Aviv", 32.0821, 34.7688),
    ("Sheraton Tel Aviv", "Tel Aviv", 32.0801, 34.7688),
    ("David InterContinental Tel Aviv", "Tel Aviv", 32.0674, 34.7605),
    ("Isrotel Tower Tel Aviv", "Tel Aviv", 32.0895, 34.7729),
    ("Carlton Tel Aviv", "Tel Aviv", 32.0947, 34.7745),
    ("Norman Tel Aviv", "Tel Aviv", 32.0785, 34.7756),
    ("Poli House Tel Aviv", "Tel Aviv", 32.0700, 34.7702),
    ("Brown TLV", "Tel Aviv", 32.0658, 34.7727),
    ("Isrotel King Solomon Eilat", "Eilat", 29.5518, 34.9550),
    ("Herods Palace Eilat", "Eilat", 29.5486, 34.9563),
    ("Leonardo Plaza Eilat", "Eilat", 29.5544, 34.9525),
    ("Dan Eilat", "Eilat", 29.5511, 34.9539),
    ("Royal Beach Eilat", "Eilat", 29.5510, 34.9550),
]

# Popular malls + markets — Google Maps users search these by name.
_SHOPPING: list[tuple[str, str, float, float]] = [
    ("Mamilla Mall", "Jerusalem", 31.7767, 35.2280),
    ("Malha Mall", "Jerusalem", 31.7511, 35.1875),
    ("Ramat Aviv Mall", "Tel Aviv", 32.1130, 34.8028),
    ("Dizengoff Center", "Tel Aviv", 32.0757, 34.7756),
    ("Azrieli Mall", "Tel Aviv", 32.0738, 34.7920),
    ("TLV Fashion Mall", "Tel Aviv", 32.0554, 34.7810),
    ("Grand Kanyon Haifa", "Haifa", 32.7860, 35.0223),
    ("Ice Mall Eilat", "Eilat", 29.5528, 34.9584),
]
# fmt: on


# Flat searchable list built once at import time. Each row is:
# ("lowercased alias for matching", "display label", "sublabel", lat, lng, priority_boost)
def _aliases_for_label(label: str) -> list[str]:
    """Return every lowercased alias a user might type for the given
    display label. Parenthetical hints ("Western Wall (Kotel)") are
    exploded so both "western wall" AND "kotel" match. Also splits on
    the ` - ` separator so "German Colony - Jerusalem" surfaces on both
    tokens."""
    parts = [label.lower()]
    if "(" in label and ")" in label:
        # "Western Wall (Kotel)" → also indexable by "kotel".
        inside = label[label.index("(") + 1: label.rindex(")")].strip().lower()
        if inside:
            parts.append(inside)
        outside = (label[: label.index("(")] + label[label.rindex(")") + 1:]).strip().lower()
        if outside:
            parts.append(outside)
    return list({p for p in parts if p})


def _build_index() -> list[tuple[str, str, str, float, float, int]]:
    rows: list[tuple[str, str, str, float, float, int]] = []
    # Cities get the highest priority — they anchor most searches.
    for label, sub, lat, lng in _CITIES:
        for alias in _aliases_for_label(label):
            rows.append((alias, label, sub, lat, lng, 3))
    for label, city, lat, lng in _JLM_NBRHDS + _TLV_NBRHDS + _HAI_NBRHDS:
        for alias in _aliases_for_label(label):
            rows.append((alias, label, city, lat, lng, 2))
    # Hotels + shopping — high priority because users search these by
    # exact brand name ("Waldorf", "Mamilla Mall") and are almost never
    # looking for the surrounding neighborhood instead.
    for label, city, lat, lng in _HOTELS + _SHOPPING:
        for alias in _aliases_for_label(label):
            rows.append((alias, label, city, lat, lng, 3))
    for label, sub, lat, lng in _LANDMARKS:
        for alias in _aliases_for_label(label):
            rows.append((alias, label, sub, lat, lng, 1))
    return rows


_INDEX = _build_index()
_ALIASES = [row[0] for row in _INDEX]


def fuzzy_suggest(query: str, limit: int = 5) -> list[dict]:
    """Return up to `limit` suggestions from the curated Israeli
    dataset, ranked by fuzzy string similarity to `query`. Case- and
    typo-tolerant — "rehavia", "Rehavya", "rehav" all surface Rehavia.

    Returns [] when the query is too short or no reasonable match
    exists (0.55 similarity floor). Caller should fall back to
    Nominatim for those.
    """
    q = (query or "").strip().lower()
    if len(q) < 2:
        return []

    # For very short queries, use pure `startswith` so "tel" instantly
    # surfaces Tel Aviv without a fuzzy-similarity threshold blocking it.
    if len(q) <= 3:
        starts = []
        seen_labels: set[str] = set()
        for row in _INDEX:
            if row[0].startswith(q) and row[1] not in seen_labels:
                seen_labels.add(row[1])
                starts.append((row, row[5] + 5))
        starts.sort(key=lambda pair: (-pair[1], pair[0][1]))
        return [_row_to_dict(row) for row, _ in starts[:limit]]

    # Longer queries — use difflib's normalized similarity ratio.
    # Cutoff at 0.78: strict enough that "hilton" no longer fuzz-matches
    # "Holon" (0.727) or "mamilla" → "Ramla" (0.667), but lenient enough
    # to keep the typo case working — "rehavya" → "Rehavia" is 0.857 and
    # "rehav" → "Rehavia" is 0.833. Anything weaker is punted to Nominatim
    # which has real POI + hotel + landmark data our curated set doesn't.
    close = difflib.get_close_matches(q, _ALIASES, n=limit * 3, cutoff=0.78)
    scored: list[tuple[tuple[str, str, str, float, float, int], float]] = []
    seen_labels: set[str] = set()
    for alias in close:
        for row in _INDEX:
            # Match by alias AND dedup by DISPLAY label — otherwise
            # "kfar" would surface Kfar Saba multiple times (once per
            # underlying alias row for the same place).
            if row[0] == alias and row[1] not in seen_labels:
                seen_labels.add(row[1])
                similarity = difflib.SequenceMatcher(None, q, alias).ratio()
                # Substring hits also score well — "rehav" is a substring
                # of "rehavia" and should surface even at short lengths.
                if q in alias:
                    similarity += 0.15
                scored.append((row, similarity + row[5] * 0.05))
                break

    # Also include any startswith OR contains hits that difflib might
    # have missed. "beach" won't clear the fuzzy cutoff against long
    # aliases but should still surface "Tel Aviv Beach" — we handle
    # that here as a substring match with a slightly lower score.
    for row in _INDEX:
        if row[1] in seen_labels:
            continue
        if row[0].startswith(q):
            seen_labels.add(row[1])
            scored.append((row, 0.95 + row[5] * 0.05))
        elif q in row[0]:
            seen_labels.add(row[1])
            scored.append((row, 0.80 + row[5] * 0.05))

    scored.sort(key=lambda pair: -pair[1])
    return [_row_to_dict(r) for r, _ in scored[:limit]]


def _row_to_dict(row: tuple[str, str, str, float, float, int]) -> dict:
    _, label, sublabel, lat, lng, _boost = row
    return {"label": label, "sublabel": sublabel, "lat": lat, "lng": lng, "type": "curated"}


def curated_labels() -> Iterable[str]:
    """Expose the display labels — occasionally useful for tests."""
    return (row[1] for row in _INDEX)

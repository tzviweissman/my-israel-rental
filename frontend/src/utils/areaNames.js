/**
 * areaNames — presentation layer for the free-text `property.area` field.
 *
 * Two problems this solves, both DISPLAY-ONLY (the stored value is never
 * rewritten, and the backend's regex matching in
 * `backend/utils/area_filter.py` is untouched):
 *
 *   1. **Language.** `area` comes from the database, not from the i18n
 *      catalogue, so the Hebrew UI used to render "נכסים ב City Center".
 *      `areaLabel(stored, t)` returns a canonical Hebrew label in Hebrew
 *      mode and a canonical English label in English mode.
 *   2. **Spelling drift.** The same neighbourhood is stored under several
 *      spellings ("Ramat Eshkol" / "Ramat Eshkol, Jerusalem" /
 *      "Jerusalem - Ramat Eshkol", plus outright typos like
 *      "Sanhedria Murhevet"). `canonicalArea(stored)` folds those onto one
 *      key so the browse-by-area UI can group them under one heading
 *      instead of showing the same place three times.
 *
 * Matching rules — deliberately strict:
 *   * Normalisation only lower-cases, collapses internal whitespace, and
 *     trims (same spirit as the `.trim().toLowerCase()` lookups in
 *     utils/servicesGeo.js). Nothing is stemmed or truncated.
 *   * Lookup is **exact after normalisation, never substring**. A substring
 *     match would merge "Sanhedria" into "Sanhedria Murchevet" — two
 *     genuinely different neighbourhoods ("Murchevet" = the 1970 northern
 *     *expansion*, a separate place). Same reason the backend anchors its
 *     regex.
 *   * Unknown values fall through **unchanged**. Hosts type their own area
 *     free-form, so a brand-new neighbourhood must keep rendering rather
 *     than disappearing. This fallback is load-bearing — do not "fix" it
 *     into an empty string or a placeholder.
 *
 * Three entries are STREETS, not neighbourhoods ("Machal", "Levi Eshkol",
 * "Mishmar HaGvul" — all inside Ramat Eshkol). They keep their own canonical
 * key, labelled "<Street>, <Neighbourhood>": the lister typed a street on
 * purpose, so folding them into plain "Ramat Eshkol" would throw away
 * precision they intended, and a Ramat Eshkol filter must not silently
 * swallow them. The label still tells a renter where the street is.
 *
 * Adding a neighbourhood: add a row to AREA_CANONICALS (canonical label +
 * the stored spellings that fold onto it) and the matching `areas.<key>`
 * entry to BOTH src/locales/en.js and src/locales/he.js. A missing Hebrew
 * key silently renders English forever.
 */

import { LOCATION_OPTIONS } from '../constants/locations';

/**
 * `[canonicalLabel, storedVariants]` — the canonical label is a *display*
 * string (and, slugged, the i18n key; see `i18nKeyFor`). `storedVariants`
 * are the values that actually exist in the `area` field, most common
 * first: `storedVariants[0]` is what the UI hands to any filter, so it is
 * always a real stored value the backend regex can match. The canonical
 * label itself is also accepted as an input to `canonicalArea` so round
 * trips through a group key work.
 */
export const AREA_CANONICALS = [
  ['Ramat Eshkol', ['Ramat Eshkol', 'Ramat Eshkol, Jerusalem', 'Jerusalem - Ramat Eshkol']],
  ['Geula', ['Geula', 'Jerusalem - Geula']],
  ['Nachlaot', ['Nachlaot', 'Jerusalem - Nachlaot']],
  ['Old City', ['Old City']],
  ['City Center', ['City Center', 'Yaffo Street / City Center, Jerusalem']],
  ['Romema', ['Romema']],
  // Street inside Ramat Eshkol — its central block. Own key on purpose.
  ['Machal St, Ramat Eshkol', ['Machal', 'Machal, Jerusalem']],
  ['Rehavia', ['Rehavia', 'Jerusalem - Rehavia']],
  ['Shaarei Chessed', ['Shaarei Chessed', 'Jerusalem - Shaare Hesed']],
  ['Givat Hamivtar', ['Givat Hamivtar', 'Givat Hamivtar, Jerusalem']],
  // Kept as its own entry rather than folded into either half — the listing
  // is genuinely advertised as being on the boundary.
  ['Givat Hamivtar / Ramat Eshkol', ['Givat Hamivtar / Ramat Eshkol']],
  ['Sanhedria Murchevet', ['Sanhedria Murchevet', 'Sanhedria Murhevet']],
  ['Sanhedria', ['Sanhedria', 'Sanhedria, Jerusalem']],
  ['French Hill', ['French Hill', 'French Hill, Jerusalem']],
  ['Mekor Baruch', ['Mekor Baruch', 'Jerusalem - Mekor Baruch']],
  ['Maalot Dafna', ['Maalot Dafna', 'Jerusalem - Maalot Dafna', 'Maalot Dafna, Jerusalem']],
  ['Baka', ['Baka']],
  ['Arzei Habira', ['Arzei Habira', 'Arzei HaBirah', 'Arzei HaBirah, Jerusalem', 'Jerusalem - Arzei HaBira']],
  // Sderot Eshkol — the boulevard named for PM Levi Eshkol, in Ramat Eshkol.
  ['Eshkol Blvd, Ramat Eshkol', ['Levi Eshkol']],
  ['Ramat Shlomo', ['Ramat Shlomo', 'Ramat Shlomo, Jerusalem']],
  // Real west-Jerusalem neighbourhood. Missed on the first pass because the
  // area census was accidentally truncated before this row.
  ['Givat Shaul', ['Givat Shaul', 'Jerusalem - Givat Shaul']],
  ['Talbiya', ['Talbiya']],
  ['Har Nof', ['Har Nof']],
  ['Gush 80', ['Gush 80']],
  ['Belz', ['Belz']],
  // Street running north-south off Eshkol Blvd, inside Ramat Eshkol.
  ['Mishmar HaGvul St, Ramat Eshkol', ['Mishmar HaGvul']],
  ['German Colony', ['German Colony']],
  ['Mamilla', ['Mamilla']],
  // "Mekor Chaim" is the catalogue (and dropdown) spelling; "Mekor Haim" is
  // the spelling that drifted into the DB. Both fold here.
  ['Mekor Haim', ['Mekor Haim', 'Mekor Chaim']],
];

/**
 * Lower-cased city name → the catalogue's spelling of it. Used only to
 * recognise the `"<City> - X"` / `"X, <City>"` wrappers below (and to echo a
 * matched city back in catalogue casing) — never to invent a city.
 */
const CITY_BY_KEY = new Map(
  LOCATION_OPTIONS.map((g) => [g.city.trim().toLowerCase(), g.city]),
);

/**
 * Fold a stored area string into its lookup form: trimmed, lower-cased,
 * internal whitespace collapsed. Does NOT strip punctuation — "Givat
 * Hamivtar / Ramat Eshkol" must stay distinguishable from "Givat Hamivtar".
 */
const normalize = (value) =>
  (value == null ? '' : String(value)).trim().replace(/\s+/g, ' ').toLowerCase();

// normalised stored variant (and normalised canonical label) → canonical label
const VARIANT_TO_CANONICAL = new Map();
// canonical label → the stored variant to use as a filter value
const CANONICAL_TO_PRIMARY_STORED = new Map();
AREA_CANONICALS.forEach(([canonical, variants]) => {
  VARIANT_TO_CANONICAL.set(normalize(canonical), canonical);
  variants.forEach((v) => VARIANT_TO_CANONICAL.set(normalize(v), canonical));
  CANONICAL_TO_PRIMARY_STORED.set(canonical, variants[0] || canonical);
});

/**
 * i18n key suffix for a canonical label. Slugged to a plain identifier:
 * 'Ramat Eshkol' → 'ramatEshkol', 'Gush 80' → 'gush80',
 * 'Machal St, Ramat Eshkol' → 'machalStRamatEshkol'.
 */
export const i18nKeyFor = (canonical) => {
  const words = String(canonical).replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ');
  return words
    .map((w, i) => (i === 0
      ? w.charAt(0).toLowerCase() + w.slice(1)
      : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
};

/**
 * Split the three shapes the data actually uses into `{ city, bare }`:
 *
 *   'Jerusalem - Ramat Eshkol' → { city: 'Jerusalem', bare: 'Ramat Eshkol' }
 *   'Ramat Eshkol, Jerusalem'  → { city: 'Jerusalem', bare: 'Ramat Eshkol' }
 *   'Ramat Eshkol'             → { city: null,        bare: 'Ramat Eshkol' }
 *
 * A prefix/suffix only counts as a city when it IS a catalogue city. That
 * rule is what keeps this safe: it can't mangle `'Machal St, Ramat Eshkol'`
 * (a display label that happens to contain a comma) or a neighbourhood whose
 * own name contains a dash.
 */
const splitCity = (raw) => {
  const dash = raw.indexOf(' - ');
  if (dash > 0) {
    const city = CITY_BY_KEY.get(raw.slice(0, dash).trim().toLowerCase());
    const rest = raw.slice(dash + 3).trim();
    if (rest && city) return { city, bare: rest };
  }
  const comma = raw.lastIndexOf(',');
  if (comma > 0) {
    const head = raw.slice(0, comma).trim();
    const city = CITY_BY_KEY.get(raw.slice(comma + 1).trim().toLowerCase());
    if (head && city) return { city, bare: head };
  }
  return { city: null, bare: raw };
};

/**
 * Canonical label for a stored area value, or `null` when the value isn't in
 * the table (unknown / brand-new neighbourhood, or a city name). Callers
 * that group by area should treat `null` as "group under itself".
 *
 * Lookup is exact-after-normalisation, tried twice: once on the value as
 * stored, and — only if that misses — once with a known city wrapper
 * stripped. The second pass is what keeps display working now that the
 * backend canonicalises new writes to `"<City> - <Neighbourhood>"`
 * (backend/utils/area_normalize.py): without it, a freshly-created
 * "Jerusalem - French Hill" would fall through to raw English while the
 * legacy bare "French Hill" rows kept their Hebrew label. Still never a
 * substring match — "Sanhedria" and "Sanhedria Murchevet" stay distinct.
 */
export const canonicalArea = (stored) => {
  const key = normalize(stored);
  if (!key) return null;
  const direct = VARIANT_TO_CANONICAL.get(key);
  if (direct) return direct;

  const { city, bare } = splitCity((stored == null ? '' : String(stored)).trim());
  if (!city) return null;
  return VARIANT_TO_CANONICAL.get(normalize(bare)) || null;
};

/**
 * Localised label for a stored area value.
 *
 * Known values resolve through `t('areas.<key>', '<canonical English>')`, so
 * Hebrew mode gets Hebrew and English mode gets the canonical English
 * label (variants are normalised away in both languages). Unknown values
 * are returned **exactly as stored**.
 */
/**
 * Sentinel the browse-by-area grouping uses for listings with a blank
 * `area` (8 in production). Kept as a fixed English string rather than a
 * localised one because it doubles as a Map key and is compared against —
 * a language-dependent key would regroup rows on every language switch.
 * Translated here at render time instead.
 */
export const UNGROUPED_AREA = 'Other';

export const areaLabel = (stored, t) => {
  const raw = stored == null ? '' : String(stored);
  if (raw === UNGROUPED_AREA) {
    return typeof t === 'function' ? t('areas.other', UNGROUPED_AREA) : raw;
  }
  const canonical = canonicalArea(raw);
  if (!canonical) return raw;
  if (typeof t !== 'function') return canonical;
  return t(`areas.${i18nKeyFor(canonical)}`, canonical);
};

/**
 * The stored spelling that represents a canonical area — i.e. what to send
 * to a filter. Deliberately a real DB value (never the canonical label,
 * which for the three street entries is a display-only string the backend
 * regex would not match) so grouping in the UI can't break filtering.
 */
export const primaryStoredArea = (canonical) =>
  CANONICAL_TO_PRIMARY_STORED.get(canonical) || canonical;

// ---------------------------------------------------------------------------
// storedArea — the canonical value to WRITE (as opposed to the label to show)
// ---------------------------------------------------------------------------
// Mirrors `backend/utils/area_normalize.normalize_area`. The backend is
// authoritative — every write is canonicalised there regardless of what the
// client sends. This exists so the bulk-import editor SHOWS the user the value
// that will actually be saved, instead of silently rewriting it on submit.
//
// Deliberately built from the two tables that already exist — AREA_CANONICALS
// (which spellings drifted into the DB) and LOCATION_OPTIONS (how the
// catalogue spells each neighbourhood) — rather than a third variant table
// that would have to be kept in sync with both.

// folded neighbourhood → { cities: [...], spelling } from the catalogue.
const CATALOG_NEIGHBORHOODS = new Map();
LOCATION_OPTIONS.forEach((group) => {
  group.neighborhoods.forEach((n) => {
    const key = normalize(n);
    const entry = CATALOG_NEIGHBORHOODS.get(key);
    if (entry) entry.cities.push(group.city);
    else CATALOG_NEIGHBORHOODS.set(key, { cities: [group.city], spelling: n });
  });
});

// Bare neighbourhood names shared by several cities that we still resolve,
// because production data says which city is meant. Must stay in lockstep
// with `_AMBIGUOUS_DEFAULT_CITY` in backend/utils/area_normalize.py — see the
// rationale there. Everything else ambiguous is left alone rather than guessed.
const AMBIGUOUS_DEFAULT_CITY = new Map([['ramat eshkol', 'Jerusalem']]);

/**
 * Resolve any spelling to its catalogue entry, going through AREA_CANONICALS
 * when the raw spelling isn't in the catalogue: the drift table tells us which
 * variants are the same place, the catalogue tells us how to spell it.
 */
const catalogEntryFor = (bare) => {
  const direct = CATALOG_NEIGHBORHOODS.get(normalize(bare));
  if (direct) return direct;

  const canonical = canonicalArea(bare);
  if (!canonical) return null;
  // The canonical label itself, then every stored variant of that cluster —
  // one of them is usually the catalogue spelling (e.g. the cluster labelled
  // 'Shaarei Chessed' reaches the catalogue via 'Jerusalem - Shaare Hesed').
  const candidates = [canonical, ...(AREA_CANONICALS.find(([c]) => c === canonical)?.[1] || [])];
  for (const candidate of candidates) {
    const hit = CATALOG_NEIGHBORHOODS.get(normalize(splitCity(candidate).bare));
    if (hit) return hit;
  }
  return null;
};

/**
 * The canonical value to STORE for a user-supplied area:
 * `"<City> - <Neighbourhood>"` when we recognise it, otherwise the input
 * **unchanged** (never blanked — hosts may list somewhere genuinely new).
 *
 *   storedArea('Ramat Eshkol, Jerusalem')  → 'Jerusalem - Ramat Eshkol'
 *   storedArea('Sanhedria Murhevet')       → 'Jerusalem - Sanhedria Murhevet'
 *   storedArea('Gush 80')                  → 'Gush 80'
 */
export const storedArea = (value) => {
  if (value == null) return value;
  const cleaned = String(value).trim().replace(/\s+/g, ' ');
  if (!cleaned) return value;

  const { city, bare } = splitCity(cleaned);
  const entry = catalogEntryFor(bare);
  if (!entry) return value;

  if (city) {
    // Trust the stated city, but only if the catalogue agrees it has this
    // neighbourhood — otherwise we'd invent "Haifa - Rehavia".
    return entry.cities.includes(city) ? `${city} - ${entry.spelling}` : value;
  }
  if (entry.cities.length === 1) return `${entry.cities[0]} - ${entry.spelling}`;

  const fallback = AMBIGUOUS_DEFAULT_CITY.get(normalize(entry.spelling));
  if (fallback && entry.cities.includes(fallback)) return `${fallback} - ${entry.spelling}`;

  return value;
};

/**
 * Group/filter key for browse lists. Every stored spelling of one area maps
 * to the same key, and that key is itself a stored value — so a UI that
 * collapses three "Ramat Eshkol" spellings into one row can pass the key
 * straight to an area filter (client-side or backend) and still match.
 * Unmapped areas group under their own trimmed value.
 */
export const areaGroupKey = (stored) => {
  const raw = (stored == null ? '' : String(stored)).trim();
  const canonical = canonicalArea(raw);
  return canonical ? primaryStoredArea(canonical) : raw;
};

/**
 * Do two stored values refer to the same area? Canonical-aware, with a
 * normalised exact-string fallback for values outside the table. Used by the
 * client-side area filters so a heading that collapsed three spellings still
 * selects all three listings.
 */
export const sameArea = (a, b) => {
  const ca = canonicalArea(a);
  const cb = canonicalArea(b);
  if (ca && cb) return ca === cb;
  return normalize(a) === normalize(b) && normalize(a) !== '';
};


/**
 * Display name for an area that may be a marketplace SLUG.
 *
 * The two halves of the site speak different vocabularies. Properties
 * store free text ("Tel Aviv", "Jerusalem - Rehavia") which `areaLabel`
 * canonicalises. The services marketplace stores a slug ("tel-aviv"),
 * which `areaLabel` cannot match — so it fell through and printed
 * "· tel-aviv" on the public business page and on every service card:
 * lower-case, hyphen and all, on pages meant to look considered.
 *
 * Title-casing the slug reproduces the marketplace catalogue's own label
 * exactly (`LOCATIONS` in routes/marketplace/shared.py — "tel-aviv" →
 * "Tel Aviv", "bet-shemesh" → "Bet Shemesh") without a network call, so
 * a card in a list does not need to fetch a catalogue to name a city.
 *
 * Known limit, pre-existing and not introduced here: that catalogue has
 * no Hebrew labels, so a Hebrew page shows the English city name either
 * way. Giving it Hebrew is a backend change, not a formatting one.
 */
export const prettyArea = (stored, t) => {
  const raw = stored == null ? '' : String(stored).trim();
  if (!raw) return '';
  // Slug-shaped: lower-case words joined by hyphens, no spaces.
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(raw)) {
    return raw
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return areaLabel(raw, t);
};

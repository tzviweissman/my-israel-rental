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
  ['Mekor Haim', ['Mekor Haim']],
];

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
 * Canonical label for a stored area value, or `null` when the value isn't in
 * the table (unknown / brand-new neighbourhood, or a city name). Callers
 * that group by area should treat `null` as "group under itself".
 */
export const canonicalArea = (stored) => {
  const key = normalize(stored);
  if (!key) return null;
  return VARIANT_TO_CANONICAL.get(key) || null;
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

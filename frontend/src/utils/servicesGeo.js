/**
 * Frontend mirror of the backend LOCATIONS lookup — used by the Services
 * map view to plot gigs whose `area` is a free-text city name (e.g.
 * "Tel Aviv, Florentin") without a round-trip.
 *
 * Kept in sync with /app/backend/routes/marketplace.py::LOCATIONS —
 * update both when adding new cities. Coordinates are city centers,
 * approximated to 3 decimals (~100 m) which is far more precision than
 * a "closest city" pin cluster needs.
 */
export const CITY_COORDS = {
  jerusalem:  { label: 'Jerusalem',     lat: 31.784, lng: 35.217 },
  telAviv:    { label: 'Tel Aviv',      lat: 32.084, lng: 34.782 },
  betShemesh: { label: 'Bet Shemesh',   lat: 31.744, lng: 34.986 },
  modiin:     { label: 'Modiin',        lat: 31.899, lng: 35.010 },
  netanya:    { label: 'Netanya',       lat: 32.328, lng: 34.856 },
  haifa:      { label: 'Haifa',         lat: 32.794, lng: 34.989 },
  ashdod:     { label: 'Ashdod',        lat: 31.802, lng: 34.643 },
  beersheba:  { label: 'Beersheba',     lat: 31.252, lng: 34.791 },
  herzliya:   { label: 'Herzliya',      lat: 32.166, lng: 34.844 },
  raanana:    { label: "Ra'anana",      lat: 32.185, lng: 34.870 },
  rishon:     { label: 'Rishon LeZion', lat: 31.973, lng: 34.789 },
  petahTikva: { label: 'Petah Tikva',   lat: 32.088, lng: 34.886 },
};

const _BY_LABEL = new Map(
  Object.values(CITY_COORDS).map((c) => [c.label.toLowerCase(), c]),
);

// Every way an owner writes a city: English spellings, abbreviations and
// Hebrew. Searched anywhere in the area text, so "RBS, jerusalem" and
// "Jerusalem & surrounding areas" find their city (20 Oct 2026: six
// businesses were missing from the map because only the text before the
// first comma was looked up, and only by its exact English label).
const _ALIASES = [
  ['jerusalem', ['jerusalem', 'yerushalayim', 'jlm', 'ירושלים']],
  ['betShemesh', ['ramat beit shemesh', 'ramat bet shemesh', 'rbs', 'beit shemesh', 'bet shemesh', 'beth shemesh', 'בית שמש']],
  ['telAviv', ['tel aviv', 'tel-aviv', 'jaffa', 'yafo', 'תל אביב']],
  ['modiin', ["modi'in", 'modiin', 'מודיעין']],
  ['netanya', ['netanya', 'natanya', 'נתניה']],
  ['haifa', ['haifa', 'חיפה']],
  ['ashdod', ['ashdod', 'אשדוד']],
  ['beersheba', ['beersheba', 'beer sheva', "be'er sheva", 'באר שבע']],
  ['herzliya', ['herzliya', 'herzlia', 'הרצליה']],
  ['raanana', ["ra'anana", 'raanana', 'רעננה']],
  ['rishon', ['rishon lezion', 'rishon le zion', 'rishon', 'ראשון לציון']],
  ['petahTikva', ['petah tikva', 'petach tikva', 'petah tikvah', 'פתח תקווה', 'פתח תקוה']],
];
const _wordAt = (text, word) => {
  // ASCII words must stand alone ("rbs" not inside "herbs"); Hebrew as is.
  if (!/^[a-z' -]+$/.test(word)) return text.indexOf(word);
  const m = new RegExp(`(^|[^a-z])${word.replace(/[-']/g, (c) => `\\${c}`)}($|[^a-z])`).exec(text);
  return m ? m.index + m[1].length : -1;
};
/** The city an area text names first, or null. */
export const cityFromText = (text) => {
  const t = String(text || '').toLowerCase();
  let best = null;
  for (const [key, words] of _ALIASES) {
    for (const w of words) {
      const at = _wordAt(t, w);
      if (at >= 0 && (!best || at < best.at)) best = { at, key };
    }
  }
  return best ? CITY_COORDS[best.key] : null;
};

/**
 * Best-effort lat/lng for a gig. Prefers an explicit `lat`/`lng` on the
 * gig doc (future-proof for providers who set precise coords), then
 * splits the free-text `area` on the first comma and looks the head up
 * in the city table. Returns `null` when nothing resolves — the caller
 * must handle that case (typically: hide the pin, keep in list view).
 */
export const resolveGigCoords = (gig) => {
  if (!gig) return null;
  if (typeof gig.lat === 'number' && typeof gig.lng === 'number') {
    return [gig.lat, gig.lng];
  }
  const area = (gig.area || '').trim();
  if (!area) return null;
  const head = area.split(',', 1)[0].trim().toLowerCase();
  const hit = _BY_LABEL.get(head) || cityFromText(area);
  return hit ? [hit.lat, hit.lng] : null;
};

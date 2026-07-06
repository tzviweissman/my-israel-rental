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
  const hit = _BY_LABEL.get(head);
  return hit ? [hit.lat, hit.lng] : null;
};

/**
 * What this person searched for before — nothing else.
 *
 * A blank search screen is a dead end for anyone who does not already know
 * exactly what they want, and the usual fix is to fill it with "popular"
 * suggestions that are really just whatever we would like people to click.
 * The rule here is that every suggestion has to be true: these are the
 * user's OWN previous searches, recorded when they actually searched, and
 * nothing is invented to pad the list out. An empty history renders
 * nothing rather than an example.
 *
 * Local to the device on purpose. Sending someone's search history to the
 * server to power a hint is a much bigger promise than the feature is
 * worth, and localStorage survives exactly as long as it should.
 *
 * Scoped per surface (`stays`, `services`, `requests`): the areas someone
 * looks for a flat in are not the trades they hire, and mixing them makes
 * both lists worse.
 */

const KEY = (scope) => `mir:recent:${scope}`;

// Enough to be useful, short enough to stay scannable. Past about five the
// list stops being "where you were" and becomes another thing to read.
const MAX = 5;

/** Everything stored for `scope`, newest first. Never throws. */
export function getRecentSearches(scope) {
  try {
    const raw = window.localStorage.getItem(KEY(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: an older build, a hand-edited value, or a half-written
    // entry should degrade to "no history", never to a crash inside a
    // search box.
    return parsed
      .filter((e) => e && typeof e.value === 'string' && e.value.trim())
      .slice(0, MAX);
  } catch {
    // Private mode, storage disabled, quota — all mean the same thing here.
    return [];
  }
}

/**
 * Record one search. Call it when the user COMMITS to a search — picks an
 * area, submits a query — not on every keystroke, or the list fills with
 * the prefixes of one word.
 *
 * `label` is what to show; `value` is what to re-run. They differ under
 * Hebrew, where the stored area stays canonical English.
 */
export function recordSearch(scope, value, label = null) {
  const clean = String(value ?? '').trim();
  if (!clean) return;
  try {
    const existing = getRecentSearches(scope);
    // Case-insensitive de-dupe, and the repeat moves to the front rather
    // than adding a second row — searching Jerusalem twice is one memory.
    const rest = existing.filter(
      (e) => e.value.toLowerCase() !== clean.toLowerCase(),
    );
    const next = [{ value: clean, label: label || clean }, ...rest].slice(0, MAX);
    window.localStorage.setItem(KEY(scope), JSON.stringify(next));
  } catch {
    // A search that cannot be remembered is not a search that should fail.
  }
}

/** Forget everything for one surface. */
export function clearRecentSearches(scope) {
  try {
    window.localStorage.removeItem(KEY(scope));
  } catch {
    /* nothing to do */
  }
}

export default getRecentSearches;

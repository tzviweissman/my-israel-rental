/**
 * Where the help entries go — in ONE place, because they are the same three
 * destinations in the header menu, in four inline offers, and later in the
 * Day 1 email.
 *
 * These point at `/what-you-can-do` — the role-filtered feature library
 * from `docs/perks-and-features-spec.md` Part 1.
 *
 * It was briefly not built, and while that was true these entries went to
 * `/why-list` and `/why-host` instead: pointing at a route that does not
 * exist would have shipped a 404 behind a control whose entire reason for
 * existing is that help should be findable. The fallback is kept below
 * rather than deleted, because the same situation recurs the next time a
 * destination is planned before it is built.
 */

// The path T3 will create. Named here so the swap is one line.
export const FEATURE_LIBRARY_PATH = '/what-you-can-do';

/** The library now exists (`/what-you-can-do`, routed in App.js). */
export const FEATURE_LIBRARY_READY = true;

/**
 * The best "what can this site do for me" page for a role, today.
 *
 * @param {string} role  the user's role
 */
export function featureLibraryFor(role) {
  if (FEATURE_LIBRARY_READY) return FEATURE_LIBRARY_PATH;
  // A plumber does not care about iCal sync and a landlord does not care
  // about the services board, so this is role-split rather than one page.
  return role === 'owner' || role === 'manager' ? '/why-host' : '/why-list';
}

/** Support. The site-wide WhatsApp number, same as the floating button. */
export const SUPPORT_WHATSAPP = 'https://wa.me/972553225141';

/**
 * Where the help entries go — in ONE place, because they are the same three
 * destinations in the header menu, in four inline offers, and later in the
 * Day 1 email.
 *
 * THE FEATURE LIBRARY DOES NOT EXIST YET
 * --------------------------------------
 * T7's entries are meant to point at `/what-you-can-do` — the role-filtered
 * feature library from `docs/perks-and-features-spec.md` Part 1, which this
 * pass does not build (T3 is explicitly out of scope). There is no such
 * route in `App.js`.
 *
 * Pointing at it anyway would ship a 404 behind a control whose entire
 * reason for existing is that help should be findable. So until T3 lands
 * these go to the pages that already exist and already answer the same
 * question for the same audience:
 *
 *   * `/why-list`  — the value page for service and business owners
 *   * `/why-host`  — the value page for property owners
 *
 * Both are real, on-brand, and role-appropriate. When `/what-you-can-do`
 * exists, `featureLibraryFor` is the only thing that has to change.
 */

// The path T3 will create. Named here so the swap is one line.
export const FEATURE_LIBRARY_PATH = '/what-you-can-do';

/** Whether the feature library route exists yet. Flip when T3 ships. */
export const FEATURE_LIBRARY_READY = false;

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

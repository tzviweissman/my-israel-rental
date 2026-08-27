/**
 * What the tour points at, in order.
 *
 * TARGETS ARE `data-tour` ATTRIBUTES, never CSS paths or DOM positions. A
 * refactor that moves a button changes its classes and its parents; it does
 * not change an attribute somebody put there on purpose. That is the whole
 * reason for the indirection — a tour anchored to `.flex > div:nth-child(2)`
 * breaks silently the first time somebody adds a wrapper.
 *
 * COPY IS NOT HERE. Every string lives in `en.js` / `he.js` under
 * `tour.step.<id>`, so the tour is translated like everything else and a
 * step's wording can change without touching this file.
 *
 * WHAT THE STEPS TEACH. Not "this is your dashboard, these are your
 * settings" — people can see that, and a tour that spends its first two
 * steps on furniture has lost the reader before it says anything useful.
 * Each step below is something this site does that a general marketplace
 * does not: a page of your own, a QR you can print, chat that translates,
 * a calendar that stops double bookings, a contract signed without a
 * printer.
 *
 * FIVE TO SEVEN STEPS, HARD MAX. A longer tour is abandoned in the middle,
 * which teaches less than a short one finished.
 */

/**
 * @typedef {object} TourStep
 * @property {string}   id      copy key + analytics key
 * @property {string}   target  `data-tour` value on the real element
 * @property {string}   [route] where the step lives; the engine navigates
 *                              there first. Omitted means "wherever we are".
 * @property {string[]} roles   'business' | 'lister'
 */
export const TOUR_STEPS = [
  {
    id: 'checklist',
    target: 'setup-checklist',
    route: '/dashboard',
    roles: ['business', 'lister'],
  },
  {
    id: 'business-page',
    target: 'business-design',
    route: '/dashboard?tab=my-businesses',
    roles: ['business'],
  },
  {
    id: 'add-property',
    target: 'add-property',
    route: '/dashboard',
    roles: ['lister'],
  },
  {
    id: 'availability',
    target: 'availability',
    route: '/dashboard?tab=my-businesses',
    roles: ['business'],
  },
  {
    /* LISTER ONLY, and that is a finding rather than a preference. The
       share panel lives inside My Properties (PropertyList.jsx) and is
       hidden at zero properties by design (D6). A business owner has no
       properties tab at all, so this step would have been skipped every
       single time for them — a tour advertising a QR code and then
       silently not showing it.

       Businesses do get a QR, but only on the public business page; there
       is no control for it anywhere in their dashboard. That gap is worth
       closing separately. Until it is, the business tour reaches the same
       idea through the feature library, which the final step points at. */
    id: 'share',
    target: 'share-panel',
    route: '/dashboard?tab=properties',
    roles: ['lister'],
  },
  {
    id: 'messages',
    target: 'messages-tab',
    route: '/dashboard',
    roles: ['business', 'lister'],
  },
  {
    id: 'help',
    target: 'help',
    route: '/dashboard',
    roles: ['business', 'lister'],
  },
];

/** Which tour a role gets. Anyone who is not clearly a property lister is
 *  shown the business tour — this site is not aimed at property owners by
 *  default, and the supply side is broader than them. */
export function tourRoleFor(role) {
  return role === 'owner' || role === 'manager' ? 'lister' : 'business';
}

/** The steps for a role, in order. */
export function stepsForRole(role) {
  const which = tourRoleFor(role);
  return TOUR_STEPS.filter((s) => s.roles.includes(which));
}

export default TOUR_STEPS;

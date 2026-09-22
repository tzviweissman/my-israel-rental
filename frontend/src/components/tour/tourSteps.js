/**
 * The walk: the site's one guide (Tzvi, 22 Sep 2026). It replaced both the
 * short dashboard tour and the card page at /getting-started.
 *
 * It goes through the REAL pages. Each stop opens a page, points at the
 * part that matters, and says in one sentence how it helps the business
 * grow. "Do it now" opens the form right there; the walk steps aside and a
 * small bar brings it back when they are done. Nothing is required.
 *
 * Two walks, chosen by what the account has (TourProvider):
 *   business - 9 stops, in the order a new business uses them;
 *   host     - 8 stops for someone who rents out a place.
 * Someone who is both takes the business walk first and is offered the
 * host walk at the end.
 *
 * @typedef {object} WalkStep
 * @property {string}          id      unique across BOTH walks: it is the
 *                                     server's resume point and the copy key
 * @property {string}          route   the page this stop lives on
 * @property {string|string[]} target  `data-tour` value(s) on that page;
 *                                     the first one present is used, and a
 *                                     stop with none present is skipped
 * @property {{href?: string, click?: string|string[]}} [doIt]
 *                                     "Do it now": go to a form, or press a
 *                                     control on this page
 */

export const WALKS = {
  business: [
    { id: 'b.page', route: '/dashboard?tab=my-businesses', target: 'business-design',
      doIt: { href: '/dashboard?tab=my-businesses&details=1' } },
    { id: 'b.service', route: '/dashboard?tab=my-gigs', target: 'gigs',
      doIt: { href: '/businesses/add' } },
    { id: 'b.share', route: '/dashboard?tab=my-businesses', target: 'business-share',
      doIt: { click: 'business-share' } },
    { id: 'b.requests', route: '/requests', target: 'requests-board' },
    { id: 'b.orders', route: '/dashboard?tab=orders', target: 'orders-board',
      doIt: { click: 'orders-new' } },
    { id: 'b.network', route: '/dashboard?tab=network&view=partners', target: ['network', 'network-no-business'],
      doIt: { href: '/businesses' } },
    { id: 'b.automations', route: '/dashboard?tab=network&view=automations', target: ['automation-recipes', 'network-no-business'],
      doIt: { click: ['automation-new', 'network-add-business'] } },
    { id: 'b.stats', route: '/dashboard?tab=overview', target: 'overview-stats' },
    { id: 'b.messages', route: '/dashboard?tab=messages', target: ['messages-panel', 'messages-tab'] },
  ],
  host: [
    { id: 'h.calendar', route: '/dashboard?tab=properties', target: 'ical',
      doIt: { click: 'ical' } },
    { id: 'h.instant', route: '/dashboard?tab=properties', target: 'property-edit',
      doIt: { click: 'property-edit' } },
    { id: 'h.contracts', route: '/dashboard?tab=contracts', target: 'contracts' },
    { id: 'h.share', route: '/dashboard?tab=properties', target: 'share-panel',
      doIt: { click: 'share-panel' } },
    { id: 'h.automations', route: '/dashboard?tab=network&view=automations', target: ['automation-recipes', 'network-no-business'],
      doIt: { click: ['automation-new', 'network-add-business'] } },
    { id: 'h.pricing', route: '/dashboard?tab=properties', target: 'smart-pricing',
      doIt: { click: 'smart-pricing' } },
    { id: 'h.stats', route: '/dashboard?tab=properties', target: 'property-stats' },
    { id: 'h.messages', route: '/dashboard?tab=messages', target: ['messages-panel', 'messages-tab'] },
  ],
};

/** Which walk the account's ROLE suggests, when nothing better is known.
 *  TourProvider prefers what the account actually has. */
export function tourRoleFor(role) {
  return role === 'owner' || role === 'manager' ? 'host' : 'business';
}

/** The copy key for a stop: `tour.step.<id with dots as underscores>`. */
export const stepKey = (id) => `tour.step.${id.replace('.', '_')}`;

export default WALKS;

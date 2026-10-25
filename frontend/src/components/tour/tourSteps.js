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
 *   business - 22 stops, in the order a new business uses them;
 *   host     - 9 stops for someone who rents out a place.
 * The stops added on 16 Oct 2026 (Tzvi: "add all the new features to the
 * walk through tour") cover link-in-bio, appointments, gift cards, the
 * sales summary with private feedback, and messages to guests; on 17 Oct
 * hours and fees with table ordering (b.hours); on 19 Oct calendar sync
 * (b.calendar) and sales at the counter (b.counter); on 22 Oct the rating
 * badge (b.badge), sending a price first (b.quotes), payment requests
 * (b.payreq), holiday and win-back messages (b.occasions) and the leads
 * board (b.leads), with the automatic reply above it (b.awayreply, 24 Oct); then the reorder when stock runs low (b.reorder). Stops on My page that
 * are not about the details window carry `details=0`, which closes it
 * (MyBusinessesTab), so the one b.biolink opens is not left over them.
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
    { id: 'b.page', route: '/dashboard?tab=my-businesses&details=0', target: 'business-design',
      doIt: { href: '/dashboard?tab=my-businesses&details=1' } },
    { id: 'b.service', route: '/dashboard?tab=my-businesses&details=0', target: 'business-services',
      doIt: { href: '/businesses/add' } },
    { id: 'b.share', route: '/dashboard?tab=my-businesses&details=0', target: 'business-share',
      doIt: { click: 'business-share' } },
    { id: 'b.badge', route: '/dashboard?tab=my-businesses&details=0', target: 'rating-badge',
      doIt: { click: 'rating-badge' } },
    { id: 'b.biolink', route: '/dashboard?tab=my-businesses&details=1', target: 'bio-link' },
    { id: 'b.hours', route: '/dashboard?tab=my-businesses&details=0', target: 'business-hours',
      doIt: { click: 'business-hours' } },
    { id: 'b.calendar', route: '/dashboard?tab=my-businesses&details=0', target: 'calendar-sync',
      doIt: { click: 'calendar-sync' } },
    { id: 'b.requests', route: '/requests', target: 'requests-board' },
    { id: 'b.orders', route: '/dashboard?tab=orders', target: 'orders-board',
      doIt: { click: 'orders-new' } },
    { id: 'b.counter', route: '/dashboard?tab=orders', target: 'orders-counter',
      doIt: { click: 'orders-counter' } },
    { id: 'b.appointments', route: '/dashboard?tab=appointments', target: 'appointment-settings',
      doIt: { click: 'appointment-settings-open' } },
    { id: 'b.quotes', route: '/dashboard?tab=appointments', target: 'quote-new-open',
      doIt: { click: 'quote-new-open' } },
    { id: 'b.payreq', route: '/dashboard?tab=customers&view=list', target: 'customers-payreq',
      doIt: { click: 'customers-payreq' } },
    { id: 'b.occasions', route: '/dashboard?tab=customers&view=list', target: ['occasions-card', 'customers-email'],
      doIt: { click: ['occasion-holiday', 'customers-email'] } },
    { id: 'b.leads', route: '/dashboard?tab=customers&view=leads', target: 'leads-board',
      doIt: { click: 'leads-add-open' } },
    // No "Do it now": the switch sends messages in the owner's name, so they turn it on themselves.
    { id: 'b.awayreply', route: '/dashboard?tab=customers&view=leads', target: 'away-reply' },
    { id: 'b.giftcards', route: '/dashboard?tab=discounts', target: 'gift-cards',
      doIt: { click: 'gift-cards-open' } },
    { id: 'b.network', route: '/dashboard?tab=network&view=partners', target: ['network', 'network-no-business'],
      doIt: { href: '/businesses' } },
    { id: 'b.automations', route: '/dashboard?tab=network&view=automations', target: ['automation-recipes', 'network-no-business'],
      doIt: { click: ['automation-new', 'network-add-business'] } },
    // The card is disabled for a business with no shop products yet; then
    // the stop points at it all the same and "Do it now" adds products.
    { id: 'b.reorder', route: '/dashboard?tab=network&view=automations', target: ['recipe-lowStockReorder', 'recipe-lowStockReorder-off', 'network-no-business'],
      doIt: { click: ['recipe-lowStockReorder', 'recipe-add-products', 'network-add-business'] } },
    { id: 'b.stats', route: '/dashboard?tab=overview', target: 'overview-stats' },
    { id: 'b.summary', route: '/dashboard?tab=overview', target: 'sales-summary' },
    { id: 'b.messages', route: '/dashboard?tab=messages', target: ['messages-panel', 'messages-tab'] },
  ],
  host: [
    { id: 'h.calendar', route: '/dashboard?tab=properties', target: 'ical',
      doIt: { click: 'ical' } },
    { id: 'h.instant', route: '/dashboard?tab=properties', target: 'property-edit',
      doIt: { click: 'property-edit' } },
    { id: 'h.contracts', route: '/dashboard?tab=contracts', target: 'contracts' },
    { id: 'h.guestmsg', route: '/dashboard?tab=properties', target: 'guest-messages',
      doIt: { click: 'guest-messages' } },
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

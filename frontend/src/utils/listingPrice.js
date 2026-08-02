/**
 * Comparable price for a listing.
 *
 * Extracted so the price *filter* and the price *sort* on /stays can't drift
 * apart. They were about to be two copies of the same conversion, which is
 * how a listing ends up passing the "under ₪6,000" filter and then sorting as
 * if it cost $6,000.
 */

// Last-resort rate, used only when /exchange-rate can't be reached. Matches
// the backend's own fallback (utils/fx.py) so an outage degrades to one
// number rather than two different wrong ones.
//
// This used to be THE rate for the whole rentals side. It was ~19% off:
// the real figure is around 3.06, so a $2,000/month listing rendered as
// about ₪7,300 instead of ₪6,120 — and because /stays converts before
// applying the price filter, "under ₪7,000" was silently excluding listings
// that qualified. Callers now pass the live rate from useExchangeRate.
export const FX_USD_TO_ILS = 3.65;

/** The price that actually applies: nightly for vacation stays, else monthly. */
export const listingPrice = (property) =>
  (property?.rental_type === 'vacation' ? property?.nightly_price : property?.monthly_price) || 0;

/**
 * `property`'s price expressed in `currency` ('ILS' | 'USD').
 *
 * Listings with no `currency` field are treated as ILS, matching how they are
 * displayed. Returns 0 when there's no price at all — callers that need to
 * tell "free" from "not priced" should check `listingPrice` directly.
 */
export const priceIn = (property, currency, rate = FX_USD_TO_ILS) => {
  const price = listingPrice(property);
  if (!price) return 0;
  const from = property?.currency || 'ILS';
  if (from === currency) return price;
  if (currency === 'USD' && from === 'ILS') return price / rate;
  if (currency === 'ILS' && from === 'USD') return price * rate;
  return price;
};

/**
 * Comparator for price sorting. Listings with no price sink to the bottom in
 * BOTH directions — "cheapest first" showing a wall of unpriced listings is
 * useless, and they aren't meaningfully "most expensive" either.
 */
export const byPrice = (currency, direction = 'asc', rate = FX_USD_TO_ILS) => (a, b) => {
  const pa = priceIn(a, currency, rate);
  const pb = priceIn(b, currency, rate);
  if (!pa && !pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  return direction === 'desc' ? pb - pa : pa - pb;
};

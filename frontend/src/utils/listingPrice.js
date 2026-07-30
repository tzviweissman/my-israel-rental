/**
 * Comparable price for a listing.
 *
 * Extracted so the price *filter* and the price *sort* on /stays can't drift
 * apart. They were about to be two copies of the same conversion, which is
 * how a listing ends up passing the "under ₪6,000" filter and then sorting as
 * if it cost $6,000.
 */

// Matches the constant used by Properties.js and the backend fallback so
// every conversion on the rentals side agrees.
//
// TODO: the rentals side should use the live /exchange-rate figure the
// property detail page already fetches, rather than this constant. Left as-is
// here deliberately — changing it would move listings in and out of existing
// saved price filters, which is a product decision, not a refactor.
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
export const byPrice = (currency, direction = 'asc') => (a, b) => {
  const pa = priceIn(a, currency);
  const pb = priceIn(b, currency);
  if (!pa && !pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  return direction === 'desc' ? pb - pa : pa - pb;
};

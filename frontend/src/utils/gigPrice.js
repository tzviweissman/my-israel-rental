/**
 * How a service's price reads, in one place (spec C7).
 *
 * Three rules, and each exists because the alternative misleads:
 *
 *  - `₪79`, never `₪79.00`. Down a column of twenty rows the trailing
 *    zeros are pure noise, and they make every price two characters
 *    wider than it needs to be on a phone. toLocaleString already drops
 *    them, and it keeps a genuine `79.5` intact rather than rounding it
 *    to something the customer would not be charged.
 *
 *  - `from ₪79` only when there is genuinely more than one option.
 *    Saying "from" about a single fixed price implies choices that do
 *    not exist, and invites a customer to go looking for the cheap one.
 *
 *  - No price becomes "Ask for a quote", never a blank. A missing price
 *    reads as a broken page; an invitation reads as a service. This
 *    matters most for trades that genuinely cannot list one — a plumber
 *    quoting a job is not the same as a bakery with a price list.
 *
 * THE CURRENCY COMES FROM THE OPTION BEING QUOTED. This used to read
 * `gig.tiers[0].currency`, which is empty on a STORE listing — a store
 * prices itself through `products` — so every store fell through to the
 * `|| 'ILS'` default. A butcher who had entered $215 had his card, and
 * every board that renders it, print ₪215. Reported by the business
 * itself, which is the worst way to find a price bug: the amount was
 * right, the symbol was wrong, and nothing anywhere was empty or broken.
 *
 * Returns the PARTS rather than a finished string, because the cards
 * render the "from" and the amount in different weights.
 */
// The extension is explicit so this module can be imported by plain node,
// which is what lets scripts/test-gig-price.mjs exercise it with no build
// and no browser. Webpack resolves it either way.
import { FX_USD_TO_ILS } from './listingPrice.js';

const symbolFor = (currency) => (currency === 'USD' ? '$' : '₪');

/**
 * The rows a gig prices itself with: products for a store, tiers for
 * everything else. Exported because more than one screen has had to work
 * this out for itself and got it wrong.
 */
const hasPrice = (r) => {
  // `Number(null)` is 0 and 0 is finite, so a row whose price is null - a
  // "call for a price" item sitting beside priced ones - counted as free and
  // won every cheapest-option comparison. Rejected before the coercion.
  if (r?.price === null || r?.price === undefined || r?.price === '') return false;
  return Number.isFinite(Number(r.price));
};

export const priceRows = (gig) => {
  const rows = (gig?.gig_type === 'store' ? gig?.products : gig?.tiers) || [];
  return rows.filter((r) => r && hasPrice(r));
};

/**
 * The cheapest option, compared across currencies rather than by raw
 * number. A shop listing a $30 item beside a ₪90 one has the ₪90 as its
 * cheaper option, and sorting on the bare figure would name the dollar
 * item and then print its price with a shekel sign.
 */
export const cheapestRow = (gig, rate = FX_USD_TO_ILS) => {
  const rows = priceRows(gig);
  if (!rows.length) return null;
  const inIls = (r) => (r.currency === 'USD' ? Number(r.price) * rate : Number(r.price));
  return rows.reduce((best, r) => (inIls(r) < inIls(best) ? r : best), rows[0]);
};

export const gigPriceParts = (gig, rate = FX_USD_TO_ILS) => {
  const row = cheapestRow(gig, rate);

  // A gig prices itself either through tiers or through products; count
  // whichever it uses. More than one means the figure shown is a floor.
  const optionCount = (gig?.tiers?.length || 0) + (gig?.products?.length || 0);

  // `cheapest_price` is the server's own figure, used for filtering and
  // sorting. It is the fallback rather than the source: it carries no
  // currency, so quoting it beside a symbol taken from somewhere else is
  // exactly the bug above.
  const amount = row ? Number(row.price) : gig?.cheapest_price;
  const currency = row?.currency || 'ILS';
  const sym = symbolFor(currency);

  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) {
    return { quote: true, from: false, text: null, sym, currency };
  }
  return {
    quote: false,
    from: optionCount > 1,
    text: `${sym}${Number(amount).toLocaleString()}`,
    sym,
    currency,
  };
};

export default gigPriceParts;

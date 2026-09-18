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

/**
 * The price a card or a map pin SHOWS, and what it is per.
 *
 * Nightly for a vacation stay, monthly otherwise - the same rule as
 * `listingPrice` - with one addition: a vacation listing priced ONLY for a
 * holiday shows that price, per night or for the whole holiday as its owner
 * said (`holiday_lump_is_per_night`). Until 18 Sep 2026 such a listing read
 * "Price on request" on /stays while its own page showed $6,000 for Sukkot.
 *
 * Never an invented number: no price is `null`. The map used to derive a
 * nightly figure from a monthly rent (monthly / 30) that no owner set.
 *
 * `per` is 'night' | 'month' | 'holiday' | 'holidayNight'. Holiday prices are
 * deliberately NOT in `listingPrice`: a whole-Sukkot total sorted against
 * nightly rates would be a comparison of different things.
 */
export const shownPrice = (p) => {
  if (!p) return null;
  if (p.rental_type === 'vacation') {
    if (p.nightly_price) return { amount: Number(p.nightly_price), currency: p.currency || 'ILS', per: 'night' };
    if (p.holiday_lump_price) {
      return {
        amount: Number(p.holiday_lump_price),
        currency: p.holiday_lump_currency || p.currency || 'ILS',
        per: p.holiday_lump_is_per_night ? 'holidayNight' : 'holiday',
        holiday: (p.holiday_tags || [])[0] || null,
      };
    }
    return null;
  }
  if (p.monthly_price) return { amount: Number(p.monthly_price), currency: p.currency || 'ILS', per: 'month' };
  // A short-term listing whose owner filled in only the NIGHTLY box: show
  // what they entered, with the unit they entered it in. Two live flats,
  // 18 Sep 2026, read "Price on request" on their cards and "₪—" under
  // the map while carrying 7,500 and 8,000 a night. Whether that figure is
  // right is the owner's to fix (the admin price check flags it); hiding it
  // is not ours to decide.
  if (p.nightly_price) return { amount: Number(p.nightly_price), currency: p.currency || 'ILS', per: 'night' };
  return null;
};

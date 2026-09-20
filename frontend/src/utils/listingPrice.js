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


// ---------------------------------------------------------------------------
// WHICH PRICE A LISTING SHOWS, AND PER WHAT
//
// The one definition. Every screen that shows a listing's price asks here:
// the /stays card, the listing card, the listing page, the map pins and the
// strip under them, the owner's dashboard, the manager page, Liked, the chat
// header, the home showcase and the owner's bulk manager. The Smart List on
// the server mirrors it in backend/utils/listing_price.py, and both are held
// to the same cases in shared/listing_price_cases.json.
//
// Why one place (18 Sep 2026): about fifteen screens each worked this out for
// themselves. When "my Sukkot price is per night" was added in June, two of
// them were taught and the rest were not, and a Sukkot list told customers a
// flat was "$154 / Sukkot" when the owner had said $154 a night. A new kind
// of price now has one place to be taught.
//
// Never an invented number: no price is `null`, not 0 and not a figure
// derived from another (the map used to show monthly / 30).
// ---------------------------------------------------------------------------

const HOLIDAYS = ['sukkot', 'pesach'];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** The everyday price: nightly for a vacation stay; otherwise monthly, or
 *  nightly when that is the only box the owner filled in. */
export const regularShown = (p) => {
  if (!p) return null;
  const cur = p.currency || 'ILS';
  const nightly = num(p.nightly_price);
  const monthly = num(p.monthly_price);
  if (p.rental_type === 'vacation') {
    return nightly ? { amount: nightly, currency: cur, per: 'night', holidays: [] } : null;
  }
  if (monthly) return { amount: monthly, currency: cur, per: 'month', holidays: [] };
  return nightly ? { amount: nightly, currency: cur, per: 'night', holidays: [] } : null;
};

/** The holiday price, if the listing has one. With `holiday`, only when the
 *  listing is offered for that holiday, and named as it. Any rental type:
 *  a long-term flat can also be listed for Sukkot with its own price (the
 *  listing page always allowed this; the listing card used to ignore it). */
export const holidayShown = (p, holiday = null) => {
  if (!p) return null;
  const amount = num(p.holiday_lump_price);
  if (!amount) return null;
  const tags = (p.holiday_tags || []).filter((x) => HOLIDAYS.includes(x));
  if (holiday && !tags.includes(holiday)) return null;
  return {
    amount,
    currency: p.holiday_lump_currency || p.currency || 'ILS',
    per: p.holiday_lump_is_per_night ? 'holidayNight' : 'holiday',
    holidays: holiday ? [holiday] : HOLIDAYS.filter((h) => tags.includes(h)),
  };
};

/**
 * The price to show. In a holiday context (a Sukkot list, the Sukkot page)
 * the holiday price wins when the listing is offered for it. Otherwise the
 * everyday price, and the holiday price only when it is the only one.
 */
export const shownPrice = (p, { holiday = null } = {}) => {
  if (holiday) {
    const h = holidayShown(p, holiday);
    if (h) return h;
  }
  return regularShown(p) || holidayShown(p);
};

export const priceSymbol = (currency) => (currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₪');

/** "night", "month", "Sukkot", "night (Sukkot)" - translated, no slash. */
export const unitLabel = (shown, t) => {
  if (!shown) return '';
  const names = (shown.holidays || [])
    .map((h) => t(`stays.holiday_${h}`, h.charAt(0).toUpperCase() + h.slice(1)))
    .join('/');
  switch (shown.per) {
    case 'night': return t('stays.unitNight', 'night');
    case 'month': return t('stays.unitMonth', 'month');
    case 'holiday': return names || t('stays.unitHoliday', 'holiday');
    case 'holidayNight':
      return names ? t('stays.unitHolidayNight', 'night ({{holiday}})', { holiday: names }) : t('stays.unitNight', 'night');
    default: return '';
  }
};

/** "₪6,000 / Sukkot", or null when there is no price. */
export const formatShownPrice = (shown, t) =>
  shown ? `${priceSymbol(shown.currency)}${Math.round(shown.amount).toLocaleString()} / ${unitLabel(shown, t)}` : null;

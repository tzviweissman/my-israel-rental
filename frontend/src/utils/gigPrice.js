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
 * Returns the PARTS rather than a finished string, because the cards
 * render the "from" and the amount in different weights.
 */
export const gigPriceParts = (gig) => {
  const amount = gig?.cheapest_price;
  const currency = gig?.tiers?.[0]?.currency || 'ILS';
  const sym = currency === 'ILS' ? '₪' : '$';

  // A gig prices itself either through tiers or through products; count
  // whichever it uses. More than one means the figure shown is a floor.
  const optionCount = (gig?.tiers?.length || 0) + (gig?.products?.length || 0);

  if (amount === null || amount === undefined) {
    return { quote: true, from: false, text: null, sym };
  }
  return {
    quote: false,
    from: optionCount > 1,
    text: `${sym}${Number(amount).toLocaleString()}`,
    sym,
  };
};

export default gigPriceParts;

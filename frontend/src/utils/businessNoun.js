/**
 * What does THIS business call the things it offers?
 *
 * A plumber offers services. A furniture shop offers products. Calling
 * both "gigs" is Fiverr's word and belongs to neither — and the point of
 * the marketplace opening to shops is that a clothing business should not
 * have to read its stock described as gigs.
 *
 * Nothing new is stored to answer this. A listing already records its
 * kind (`gig_type`: store / appointment / deliverable), and a business
 * already records its categories, so the noun is derived:
 *
 *   1. the business's own listings, if it has any — the most direct
 *      evidence of what it actually sells;
 *   2. otherwise its category, so a brand-new empty shop still reads
 *      correctly before anything is added;
 *   3. otherwise "service", which is what most businesses here are.
 */

// Categories that sell goods. Kept tiny and explicit rather than guessed
// from the label, so adding a category never silently changes wording
// somewhere else.
const PRODUCT_CATEGORIES = new Set(['shops-products']);

export function businessSellsProducts(business, listings = []) {
  // The CATEGORY wins, because it is what the owner declared this
  // business to be. Listings are only evidence, and a furniture shop that
  // also offers assembly would otherwise be told it sells services —
  // which is how a shop ends up reading as something it is not.
  if ((business?.categories || []).some((c) => PRODUCT_CATEGORIES.has(c))) return true;

  // No declared category (older businesses, or one created from just a
  // name): fall back to what it actually lists. Majority, because mixed
  // is normal and a heading has to pick one word.
  if (listings.length) {
    const stores = listings.filter((l) => l.gig_type === 'store').length;
    return stores * 2 > listings.length;
  }
  return false;
}

/**
 * i18n key suffix — 'Product' or 'Service' — so callers can build
 * `t('businesses.add' + nounKey(...))` and keep both languages in the
 * catalogue rather than assembling sentences in code.
 */
export function nounKey(business, listings = []) {
  return businessSellsProducts(business, listings) ? 'Product' : 'Service';
}

export default nounKey;

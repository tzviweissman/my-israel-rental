/**
 * The credential rules, in one place. Read by the "Good to know" band
 * (components/marketplace/GoodToKnow.jsx) and by the proof line beside the
 * main button (components/marketplace/ProofLine.jsx), so the two can never
 * disagree about what is true.
 *
 * Every rule answers from data already on the record. Nothing is typed as
 * a claim: years in business is derived from the founding year, so it
 * cannot go stale; "new" comes from the year the business joined.
 */

// Kosher certification is shown only where it means something. A plumber
// with a hechsher is not a signal; a bakery without one is. The taxonomy
// has two food-shaped categories and no others (see the history in
// GoodToKnow.jsx, where this rule lived until 23 Sep 2026).
const FOOD_CATEGORIES = new Set(['events-catering', 'shops-products']);

/** Categories that would make a hechsher meaningful, if any are known. */
export const isFoodBusiness = (categories = []) =>
  (categories || []).some((c) => FOOD_CATEGORIES.has(String(c).toLowerCase()));

/** Whole years since the founding year, or null. Never "0 years". */
export const yearsInBusiness = (foundedYear, now = new Date()) => {
  if (!foundedYear) return null;
  const years = now.getFullYear() - Number(foundedYear);
  return years >= 1 ? years : null;
};

/** Joined this calendar year. `memberSince` is the joining YEAR. */
export const isNewHere = (memberSince, now = new Date()) =>
  !!memberSince && String(memberSince) === String(now.getFullYear());

/**
 * The certifying body to show, or null. Shown when a hechsher was entered
 * AND nothing contradicts it: an owner who typed a certifying body made
 * the claim deliberately, and the category list only keeps it off a
 * business that plainly is not food.
 */
export const kosherBody = (cert, knownCategories = []) => {
  const known = (knownCategories || []).filter(Boolean);
  return cert && cert.body && (!known.length || isFoodBusiness(known)) ? cert.body : null;
};

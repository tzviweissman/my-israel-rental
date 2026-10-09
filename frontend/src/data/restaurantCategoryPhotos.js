/**
 * One photo per restaurant category, for the category tiles on /restaurants
 * (Tzvi, 8 Oct 2026: "high end and really clean", like adr.it's food tiles).
 *
 * Free stock photos (Unsplash licence: commercial use, no credit required),
 * each checked to be kosher-appropriate (no cheese with meat, no shellfish,
 * no pork), with the background removed and replaced by one cream colour on
 * Cloudinary so the set reads as one shoot. A missing key falls back to the
 * category's icon.
 */
const RESTAURANT_CATEGORY_PHOTOS = {};

export default RESTAURANT_CATEGORY_PHOTOS;

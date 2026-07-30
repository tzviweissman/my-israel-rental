/**
 * Card display title for a listing.
 *
 * Why this exists
 * ---------------
 * 120 of 204 production listings have a `title` that is just the
 * neighbourhood name — 22 called "Geula", 18 "Ramat Eshkol", 11 "Old City".
 * They came in through the bulk importer with the area mapped into the title
 * column. The card renders the title on one line and the area right below it,
 * so those listings all read "Old City / Old City" and a row of genuinely
 * different apartments looks like the same one repeated.
 *
 * That is what "duplicates are still showing" turned out to be: not duplicate
 * records (their addresses, owners and photos differ, and every dedupe
 * signature group is size 1) but indistinguishable *cards*.
 *
 * Display-layer only, matching `areaLabel` in ./areaNames — the stored title
 * is untouched, so search, the dashboard edit form and the admin table all
 * keep seeing exactly what the owner typed.
 */
import { canonicalArea } from './areaNames';

/** Street part of an address: "Malkei Israel Street 32, 9550166 Jerusalem,
 *  Israel" -> "Malkei Israel Street 32". The city and country are already on
 *  the line below, and the postal code is noise on a card. */
export const streetOf = (address) => {
  const raw = address == null ? '' : String(address).trim();
  if (!raw) return '';
  return raw.split(',')[0].trim();
};

/**
 * True when the title carries no information the area line isn't already
 * showing. Compared through `canonicalArea` so the many stored spellings of
 * one neighbourhood ("Sanhedria Murhevet" vs "Jerusalem - Sanhedria
 * Murhevet") all count as the same name rather than looking distinct.
 */
export const isAreaOnlyTitle = (title, area) => {
  const t = (title == null ? '' : String(title)).trim();
  if (!t) return true;
  const a = (area == null ? '' : String(area)).trim();
  if (!a) return false;
  if (t.toLowerCase() === a.toLowerCase()) return true;
  const ct = canonicalArea(t);
  const ca = canonicalArea(a);
  return Boolean(ct && ca && ct === ca);
};

/**
 * @param {object} property  listing as returned by the card-grid endpoint
 * @param {function} t       i18next translator
 * @returns {string} something that distinguishes this card from its neighbours
 */
export const propertyTitle = (property, t) => {
  const title = (property?.title == null ? '' : String(property.title)).trim();
  if (!isAreaOnlyTitle(title, property?.area)) return title;

  // The street is what actually tells two listings apart, and it's what a
  // renter is looking for. ~70% of the affected listings have one.
  const street = streetOf(property?.address);
  if (street) return street;

  // No address: fall back to the shape of the place. Weaker, but still beats
  // repeating the neighbourhood name that is already on the next line.
  const beds = Math.round(Number(property?.bedrooms) || 0);
  const typeKey = property?.property_type === 'villa'
    ? 'property.villa'
    : property?.property_type === 'house'
      ? 'property.house'
      : 'property.apartment';
  const typeLabel = typeof t === 'function'
    ? t(typeKey, property?.property_type || 'Apartment')
    : (property?.property_type || 'Apartment');

  if (!beds) return typeLabel;
  if (typeof t !== 'function') return `${typeLabel} - ${beds}`;
  // Two flat keys rather than i18next pluralisation: Hebrew has more plural
  // categories (one/two/many/other) than English, so count-suffixed keys
  // would give the two locales different key sets and trip the parity check.
  return beds === 1
    ? t('property.typeWithBedsOne', { type: typeLabel })
    : t('property.typeWithBeds', { type: typeLabel, count: beds });
};

export default propertyTitle;

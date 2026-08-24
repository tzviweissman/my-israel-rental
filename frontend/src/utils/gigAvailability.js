/**
 * isAvailableNow — pure function that decides whether an appointment
 * gig has an open window at the moment this code runs.
 *
 * Uses the browser's local time. The provider's declared weekly hours
 * live in the same civil time we display them in (the wizard stores
 * plain "HH:MM" strings without a timezone), so mapping current local
 * hh:mm → the day's window is enough — no timezone math required.
 *
 * Returns `false` for non-appointment gigs so the callsite doesn't have
 * to double-check `gig_type`. Also returns `false` when the gig has no
 * weekly_availability yet (fresh appointment gig before hours are set).
 */
import { productPhotos } from './productPhotos';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const toMinutes = (hhmm) => {
  if (typeof hhmm !== 'string') return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

export const isAvailableNow = (gig, now = new Date()) => {
  if (!gig || gig.gig_type !== 'appointment') return false;
  const weekly = gig.weekly_availability;
  if (!weekly || typeof weekly !== 'object') return false;
  const dayKey = DAY_KEYS[now.getDay()];
  const windows = weekly[dayKey] || [];
  if (!windows.length) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return windows.some((w) => {
    const s = toMinutes(w?.start);
    const e = toMinutes(w?.end);
    return s != null && e != null && s <= nowMin && nowMin < e;
  });
};

/**
 * getGigCover — resolve the best cover image for a gig.
 *
 * Search order:
 *   1. Legacy gig-wide gallery (still populated on older gigs)
 *   2. First product with an image (Store gigs)
 *   3. First tier with images (Deliverable/Appointment gigs)
 *
 * Returns `null` when the gig has no images anywhere. Callsites are
 * expected to render a "No image" placeholder in that case.
 */
export const getGigCover = (gig) => {
  if (!gig) return null;
  if (Array.isArray(gig.gallery) && gig.gallery[0]) return gig.gallery[0];
  if (Array.isArray(gig.products)) {
    // productPhotos, not `p.image`: the wizard writes a product's gallery
    // to `images` and CLEARS the legacy singular field, so reading only
    // `image` returned nothing for every store listed through the current
    // uploader. This function is the cover for service cards, the
    // featured row, the business page's header band, the share image and
    // the gig hero — so a shop with photos on every product appeared to
    // have none, everywhere at once.
    for (const p of gig.products) {
      const first = productPhotos(p)[0];
      if (first) return first;
    }
  }
  if (Array.isArray(gig.tiers)) {
    const withImgs = gig.tiers.find((t) => Array.isArray(t?.images) && t.images[0]);
    if (withImgs) return withImgs.images[0];
  }
  return null;
};

/**
 * Prefer the Hebrew copy of a gig's title/description when the user is
 * browsing in Hebrew. Falls back to the primary (English/default) copy
 * silently — no visual indicator — so partially-translated gigs still
 * render cleanly.
 */
export const localizedTitle = (gig, i18n) => {
  const isHe = (i18n?.language || '').toLowerCase().startsWith('he');
  if (isHe && gig?.title_he) return gig.title_he;
  return gig?.title || '';
};

export const localizedDescription = (gig, i18n) => {
  const isHe = (i18n?.language || '').toLowerCase().startsWith('he');
  if (isHe && gig?.description_he) return gig.description_he;
  return gig?.description || '';
};

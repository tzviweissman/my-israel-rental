/**
 * The title/description in the language the visitor is browsing in.
 *
 * A post is written in ONE language and the other side is filled in by
 * the background translator: `title_he` for an English post, `title_en`
 * for a Hebrew one. Falls back to the original silently - no visual
 * indicator - so a post whose translation has not landed yet (it takes a
 * few seconds) still renders cleanly.
 *
 * `_en` was written by the backend since 2026-08-16 and read by nothing
 * here, so an English visitor to a Hebrew-authored listing saw Hebrew.
 * Works for gigs, jobs and requests alike - they share the field names.
 */
const isHebrewUi = (i18n) => (i18n?.language || '').toLowerCase().startsWith('he');

export const localizedTitle = (item, i18n) => {
  if (!item) return '';
  if (isHebrewUi(i18n)) return item.title_he || item.title || '';
  return item.title_en || item.title || '';
};

export const localizedDescription = (item, i18n) => {
  if (!item) return '';
  if (isHebrewUi(i18n)) return item.description_he || item.description || '';
  return item.description_en || item.description || '';
};

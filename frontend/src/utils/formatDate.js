/**
 * '2026-09-01' → '1 Sept 2026' (or '1 בספט׳ 2026' under Hebrew).
 *
 * The request cards were showing the wire format raw — a machine's date on
 * a consumer page, and ambiguous to boot: an Israeli reader of "2026-09-01"
 * has no way to know it isn't day-month reversed.
 *
 * Parsing goes through DateField's parseISODate, never `new Date(string)`:
 * a bare ISO string parses as UTC MIDNIGHT, so anyone east of Greenwich
 * (all of Israel) would see the previous day. That exact off-by-one is why
 * DateField owns a manual parser — reuse it rather than re-learn it.
 *
 * Formatting is Intl's, not ours: month names, ordering and the geresh in
 * Hebrew abbreviations are locale knowledge the platform already has, and
 * a hand-rolled table would be one more silent-fallback surface.
 */
import { parseISODate } from '../components/common/DateField';
import i18n from '../i18n';

const LOCALE = { he: 'he-IL', en: 'en-GB' };

// `lang` defaults to whatever the app is currently in, read from the i18n
// singleton — several render sites (the board card) receive `t` as a prop
// and have no i18n instance of their own to pass.
export function formatDate(iso, lang) {
  const d = parseISODate(iso);
  // Not parseable → hand back whatever it was. Showing the raw value is
  // wrong-looking but honest; showing nothing hides that a date exists.
  if (!d) return iso || '';
  const key = String(lang || i18n.language || 'en').split('-')[0];
  return new Intl.DateTimeFormat(LOCALE[key] || LOCALE.en, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export default formatDate;

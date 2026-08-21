/**
 * Shared WhatsApp deep-link builder.
 *
 * Single source of truth for turning a human-typed phone number into a
 * `https://wa.me/<digits>` link. Used by the property detail page (WhatsApp
 * replaces "Message Owner" while we wait on Meta approval for automated
 * WhatsApp messaging) and by the services marketplace (providers who pick
 * the WhatsApp booking mode).
 *
 * The important contract: **`normalizeWhatsAppNumber` returns `null` for
 * anything it can't confidently turn into a real number.** Callers are
 * expected to treat `null` as "no WhatsApp — fall back to the in-app chat
 * path" rather than rendering a button that opens an empty WhatsApp compose
 * screen. `https://wa.me/` with no digits is a live URL that goes nowhere
 * useful, so a truthiness check on the raw string is NOT enough.
 */

// Below this many digits it isn't a dialable number — almost certainly a
// partially typed value or junk pasted into the field. Israeli mobiles are
// 9 digits after the leading 0 (e.g. 050-123-4567 → 0501234567 = 10), and
// the shortest plausible international number is around 8, so 8 is a safe
// floor that rejects garbage without blocking legitimate short-code
// countries.
const MIN_DIGITS = 8;

// Longest possible E.164 number. Anything past this is malformed (or an
// account id someone pasted into the phone field).
const MAX_DIGITS = 15;

const ISRAEL_CC = '972';

/**
 * Normalize a raw phone string to bare E.164 digits (no `+`, no spaces).
 *
 * Rules:
 *  - Strip everything that isn't a digit: spaces, dashes, parens, dots, `+`.
 *  - **Leading `0` → Israeli country code `972`.** Israelis overwhelmingly
 *    type their number in national format (`050-123-4567`), and `wa.me`
 *    only accepts full international format. A leading `0` in national
 *    format is the trunk prefix and is dropped when the country code is
 *    prepended — so `0501234567` becomes `972501234567`, NOT
 *    `9720501234567` (that extra 0 would produce a dead link). This is the
 *    single most common way a WhatsApp link silently breaks here.
 *  - A number that already carries a country code (anything not starting
 *    with `0`, e.g. `972…`, `+1…`, `44…`) is passed through untouched — we
 *    deliberately do not try to guess or "fix" foreign numbers.
 *
 * @param {string} raw
 * @returns {string|null} bare digits, or null when unusable
 */

/**
 * Undo the two ways an Israeli number gets mangled on the way in.
 *
 * A real listing was published as "+972972533270020" and nobody could
 * reach it: the entry form showed a "+972" selector beside a box, the
 * owner typed the number complete with its own 972, and the two were
 * concatenated. At 15 digits it sits exactly on the E.164 maximum, so
 * every length check passed and the link simply went nowhere.
 *
 * The entry form no longer allows it (see utils/phoneFormat.js), but
 * numbers saved before that are still in the database, and the owners
 * have no idea. Repairing on READ makes every one of them work again
 * without a migration, and keeps working for any other route into the
 * data - a CSV import, an admin edit - that might reintroduce it.
 *
 * Only ever applied to numbers that are already Israeli. Foreign numbers
 * are left exactly as given, because we have no basis to second-guess
 * them.
 */
function repairIsraeliDigits(digits) {
  let d = digits;
  // The country code twice over. Loop rather than a single slice: three
  // copies is not a shape anyone should have to think about again.
  while (d.startsWith(ISRAEL_CC + ISRAEL_CC) && d.length > 12) {
    d = d.slice(ISRAEL_CC.length);
  }
  // The country code followed by the national trunk 0 - "+972" plus
  // "050-123-4567" typed out of habit.
  if (d.startsWith(`${ISRAEL_CC}0`)) {
    d = ISRAEL_CC + d.slice(ISRAEL_CC.length).replace(/^0+/, '');
  }
  return d;
}

export function normalizeWhatsAppNumber(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw);
  // Coerce defensively — backends have handed us numbers before. Also
  // strips the directional marks and non-breaking hyphens that come with
  // numbers pasted out of iOS Contacts.
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;

  // Did the user actually tell us the country? A leading `+` (anywhere in
  // the leading punctuation) or a `00` prefix is an explicit statement; a
  // bare string of digits is not, and guessing is what sent renters abroad.
  const explicitIntl = /^[\s‎‏‪-‮(]*\+/.test(text) || digits.startsWith('00');

  let normalized;
  if (explicitIntl) {
    // Honour it as given. We deliberately don't try to "fix" foreign
    // numbers — we have no basis to.
    normalized = digits.startsWith('00') ? digits.slice(2) : digits;
  } else if (digits.startsWith('0')) {
    // Israeli national format ("050-123-4567"): the trunk 0 is REPLACED by
    // the country code, never kept alongside it.
    normalized = ISRAEL_CC + digits.replace(/^0+/, '');
  } else if (digits.startsWith(ISRAEL_CC) && digits.length === 12) {
    // Already a full Israeli number, just without the +.
    normalized = digits;
  } else if (digits.length === 9 && digits.startsWith('5')) {
    // Israeli mobile with both the + and the trunk 0 missing ("553304424").
    // 9 digits starting with 5 is unambiguous here: an Israeli mobile is
    // exactly 9 digits after the 0.
    normalized = ISRAEL_CC + digits;
  } else {
    // Ambiguous: bare digits that could belong to any country. This used to
    // fall through as "assume it already has a country code", which dialled
    // "732 723 8572" (a New Jersey number) as +7 Russia and "553304424" (an
    // Israeli mobile) as +55 Brazil. Sending a renter to a stranger abroad
    // is worse than showing no button, so the caller falls back to chat.
    return null;
  }

  // Repair before measuring: a doubled country code is 15 digits, which
  // would otherwise pass the check below and produce a dead link.
  if (normalized.startsWith(ISRAEL_CC)) normalized = repairIsraeliDigits(normalized);

  if (normalized.length < MIN_DIGITS || normalized.length > MAX_DIGITS) return null;
  return normalized;
}

/**
 * Build a plain `https://wa.me/<digits>` link.
 *
 * @param {string} raw
 * @returns {string|null} the URL, or null when `raw` isn't a usable number
 */
export function buildWhatsAppLink(raw) {
  const digits = normalizeWhatsAppNumber(raw);
  return digits ? `https://wa.me/${digits}` : null;
}

/**
 * Build a `https://wa.me/<digits>?text=<encoded>` link with a prefilled
 * message. Falls back to the bare link when `message` is empty so we never
 * emit a stray `?text=`.
 *
 * @param {string} raw
 * @param {string} [message] plain text; URL-encoded here, do not pre-encode
 * @returns {string|null} the URL, or null when `raw` isn't a usable number
 */
export function buildWhatsAppLinkWithMessage(raw, message) {
  const base = buildWhatsAppLink(raw);
  if (!base) return null;
  const text = (message === null || message === undefined) ? '' : String(message).trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

/**
 * Convenience predicate for form validation / conditional rendering.
 * @param {string} raw
 * @returns {boolean}
 */
export function hasValidWhatsApp(raw) {
  return normalizeWhatsAppNumber(raw) !== null;
}

export default buildWhatsAppLink;

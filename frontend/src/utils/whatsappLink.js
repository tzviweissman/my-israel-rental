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
export function normalizeWhatsAppNumber(raw) {
  if (raw === null || raw === undefined) return null;
  // Coerce defensively — backends have handed us numbers before.
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;

  // `00` is the international dialing prefix in Israel and much of the
  // world (00972…) — strip it before the leading-zero rule below, which
  // would otherwise mangle it.
  let normalized = digits.startsWith('00') ? digits.slice(2) : digits;

  if (normalized.startsWith('0')) {
    // National format → prepend IL country code, dropping the trunk 0.
    normalized = ISRAEL_CC + normalized.replace(/^0+/, '');
  }

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

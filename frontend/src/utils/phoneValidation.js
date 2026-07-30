/**
 * Shared validation for the WhatsApp/phone field.
 *
 * Why this is strict
 * ------------------
 * Numbers typed without a country code and without the Israeli trunk `0`
 * are genuinely ambiguous, and we used to guess. In production that guess
 * sent renters to the wrong country: "553304424" (an Israeli mobile typed
 * without the 0) was dialled as +55 Brazil, and "732 723 8572" (a New
 * Jersey number) as +7 Russia. A WhatsApp button that opens a chat with a
 * stranger abroad is worse than no button at all.
 *
 * `normalizeWhatsAppNumber` now refuses to guess, which means a number
 * saved in an ambiguous format simply gets no button — silently. So the
 * fix has to be here too: catch it at the point of entry, while the person
 * who knows the number is still looking at the screen.
 */
import { normalizeWhatsAppNumber } from './whatsappLink';

/**
 * Validation message for a phone input, or '' when it's fine.
 *
 * An empty value is always fine — the field is optional everywhere it
 * appears. Callers should treat '' as "no error", not "no opinion".
 *
 * @param {string}   raw the raw input value
 * @param {function} t   i18next translator
 */
export const phoneError = (raw, t) => {
  const text = (raw == null ? '' : String(raw)).trim();
  if (!text) return '';

  const tr = typeof t === 'function' ? t : (_k, o) => (o && o.defaultValue) || '';
  const digits = text.replace(/\D/g, '');

  if (digits.length < 8) {
    return tr('phone.tooShort', {
      defaultValue: "That looks too short — please include the full number.",
    });
  }
  if (normalizeWhatsAppNumber(text)) return '';

  // Reached only when the number is long enough but we can't tell which
  // country it belongs to. Tell them exactly what to add rather than a
  // generic "invalid number".
  return tr('phone.needsCountryCode', {
    defaultValue:
      'Please start with 0 for an Israeli number (050-123-4567), or add the country code (+1, +44).',
  });
};

/** Convenience for disabling a submit button. */
export const isPhoneValid = (raw) => !phoneError(raw, null);

/**
 * What the number will actually be dialled as, for a live confirmation
 * under the input. Returns '' when there's nothing useful to show.
 */
export const phonePreview = (raw) => {
  const digits = normalizeWhatsAppNumber(raw);
  return digits ? `+${digits}` : '';
};

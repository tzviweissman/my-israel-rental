/**
 * Country dial codes, and splitting/joining a phone number around them.
 *
 * Kept out of the component so it can be tested directly — this is the logic
 * that decides which country a stored number belongs to, and getting it
 * wrong is what dialled an Israeli mobile as +55 Brazil.
 */

// Israel first, then where this audience actually comes from. Deliberately
// short: a 200-row country list is worse to use than a focused one, and
// anyone outside it is one line away from being supported.
export const DIAL_CODES = [
  { code: 'IL', dial: '972', flag: '🇮🇱', name: 'Israel' },
  { code: 'US', dial: '1', flag: '🇺🇸', name: 'United States / Canada' },
  { code: 'GB', dial: '44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'FR', dial: '33', flag: '🇫🇷', name: 'France' },
  { code: 'BE', dial: '32', flag: '🇧🇪', name: 'Belgium' },
  { code: 'DE', dial: '49', flag: '🇩🇪', name: 'Germany' },
  { code: 'CH', dial: '41', flag: '🇨🇭', name: 'Switzerland' },
  { code: 'NL', dial: '31', flag: '🇳🇱', name: 'Netherlands' },
  { code: 'IT', dial: '39', flag: '🇮🇹', name: 'Italy' },
  { code: 'ES', dial: '34', flag: '🇪🇸', name: 'Spain' },
  { code: 'AU', dial: '61', flag: '🇦🇺', name: 'Australia' },
  { code: 'ZA', dial: '27', flag: '🇿🇦', name: 'South Africa' },
  { code: 'AR', dial: '54', flag: '🇦🇷', name: 'Argentina' },
  { code: 'BR', dial: '55', flag: '🇧🇷', name: 'Brazil' },
  { code: 'MX', dial: '52', flag: '🇲🇽', name: 'Mexico' },
  { code: 'RU', dial: '7', flag: '🇷🇺', name: 'Russia' },
  { code: 'UA', dial: '380', flag: '🇺🇦', name: 'Ukraine' },
];

// Subscriber digits after the country code, for the countries where that
// length is fixed and we are confident about it. Used ONLY to recognise a
// duplicated country code; a dial code missing from here is simply never
// de-duplicated, which is the safe direction to be wrong in.
const LOCAL_DIGITS = {
  972: 9,   // Israeli mobile: 9 after the trunk 0, e.g. 50 123 4567
  1: 10,    // NANP
  44: 10,   // UK mobile
  33: 9,
  49: 10,
  31: 9,
  61: 9,
  27: 9,
  380: 9,
};

export const DEFAULT_DIAL = '972';

// Longest first so a short code can't shadow a longer one that starts with
// the same digits — 380 (Ukraine) must be tested before 38 would be.
const BY_LENGTH = [...DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);

/**
 * Split a stored value into `{ dial, local }`.
 *
 * Has to cope with everything already in the database: "+972501234567",
 * "0501234567" (Israeli national), "972501234567" (no plus), and blank.
 *
 * A leading 0 is the national trunk prefix, so it means "this is a local
 * number in the default country" — never part of the subscriber digits.
 */
export const splitPhone = (raw) => {
  const digits = (raw == null ? '' : String(raw)).replace(/\D/g, '');
  if (!digits) return { dial: DEFAULT_DIAL, local: '' };
  if (digits.startsWith('0')) {
    return { dial: DEFAULT_DIAL, local: digits.replace(/^0+/, '') };
  }
  const match = BY_LENGTH.find((c) => digits.startsWith(c.dial));
  if (match) return { dial: match.dial, local: digits.slice(match.dial.length) };
  return { dial: DEFAULT_DIAL, local: digits };
};

/**
 * Recombine into explicit international format.
 *
 * Strips a trunk 0 the user typed out of habit — "+972" plus "0501234567"
 * must not become +9720501234567, which is the single most common way an
 * Israeli WhatsApp link silently goes nowhere.
 */
export const joinPhone = (dial, local) => {
  let clean = String(local || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!clean) return '';

  // The selector already shows the country, so a number that ALSO carries
  // it is the same code twice. A real business published
  // "+972972533270020" this way and nobody could reach them on WhatsApp:
  // it is 15 digits, which slips under the E.164 maximum, so every length
  // check passed and the link simply went nowhere.
  //
  // Only stripped when the remainder is exactly the right length for that
  // country. Blanket stripping would corrupt a legitimate local number
  // that happens to begin with its own dial code - a US 10-digit local
  // starting with 1 being the obvious case.
  const expected = LOCAL_DIGITS[dial];
  if (expected && clean.startsWith(dial)) {
    const rest = clean.slice(dial.length).replace(/^0+/, '');
    if (rest.length === expected) clean = rest;
  }

  return `+${dial}${clean}`;
};

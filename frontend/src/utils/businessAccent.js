/**
 * The four accents a business can choose, and the only place their values
 * live (spec K1 in docs/business-page-customization-spec.md).
 *
 * Why a closed set and not a colour picker: an owner will not send a
 * customer a link to a page that embarrasses them, so no combination of
 * choices may produce an ugly page. Four options that all look deliberate
 * beat a free choice that mostly does not.
 *
 * Why names and not hexes in the database: a hex stored on a business is a
 * copy of the design system that nobody updates. Storing `sea` means a
 * palette change is a code change, and no business is left holding a colour
 * the system has retired.
 *
 * Every value below is an existing token from `brand/design-tokens.css`.
 * Two candidates were cut for reasons worth keeping:
 *
 *   - **terracotta** — not in the palette. Adding a colour to serve one
 *     feature is how a locked design system stops being locked.
 *   - **green** — functional on this site (status, verified, available). An
 *     accent green would teach a visitor that green means "this business
 *     picked green" on one page and "available" on the next.
 */

export const DEFAULT_ACCENT = 'stone';

export const ACCENTS = {
  // `tint` paints the fallback cover band; `on` is what stays readable on
  // top of it. Both are asserted by scripts/check-tile-contrast.mjs rather
  // than trusted.
  stone: { tint: '#EFE9DC', on: '#23201B', rule: '#E1D8C6' },
  sea:   { tint: '#1E5F8C', on: '#FFFFFF', rule: '#1E5F8C' },
  deep:  { tint: '#123B57', on: '#FFFFFF', rule: '#123B57' },
  gold:  { tint: '#C9A227', on: '#23201B', rule: '#C9A227' },
};

export const ACCENT_NAMES = Object.keys(ACCENTS);

/** The accent for a business, falling back to the default for anything
 *  unrecognised — including a value written by an older build. */
export function accentFor(business) {
  const name = business?.accent;
  return ACCENTS[name] ? name : DEFAULT_ACCENT;
}

/* A business's own colour (Tzvi, 15 Oct 2026: "brand colours and fonts").
 * The closed set above stays the default and the fallback. A free colour
 * is allowed because the readability that the closed set guaranteed is
 * computed here instead: text on the colour is white or ink, whichever
 * reads better (WCAG contrast), and `text` is the colour darkened until
 * it reads on white at 4.5:1, for anything written IN the brand colour. */
const HEX = /^#[0-9a-fA-F]{6}$/;

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
export function relLuminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a, b) {
  const [x, y] = [relLuminance(a), relLuminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.round(((n >> s) & 255) * (1 - f)).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
const INK = '#111827';

/** Colours for a business's own brand colour, or null. */
export function brandColors(hex) {
  if (!HEX.test(hex || '')) return null;
  const on = contrast(hex, '#FFFFFF') >= contrast(hex, INK) ? '#FFFFFF' : INK;
  let text = hex;
  for (let f = 0.08; contrast(text, '#FFFFFF') < 4.5 && f < 1; f += 0.08) text = darken(hex, f);
  return { tint: hex, on, rule: hex, text, custom: true };
}

/** The palette entry itself. Never returns undefined. */
export function accentColors(business) {
  return brandColors(business?.brand_color) || ACCENTS[accentFor(business)];
}

export default accentColors;

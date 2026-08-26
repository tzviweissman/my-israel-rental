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

/** The palette entry itself. Never returns undefined. */
export function accentColors(business) {
  return ACCENTS[accentFor(business)];
}

export default accentColors;

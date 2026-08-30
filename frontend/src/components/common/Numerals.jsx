/**
 * Digits inside a Playfair heading, set in the body font.
 *
 * THE DEFECT. Playfair Display's default figures are hybrid: `8` is full
 * cap height, but `1` and `0` are roughly three-quarters of it. Measured
 * on the real face at 200px, ink height:
 *
 *     capital O  147      digit 8  147
 *     digit 1    104      digit 0  108
 *
 * So "1 open on the board" renders with a numeral that sits visibly low
 * and small against the letters beside it, and any heading beginning
 * with a 1 or a 0 looks broken rather than styled.
 *
 * WHY NOT `font-variant-numeric: lining-nums`, which is the usual answer:
 * it does nothing here. Measured again with it applied, digit 1 is still
 * 104 — the face ships no lining set for the property to switch to. This
 * is worth writing down because the CSS looks like it should work, and a
 * future reader will otherwise try it, see no change, and assume the
 * cache is stale.
 *
 * WHY NOT a `unicode-range` @font-face mapping digits to Manrope, which
 * is the tidier trick: the brand fonts arrive through a Google Fonts
 * `@import`, so there is no stable file URL to point `src` at, and
 * `local()` only resolves for visitors who happen to have Manrope
 * installed. It would work on this machine and silently not work for
 * everyone else — the worst kind of fix.
 *
 * So: wrap runs of digits and set the body font on them. Manrope's
 * figures measure 143–149 against a 149 cap, so they sit at the height
 * Playfair's letters expect. The RTL faces (Frank Ruhl Libre, Assistant)
 * already have even figures — 134 against a 136 cap — so this is a
 * no-op there beyond a font swap on the digits, which is why the class
 * inherits weight and size rather than setting its own.
 *
 * Takes already-translated text, so it is i18n-safe: it never splits a
 * translation key, only the finished string, and any digit run in any
 * language is caught.
 */
import React from 'react';

// Two regexes on purpose. The split one is global; a global regex's
// `.test()` carries `lastIndex` between calls and would return true and
// false alternately over the same parts, wrapping every other number.
const SPLIT_DIGITS = /(\d[\d,.]*)/g;
const IS_DIGITS = /^\d/;

/**
 * @param {string} children  already-translated text
 */
export default function Numerals({ children }) {
  if (typeof children !== 'string' || !children) return children || null;
  const parts = children.split(SPLIT_DIGITS);
  return (
    <>
      {parts.map((part, i) => (
        IS_DIGITS.test(part)
          ? <span key={i} className="lining-num">{part}</span>
          : <React.Fragment key={i}>{part}</React.Fragment>
      ))}
    </>
  );
}

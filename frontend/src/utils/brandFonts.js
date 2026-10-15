/**
 * A business's own fonts (Tzvi, 15 Oct 2026: "brand colours and fonts").
 * Mirrors BRAND_HEADING_FONTS / BRAND_BODY_FONTS in
 * backend/routes/marketplace/businesses.py, which stores only the keys.
 *
 * Every face here has Hebrew AND Latin letters, so a page never falls
 * back to a system face halfway through a sentence in either language
 * (the RTL font bug this codebase has met ~69 times). Each is loaded from
 * Google Fonts only on a page that uses it.
 *
 * Applied as variables (`--font-head`, `--font-body`) on the business's
 * own content, never on the site's header or footer, and never as a
 * literal family on a heading: everything already reads the variables.
 */
import { useEffect } from 'react';

export const HEADING_FONTS = {
  'frank-ruhl': { family: 'Frank Ruhl Libre', fallback: 'Georgia, serif', weights: '400;700', label: 'Classic serif' },
  'david-libre': { family: 'David Libre', fallback: 'Georgia, serif', weights: '400;700', label: 'Book serif' },
  'suez-one': { family: 'Suez One', fallback: 'Georgia, serif', weights: '400', label: 'Bold serif' },
  'secular-one': { family: 'Secular One', fallback: 'system-ui, sans-serif', weights: '400', label: 'Bold modern' },
  rubik: { family: 'Rubik', fallback: 'system-ui, sans-serif', weights: '500;700', label: 'Rounded modern' },
  heebo: { family: 'Heebo', fallback: 'system-ui, sans-serif', weights: '500;800', label: 'Clean modern' },
  'varela-round': { family: 'Varela Round', fallback: 'system-ui, sans-serif', weights: '400', label: 'Soft and friendly' },
  'amatic-sc': { family: 'Amatic SC', fallback: 'cursive', weights: '700', label: 'Handwritten' },
  karantina: { family: 'Karantina', fallback: 'system-ui, sans-serif', weights: '700', label: 'Tall and narrow' },
};

export const BODY_FONTS = {
  assistant: { family: 'Assistant', fallback: 'system-ui, sans-serif', weights: '400;600;700', label: 'Assistant' },
  heebo: { family: 'Heebo', fallback: 'system-ui, sans-serif', weights: '400;600;700', label: 'Heebo' },
  rubik: { family: 'Rubik', fallback: 'system-ui, sans-serif', weights: '400;600;700', label: 'Rubik' },
  alef: { family: 'Alef', fallback: 'system-ui, sans-serif', weights: '400;700', label: 'Alef' },
  'open-sans': { family: 'Open Sans', fallback: 'system-ui, sans-serif', weights: '400;600;700', label: 'Open Sans' },
  'varela-round': { family: 'Varela Round', fallback: 'system-ui, sans-serif', weights: '400', label: 'Varela Round' },
};

const stack = (f) => `'${f.family}', ${f.fallback}`;

/** The Google Fonts stylesheet for these faces, or null for none. */
export function fontsHref(faces) {
  const list = faces.filter(Boolean);
  if (!list.length) return null;
  const seen = new Set();
  const params = list.filter((f) => !seen.has(f.family) && seen.add(f.family))
    .map((f) => `family=${f.family.replace(/ /g, '+')}:wght@${f.weights}`);
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}

/** The faces a business chose, as {heading, body} entries (either may be null). */
export function brandFaces(business) {
  const f = (business && business.brand_fonts) || {};
  return { heading: HEADING_FONTS[f.heading] || null, body: BODY_FONTS[f.body] || null };
}

/** Load the business's fonts and return the style that applies them. */
export function useBrandFonts(business) {
  const { heading, body } = brandFaces(business);
  const href = fontsHref([heading, body]);
  useEffect(() => {
    if (!href || typeof document === 'undefined') return;
    if (document.querySelector(`link[data-brand-fonts="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.brandFonts = href;
    document.head.appendChild(link);
  }, [href]);
  // The Hebrew variables too: `[dir="rtl"]` (design-tokens.css) re-points
  // --font-head at --font-head-he on ANY element marked rtl inside the
  // page, which would put the site's face back under the owner's choice.
  // Every face here has Hebrew, so one face serves both.
  const style = {};
  if (heading) { style['--font-head'] = stack(heading); style['--font-head-he'] = stack(heading); }
  if (body) {
    style['--font-body'] = stack(body);
    style['--font-body-he'] = stack(body);
    style.fontFamily = 'var(--font-body)';
  }
  return style;
}

/** Load a list of faces (the editor's font picker shows each in itself). */
export function useFontsLoaded(faces) {
  const href = fontsHref(faces);
  useEffect(() => {
    if (!href || document.querySelector(`link[data-brand-fonts="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.brandFonts = href;
    document.head.appendChild(link);
  }, [href]);
}

export const faceStack = stack;

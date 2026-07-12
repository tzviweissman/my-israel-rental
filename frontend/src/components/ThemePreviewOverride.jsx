/**
 * Theme preview override — injected into <head> whenever the URL has
 * `?preview=green-gold`. Purely additive; no permanent changes.
 *
 * How it works:
 *   - Tailwind arbitrary color classes like `bg-[#1E6A6A]` compile to
 *     escaped CSS class selectors (`.bg-\[\#1E6A6A\]`). We override
 *     those (plus the `from-` / `to-` gradient stop variables) so every
 *     occurrence of the current teal palette flips to green without
 *     touching the 98 source files that reference it.
 *   - `!important` beats the compiled Tailwind rules AND unimportant
 *     inline `style={{ background: '#1E6A6A' }}` props.
 *   - Handful of hand-written `linear-gradient(135deg, #1E6A6A ...)`
 *     inline strings can't be selector-targeted; the preview will still
 *     show teal for those (all in secondary UI, not the home page).
 *
 * Delete this file (and its App.js mount) once the theme decision is
 * finalised — either apply the green palette permanently across the
 * source files, or leave the teal as-is.
 */
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

// Colours picked to match the bright emerald pill in the reference
// screenshot. `PRIMARY` replaces the medium teal; `PRIMARY_DARK`
// replaces the deep teal so gradients still have visible depth.
const PRIMARY = '#22C55E';
const PRIMARY_DARK = '#166534';
const PRIMARY_HOVER = '#16A34A';
const PRIMARY_10 = 'rgba(34, 197, 94, 0.10)';
const PRIMARY_20 = 'rgba(34, 197, 94, 0.20)';

// The `.bg-\[\#…\]` selectors below match how Tailwind escapes the `#`
// and brackets. Written out long-form so we don't have to templateify
// the escape sequences at runtime.
const CSS = `
/* Solid utilities */
.bg-\\[\\#1E6A6A\\] { background-color: ${PRIMARY} !important; }
.text-\\[\\#1E6A6A\\] { color: ${PRIMARY} !important; }
.border-\\[\\#1E6A6A\\] { border-color: ${PRIMARY} !important; }
.ring-\\[\\#1E6A6A\\] { --tw-ring-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px ${PRIMARY_20} !important; }
.hover\\:bg-\\[\\#1E6A6A\\]:hover { background-color: ${PRIMARY_HOVER} !important; }
.hover\\:text-\\[\\#1E6A6A\\]:hover { color: ${PRIMARY_HOVER} !important; }
.hover\\:border-\\[\\#1E6A6A\\]:hover { border-color: ${PRIMARY_HOVER} !important; }
.focus\\:border-\\[\\#1E6A6A\\]:focus { border-color: ${PRIMARY} !important; }

.bg-\\[\\#0F3A3A\\] { background-color: ${PRIMARY_DARK} !important; }
.text-\\[\\#0F3A3A\\] { color: ${PRIMARY_DARK} !important; }
.border-\\[\\#0F3A3A\\] { border-color: ${PRIMARY_DARK} !important; }

.bg-\\[\\#175656\\] { background-color: ${PRIMARY_HOVER} !important; }
.hover\\:bg-\\[\\#175656\\]:hover { background-color: ${PRIMARY_HOVER} !important; }

/* Gradient stops — Tailwind stores them in CSS variables */
.from-\\[\\#1E6A6A\\] { --tw-gradient-from: ${PRIMARY} var(--tw-gradient-from-position) !important; --tw-gradient-to: rgba(34, 197, 94, 0) var(--tw-gradient-to-position) !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
.to-\\[\\#0F3A3A\\] { --tw-gradient-to: ${PRIMARY_DARK} var(--tw-gradient-to-position) !important; }
.to-\\[\\#1E6A6A\\] { --tw-gradient-to: ${PRIMARY} var(--tw-gradient-to-position) !important; }
.from-\\[\\#0F3A3A\\] { --tw-gradient-from: ${PRIMARY_DARK} var(--tw-gradient-from-position) !important; --tw-gradient-to: rgba(22, 101, 52, 0) var(--tw-gradient-to-position) !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
.via-\\[\\#1E6A6A\\] { --tw-gradient-stops: var(--tw-gradient-from), ${PRIMARY} var(--tw-gradient-via-position), var(--tw-gradient-to) !important; }

/* Alpha variants seen sporadically across the codebase */
.bg-\\[\\#1E6A6A\\]\\/8, .bg-\\[\\#1E6A6A\\]\\/10 { background-color: ${PRIMARY_10} !important; }
.bg-\\[\\#1E6A6A\\]\\/20 { background-color: ${PRIMARY_20} !important; }
.border-\\[\\#1E6A6A\\]\\/20 { border-color: ${PRIMARY_20} !important; }

/* The Services hero video overlay uses hard-coded rgba() — repaint it
   in the same green so the "video-forward" tint of the primary hero
   section flips too. Scoped to the hero element so we don't accidentally
   green-tint every dark overlay in the app. */
[data-testid="services-hero"] > div[aria-hidden="true"] {
  background: linear-gradient(135deg, rgba(34,197,94,0.78) 0%, rgba(22,101,52,0.88) 100%) !important;
}

/* Preview watermark chip — small, top-right, dismissible-by-URL-edit */
#green-gold-preview-badge {
  position: fixed; top: 12px; right: 12px; z-index: 9999;
  background: ${PRIMARY}; color: white; padding: 6px 12px;
  border-radius: 9999px; font-size: 11px; font-weight: 700;
  letter-spacing: 0.5px; text-transform: uppercase;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  font-family: system-ui, -apple-system, sans-serif;
}
#green-gold-preview-badge a {
  color: #FEF3C7; margin-left: 8px; text-decoration: underline;
}
`;

const STYLE_ID = '__theme-preview-green-gold__';
const BADGE_ID = 'green-gold-preview-badge';
const MARK_ATTR = 'data-theme-preview-patched';

// Inline `style="…"` and `style={{…}}` props can't be reached by CSS
// selectors alone — the color values are literal in the attribute
// string. We walk the DOM on apply, rewrite matching colours in place,
// and also set up a MutationObserver so React re-renders (or newly
// mounted routes) get patched too. Restoring the original inline styles
// on exit is deliberately out of scope: the "Exit preview" link is a
// plain <a href="?"> that triggers a full navigation, remounting the
// app from scratch with the original values.
// The browser normalises `style="background: #1E6A6A"` to `rgb(30, 106,
// 106)` at parse time, so `getAttribute('style')` returns the rgb form.
// We map BOTH representations to cover:
//   • React inline `style={{ backgroundColor: '#1E6A6A' }}` (rgb form)
//   • Hand-written `linear-gradient(135deg, #1E6A6A 0%, …)` (hex form)
const COLOUR_MAP = [
  { from: /#1E6A6A/gi, to: PRIMARY },
  { from: /rgb\(\s*30,\s*106,\s*106\s*\)/gi, to: PRIMARY },
  { from: /#175656/gi, to: PRIMARY_HOVER },
  { from: /rgb\(\s*23,\s*86,\s*86\s*\)/gi, to: PRIMARY_HOVER },
  { from: /#0F3A3A/gi, to: PRIMARY_DARK },
  { from: /rgb\(\s*15,\s*58,\s*58\s*\)/gi, to: PRIMARY_DARK },
  { from: /#164a4a/gi, to: PRIMARY_DARK },
  { from: /rgb\(\s*22,\s*74,\s*74\s*\)/gi, to: PRIMARY_DARK },
];

function patchInlineStyles(root) {
  const nodes = root.querySelectorAll('[style]');
  nodes.forEach((el) => {
    // Idempotency guard — we only need to patch each node once. React
    // may re-render the same DOM element, but its `style` attribute
    // will re-appear with the fresh (teal) value, at which point the
    // MutationObserver picks it up again.
    let s = el.getAttribute('style') || '';
    let changed = false;
    for (const { from, to } of COLOUR_MAP) {
      if (from.test(s)) {
        s = s.replace(from, to);
        changed = true;
      }
    }
    if (changed) {
      el.setAttribute('style', s);
      el.setAttribute(MARK_ATTR, '1');
    }
  });
}

let observer = null;

function apply() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);

  const badge = document.createElement('div');
  badge.id = BADGE_ID;
  badge.innerHTML = 'GREEN + GOLD PREVIEW <a href="?">Exit preview</a>';
  document.body.appendChild(badge);

  // Initial DOM walk + observer for anything React mounts later.
  patchInlineStyles(document.body);
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'style' && m.target instanceof Element) {
        patchInlineStyles(m.target.parentElement || document.body);
      }
      m.addedNodes.forEach((n) => {
        if (n instanceof Element) patchInlineStyles(n);
      });
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style'],
  });
}

function remove() {
  document.getElementById(STYLE_ID)?.remove();
  document.getElementById(BADGE_ID)?.remove();
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

export default function ThemePreviewOverride() {
  // Runs on every route change so `?preview=green-gold` can be added or
  // removed via any link without a full page reload.
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('preview') === 'green-gold') apply();
    else remove();
    return remove;
  }, [location.search]);

  return null;
}

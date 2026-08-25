/**
 * WCAG AA contrast for every category tile, measured rather than eyeballed.
 *
 * The rule these tiles exist to satisfy: a category label never sits on a
 * photograph. White text over imagery loses contrast even under a dark
 * overlay, and it fails unpredictably — per photo, per crop, per device.
 * Putting the label on a flat header makes its contrast a property of two
 * hex values, which is a thing a script can check.
 *
 * So this is the check. Run it after touching categoryTheme.js:
 *
 *     node scripts/check-tile-contrast.mjs
 *
 * Exits non-zero on any failure, so it can gate a commit.
 *
 * Thresholds are WCAG 2.1 AA: 4.5:1 for the label (normal text) and 3:1
 * for the icon (non-text graphic). The icon is measured against the body
 * colour rather than the white tile it sits on — the worst realistic case
 * if that tile's translucency ever changes.
 */
import { readFileSync } from 'node:fs';
const src = readFileSync('frontend/src/components/marketplace/categoryTheme.js', 'utf8');

const lum = (hex) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Brand primary, for the DEFAULT_THEME which uses the CSS var.
const BRAND_PRIMARY = '#1E5F8C';

const themes = [...src.matchAll(/^\s+'?([a-z0-9-]+)'?:\s*\{\s*\n\s*header:\s*'([^']+)',\s*body:\s*'([^']+)',\s*\n\s*icon:\s*'(\w+)',\s*iconColor:\s*'([^']+)'/gm)]
  .map((m) => ({ slug: m[1], header: m[2], body: m[3], icon: m[4], iconColor: m[5] }));

// The fallback is parsed separately because it is a named export rather
// than an entry in the map. It is checked deliberately: it is the theme an
// unrecognised category silently lands on, so it is the one nobody looks
// at. Hard-fail if its shape stops matching, rather than quietly reporting
// one fewer tile — a check that can skip its subject is not a check.
const def = src.match(
  /DEFAULT_THEME = \{\s*\n\s*header:\s*'([^']+)',\s*body:\s*'([^']+)',\s*\n\s*icon:\s*'(\w+)',\s*iconColor:\s*'([^']+)'/,
);
if (!def) {
  console.error('could not parse DEFAULT_THEME — check its shape in categoryTheme.js');
  process.exit(2);
}
themes.push({
  slug: 'DEFAULT_THEME',
  header: def[1] === 'var(--brand-primary)' ? BRAND_PRIMARY : def[1],
  body: def[2],
  icon: def[3],
  iconColor: def[4],
});

let fails = 0;
console.log('label = #FFFFFF on the header slab; icon on the body panel\n');
console.log('slug'.padEnd(26), 'label'.padEnd(9), 'icon');
for (const th of themes) {
  const labelR = ratio('#FFFFFF', th.header);
  // The icon sits on a white/70 tile over the body colour; worst realistic
  // case is the body colour itself showing through.
  const iconR = th.iconColor ? ratio(th.iconColor, th.body) : null;
  const labelOk = labelR >= 4.5;                 // AA, normal text
  const iconOk = iconR === null || iconR >= 3;   // AA, non-text graphic
  if (!labelOk || !iconOk) fails++;
  console.log(
    th.slug.padEnd(26),
    `${labelR.toFixed(2)} ${labelOk ? 'PASS' : 'FAIL'}`.padEnd(9),
    iconR === null ? '(no icon)' : `${iconR.toFixed(2)} ${iconOk ? 'PASS' : 'FAIL'}`,
  );
}
// --- the tiles that actually ship -------------------------------------
//
// CategoryCarousel is not mounted anywhere today: the Services hero's
// service picker replaced the "Browse by category" row (see the comment in
// pages/Services.jsx), leaving the component orphaned. So everything above
// guards a component in waiting.
//
// The category visual that DOES render is CoverPlaceholder — a tinted
// square with a line icon, standing in wherever a listing has no photo.
// Same rule, same check, and this half is the half a visitor sees.
const ph = readFileSync('frontend/src/components/common/CoverPlaceholder.jsx', 'utf8');
const tintBlock = ph.match(/const TINTS = \[([\s\S]*?)\];/);
if (!tintBlock) {
  console.error('could not parse TINTS out of CoverPlaceholder.jsx');
  process.exit(2);
}
const TINTS = [...tintBlock[1].matchAll(/'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1]);
const INK = '#23201B';
const ICON_ALPHA = 0.55; // the opacity the icon is drawn at

/** What the eye actually sees: `fg` at `alpha` composited onto `bg`. */
const over = (fg, bg, alpha) => {
  const px = (hex, i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16);
  const mix = (i) => Math.round(px(fg, i) * alpha + px(bg, i) * (1 - alpha));
  return `#${[0, 2, 4].map((i) => mix(i).toString(16).padStart(2, '0')).join('')}`;
};

console.log('\nCoverPlaceholder — ink icon at 55% over each tint');
for (const tint of TINTS) {
  const r = ratio(over(INK, tint, ICON_ALPHA), tint);
  const ok = r >= 3; // AA, non-text graphic
  if (!ok) fails++;
  console.log(' ', tint, `${r.toFixed(2)} ${ok ? 'PASS' : 'FAIL'}`);
}

console.log(
  `\n${themes.length} tiles + ${TINTS.length} placeholder tints checked, ${fails} failing`,
);
process.exit(fails ? 1 : 0);

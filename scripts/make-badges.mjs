#!/usr/bin/env node
/**
 * "Find us on MyIsraelRental" badges (Tzvi, 18 Oct 2026): what an upgraded
 * business puts on its own website, Instagram or flyer, linking to its page.
 * Every one of those is a mention of the business and of the site.
 *
 * Writes frontend/public/badge/find-us-{en,he}-{dark,light}.svg (for websites)
 * and the same as .png at 3x (for flyers and Instagram). The icon is
 * brand/logo-icon.svg, drawn inline. Re-run after changing the wording.
 *
 *   node scripts/make-badges.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'frontend', 'public', 'badge');
const require = createRequire(path.join(ROOT, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const W = 232;
const H = 64;
const THEMES = {
  dark: { bg: '#000000', border: '#000000', small: '#D1D5DB', big: '#FFFFFF' },
  light: { bg: '#FFFFFF', border: '#D1D5DB', small: '#4B5563', big: '#111827' },
};
const WORDS = { en: 'Find us on', he: 'מצאו אותנו ב-' };

function icon(x, y) {
  // brand/logo-icon.svg at 40px.
  return `<g transform="translate(${x} ${y}) scale(${40 / 120})">
    <rect x="4" y="4" width="112" height="112" rx="30" fill="#143C5A"/>
    <rect x="33" y="60" width="14" height="30" rx="6" fill="#7CA8C8"/>
    <rect x="53" y="44" width="14" height="46" rx="6" fill="#FFFFFF"/>
    <rect x="73" y="30" width="14" height="60" rx="6" fill="#C9A227"/>
  </g>`;
}

function svg(lang, theme) {
  const t = THEMES[theme];
  const rtl = lang === 'he';
  const iconX = rtl ? W - 12 - 40 : 12;
  const textX = rtl ? W - 64 : 64;
  const anchor = rtl ? 'end' : 'start';
  const font = rtl ? "Assistant, 'Segoe UI', Arial, sans-serif" : "Manrope, 'Segoe UI', Helvetica, Arial, sans-serif";
  const label = `${WORDS[lang]} MyIsraelRental`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
  <title>${label}</title>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.bg}" stroke="${t.border}"/>
  ${icon(iconX, 12)}
  <!-- In right-to-left text "start" is the right edge, so the Hebrew line
       anchors at start; the English name below anchors at end. -->
  <text x="${textX}" y="28" text-anchor="start" font-family="${font}" font-size="12" fill="${t.small}"${rtl ? ' direction="rtl"' : ''}>${WORDS[lang]}</text>
  <text x="${textX}" y="47" text-anchor="${anchor}" font-family="Manrope, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="${t.big}">MyIsraelRental</text>
</svg>
`;
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 3 });
for (const lang of ['en', 'he']) {
  for (const theme of Object.keys(THEMES)) {
    const name = `find-us-${lang}-${theme}`;
    const body = svg(lang, theme);
    fs.writeFileSync(path.join(OUT, `${name}.svg`), body);
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}</style></head><body>${body}</body></html>`);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } });
    console.log(`wrote ${name}.svg and .png`);
  }
}
await browser.close();

// Page builder v3, phase 1: the hero, checked in a browser, with
// before/after screenshots. Local only.
//
// "After" is a business switched to v3 (POST /api/marketplace/businesses/
// {id}/page-v3 {"on": true}, with PAGE_BUILDER_V3_ENABLED=1 in backend/.env);
// "before" is the same business's standard page. Defaults are the local
// L.A. Cholent copies from the owner walkthrough (rp-exp and rp-exp-1).
//
// Checks the must-pass rules phase 1 can already answer
// (docs/page-builder-design-rules.md, part 9): a hero with media (tier 3
// panel), the wordmark at least 96px on desktop and 56px on a phone, one
// filled accent button above the fold, no sideways scroll at 360 and 390,
// Hebrew in a Hebrew face, and the button's contrast.
//   Needs: local API on :8001, dev server on :3210
//   Run:   node scripts/check-page-v3.mjs [after-slug] [before-slug]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const WEB = 'http://localhost:3210';
const AFTER = process.argv[2] || 'rp-exp';
const BEFORE = process.argv[3] || 'rp-exp-1';
const OUT = 'screenshots/page-v3';
await mkdir(OUT, { recursive: true });

const fails = [];
const expect = (ok, msg) => { if (!ok) fails.push(msg); };
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844], [360, 800]]) {
  for (const lang of ['en', 'he']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const tag = `${lang}-${w}`;

    if (w !== 360) {
      await page.goto(`${WEB}/business/${BEFORE}?lng=${lang}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/before-${tag}.png` });
    }

    await page.goto(`${WEB}/business/${AFTER}?lng=${lang}`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="pv3-hero"]').waitFor({ timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const word = document.querySelector('[data-testid="pv3-wordmark"]');
      const btn = document.querySelector('[data-testid="pv3-primary"]');
      const ws = getComputedStyle(word);
      const filled = [...document.querySelectorAll('button, a')].filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom > innerHeight || r.width === 0) return false;
        const bg = getComputedStyle(el).backgroundColor;
        return bg === getComputedStyle(btn).backgroundColor;
      }).length;
      return {
        size: parseFloat(ws.fontSize), family: ws.fontFamily, dir: document.documentElement.dir,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        btnBg: rgb(getComputedStyle(btn).backgroundColor), btnFg: rgb(getComputedStyle(btn).color),
        filledAboveFold: filled, text: word.innerText,
      };
    });
    const need = w >= 1024 ? 96 : 56;
    expect(m.size >= need, `${tag}: wordmark ${m.size}px, needs ${need}px`);
    expect(!m.overflow, `${tag}: scrolls sideways`);
    expect(m.filledAboveFold === 1, `${tag}: ${m.filledAboveFold} filled accent buttons above the fold, expected 1`);
    expect(ratio(m.btnBg, m.btnFg) >= 4.5, `${tag}: button text ${ratio(m.btnBg, m.btnFg).toFixed(2)}:1`);
    if (lang === 'he') expect(m.dir === 'rtl', `${tag}: not right to left`);
    expect(!errs.length, `${tag}: page errors ${errs.join(' | ')}`);
    console.log(`${tag}: wordmark ${m.size}px "${m.text}" | ${m.family.split(',')[0]} | button ${ratio(m.btnBg, m.btnFg).toFixed(2)}:1 | filled above fold ${m.filledAboveFold}`);
    if (w !== 360) {
      await page.screenshot({ path: `${OUT}/after-${tag}.png` });
      await page.screenshot({ path: `${OUT}/after-${tag}-full.png`, fullPage: true });
    }
    await ctx.close();
  }
}
await b.close();
console.log(fails.length ? `\nFAILED:\n${fails.join('\n')}` : '\nall phase-1 checks passed');
process.exitCode = fails.length ? 1 : 0;

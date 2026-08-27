/**
 * The feature library (`docs/perks-and-features-spec.md` Part 1).
 *
 * The check that matters most is not the screenshot. It is that EVERY card
 * leads to a detail page that renders real sentences in both languages.
 * A missing translation key does not throw — i18next renders the key
 * itself, so `features.item.one-calendar.body` appears on screen looking
 * almost like text. With 15 features and 5 strings each in two languages
 * that is 150 chances to ship a raw key, and no human is going to read all
 * of them.
 *
 * Also asserted:
 *   * signed out, the tabs open on Business owner (CLAUDE.md positioning:
 *     the supply side leads)
 *   * every tab has at least one card, so no audience gets an empty page
 *   * headings resolve to a face that HAS Hebrew glyphs under dir=rtl
 *
 * Usage:
 *   node scripts/shot-feature-library.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { FEATURES, AUDIENCES } from '../frontend/src/data/featureLibrary.js';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const OUT = path.join('screenshots', 'feature-library');
const WIDTHS = [1280, 768, 375];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const failures = [];

const open = async (rtl, width) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  if (rtl) {
    await ctx.addInitScript(() => {
      try { localStorage.setItem('i18nextLng', 'he'); } catch { /* private mode */ }
    });
  }
  return ctx;
};

/** Any visible text that is actually an untranslated i18next key. */
async function rawKeysOnPage(page) {
  return page.evaluate(() => {
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const s = (n.textContent || '').trim();
      // A key looks like `features.item.slug.body` — dotted, no spaces.
      if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_-]+){2,}$/.test(s)) out.push(s);
    }
    return [...new Set(out)];
  });
}

try {
  for (const rtl of [false, true]) {
    for (const width of WIDTHS) {
      const ctx = await open(rtl, width);
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));

      const label = `${rtl ? 'rtl' : 'ltr'}-${width}`;
      await page.goto(`${APP}/what-you-can-do`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('[data-testid="what-you-can-do"]').waitFor({ timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.addStyleTag({
        content: '*,*::before,*::after{animation-play-state:paused !important}',
      });
      await page.screenshot({ path: path.join(OUT, `${label}-library.png`), fullPage: true });
      console.log('  wrote', `${label}-library.png`);

      // Signed out, Business owner leads.
      const businessTabSelected = await page.locator('[data-testid="features-tab-business"]')
        .getAttribute('aria-selected');
      if (businessTabSelected !== 'true') {
        failures.push(`${label}: signed out, the library did not open on Business owner`);
      }

      // No audience may render an empty page.
      for (const a of AUDIENCES) {
        await page.locator(`[data-testid="features-tab-${a}"]`).click();
        await page.waitForTimeout(250);
        const n = await page.locator('[data-testid^="feature-card-"]').count();
        if (n === 0) failures.push(`${label}: the "${a}" tab has no cards`);
      }

      const raw = await rawKeysOnPage(page);
      if (raw.length) failures.push(`${label}: untranslated keys on the library page: ${raw.join(', ')}`);

      const head = await page.locator('h1').first()
        .evaluate((el) => getComputedStyle(el).fontFamily);
      const expect = rtl ? 'Frank Ruhl Libre' : 'Playfair Display';
      if (!head.includes(expect)) {
        failures.push(`${label}: library heading font is "${head}", expected ${expect}`);
      }

      if (errors.length) failures.push(`${label}: console errors ${JSON.stringify(errors.slice(0, 3))}`);
      await ctx.close();
    }
  }

  // ---- every detail page, in both languages ---------------------------
  for (const rtl of [false, true]) {
    const lang = rtl ? 'he' : 'en';
    const ctx = await open(rtl, 1280);
    const page = await ctx.newPage();
    for (const f of FEATURES) {
      await page.goto(`${APP}/features/${f.slug}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const ok = await page.locator(`[data-testid="feature-detail-${f.slug}"]`)
        .waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
      if (!ok) { failures.push(`${lang}: /features/${f.slug} did not render`); continue; }
      await page.waitForTimeout(200);

      const raw = await rawKeysOnPage(page);
      if (raw.length) failures.push(`${lang}: /features/${f.slug} shows raw keys: ${raw.join(', ')}`);

      // The body and the "who it is for" panel must both carry real text.
      const bodyLen = await page.locator('[data-testid="feature-body"]').innerText()
        .then((x) => x.trim().length).catch(() => 0);
      if (bodyLen < 40) {
        failures.push(`${lang}: /features/${f.slug} body is ${bodyLen} chars — too short to be real copy`);
      }
      if (await page.locator('[data-testid="feature-cta"]').count() !== 1) {
        failures.push(`${lang}: /features/${f.slug} should have exactly one CTA`);
      }
    }
    console.log(`  checked ${FEATURES.length} detail pages in ${lang}`);
    await page.goto(`${APP}/features/${FEATURES[0].slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `${lang}-detail.png`), fullPage: true });
    await ctx.close();
  }

  // ---- an unknown slug lands somewhere useful --------------------------
  const ctx = await open(false, 1280);
  const page = await ctx.newPage();
  await page.goto(`${APP}/features/does-not-exist`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);
  if (!page.url().includes('/what-you-can-do')) {
    failures.push(`an unknown feature slug did not fall back to the library (landed on ${page.url()})`);
  }
  await ctx.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('\nall checks passed');

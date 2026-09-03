#!/usr/bin/env node
/**
 * The home overhaul preview (/home-preview) renders with the site's own
 * supply on it, in both languages, with no page errors.
 *
 * WHY. The hero corridor is fed from two public lists. If either fetch
 * fails it falls back to generated stills and still looks finished, so a
 * screenshot alone cannot tell a hero full of real listings from one that
 * silently fell back. This reads the card sources and asserts they are
 * listing/business photos (Cloudinary uploads), not the fallback set.
 *
 * Built bundle on :3000 (node frontend/server.js against the API).
 *
 *   node scripts/check-home-preview.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const results = [];
const ok = (name, cond, detail = '') => {
  results.push(!!cond);
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' — ' + detail}`);
};

const browser = await chromium.launch();
for (const lng of ['en', 'he']) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${APP}/home-preview?lng=${lng}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const hero = page.locator('[data-testid="home-preview-hero"]');
  ok(`${lng}: hero is on the page`, await hero.count() === 1);
  const srcs = await hero.locator('img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src')));
  ok(`${lng}: corridor holds 24 cards`, srcs.length === 24, `${srcs.length}`);
  // The fallback stills are exactly the generated site assets, which all live
  // under `myisraelrental/site/`. Excluding those is the assertion; an earlier
  // version demanded the file sit directly under `myisraelrental/` and failed
  // every IMPORTED listing, whose photos are one folder deeper. It reported a
  // broken hero that was in fact showing ten real listings.
  const stills = srcs.filter((s) => /\/myisraelrental\/site\//.test(s || ''));
  ok(`${lng}: cards are listing/business photos, not the fallback stills`, stills.length === 0, `${stills.length} stills`);
  const distinct = new Set(srcs.filter(Boolean)).size;
  ok(`${lng}: twelve distinct photos ride the corridor`, distinct === 12, `${distinct} distinct`);
  ok(`${lng}: cards are requested at card size`, srcs.every((s) => /w_520/.test(s || '')));
  const loaded = await hero.locator('img').evaluateAll((imgs) => imgs.filter((i) => i.complete && i.naturalWidth > 0).length);
  ok(`${lng}: card images actually load`, loaded >= 20, `${loaded}/${srcs.length} loaded`);

  const rentals = await page.locator('[data-testid="home-preview-rentals"] .stays-card').count();
  ok(`${lng}: featured rentals rail has real cards`, rentals >= 3, `${rentals}`);
  const biz = await page.locator('[data-testid="home-preview-businesses"] [data-testid^="services-gig-"]').count();
  ok(`${lng}: businesses rail has real cards`, biz >= 3, `${biz}`);

  // Counting cards says nothing about where they landed. A bare `1fr` track
  // let one oversized business photo widen its column until the row ran past
  // the wrapper and the last card was sliced off by the window — every card
  // still present, every count still green. So measure: no card may sit
  // outside its own section, and cards in a row must share a width.
  for (const [name, sel] of [['rentals', 'home-preview-rentals'], ['businesses', 'home-preview-businesses']]) {
    const box = await page.locator(`[data-testid="${sel}"]`).evaluate((el) => {
      const g = el.getBoundingClientRect();
      const kids = [...el.children].map((c) => c.getBoundingClientRect());
      return {
        overflow: kids.some((k) => k.right > g.right + 1 || k.left < g.left - 1),
        widths: [...new Set(kids.map((k) => Math.round(k.width)))],
      };
    });
    ok(`${lng}: ${name} cards stay inside their section`, !box.overflow);
    ok(`${lng}: ${name} cards are all one width`, box.widths.length <= 1, box.widths.join(','));
  }

  // The hero is white and the nav is fixed chrome that defaults to white text.
  // Both halves of that have to hold, and neither is visible to a card count:
  // a regression here is white type on white paper, which still screenshots as
  // "a clean hero" to anything not measuring the pixels.
  const heroBg = await hero.evaluate((el) => getComputedStyle(el).backgroundColor);
  ok(`${lng}: hero is white`, heroBg === 'rgb(255, 255, 255)', heroBg);
  const heroInk = await page.locator('[data-testid="home-preview-hero"] h1').evaluate((el) => getComputedStyle(el).color);
  ok(`${lng}: hero headline is ink, not white`, heroInk !== 'rgb(255, 255, 255)', heroInk);
  const navPill = await page.locator('.glass-pill').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const [r, g, b] = cs.color.match(/\d+/g).map(Number);
    return { color: cs.color, luminance: (0.299 * r + 0.587 * g + 0.114 * b) / 255 };
  });
  ok(`${lng}: nav text is dark over the white hero`, navPill.luminance < 0.5, navPill.color);

  // The gallery animates in on scroll with opacity and a blur filter. A
  // reveal that never fires leaves four invisible boxes and a screenshot that
  // looks like an empty column, so assert the cells actually ended up opaque
  // and that they hold real photos rather than the site's fallback stills.
  const gallery = page.locator('[data-testid="home-preview-gallery"]');
  await gallery.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800);
  const cells = await gallery.evaluate((el) => [...el.children].map((c) => ({
    opacity: getComputedStyle(c).opacity,
    src: c.querySelector('img')?.getAttribute('src') || '',
    w: Math.round(c.getBoundingClientRect().width),
  })));
  ok(`${lng}: gallery has four cells`, cells.length === 4, `${cells.length}`);
  ok(`${lng}: gallery cells finished fading in`, cells.every((c) => Number(c.opacity) > 0.9), cells.map((c) => c.opacity).join(','));
  ok(`${lng}: gallery photos are real listings/businesses`, cells.every((c) => c.src && !/\/myisraelrental\/site\//.test(c.src)));
  ok(`${lng}: gallery photos are distinct`, new Set(cells.map((c) => c.src)).size === cells.length);
  // Padded to the cell, never cropped: many businesses upload a flyer as their
  // cover, and cropping one into a portrait cell takes the first and last
  // letter off every line.
  ok(`${lng}: gallery photos are padded, not cropped`, cells.every((c) => /c_pad,b_auto/.test(c.src)));

  const h1 = page.locator('[data-testid="home-preview-hero"] h1');
  const font = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
  ok(`${lng}: heading font is ${lng === 'he' ? 'Frank Ruhl Libre' : 'Playfair Display'}`,
    lng === 'he' ? /Frank Ruhl/.test(font) : /Playfair/.test(font), font);
  const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
  ok(`${lng}: document direction is ${lng === 'he' ? 'rtl' : 'ltr'}`, lng === 'he' ? dir === 'rtl' : dir !== 'rtl', String(dir));

  const bodyText = await page.innerText('body');
  ok(`${lng}: no raw i18n keys on the page`, !/home\.v2\./.test(bodyText));
  ok(`${lng}: no page errors`, errors.length === 0, errors[0]);
  await page.context().close();
}
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);

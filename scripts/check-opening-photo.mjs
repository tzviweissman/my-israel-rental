#!/usr/bin/env node
/**
 * How much of a first screen is picture, measured on ANY page (Tzvi, 26 Nov 2026, "do all 3", after Bawk Bawk: he
 * picked a split opening on the design board that was about a third photo, and check-site's OPENING (3h.1: at least
 * 70% picture) only ran once the whole site was built, on index.html, after the pick). Run it on each of the three
 * first screens in gen/board/ before Tzvi picks one (build-business-page step 4), so a screen that cannot reach 70%
 * is changed or labelled on the board, never found after the pick.
 *
 * At 1440x900 and 390x844 it samples the first screen on a grid, as check-site does (video, canvas, img, picture or a
 * background image; a gradient is not a picture), twice: 0.6 s after load and again once the opening has settled
 * (3.5 s), and keeps the larger. An opening that turns or drops its photo in is judged where it lands.
 *
 *   node scripts/check-opening-photo.mjs <url> [more urls]      exit 1 when a page is under 70% at either size
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-opening-photo.mjs <url> [more urls]'); process.exit(2); }
const cover = () => {
  let hit = 0, n = 0;
  for (let x = 20; x < innerWidth; x += Math.max(40, innerWidth / 18)) for (let y = 70; y < innerHeight; y += Math.max(40, innerHeight / 12)) {
    n++; for (const e of document.elementsFromPoint(x, y)) {
      if (e === document.body || e === document.documentElement) break;
      const cs = getComputedStyle(e);
      if (+cs.opacity > .2 && (/^(VIDEO|CANVAS|IMG|PICTURE)$/.test(e.tagName) || (cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)))) { hit++; break; }
    }
  }
  return hit / n;
};
const browser = await chromium.launch();
let bad = 0;
for (const url of urls) {
  const parts = [];
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(600);
    const early = await page.evaluate(cover); await page.waitForTimeout(2900);
    const share = Math.max(early, await page.evaluate(cover));
    parts.push(`${w}x${h} ${Math.round(share * 100)}%`);
    if (share < .7) bad++;
    await page.close();
  }
  console.log(`${parts.some((p) => +p.split(' ')[1].slice(0, -1) < 70) ? 'UNDER' : 'ok   '}  ${url}: picture ${parts.join(', ')} (3h.1 asks 70% or more)`);
}
await browser.close();
process.exit(bad ? 1 : 0);

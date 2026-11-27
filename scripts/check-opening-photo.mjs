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
 * A split opening (two grounds, one above the other on a phone, side by side on a laptop) must have its product cross
 * the line on both sizes (Tzvi, 27 Nov 2026: "why in mobile is the platter not also some on the white and some on
 * orange"; the phone halves stacked and the platter sat wholly on cream). When the first screen shows two grounds, the
 * largest picture must stand on both, or the page fails as SPLIT.
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
// the ground behind a point, skipping pictures; the largest picture's two ends must stand on different grounds
const straddle = () => {
  const bg = (x, y) => { for (const e of document.elementsFromPoint(x, y)) { if (/^(IMG|VIDEO|CANVAS|PICTURE)$/.test(e.tagName)) continue;
    const c = getComputedStyle(e).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; } return ''; };
  const g = new Set(); for (let y = 80; y < innerHeight; y += 30) for (const x of [10, innerWidth - 10]) g.add(bg(x, y));
  g.delete(''); if (g.size < 2) return null;
  const im = [...document.querySelectorAll('img,video,canvas')].map((e) => [e, e.getBoundingClientRect()])
    .filter(([e, r]) => r.top < innerHeight && r.bottom > 0 && +getComputedStyle(e).opacity > .2).sort((a, b) => b[1].width * b[1].height - a[1].width * a[1].height)[0];
  if (!im) return null; const r = im[1], tall = innerWidth < innerHeight;
  const a = tall ? bg(r.left + r.width / 2, Math.max(r.top + 8, 70)) : bg(r.left + 8, r.top + r.height / 2);
  const b = tall ? bg(r.left + r.width / 2, Math.min(r.bottom - 8, innerHeight - 4)) : bg(r.right - 8, r.top + r.height / 2);
  return a !== b;
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
    const across = await page.evaluate(straddle);
    if (across === false) { bad++; console.log(`SPLIT  ${url} at ${w}x${h}: the picture stands on one ground only; place it across the line`); }
    parts.push(`${w}x${h} ${Math.round(share * 100)}%`);
    if (share < .7) bad++;
    await page.close();
  }
  console.log(`${parts.some((p) => +p.split(' ')[1].slice(0, -1) < 70) ? 'UNDER' : 'ok   '}  ${url}: picture ${parts.join(', ')} (3h.1 asks 70% or more)`);
}
await browser.close();
process.exit(bad ? 1 : 0);

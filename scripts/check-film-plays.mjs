#!/usr/bin/env node
/*
 * Every video that tries to play on an iPhone actually moves (25 Nov 2026: American Crust's phone loop was
 * "playing" at 0.00 s on every iPhone for a day, because Safari cannot decode 4:4:4 video). Correctness, not a design
 * rule, so publish-page runs it on every site, however old. check-iphone.mjs covers the slides openings in more depth.
 *
 *   node scripts/check-film-plays.mjs <url> [more urls]
 *
 * Opens each page in WebKit as an iPhone 13, waits 5 s without scrolling. Fails (exit 1):
 *   BROKEN  a video on the page reports a decode or source error
 *   STILL   a video that is not paused (it wants to play) has not passed 0.3 s
 */
import { webkit, devices } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-film-plays.mjs <url> [more urls]'); process.exit(2); }
const browser = await webkit.launch();
const problems = [];
for (const url of urls) {
  // "mir-check": the live site does not count this run as a visitor (utils/view_tracking.py)
  const ctx = await browser.newContext({ ...devices['iPhone 13'], userAgent: `${devices['iPhone 13'].userAgent} mir-check` });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  const vids = await page.evaluate(() => [...document.querySelectorAll('video')].map((v) => ({
    src: (v.currentSrc || v.getAttribute('src') || '').split('/').pop().split('?')[0], t: v.currentTime, paused: v.paused, err: v.error && v.error.code,
  })));
  for (const v of vids) {
    if (v.err) problems.push(`BROKEN  ${url}: ${v.src} cannot be played on an iPhone (media error ${v.err})`);
    else if (!v.paused && v.t < 0.3) problems.push(`STILL   ${url}: ${v.src} is playing but stood at ${v.t.toFixed(2)} s after 5 s on an iPhone`);
  }
  console.log(`${url}: checked`);
  await ctx.close();
}
await browser.close();
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('check-film-plays: ok');

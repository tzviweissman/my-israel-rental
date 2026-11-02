#!/usr/bin/env node
/**
 * A scroll-driven opening is smooth and long enough to see (page rules 3h, checklist R3h.20): SMOOTH and SLOW.
 * Moved out of check-site.mjs on 29 Oct 2026 so a site made before this rule is not held to it (Tzvi: "new rules
 * shouldnt affect already made sites"; publish-page runs it by its rule id, scripts/rule-dates.mjs). Only the home
 * page (index.html) is measured.
 *
 *   node scripts/check-opening-scroll.mjs <url> [more urls]        exit 1 on SMOOTH or SLOW
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-opening-scroll.mjs <url> [more urls]'); process.exit(2); }
const fails = [];
const fail = (url, kind, msg) => { fails.push(1); console.log(`${kind.padEnd(6)} ${msg}  (${url.replace(/\?.*$/, '')})`); };
const browser = await chromium.launch();

for (const url of urls) {
  if (!/\/(index\.html)?(\?.*)?$/.test(new URL(url).pathname + new URL(url).search)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(600);
  // SMOOTH and SLOW (Tzvi, 24-25 Oct 2026: Blazin' "the board flies in but not smoothly ... the effects and the pictures
  // are a little delayed"; Bun Intended "it moves too glitchy and quick for me to see the full effect clearly").
  // A scroll-driven opening (a sticky stage inside a taller section) gets at least 3 screens of scroll, and scrolling it
  // keeps frames under 20 ms (60 fps) with few stalls. Measured Blazin' at 33-83 ms with a blended full-screen overlay,
  // Bun Intended at 2 screens with 350 ms stalls.
  const motion = await page.evaluate(async () => {
    const sticky = [...document.querySelectorAll('body *')].find((e) => getComputedStyle(e).position === 'sticky' && e.getBoundingClientRect().top < innerHeight && e.offsetHeight > innerHeight * .6);
    const sec = sticky && sticky.parentElement;
    if (!sec) return null;
    const span = sec.offsetHeight, gaps = []; let last = performance.now(), run = true;
    (function f(t) { gaps.push(t - last); last = t; if (run) requestAnimationFrame(f); })(last);
    for (let y = 0; y <= span - innerHeight; y += 40) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 16)); }
    await new Promise((r) => setTimeout(r, 300)); run = false; scrollTo(0, 0);
    gaps.sort((x, y) => x - y);
    return { screens: span / innerHeight, median: gaps[gaps.length >> 1], slow: gaps.filter((g) => g > 50).length / gaps.length };
  });
  await page.waitForTimeout(600);
  if (motion && motion.screens < 3) fail(url, 'SLOW', `the scroll-driven opening is only ${motion.screens.toFixed(1)} screens long: give it at least 3 (about 4 to 4.5 for a story with several beats) so each step can be seen (3h)`);
  if (motion && (motion.median > 20 || motion.slow > 0.25)) fail(url, 'SMOOTH', `scrolling the opening runs at ${Math.round(1000 / motion.median)} fps with ${Math.round(motion.slow * 100)}% of frames stalled over 50 ms: needs 60 fps (frames under 20 ms). Look for full-screen blended or blurred overlays, per-frame canvas redraws, filters on moving images, and ease the shown progress toward the scroll (3h)`);
  await ctx.close();
  console.log(`${url.replace(/\?.*$/, '')}: checked`);
}
await browser.close();
if (fails.length) { console.error(`\n${fails.length} problem(s). Page rules 3h (R3h.20).`); process.exit(1); }
console.log('opening scroll: smooth and long enough');

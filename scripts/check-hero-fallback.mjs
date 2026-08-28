/**
 * No paused video is ever visible on the home page.
 *
 * iOS paints a large native play glyph over any <video> that is not playing.
 * Hiding the webkit pseudo-element does not reliably remove it, so the rule
 * enforced here is structural: if a video is not going to play, there must be
 * no video element to decorate — a real still shows instead.
 *
 * The case that shipped broken: with Reduce Motion enabled the hero kept
 * `autoPlay={false}` and stayed in the DOM, paused, wearing a play button.
 * The reduced-motion CSS only ever covered `.scene video`, never `.hero`.
 *
 * Usage: node scripts/check-hero-fallback.mjs
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const OUT = path.join('screenshots', 'hero-fallback');
await mkdir(OUT, { recursive: true });
const b = await chromium.launch();
const failures = [];

for (const rm of ['no-preference', 'reduce']) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: rm });
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);

  const state = await page.evaluate(() => {
    const vids = [...document.querySelectorAll('video')];
    const visiblePaused = vids.filter((v) => {
      const s = getComputedStyle(v);
      const r = v.getBoundingClientRect();
      const onScreen = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
      return v.paused && onScreen && s.display !== 'none'
        && s.visibility !== 'hidden' && Number(s.opacity) > 0.01;
    });
    const poster = document.querySelector('header.hero .media-poster');
    return {
      visiblePausedCount: visiblePaused.length,
      heroPosterPainted: !!poster
        && getComputedStyle(poster).backgroundImage !== 'none',
    };
  });

  if (state.visiblePausedCount > 0) {
    failures.push(`${rm}: ${state.visiblePausedCount} visible paused video(s) — iOS will draw a play button`);
  }
  if (!state.heroPosterPainted) {
    failures.push(`${rm}: the hero has no still behind it, so the fallback is a blank box`);
  }
  await page.screenshot({ path: path.join(OUT, `iphone-${rm}.png`) });
  console.log(`  ${rm.padEnd(14)} visible paused videos: ${state.visiblePausedCount}, hero still painted: ${state.heroPosterPainted}`);
  await ctx.close();
}
await b.close();

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('\nno paused video is visible in either motion setting');

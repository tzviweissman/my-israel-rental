/**
 * Scroll-stepped capture of the cinematic home page, app vs preview.
 *
 * A page of sticky pins has no meaningful "full page" screenshot — every
 * scene occupies the same viewport at a different scroll position, so
 * fullPage stitches together frames that never coexist. What matters is:
 * at the same scroll progress, does the app show the same frame as the
 * preview?
 *
 * That comparison is only valid because the page is deterministic by
 * construction: drive() is a pure function of scroll position, and the
 * villa's zoom-through resolves to a STILL rather than a video frame. Same
 * scrollTop must produce the same picture.
 *
 * Three things this does that a naive screenshot does not:
 *
 *  1. Computes scroll positions from each document's OWN geometry rather
 *     than assuming the two agree. If the app's scene is 340vh and the
 *     preview's is 320vh, progress .5 is a different pixel offset in each —
 *     and comparing those two by absolute scrollTop would silently diff
 *     frames that are supposed to differ.
 *  2. Waits two animation frames after scrolling. drive() runs on rAF, so
 *     one frame after a scroll the DOM still holds the previous frame's
 *     opacities — screenshots taken immediately are off-by-one and look
 *     like a timing bug in the engine.
 *  3. Freezes video deterministically: seeks every <video> to a fixed
 *     currentTime and pauses. Live playback means two runs of the same
 *     scroll position capture different frames, so every diff is "different"
 *     and the tool tells you nothing.
 *
 * Usage:
 *   node scripts/sweep-scenes.mjs             # app + preview, normal motion
 *   node scripts/sweep-scenes.mjs --reduced   # reduced-motion sweep
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const PREVIEW = pathToFileURL(path.resolve('cinematic-preview.html')).href;
const STOPS = [0, 0.25, 0.5, 0.75, 1];
const reduced = process.argv.includes('--reduced');
const OUT = path.join('screenshots', reduced ? 'sweep-reduced' : 'sweep');

/**
 * Replace every video with its own poster frame.
 *
 * Decoding five videos at once crashes the headless renderer outright
 * ("Target crashed"), and even when it survives, live playback means two
 * runs of the same scroll position capture different frames — so every diff
 * reads as a difference and the tool tells you nothing.
 *
 * Posters are the right answer rather than a workaround: this comparison is
 * about framing, caption timing and the zoom choreography, none of which
 * depend on which video frame is showing. The poster is also exactly what a
 * reduced-motion or slow-connection visitor sees, so the sweep doubles as a
 * check of that path.
 *
 * Detaching <source> and calling load() drops the decoder but keeps the
 * poster painted, which a plain pause() does not.
 */
const freezeVideos = (page) =>
  page.evaluate(async () => {
    document.querySelectorAll('video').forEach((v) => {
      try {
        v.pause();
        v.removeAttribute('autoplay');
        v.preload = 'none';
        v.querySelectorAll('source').forEach((s) => s.remove());
        v.removeAttribute('src');
        v.load(); // repaints the poster with no decoder attached
      } catch { /* nothing to detach */ }
    });
    // One frame for the poster to paint.
    await new Promise((r) => requestAnimationFrame(() => r()));
  });

/** Two rAFs: one for the scroll to land, one for drive() to apply it. */
const settleFrames = (page) =>
  page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );

async function sweep(browser, url, label) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  // NOT networkidle: five streaming MP4s keep the network busy forever, so
  // networkidle never fires and the whole sweep hangs. domcontentloaded plus
  // an explicit settle is both faster and actually terminates.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await freezeVideos(page);

  // Scene geometry from THIS document.
  const scenes = await page.evaluate(() =>
    [...document.querySelectorAll('[data-scene], section.scene')].map((s, i) => {
      const r = s.getBoundingClientRect();
      return {
        i,
        id: s.dataset.scene || s.id || `s${i}`,
        top: Math.round(r.top + window.scrollY),
        height: Math.round(r.height),
      };
    }),
  );
  const vh = await page.evaluate(() => window.innerHeight);

  for (const sc of scenes) {
    const total = sc.height - vh;
    if (total <= 0) continue;
    for (const p of STOPS) {
      const y = Math.round(sc.top + total * p);
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await settleFrames(page);
      // Re-freeze: an IntersectionObserver may have resumed playback as the
      // scene entered view.
      await freezeVideos(page);
      const name = `${label}-scene${sc.i}-${String(p).replace('0.', '')}.png`;
      await page.screenshot({ path: path.join(OUT, name) });
      console.log('  ', name);
    }
  }
  await ctx.close();
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  // Muted videos still need this in headless to paint rather than stay black.
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
try {
  console.log(reduced ? 'reduced-motion sweep:' : 'sweep — app:');
  await sweep(browser, APP, 'app');
  if (!reduced) {
    console.log('sweep — preview:');
    await sweep(browser, PREVIEW, 'preview');
  }
} finally {
  await browser.close();
}

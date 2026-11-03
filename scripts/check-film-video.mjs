#!/usr/bin/env node
/**
 * A scroll film plays as real video, led by the scroll (Tzvi, 3 Nov 2026, Krysp: "the motions dont look smooth" and
 * then "it still doesnt look so smooth like the video i sent you"; page rules 3h.22, checklist R3h.24).
 *
 * Scrubbing still frames stretches a film over several screens into slow motion: the recording showed 3 to 10 new
 * pictures a second, and blending neighbours only made it soft. The adverts he compared it with play at their own
 * speed. So every .film[data-frames] also names a video (data-video, "{k}" for d/m), and starter/film.js plays it
 * while the scroll is ahead, steers its speed to keep up, holds when the scroll stops and jumps back on the way up.
 *
 * On each page with a scroll film, laptop and phone, in real Chrome (Playwright's own Chromium cannot play H.264):
 *   VIDEO   the section names no data-video, or a named file does not load
 *   FOLLOW  scrolled steadily through the film in 12 s, the video is not playing, or its time is more than 0.5 s from
 *           where the scroll puts it, at a quarter, half and three quarters of the way
 * The site's own smooth scrolling is bypassed (behavior: instant), as a wheel or a finger would.
 *
 *   node scripts/check-film-video.mjs <url> [more urls]      exit 1 when a page fails; a page with no film passes
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-film-video.mjs <url> [more urls]'); process.exit(2); }
let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); }
let bad = 0;
for (const url of urls) {
  for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
    const p = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile })).newPage();
    await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(4000);
    const r = await p.evaluate(async () => {
      const f = document.querySelector('.film[data-frames]');
      if (!f) return { none: true };
      if (!f.dataset.video) return { why: ['VIDEO  the scroll film names no data-video: still frames alone play it as slow motion (3h.22)'] };
      const v = f.querySelector('video');
      if (!v) return { why: [`VIDEO  no video element (does film.js handle data-video? file ${f.dataset.video})`] };
      for (let i = 0; i < 40 && v.readyState < 3 && !v.error; i++) await new Promise((r) => setTimeout(r, 250));
      if (v.error || v.readyState < 3) return { why: [`VIDEO  ${v.currentSrc || v.src} did not load (${v.error ? v.error.code : 'not ready'})`] };
      const span = f.offsetHeight - innerHeight, dur = v.duration, t0 = performance.now(), why = [], seen = [];
      await new Promise((res) => {
        (function step() {
          const k = (performance.now() - t0) / 12000;
          scrollTo({ top: f.offsetTop + span * Math.min(1, k), behavior: 'instant' });
          for (const at of [0.25, 0.5, 0.75]) if (k >= at && !seen.includes(at)) {
            seen.push(at);
            const want = at * dur, off = Math.abs(v.currentTime - want);
            if (v.paused || off > 0.5) why.push(`FOLLOW at ${at * 100}% of the film the video is ${v.paused ? 'paused' : 'playing'} at ${v.currentTime.toFixed(2)} s, the scroll is at ${want.toFixed(2)} s`);
          }
          k < 1 ? requestAnimationFrame(step) : res();
        })();
      });
      return { why };
    });
    if (r.why && r.why.length) { bad++; console.log(`FILM  ${url} ${w}x${h}\n  ${r.why.join('\n  ')}`); }
  }
  console.log(`${url}: checked`);
}
await browser.close();
process.exit(bad ? 1 : 0);

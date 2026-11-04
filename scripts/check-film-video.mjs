#!/usr/bin/env node
/**
 * A scroll film plays as real video, led by the scroll (Tzvi, 3 Nov 2026, Krysp: "the motions dont look smooth" and
 * then "it still doesnt look so smooth like the video i sent you"; page rules 3h.22, checklist R3h.24).
 *
 * Scrubbing still frames stretches a film over several screens into slow motion: the recording showed 3 to 10 new
 * pictures a second, and blending neighbours only made it soft. The adverts he compared it with play at their own
 * speed. So every .film[data-frames] also names a video (data-video, "{k}" for d/m, every frame a keyframe), and
 * starter/film.js moves it to the eased scroll position each frame: in sync, and as smooth as the scroll.
 *
 * On each page with a scroll film, laptop and phone, in real Chrome (Playwright's own Chromium cannot play H.264):
 *   VIDEO   the section names no data-video, or a named file does not load
 *   FOLLOW  scrolled steadily through the film in 20 s, its time is more than 0.4 s from where the scroll puts it
 *   FREEZE  while the page scrolls, the film stands still more than 400 ms at once, or on more than 15% of frames
 * (4 Nov 2026: "it keeps freezing", "its not playing in sync with scrolling". A video played and steered to keep up stood
 * still 57% of the time on a slow scroll; one moved to the scroll position needs every frame a keyframe, -g 1, and a
 * server that answers Range requests: scripts/serve-builds.mjs did not, so every seek failed.)
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
      // scrolled steadily through the film in 20 s (a slow, reading pace: the hard case): sampled every frame from 10% to 90%
      const span = f.offsetHeight - innerHeight, dur = v.duration, t0 = performance.now(), why = [];
      let last = -1, lastMove = 0, longest = 0, lag = 0, n = 0, same = 0;
      await new Promise((res) => {
        (function step() {
          const now = performance.now(), k = (now - t0) / 20000;
          scrollTo({ top: f.offsetTop + span * Math.min(1, k), behavior: 'instant' });
          if (k > 0.1 && k < 0.9) {
            n++; lag = Math.max(lag, Math.abs(v.currentTime - k * dur));
            if (v.currentTime === last) same++; else { if (lastMove) longest = Math.max(longest, now - lastMove); lastMove = now; }
            if (!lastMove) lastMove = now;
          }
          last = v.currentTime; k < 1 ? requestAnimationFrame(step) : res();
        })();
      });
      if (lag > 0.4) why.push(`FOLLOW the film is up to ${lag.toFixed(2)} s away from where the scroll puts it (0.4 at most): not in sync`);
      if (longest > 400) why.push(`FREEZE the film stood still for ${Math.round(longest)} ms while the page scrolled (400 at most)`);
      if (n && same / n > 0.15) why.push(`FREEZE the film did not move on ${Math.round(same / n * 100)}% of frames while the page scrolled (15% at most)`);
      return { why };
    });
    if (r.why && r.why.length) { bad++; console.log(`FILM  ${url} ${w}x${h}\n  ${r.why.join('\n  ')}`); }
  }
  console.log(`${url}: checked`);
}
await browser.close();
process.exit(bad ? 1 : 0);

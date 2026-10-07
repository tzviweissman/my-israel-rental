// A preview video for the owner: scroll top to bottom at a reading pace,
// drawn frame by frame. Every frame is a function of its time: the page's
// clock (timers, requestAnimationFrame, Date), its CSS and Web animations,
// its videos and the scroll position are all set for that exact moment,
// then the frame is photographed. So it never stutters, however heavy the
// page, and two runs give the same pictures. (It replaced a live screen
// recording, 7 Oct 2026, which ran slow on heavy pages and was sped up
// afterwards to hide it.)
//
//   Run from the project folder (it uses that project's Playwright):
//   node ~/.claude/skills/build-business-page/scripts/record.mjs <url> <width> <height> <out.mp4> [seconds] [fps]
//   e.g. ... record.mjs http://localhost:4503/ 390 844 preview-phone.mp4 40
// seconds: the scroll itself (default 40); 2.5 s of the opening and 2.5 s
// at the end are added. fps defaults to 30. It also writes <out>-sheet.jpg,
// a contact sheet: look at it before sending the video.
// Needs ffmpeg on PATH (a phone plays the mp4; WhatsApp takes ~10 MB).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const [url, w, h, out] = [process.argv[2], Number(process.argv[3] || 390), Number(process.argv[4] || 844), process.argv[5] || 'preview.mp4'];
const secs = Number(process.argv[6] || 40);
// The old 7th argument was a speed-up (1.8); anything under 10 is that.
const fps = Number(process.argv[7]) >= 10 ? Number(process.argv[7]) : 30;
const HOLD = 2.5, dt = 1000 / fps;
const dir = mkdtempSync(join(tmpdir(), 'rec-'));

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 600 ? 2 : 1 });
// Media plays only when we say so: play() is noted, not started, and each
// frame moves a "playing" video on by exactly one frame. A video the page
// scrubs itself (setting currentTime from the scroll) is left to the page.
await ctx.addInitScript(() => {
  // Real timers, kept before the page clock replaces them (waits below are
  // for real things: a decoded video frame, a loaded picture).
  window.__wait = window.setTimeout.bind(window);
  const P = HTMLMediaElement.prototype;
  P.play = function () { this.__wants = true; this.dispatchEvent(new Event('play')); this.dispatchEvent(new Event('playing')); return Promise.resolve(); };
  const pause = P.pause; P.pause = function () { this.__wants = false; return pause.call(this); };
  Object.defineProperty(P, 'paused', { configurable: true, get() { return !this.__wants; } });
});
const p = await ctx.newPage();
// Chrome's own capture: Playwright's screenshot waits for a settled page
// each time (~0.75 s a frame); this takes the frame as drawn (~0.1 s).
const cdp = await ctx.newCDPSession(p);
await p.clock.install({ time: new Date('2026-01-01T09:00:00Z') });
await p.goto(url, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);

// One step of the page's own time, then everything that runs on its own is
// set for that moment, and we wait (in real time) until it is ready to draw.
async function step(ms) {
  await p.clock.runFor(ms);
  await p.evaluate(async (ms) => {
    const seen = (window.__rec ||= new WeakMap());
    for (const a of document.getAnimations()) {
      // A new animation starts at 0, not at however far real time took it.
      seen.set(a, seen.has(a) ? seen.get(a) + ms : 0);
      a.pause(); a.currentTime = seen.get(a);
    }
    const waits = [];
    for (const v of document.querySelectorAll('video')) {
      if (v.autoplay && v.__wants === undefined) v.__wants = true;
      if (v.readyState < 1) continue;
      if (v.__wants && v.__last === v.currentTime) {
        const d = v.duration || 0, next = v.currentTime + ms / 1000;
        v.currentTime = v.loop && d ? next % d : Math.min(next, d || next);
      }
      // Seeked is not painted: wait for the new picture itself.
      if (v.seeking) waits.push(new Promise((r) => {
        const done = () => (v.requestVideoFrameCallback ? (v.requestVideoFrameCallback(() => r()), __wait(r, 250)) : r());
        v.addEventListener('seeked', done, { once: true }); __wait(r, 1500);
      }));
      v.__last = v.currentTime;
    }
    // Pictures that came into view (lazy loading) must be in before the shot.
    for (const i of document.images) {
      const r = i.getBoundingClientRect();
      if (!i.complete && r.bottom > 0 && r.top < innerHeight) waits.push(i.decode().catch(() => {}));
    }
    await Promise.all(waits);
  }, ms);
}

// Let the page settle for real (network, the first layout) before frame 0.
await p.waitForLoadState('networkidle').catch(() => {});
await step(0);
const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const holdN = Math.round(HOLD * fps), scrollN = Math.round(secs * fps);
let n = 0;
const shot = async () => writeFileSync(join(dir, `${String(n++).padStart(5, '0')}.jpg`), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true })).data, 'base64'));
for (let i = 0; i < holdN; i++) { await step(dt); await shot(); }
for (let i = 1; i <= scrollN; i++) {
  const t = i / scrollN, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  await p.evaluate((y) => scrollTo(0, y), Math.round(max * (0.15 * t + 0.85 * e)));
  await step(dt); await shot();
}
for (let i = 0; i < holdN; i++) { await step(dt); await shot(); }
await ctx.close(); await b.close();

execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', join(dir, '%05d.jpg'),
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-crf', '21', '-preset', 'slow',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]);
const every = Math.max(1, Math.floor(n / 12));
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', out, '-vf', `select=not(mod(n\\,${every})),scale=-2:540,tile=6x2`,
  '-frames:v', '1', out.replace(/\.mp4$/i, '') + '-sheet.jpg']);
rmSync(dir, { recursive: true, force: true });
console.log(`wrote ${out} (${n} frames at ${fps} fps) and its contact sheet`);

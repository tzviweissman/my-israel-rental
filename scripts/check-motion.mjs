#!/usr/bin/env node
/**
 * Choices that change the page change it smoothly, and to the right colour
 * (Tzvi, 20 Oct 2026, on Nails by Elisheva: "it's not switching smoothly",
 * "the page doesn't match the nail colour", then "should the site checker
 * catch something like that"). The other checks look at still pictures, so a
 * switch that jumps, flashes a blank frame, or lands on the wrong colour
 * passed all of them.
 *
 *   node scripts/check-motion.mjs <url> [more urls]
 *
 * On each page it taps the choices a visitor taps (buttons with aria-pressed:
 * shades, flavours, sizes), records the screen in real time at 25 fps, and
 * fails:
 *   JUMP   more than 55% of a switch's change happens between two frames
 *          (an instant swap; a crossfade or spread is spread over many)
 *   FLASH  a frame in the middle of a switch looks like neither the start nor
 *          the end (a blank, or the old picture coming back)
 *   COLOUR the choice recolours the page (its colour is in --c or its own
 *          background) and the page ground ends up a different hue
 * It also taps two choices 250 ms apart: the second must not be ignored and
 * must not flash. Exit 1 on any. Run from the repo (it uses its Playwright).
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { chromium } = createRequire(process.cwd() + '/')('playwright');

const W = 1280, H = 800, SW = 96, SH = 60, FPS = 25;
const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-motion.mjs <url> [more urls]'); process.exit(2); }

function frames(video) {
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', video, '-vf', `fps=${FPS},scale=${SW}:${SH}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
  const buf = r.stdout, n = SW * SH * 3, out = [];
  for (let i = 0; i + n <= buf.length; i += n) out.push(buf.subarray(i, i + n));
  return out;
}
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
function hue(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return [0, 0];
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, d / (1 - Math.abs(mx + mn - 1) || 1)]; }

let bad = 0;
for (const url of urls) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(1500);
  const n = await page.evaluate(() => {
    // every group of choices on the page, wherever it sits (a long pinned opening once hid Noa Levi's rooms
    // below the first three screens): up to three choices from each group (one may already be chosen), nine at most
    const seen = new Map(), bs = [];
    for (const b of document.querySelectorAll('button[aria-pressed]')) { const r = b.getBoundingClientRect(); if (!r.width) continue;
      const g = b.parentElement, c = seen.get(g) || 0; if (c < 3 && bs.length < 9) { seen.set(g, c + 1); bs.push(b); } }
    bs.forEach((b, i) => b.setAttribute('data-motion-i', i)); return bs.length;
  });
  const taps = [];
  const order = [...Array(n).keys()].reverse();
  for (const i of order) {
    const pressed = await page.evaluate((i) => document.querySelector(`[data-motion-i="${i}"]`).getAttribute('aria-pressed'), i);
    if (pressed === 'true') continue;
    await page.evaluate((i) => { const b = document.querySelector(`[data-motion-i="${i}"]`); document.documentElement.style.scrollBehavior = 'auto'; b.scrollIntoView({ block: 'center', behavior: 'instant' }); }, i);
    await page.waitForTimeout(500);
    const colour = await page.evaluate((i) => { const b = document.querySelector(`[data-motion-i="${i}"]`); const cs = getComputedStyle(b);
      const c = b.style.getPropertyValue('--c') || ''; return c.trim() || cs.backgroundColor; }, i);
    const at = Date.now() - t0;
    await page.evaluate((i) => document.querySelector(`[data-motion-i="${i}"]`).click(), i);
    await page.waitForTimeout(1900);
    taps.push({ i, at, colour, label: await page.evaluate((i) => { const b = document.querySelector(`[data-motion-i="${i}"]`); return b.getAttribute('aria-label') || b.textContent.trim().slice(0, 30); }, i) });
  }
  // two taps in quick succession
  let rapid = null;
  // the two quick taps use choices tapped above, so the first one's settled look (B) is known
  const free = taps.map((t) => t.i).slice(-2);  // now on the last one: tap the one before it, then the last again
  if (free.length === 2) {
    // the same scroll as when the first choice was measured, so its settled look (B) lines up with these frames
    await page.evaluate((i) => document.querySelector(`[data-motion-i="${i}"]`).scrollIntoView({ block: 'center', behavior: 'instant' }), free[0]);
    await page.waitForTimeout(700);
    const at = Date.now() - t0;
    await page.evaluate(([a, b]) => { document.querySelector(`[data-motion-i="${a}"]`).click(); setTimeout(() => document.querySelector(`[data-motion-i="${b}"]`).click(), 250); }, free);
    await page.waitForTimeout(2200); rapid = { at };
  }
  await ctx.close(); await browser.close();
  const video = fs.readdirSync(dir).filter((f) => f.endsWith('.webm')).map((f) => path.join(dir, f))[0];
  const fr = frames(video);
  const fi = (ms) => Math.max(0, Math.min(fr.length - 1, Math.round(ms / 1000 * FPS)));
  const judge = (from, to, label) => {
    const a = fi(from - 120), z = fi(to);
    const total = diff(fr[a], fr[z]); if (total < 1.5) return [];
    let steps = 0, maxStep = 0, out = [];
    for (let k = a + 1; k <= z; k++) { const s = diff(fr[k - 1], fr[k]); steps += s; maxStep = Math.max(maxStep, s); }
    if (steps && maxStep / steps > 0.55 && maxStep > 3) out.push(`JUMP ${label}: ${Math.round(maxStep / steps * 100)}% of the change in one frame (make it a crossfade or a spread)`);
    for (let k = a + 1; k < z; k++) { const d = diff(fr[k], fr[a]) + diff(fr[k], fr[z]); if (d > total * 1.6 + 4) { out.push(`FLASH ${label}: a frame ${Math.round((k - a) / FPS * 1000)} ms in looks like neither the start nor the end`); break; } }
    return out;
  };
  for (const t of taps) {
    const found = judge(t.at, t.at + 1800, `tapping "${t.label}"`);
    // the page ground after the switch: a strip at the left edge, a third down (behind the content)
    const f = fr[fi(t.at + 1800)], px = (x, y) => { const o = (y * SW + x) * 3; return [f[o], f[o + 1], f[o + 2]]; };
    const m = (t.colour.match(/\d+(\.\d+)?/g) || []).map(Number), hex = t.colour.match(/#([0-9a-f]{6})/i);
    const c = hex ? [0, 2, 4].map((j) => parseInt(hex[1].slice(j, j + 2), 16)) : m.slice(0, 3);
    const changed = diff(fr[fi(t.at - 120)], f) > 4;
    if (c.length === 3 && changed) {
      const g = px(1, Math.round(SH * .35)), [hc, sc] = hue(...c), [hg, sg] = hue(...g);
      const dh = Math.min(Math.abs(hc - hg), 360 - Math.abs(hc - hg));
      if (sc > .25 && sg > .06 && dh > 40) found.push(`COLOUR tapping "${t.label}": the page ground is hue ${Math.round(hg)}, the choice is hue ${Math.round(hc)}`);
      if (sc > .25 && sg <= .06) found.push(`COLOUR tapping "${t.label}": the choice is a colour but the page ground stays grey or white`);
    }
    for (const x of found) { bad += 1; console.log(`${x}  (${url})`); }
  }
  // two quick taps: the first choice showing for a moment is right; a frame that is between none of the
  // three states (before, the first choice, the second) is a blank or an old picture coming back
  if (rapid) {
    const A = fr[fi(rapid.at - 120)], C = fr[fi(rapid.at + 2100)];
    const first = taps.find((t) => t.i === free[0]); const B = first ? fr[fi(first.at + 1800)] : null;
    const near = (f, x, y) => diff(f, x) + diff(f, y) <= diff(x, y) * 1.6 + 4;
    for (let k = fi(rapid.at) + 1; k < fi(rapid.at + 2100); k++) {
      const f = fr[k];
      if (!near(f, A, C) && !(B && (near(f, A, B) || near(f, B, C)))) { bad += 1; console.log(`FLASH two choices tapped 250 ms apart: a frame ${Math.round((k - fi(rapid.at)) / FPS * 1000)} ms in is between none of the states  (${url})`); break; }
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${url}: ${taps.length} choices tapped${rapid ? ', and two in quick succession' : ''}`);
}
if (bad) { console.error(`\n${bad} motion problem(s). A choice must change the page smoothly, with no blank or old frame, to its own colour.`); process.exit(1); }
console.log('motion: every choice switches smoothly');

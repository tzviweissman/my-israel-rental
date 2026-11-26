#!/usr/bin/env node
/**
 * One picture of a whole page, screen by screen at a laptop size (1280x800), left to right in rows of four, so a
 * review starts from what the visitor sees rather than from the code (17 Nov 2026: comparing eight sites side by
 * side showed in one look that every site had the same menu bar, steps and closing band; until then there was no
 * such picture and a script had to be written for it). publish-page writes it for every check, as
 * <build>/screens.jpg; it never blocks a publish.
 *
 *   node scripts/screen-strip.mjs <url> <out.jpg> [max screens, default 16]
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const [url, out, maxArg] = process.argv.slice(2);
if (!url || !out) { console.error('usage: node scripts/screen-strip.mjs <url> <out.jpg> [max screens]'); process.exit(2); }
const MAX = Number(maxArg) || 16, W = 1280, H = 800;
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: W, height: H } });
await p.goto(url, { waitUntil: 'load', timeout: 60000 });
await p.waitForTimeout(1200);
// the first screen is taken once its arrival has finished, not part way through it (25 Nov 2026: judges scored a
// half-arrived opening as dim); endless animations are skipped, and the wait never runs past 8 s
const settle = (ms) => p.evaluate((ms) => Promise.race([
  Promise.all(document.getAnimations().filter((a) => { const t = a.effect?.getComputedTiming?.(); return t && Number.isFinite(t.endTime); }).map((a) => a.finished.catch(() => {}))),
  new Promise((r) => setTimeout(r, ms)),
]), ms).catch(() => {});
await settle(8000);
// each screen starts where a section starts, just under the fixed menu bar, as a visitor stops there (20 Nov 2026: cut
// at even steps, a judge read "headings clipped under the menu bar" that were only the sheet's cuts); a section taller
// than the screen gets a further stop every screen. Too many stops: an even sample of them.
const stops = await p.evaluate((H) => {
  const bar = [...document.querySelectorAll('header, nav, .top')].find((e) => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().top <= 0);
  const barH = bar ? bar.getBoundingClientRect().height : 0, max = document.documentElement.scrollHeight - innerHeight;
  const root = document.querySelector('main') || document.body, out = [0];
  for (const el of [...root.children, document.querySelector('footer')].filter(Boolean)) {
    if (el.offsetHeight < 60 || getComputedStyle(el).position === 'fixed') continue;
    const top = el.getBoundingClientRect().top + scrollY - barH;
    for (let y = top; y < top + el.offsetHeight - 80; y += H - barH) out.push(Math.max(0, Math.min(max, Math.round(y))));
  }
  return [...new Set(out)].sort((a, b) => a - b).filter((y, i, a) => !i || y - a[i - 1] > 120);
}, H);
const n = Math.min(MAX, stops.length);
const pick = stops.length <= MAX ? stops : Array.from({ length: n }, (_, i) => stops[Math.round((i * (stops.length - 1)) / (n - 1))]);
const shots = [];
for (const y of pick) {
  await p.evaluate((y) => window.scrollTo(0, y), y);
  // and every later screen once what its scroll started has finished (26 Nov 2026: Clean Plus's map was taken before its
  // route had drawn, and two judges called it "small and dim"); 600 ms first so scroll-started animations exist
  await p.waitForTimeout(600); await settle(7000);
  shots.push((await p.screenshot({ type: 'jpeg', quality: 70 })).toString('base64'));
}
// lay them out on a plain page and photograph that: no image library needed
const cols = 4, tw = 480, th = 300;
const sheet = await browser.newPage({ viewport: { width: cols * (tw + 8) + 8, height: Math.ceil(n / cols) * (th + 8) + 8 } });
await sheet.setContent(`<body style="margin:0;padding:4px;background:#111;display:flex;flex-wrap:wrap">${shots.map((b, i) =>
  `<div style="position:relative;margin:4px"><img src="data:image/jpeg;base64,${b}" style="width:${tw}px;height:${th}px;display:block"><b style="position:absolute;left:6px;top:4px;font:12px sans-serif;color:#fff;background:#000a;padding:1px 5px">${i + 1}</b></div>`).join('')}</body>`);
await sheet.screenshot({ path: out, type: 'jpeg', quality: 80, fullPage: true });
await browser.close();
console.log(`${out}: ${n} screens of ${url}`);

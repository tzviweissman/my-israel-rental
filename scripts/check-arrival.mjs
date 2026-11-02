#!/usr/bin/env node
/**
 * A home page with no scroll film arrives in a set order (Tzvi, 29 Oct 2026, rules 3u.5, from Kyle Skelly's
 * video m491R3ewNgE: bar, headline, line, picture, button, about 1.5 s, once). Fails a home page whose first
 * screen is the same just after it loads and 2 s later (nothing arrived), or whose headline is still not
 * fully there at 2.5 s. Pages other than the home page, and home pages opening on a film or a pinned scroll scene, are skipped.
 *
 *   node scripts/check-arrival.mjs <url> [more urls]      exit 1 on a still first screen
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2).filter((u) => /\/(index\.html)?(\?.*)?$/.test(u));
const browser = await chromium.launch();
const reader = await browser.newPage();
const diff = (a, b) => reader.evaluate(async ([a, b]) => {
  const px = async (b64) => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = 160; c.height = Math.round(160 * im.height / im.width);
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height); return x.getImageData(0, 0, c.width, c.height).data; };
  const [p, q] = [await px(a), await px(b)]; let s = 0;
  for (let k = 0; k < p.length; k += 4) s += Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]);
  return s / (p.length / 4) / 3;
}, [a, b]);
let bad = 0;
for (const url of urls) {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    if (await p.evaluate(() => !![...document.querySelectorAll('canvas, .film, [data-film], [data-sc-act="pin"]')].some((e) => e.getBoundingClientRect().top < innerHeight) || [...document.querySelectorAll('video:not([loop])')].some((v) => v.getBoundingClientRect().top < innerHeight))) { console.log(`${url}: opens on a film, not checked`); await p.close(); break; }
    await p.waitForTimeout(100);
    const first = (await p.screenshot({ type: 'jpeg', quality: 70 })).toString('base64');
    await p.waitForTimeout(1900);
    const later = (await p.screenshot({ type: 'jpeg', quality: 70 })).toString('base64');
    await p.waitForTimeout(500);
    const head = await p.evaluate(() => { const e = document.querySelector('h1'); if (!e) return 1; let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; });
    const d = await diff(first, later);
    if (d < 1.5) { bad++; console.log(`STILL  ${url} ${w}x${h}: the first screen does not arrive, it is the same at 0.1 s and 2 s (rules 3u.5)`); }
    if (head < 0.99) { bad++; console.log(`LATE   ${url} ${w}x${h}: the headline is still not fully there at 2.5 s (rules 3u.5)`); }
    await p.close();
  }
  console.log(`${url}: checked`);
}
await browser.close();
console.log(bad ? `arrival: ${bad} problem(s)` : 'arrival: the first screen arrives in order');
process.exit(bad ? 1 : 0);

#!/usr/bin/env node
/**
 * A home page opening on a film (rules 3an.5, 3an.6; Tzvi, 27 Nov 2026: "All 3", from the Awwwards motion study,
 * docs/inspo/awwwards-2026-11-27/motion). check-arrival.mjs skips these pages; this checks them.
 *   STILL  the first screen is the same at 0.1 s and 2 s on a laptop or a phone: nothing arrived before a scroll
 *   LATE   on a laptop, the headline on the first screen is still not all there at 2.5 s
 *   CUT    on a laptop the film scrolls away with the section after it, instead of that section sliding over it
 * Pages other than the home page, and home pages with no film, are skipped.
 *
 *   node scripts/check-film-arrival.mjs <url> [more urls]      exit 1 on a problem
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2).filter((u) => /\/(index\.html)?(\?.*)?$/.test(u));
const browser = await chromium.launch();
const reader = await browser.newPage();
// mean colour difference of two screenshots, 0 to 255 (as check-arrival.mjs)
const diff = (a, b) => reader.evaluate(async ([a, b]) => {
  const px = async (b64) => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = 160; c.height = Math.round(160 * im.height / im.width);
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height); return x.getImageData(0, 0, c.width, c.height).data; };
  const [p, q] = [await px(a), await px(b)]; let s = 0;
  for (let k = 0; k < p.length; k += 4) s += Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]);
  return s / (p.length / 4) / 3;
}, [a, b]);
const FILM = '.film, [data-film], #film';
let bad = 0;
for (const url of urls) {
  let film = true;
  for (const [w, h] of [[1366, 800], [390, 844]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    film = await p.evaluate((F) => [...document.querySelectorAll(F)].some((e) => e.getBoundingClientRect().top < innerHeight), FILM);
    if (!film) { await p.close(); break; }
    const look = async () => {
      await p.waitForTimeout(100);
      const first = (await p.screenshot({ type: 'jpeg', quality: 70 })).toString('base64');
      await p.waitForTimeout(1900);
      const later = (await p.screenshot({ type: 'jpeg', quality: 70 })).toString('base64');
      await p.waitForTimeout(500);
      const head = await p.evaluate(() => { const e = [...document.querySelectorAll('h1')].find((x) => { const r = x.getBoundingClientRect(); return r.height && r.top < innerHeight; });
        if (!e) return 1; let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; });
      return [await diff(first, later), head];
    };
    let [d, head] = await look();
    // a busy machine can take the 0.1 s picture after the arrival has finished: one more fresh load before failing
    if (d < 1.5) { await p.goto(url, { waitUntil: 'domcontentloaded' }); [d, head] = await look(); }
    if (d < 1.5) { bad++; console.log(`STILL  ${url} ${w}x${h}: the film opening stands still, the first screen is the same at 0.1 s and 2 s (rules 3an.5)`); }
    // on a phone the film plays by itself and its words wait for its end (3ac.1, 3h.25), so the headline is timed on a laptop only
    if (head < 0.99 && w > 760) { bad++; console.log(`LATE   ${url} ${w}x${h}: the headline is still not all there at 2.5 s (rules 3an.5)`); }
    if (w > 760) {
      // scroll to where the section after the film has risen half a screen, and see whether the film is still in place under it
      const cut = await p.evaluate(async (F) => {
        const f = [...document.querySelectorAll(F)].find((e) => e.offsetHeight > innerHeight * 1.2); const next = f && f.nextElementSibling;
        if (!next) return null;
        const at = () => scrollY + next.getBoundingClientRect().top - innerHeight / 2;
        scrollTo({ top: at(), behavior: 'instant' }); await new Promise((r) => setTimeout(r, 400));
        scrollTo({ top: at(), behavior: 'instant' }); await new Promise((r) => setTimeout(r, 400));
        const stage = f.querySelector('.stage') || f, top = stage.getBoundingClientRect().top;
        const hit = document.elementFromPoint(innerWidth / 2, innerHeight * 0.75);
        return { top: Math.round(top), over: !!hit && !f.contains(hit) };
      }, FILM);
      if (cut && (cut.top < -20 || !cut.over)) { bad++; console.log(`CUT    ${url} ${w}x${h}: the film scrolls away with the next section (its picture at ${cut.top} px) instead of that section sliding over it; mark it data-over (rules 3an.6)`); }
    }
    await p.close();
  }
  console.log(film ? `${url}: checked` : `${url}: no film opening, not checked (check-arrival)`);
}
await browser.close();
console.log(bad ? `film arrival: ${bad} problem(s)` : 'film arrival: the film opening arrives and hands over');
process.exit(bad ? 1 : 0);

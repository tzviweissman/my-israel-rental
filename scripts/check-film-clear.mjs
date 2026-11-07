#!/usr/bin/env node
/**
 * Nothing sits over a scroll film while it plays (page rules 3h.5 and 3h.17, checklist R3h.25; Tzvi, 4 Nov 2026, Krysp:
 * "this is blocking a lot of the action we want it to be wow they need to be able to see the different textures and the
 * stuff flowing around", then "dont we have a rule already about blocking the film?"). We did: 3h.5 says words are never
 * over the action and 3h.17 that words and film take turns, but both were LOOK lines and passed on a laptop where the
 * headline card covered the top of the film and the giant name its foot. check-photo-clear only measures phones.
 *
 *   node scripts/check-film-clear.mjs <url> [more urls]
 *
 * On a page with a .film, at 1440x900 and 390x844, scrolled to 20%, 40% and 60% of the film (its action, before any
 * closing words): the film's picture (video or canvas) is screenshotted as the page shows it and with everything but the
 * picture hidden. If words, cards, shades or names change more than 3% of the film's area, it fails (a small Order pill at the foot, about 4%, fails too) (a first version
 * counted only detailed pixels, as check-photo-clear does, and passed Krysp's covering card: it sat on the plain ground
 * the ingredients swirl through). The site's own bar above the film is not over it and is not counted. Exit 1 on a covered film.
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');

const SIZES = [[1440, 900, false], [390, 844, true]], AT = [0.2, 0.4, 0.6], MAX_COVERED = 0.03;
const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-film-clear.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
const cmp = await browser.newPage();
// share of the film's picture that the page's other pieces change
const covered = (a, b) => cmp.evaluate(async ([a, b]) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
  const da = px(ia), db = px(ib), W = ia.width, H = ia.height;
  // every pixel counts, not only the detailed ones: what flows round the product crosses the plain ground too
  let n = 0;
  for (let k = 0; k < da.length; k += 4) if (Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2])) > 24) n++;
  return n / (W * H);
}, [a.toString('base64'), b.toString('base64')]);

let bad = 0;
for (const url of urls) {
  for (const [w, h, mobile] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(2500);
    if (!(await page.$('.film'))) { await page.close(); continue; }
    for (const at of AT) {
      const clip = await page.evaluate(async (at) => {
        const f = document.querySelector('.film');
        scrollTo({ top: f.offsetTop + (f.offsetHeight - innerHeight) * at, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 900));
        // a video film eases to the new spot: wait until it has stopped (up to 5 s more), or a busy machine photographs
        // it still moving and the motion counts as cover (RBS Cleaning, 7 Nov 2026: 6% and 25% "covered", no card shown)
        const v = f.querySelector('video');
        for (let i = 0, last = -1, still = 0; v && i < 50 && still < 3; i++) {
          await new Promise((r) => setTimeout(r, 100));
          still = !v.seeking && v.currentTime === last ? still + 1 : 0; last = v.currentTime;
        }
        const pics = [...f.querySelectorAll('video, canvas')].filter((e) => getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.5);
        const el = pics.pop(); if (!el) return null;
        document.querySelectorAll('[data-film-clear]').forEach((e) => e.removeAttribute('data-film-clear')); el.setAttribute('data-film-clear', '');
        const r = el.getBoundingClientRect(), x0 = Math.max(r.left, 0), y0 = Math.max(r.top, 0);
        return { x: x0, y: y0, width: Math.min(r.right, innerWidth) - x0, height: Math.min(r.bottom, innerHeight) - y0 };
      }, at);
      if (!clip || clip.width * clip.height < 1000) continue;
      const full = await page.screenshot({ clip, animations: 'disabled' });
      const hide = await page.addStyleTag({ content: '*, *::before, *::after { visibility: hidden !important; transition: none !important; } [data-film-clear], header.top, header.top * { visibility: visible !important; }' });
      const alone = await page.screenshot({ clip, animations: 'disabled' });
      await hide.evaluate((s) => s.remove());
      const c = await covered(full, alone);
      if (c > MAX_COVERED) { bad++; console.log(`COVERED ${w}x${h} ${url} at ${at * 100}% of the film: words, cards and names cover ${Math.round(c * 100)}% of its picture; at most ${MAX_COVERED * 100}% while it plays`); }
    }
    await page.close();
  }
  console.log(`${url}: checked`);
}
await browser.close();
if (bad) { console.error(`\n${bad} moment(s) where the film is covered (page rules 3h.5, 3h.17). Let the words wait until the film has played, or put them beside or under it.`); process.exit(1); }

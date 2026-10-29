#!/usr/bin/env node
/**
 * On a phone the opening photo is seen, not covered (page rules 5b.3). Rule
 * 5b.3 already said words sit on a photo with only a soft edge shade, but
 * nothing measured how much of the photo that left: on Nails by Elisheva the
 * words and a tan shade 92% tall covered her nails on a phone, and readable.mjs
 * passed it because the words themselves were readable (Tzvi, 28 Oct 2026: "hard
 * to actually see her work in the photo ... covered by words and especially the
 * tan colour").
 *
 *   node scripts/check-photo-clear.mjs <url> [more urls]
 *
 * At 390x844 and 360x640, the biggest photo, video or film canvas on the first
 * screen (if it fills at least a quarter of it) is screenshotted twice: as the
 * page shows it, and with everything except that picture hidden. Only the
 * picture's detail counts (its edges and textures: the product, the work), so
 * words on a plain ground or a plain backdrop are fine. If words, shades, tints
 * or cards change more than 40% of that detail, it fails. On the sheet in
 * docs/inspo/photo-clear-sheet.png this failed Elisheva's old opening (47%) and
 * passed her new one (0%) and The Brown Box (32-37%). A picture with almost no
 * detail (under 1.5% of its pixels, a plain backdrop or a paper texture) is a
 * ground, not a photo of anything, and is not checked. There is no attribute to
 * skip it. Exit 1 on a covered picture.
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');

const PHONES = [[390, 844], [360, 640]];
const MAX_COVERED = 0.40, MIN_DETAIL = 0.015;
const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-photo-clear.mjs <url> [more urls]'); process.exit(2); }

const browser = await chromium.launch();
const cmp = await browser.newPage();
// [share of pixels changed, share of the detail changed, share of pixels that are detail]; changed = any channel moved more than 40 of 255
const changed = (a, b) => cmp.evaluate(async ([a, b]) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
  const da = px(ia), db = px(ib), W = ia.width, H = ia.height;
  // where the picture has detail (an edge, a texture, the product), not the plain ground words may sit on
  const g = (k) => (db[k] * 3 + db[k + 1] * 6 + db[k + 2]) / 10;
  let n = 0, d = 0, dn = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const k = (y * W + x) * 4;
    const moved = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2])) > 40;
    if (moved) n++;
    if (Math.abs(g(k + 4) - g(k - 4)) + Math.abs(g(k + W * 4) - g(k - W * 4)) > 30) { d++; if (moved) dn++; }
  }
  return [n / ((W - 2) * (H - 2)), d ? dn / d : 0, d / ((W - 2) * (H - 2))];
}, [a.toString('base64'), b.toString('base64')]);

let bad = 0;
for (const url of urls) {
  for (const [w, h] of PHONES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const box = await page.evaluate(() => {
      const PIC = 'img, video, canvas';
      const seen = (el) => { const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && +cs.opacity >= 0.6 && !/blur/.test(cs.filter); };
      const clipOf = (el) => { const r = el.getBoundingClientRect(); const x0 = Math.max(r.left, 0), y0 = Math.max(r.top, 0), x1 = Math.min(r.right, innerWidth), y1 = Math.min(r.bottom, innerHeight); return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) }; };
      let best = null, area = 0;
      for (const el of document.querySelectorAll(PIC)) {
        const c = clipOf(el);
        if (seen(el) && c.width * c.height > area) { area = c.width * c.height; best = el; }
      }
      if (!best || area < innerWidth * innerHeight * 0.25) return null;
      // the picture actually shown there: a photo stacked under another (a slideshow, a swap) is not it
      const all = document.createElement('style'); all.textContent = '* { pointer-events: auto !important; }'; document.head.append(all);
      const c0 = clipOf(best);
      best = document.elementsFromPoint(c0.x + c0.width / 2, c0.y + c0.height / 2).find((e) => e.matches(PIC) && seen(e)) || best;
      all.remove();
      best = { el: best, clip: clipOf(best) };
      if (best.clip.width * best.clip.height < innerWidth * innerHeight * 0.25) return null;
      document.querySelectorAll('[data-photo-clear]').forEach((e) => e.removeAttribute('data-photo-clear'));
      best.el.setAttribute('data-photo-clear', '');
      document.querySelectorAll('video').forEach((v) => v.pause());
      return { clip: best.clip, src: best.el.currentSrc || best.el.getAttribute('src') || best.el.tagName.toLowerCase() };
    });
    if (!box) { await page.close(); continue; }
    const shot = () => page.screenshot({ clip: box.clip, animations: 'disabled' });
    let res = null;
    // a picture that is still changing (a slideshow, a film) is shot again until two shots of the page agree
    for (let tries = 0; tries < 4 && !res; tries++) {
      const full = await shot();
      const hide = await page.addStyleTag({ content: '*, *::before, *::after { visibility: hidden !important; transition: none !important; } [data-photo-clear] { visibility: visible !important; }' });
      const alone = await shot();
      await hide.evaluate((s) => s.remove());
      const again = await shot();
      if ((await changed(full, again))[0] < 0.02) res = await changed(full, alone);
      else await page.waitForTimeout(1200);
    }
    const what = `the opening picture (${box.src.split('/').pop()})`;
    if (!res) { bad += 1; console.log(`COVERED ${w}x${h} ${url}: ${what} never held still for two shots, so how much is covered could not be measured`); }
    else if (res[2] < MIN_DETAIL) console.log(`ok ${w}x${h} ${url}: ${what} is a plain ground`);
    else if (res[1] > MAX_COVERED) { bad += 1; console.log(`COVERED ${w}x${h} ${url}: words, shades and tints cover ${Math.round(res[1] * 100)}% of ${what}; at most ${MAX_COVERED * 100}%`); }
    else console.log(`ok ${w}x${h} ${url}: ${Math.round(res[1] * 100)}% of ${what} is covered`);
    await page.close();
  }
}
await browser.close();
if (bad) { console.error(`\n${bad} phone opening(s) where the picture is mostly covered (page rules 5b.3). On a phone, put the words under the photo, or shrink the shade to the strip the words sit on.`); process.exit(1); }

#!/usr/bin/env node
/**
 * Everything fits on one screen (page rules 3c.12, from woodwrights.co.nz):
 * wherever a visitor stops, each photo is seen whole with its words. The rule
 * was written on 7 Oct 2026 but nothing measured it, and The Whipped Cup's
 * sections came out taller than a laptop screen (Tzvi, 20 Oct 2026: "not
 * everything is fitting on one screen, wasn't that already a rule we
 * created"). Same lesson as the effects check: a rule nobody measures is
 * a rule that drifts.
 *
 *   node scripts/check-fits.mjs <url> [more urls]
 *
 * At 1280x650, 1440x900, 1536x753 and 1920x1080, every section (a <section>, or a
 * page head) must fit in the screen below the fixed menu bar; pinned scroll
 * scenes are skipped (their stage is the screen). At those sizes and on
 * phones (390x844, 360x640), no photo may be taller than that space, and
 * none may be shown at more than 1.35 times its own size (it looks zoomed in).
 * Photos inside an SVG (a clipped window) are measured too.
 * Exit 1 on anything too tall.
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');

const LAPTOPS = [[1280, 650], [1440, 900], [1536, 753], [1920, 1080]];
const PHONES = [[390, 844], [360, 640]];
const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-fits.mjs <url> [more urls]'); process.exit(2); }

const browser = await chromium.launch();
let bad = 0;
for (const url of urls) {
  for (const [w, h] of [...LAPTOPS, ...PHONES]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const found = await page.evaluate((laptop) => {
      // show every reveal as it ends up, so heights are the finished ones
      document.querySelectorAll('.rev, [data-rev], [data-sc-in]').forEach((e) => e.classList.add('in', 'is-in'));
      const top = [...document.querySelectorAll('header, .top, .bar, nav')].find((e) => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().top <= 0);
      const room = innerHeight - (top ? top.getBoundingClientRect().height : 0);
      const out = [];
      const pinned = (el) => [...el.querySelectorAll('*')].some((c) => getComputedStyle(c).position === 'sticky') || el.hasAttribute('data-sc-act');
      const name = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''));
      if (laptop) {
        for (const el of document.querySelectorAll('section, header.page-head')) {
          if (pinned(el) || el.closest('footer') || getComputedStyle(el).display === 'none') continue;
          // a first section that runs under the fixed menu bar (its padding makes room for it) is
          // measured from below the bar
          const topH = top ? top.getBoundingClientRect().height : 0, at = el.getBoundingClientRect().top + scrollY;
          const hh = el.getBoundingClientRect().height - Math.max(0, topH - at);
          if (hh > room + 2) out.push(`section ${name(el)} is ${Math.round(hh)}px, the screen has ${Math.round(room)}px`);
        }
      }
      for (const img of document.querySelectorAll('img, video')) {
        const r = img.getBoundingClientRect(), cs = getComputedStyle(img);
        const sec = img.closest('section');
        if (!r.width || cs.visibility === 'hidden' || +cs.opacity === 0 || img.closest('[aria-hidden="true"]') || (sec && pinned(sec))) continue;
        if (r.height > room + 2) out.push(`photo ${img.getAttribute('src') || ''} is ${Math.round(r.height)}px tall, the screen has ${Math.round(room)}px`);
        // a photo shown much bigger than it is looks soft and zoomed in (Tzvi, 20 Oct 2026, The
        // Whipped Cup: a 1170px phone photo filled a 1920px screen). object-fit: cover crops too.
        if (img.tagName === 'IMG' && img.naturalWidth) {
          const fit = cs.objectFit === 'cover' ? Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight) : Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
          if (fit > 1.35) out.push(`photo ${img.getAttribute('src') || ''} is shown at ${fit.toFixed(1)}x its own size (soft and zoomed in); show it smaller or get a bigger photo`);
        }
      }
      // A big photo keeps most of itself in view (Tzvi, 26 Oct 2026, RS Modest Activewear: "the wow page is too zoomed
      // in so i cant see many details": a portrait photo of two skirts filled a wide box, so only a slice showed).
      // object-fit: cover on a box of a very different shape cuts the photo; a big one must show at least 70% of its
      // width and height. Pinned openings and aria-hidden pictures count here; a blurred backdrop does not.
      for (const img of document.querySelectorAll('img')) {
        const r = img.getBoundingClientRect(), cs = getComputedStyle(img);
        // a faint or blurred backdrop, or a picture the page marks data-crop-ok (a texture or ground behind the words), is not a product photo
        if (!img.naturalWidth || !r.width || !r.height || cs.visibility === 'hidden' || +cs.opacity < 0.6 || cs.objectFit !== 'cover' || /blur/.test(cs.filter) || img.closest('[data-crop-ok]')) continue;
        const vis = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
        if (vis < innerWidth * innerHeight * 0.3) continue;
        const box = r.width / r.height, own = img.naturalWidth / img.naturalHeight;
        const shown = Math.min(box / own, own / box);
        if (shown < 0.7) out.push(`photo ${img.getAttribute('src') || ''} shows only ${Math.round(shown * 100)}% of its ${box > own ? 'height' : 'width'} (a ${own < 1 ? 'tall' : 'wide'} photo in a ${box < 1 ? 'tall' : 'wide'} box): extend the photo to the box's shape (pad it, generate only the new edges, paste the original back; a real place is marked data-crop-ok instead) so the whole product shows (page rules 3c.12)`);
      }
      return out;
    }, w >= 1000);
    // photos drawn inside an SVG (a shaped window, often in a pinned scene) at the size the page gives them
    found.push(...await page.evaluate(async () => {
      const out = [];
      for (const im of document.querySelectorAll('svg image')) {
        const src = im.getAttribute('href') || im.getAttribute('xlink:href'); const dw = +im.getAttribute('width'), dh = +im.getAttribute('height');
        if (!src || !dw) continue;
        const n = await new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = src; });
        if (n && Math.max(dw / n[0], dh / n[1]) > 1.35) out.push(`photo ${src} is drawn at ${Math.max(dw / n[0], dh / n[1]).toFixed(1)}x its own size (soft and zoomed in)`);
      }
      return out;
    }));
    for (const f of found) { bad += 1; console.log(`TOO TALL ${w}x${h} ${url}: ${f}`); }
    await page.close();
  }
}
await browser.close();
if (bad) { console.error(`\n${bad} thing(s) taller than the screen (page rules 3c.12). Cap photos and big type by svh; put a photo beside its words.`); process.exit(1); }
console.log(`fits: every section and photo fits the screen at ${[...LAPTOPS, ...PHONES].map(([a, b]) => a + 'x' + b).join(', ')}`);

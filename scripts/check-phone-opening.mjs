#!/usr/bin/env node
/*
 * On a phone the opening plays by itself (page rules 3ac.1; Tzvi, 16 Nov 2026, after L.A. Cholent: "i thought we dont do
 * scroll on mobile but theres a scroll", then "All sites, as a rule"). A laptop may keep an opening led by the scroll; on a
 * phone the opening is one screen, plays on arrival without a finger moving, and the next section is one swipe away.
 *
 *   node scripts/check-phone-opening.mjs <url> [more urls]      only home pages (index.html) are measured
 *
 * Opens each page in WebKit as an iPhone 13 (390 x 844) and never scrolls. The opening is the first full-screen sticky
 * stage near the top of the page; a page without one passes. Fails (exit 1):
 *   HELD    the section holding the stage is more than 1.15 screens tall: the visitor has to scroll through it
 *   STILL   the screen at 7 s looks the same as at 0.8 s: nothing played by itself
 */
import { webkit, devices } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-phone-opening.mjs <url> [more urls]'); process.exit(2); }
const browser = await webkit.launch();
const problems = [];
for (const url of urls) {
  if (!/\/(index\.html)?(\?.*)?$/.test(new URL(url).pathname + new URL(url).search)) continue;
  const ctx = await browser.newContext(devices['iPhone 13']);
  const page = await ctx.newPage();
  await page.route('**/*', (r) => (r.request().method() === 'GET' ? r.continue() : r.abort()));   // never sends anything
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const open = await page.evaluate(() => {
    const st = [...document.querySelectorAll('body *')].find((e) => {
      const cs = getComputedStyle(e); if (cs.position !== 'sticky') return false;
      const par = e.parentElement.getBoundingClientRect();
      return e.offsetHeight > innerHeight * 0.6 && par.top + scrollY < innerHeight * 1.2;
    });
    return st ? { screens: st.parentElement.offsetHeight / innerHeight, name: st.parentElement.id || st.parentElement.className } : null;
  });
  const name = url.replace(/\?.*$/, '');
  if (!open) { console.log(`${name}: no scroll opening`); await ctx.close(); continue; }
  const a = await page.screenshot();
  await page.waitForTimeout(6200);
  const b = await page.screenshot();
  // how much of the screen changed between the two pictures, 0 to 1, decoded in the page (no image library needed)
  const diff = await page.evaluate(async ([x, y]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [A, B] = await Promise.all([load(x), load(y)]);
    const w = 130, h = Math.round(A.height * 130 / A.width), c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(A, 0, 0, w, h); const da = g.getImageData(0, 0, w, h).data;
    g.drawImage(B, 0, 0, w, h); const db = g.getImageData(0, 0, w, h).data;
    // the share of 10 x 10 blocks that visibly changed: a counter or a dial is a small part of the screen
    let moved = 0, n = 0;
    for (let by = 0; by < h; by += 10) for (let bx = 0; bx < w; bx += 10) {
      let s = 0, k = 0;
      for (let y = by; y < Math.min(h, by + 10); y++) for (let x = bx; x < Math.min(w, bx + 10); x++) { const i = (y * w + x) * 4; s += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); k++; }
      n++; if (s / (k * 3 * 255) > 0.06) moved++;
    }
    return moved / n;
  }, [a.toString('base64'), b.toString('base64')]);
  if (open.screens > 1.15) problems.push(`HELD   ${name}: the opening (${open.name}) is ${open.screens.toFixed(1)} screens tall on a phone, so it is scrolled through; make it one screen that plays by itself (3ac.1)`);
  if (diff < 0.01) problems.push(`STILL  ${name}: the opening did not move in 7 s on a phone without scrolling (changed ${(diff * 100).toFixed(1)}%); play it on arrival (3ac.1)`);
  console.log(`${name}: opening ${open.screens.toFixed(2)} screens, changed ${(diff * 100).toFixed(1)}% by itself`);
  await ctx.close();
}
await browser.close();
if (problems.length) { console.log('\n' + problems.join('\n')); console.error(`\n${problems.length} problem(s). Page rules 3ac.1.`); process.exit(1); }
console.log('phone opening: plays by itself in one screen');

#!/usr/bin/env node
/**
 * No blank screen anywhere in the scroll (Tzvi, 29 Oct 2026, from Nate Herk's video QUI6Ug4cHnE, whose
 * harness looked for "an empty screen before the close"). Bake away showed about a screen of plain dark
 * ground between its film and its flavours (28 Oct); no check saw it, only the owner video's contact sheet.
 *
 * The page is scrolled top to bottom in steps of a third of a screen, each step held long enough for
 * entrance fades, and the screen below the top bar is photographed. A screen whose light hardly changes
 * from pixel to pixel (spread under 6 of 255) is plain ground: a blank screen. (A first version looked at
 * page elements; film canvases under shades and grounds made it report blanks that were not there.)
 *
 *   node scripts/check-blank.mjs <url> [more urls]      exit 1 on any blank screen
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-blank.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
const reader = await browser.newPage();   // decodes screenshots (no image library needed)
let bad = 0;
for (const url of urls) {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    try { await p.goto(url, { waitUntil: 'load', timeout: 60000 }); } catch (e) { console.log(`note   ${url}: did not finish loading (${e.message.split('\n')[0]}), checked as it is`); }
    await p.waitForTimeout(700);
    const total = await p.evaluate(() => document.documentElement.scrollHeight);
    const blanks = [];
    for (let y = 0; y <= total - h; y += Math.round(h / 3)) {
      await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(650);
      // what a person sees: the screenshot below the top bar. A screen of plain ground has almost no change in light
      // from pixel to pixel; anything to look at (words, a photo, the film) has plenty
      const top = await p.evaluate(() => Math.min(Math.round(innerHeight * 0.25), Math.round((document.querySelector('header, .top, nav') || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom)));
      const shot = (await p.screenshot({ type: 'jpeg', quality: 70, clip: { x: 0, y: Math.max(0, top), width: w, height: h - Math.max(0, top) } })).toString('base64');
      const spread = await reader.evaluate(async (b64) => {
        const im = new Image(); im.src = 'data:image/jpeg;base64,' + b64; await im.decode();
        const c = document.createElement('canvas'); c.width = 160; c.height = Math.round(160 * im.height / im.width);
        const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0, sum = 0, sq = 0;
        for (let k = 0; k < d.length; k += 4) { const l = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; sum += l; sq += l * l; n++; }
        const m = sum / n; return Math.sqrt(Math.max(0, sq / n - m * m));
      }, shot);
      const hits = spread >= 6 ? 3 : 0;
      if (hits < 3) blanks.push(y);
    }
    await p.close();
    if (blanks.length) { bad++; console.log(`BLANK  ${url} ${w}x${h}: nothing to see on screen at scroll ${blanks.map((y) => Math.round(y / h * 10) / 10 + ' screens').join(', ')} (rules 3s: never a blank screen)`); }
  }
  console.log(`${url}: checked`);
}
await browser.close();
console.log(bad ? `blank: ${bad} problem(s)` : 'blank: no blank screen anywhere in the scroll');
process.exit(bad ? 1 : 0);

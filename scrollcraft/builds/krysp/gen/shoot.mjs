// screenshots of every page at the sizes of rules 3p.6, for the review sheet: node gen/shoot.mjs
import { chromium } from 'playwright';
import path from 'node:path';
const BASE = process.env.CHECK_BASE || 'http://127.0.0.1:8991';
const out = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'shots');
const sizes = [[1440, 900], [1280, 650], [390, 844], [360, 640]];
const browser = await chromium.launch();
for (const [w, h] of sizes) {
  const phone = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const page = await ctx.newPage();
  for (const pg of ['index', 'shop', 'contact']) {
    await page.goto(`${BASE}/krysp/${pg}.html`, { waitUntil: 'load' }); await page.waitForTimeout(700);
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    const pts = pg === 'index' ? [0, .6, 1.6, 2.6, 3.4] .map((k) => k * h) : [];
    let y = 0, i = 0;
    const ys = pg === 'index' && !phone ? [0, .8 * h, 1.8 * h, 2.8 * h] : [];
    for (let s = ys.length ? ys[ys.length - 1] + h : 0; s < H; s += h) ys.push(s);
    for (const yy of ys) { await page.evaluate((v) => scrollTo(0, v), yy); await page.waitForTimeout(600); await page.screenshot({ path: path.join(out, `${pg}-${w}x${h}-${String(i++).padStart(2, '0')}.png`) }); }
  }
  await ctx.close();
}
await browser.close();
console.log('done');

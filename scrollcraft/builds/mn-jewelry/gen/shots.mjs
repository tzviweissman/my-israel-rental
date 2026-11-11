// Look at the site: node gen/shots.mjs [page] -> gen/shots/<page>-<size>-<n>.png at several scroll points (run from the repo root)
import { chromium } from 'playwright';
import fs from 'node:fs';
const page0 = process.argv[2] || 'index';
const base = process.env.BASE || 'http://127.0.0.1:8731/';
const out = 'scrollcraft/builds/mn-jewelry/gen/shots'; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const [name, w, h, mobile] of [['laptop', 1440, 900, false], ['phone', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(base + page0 + '.html', { waitUntil: 'load' }); await p.waitForTimeout(3200);
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  let n = 0;
  for (let y = 0; y < H; y += h * .9) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(700); await p.screenshot({ path: `${out}/${page0}-${name}-${n++}.png` }); }
  console.log(name, 'shots', n, 'errors', errs);
  await ctx.close();
}
await b.close();

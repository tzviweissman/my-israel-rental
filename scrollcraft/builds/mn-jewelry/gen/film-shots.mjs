// The opening film at several scroll points, laptop and phone: node gen/film-shots.mjs (from the repo root)
import { chromium } from 'playwright';
const out = 'scrollcraft/builds/mn-jewelry/gen/shots';
const b = await chromium.launch();
for (const [name, w, h, m] of [['laptop', 1440, 900, false], ['phone', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: m, hasTouch: m })).newPage();
  await p.goto('http://127.0.0.1:8732/mn-jewelry/index.html'); await p.waitForTimeout(3500);
  const span = await p.evaluate(() => document.getElementById('open').offsetHeight - innerHeight);
  for (const f of [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1]) { await p.evaluate((y) => scrollTo(0, y), span * f); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/film-${name}-${f}.png` }); }
}
await b.close();

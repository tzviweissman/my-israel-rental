// The harness scrolls in instant jumps, so it never produces velocity. This
// forces --heat to 1 and photographs the hero and the timeline so the ember
// layer, the grain and the accent mix can be seen, then reports the computed
// accent at rest and at full heat.
//   node scrollcraft/builds/blazin-boards/lab/heat-shot.mjs
import { chromium } from 'playwright';
const PAGE = process.env.URL || 'http://localhost:4501/';
const OUT = new URL('./heat', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
import { mkdir } from 'node:fs/promises';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page.goto(PAGE, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const accent = (sel) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).color, sel);
const rest = await accent('.hero h1 b');
await page.screenshot({ path: `${OUT}/hero-rest.png` });
await page.evaluate(() => document.documentElement.style.setProperty('--heat', '1'));
await page.waitForTimeout(100);
const hot = await accent('.hero h1 b');
await page.screenshot({ path: `${OUT}/hero-hot.png` });
const y = await page.evaluate(() => document.querySelector('#facts').offsetTop - 80);
await page.evaluate((yy) => scrollTo(0, yy), y);
await page.waitForTimeout(400);
await page.evaluate(() => document.documentElement.style.setProperty('--heat', '1'));
await page.screenshot({ path: `${OUT}/how-hot.png` });
// Real velocity: wheel hard and read --heat the engine's own way.
await page.evaluate(() => { document.documentElement.style.removeProperty('--heat'); scrollTo(0, 0); });
await page.waitForTimeout(300);
for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 600); await page.waitForTimeout(16); }
const live = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--heat'));
await page.waitForTimeout(1600);
const cooled = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--heat'));
console.log({ rest, hot, liveAfterFlick: live.trim(), afterCooling: cooled.trim() });
await browser.close();

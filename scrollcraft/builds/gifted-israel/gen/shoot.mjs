// Looks at the pages: node gen/shoot.mjs [page] [w] [h] -> gen/look/shot-<page>-<w>.png (whole page, scrolled once so lazy pictures load)
import { chromium } from 'playwright';
const [page = 'index', w = 1366, h = 768] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: +w < 768, hasTouch: +w < 768 });
const p = await c.newPage();
const errs = []; p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(`http://127.0.0.1:8977/gifted-israel/${page}.html`, { waitUntil: 'load' });
await p.waitForTimeout(3500);
await p.screenshot({ path: `gen/look/first-${page}-${w}.png` });
const H = await p.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < Math.min(H, 7000); y += +h) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(250); }
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
await p.screenshot({ path: `gen/look/shot-${page}-${w}.png`, fullPage: true, clip: { x: 0, y: 0, width: +w, height: Math.min(H, 7000) } });
console.log(page, w, 'height', H, 'errors', errs.slice(0, 5));
await b.close();

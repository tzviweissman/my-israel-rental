// node gen/shots.mjs <page> <w>x<h> [scrollYs comma] : viewport shots into gen/shots (phones get touch)
import { chromium } from 'playwright';
const [page = 'index', size = '1440x900', ys = '0'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const b = await chromium.launch();
const phone = w < 768;
const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
const p = await c.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(`http://localhost:4532/${page}.html`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
for (const y of ys.split(',')) {
  await p.evaluate((y) => window.scrollTo(0, y === 'end' ? document.body.scrollHeight : +y), y);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `gen/shots/${page}-${w}-${y}.png` });
}
console.log('height', await p.evaluate(() => document.body.scrollHeight), 'errors', errs.length ? errs : 'none');
await b.close();

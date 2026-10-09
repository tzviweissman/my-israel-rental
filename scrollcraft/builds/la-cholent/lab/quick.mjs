// Quick look: the page at fixed scroll fractions, desktop and phone.
import { chromium } from 'playwright';
const [w, h, tag] = [Number(process.argv[2] || 1440), Number(process.argv[3] || 900), process.argv[4] || 'd'];
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:4503/', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const stops = (process.argv[5] || '0,0.06,0.14,0.22,0.3,0.36,0.42,0.48,0.56,0.64,0.72,0.82,0.92,1').split(',').map(Number);
for (const s of stops) {
  await p.evaluate((y) => scrollTo(0, y), Math.round(max * s));
  await p.waitForTimeout(700);
  await p.screenshot({ path: `scrollcraft/builds/la-cholent/lab/quick/${tag}-${String(Math.round(s * 100)).padStart(3, '0')}.png` });
}
console.log('height vh', ((max + h) / h).toFixed(1), errs.length ? 'ERR ' + errs.join(' | ') : 'no errors');
await b.close();

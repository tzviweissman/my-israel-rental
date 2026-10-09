// Screenshots at fractions of the page, for a contact sheet.
import { chromium } from 'playwright';
const [w, h, tag] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
const fr = process.argv.slice(5).map(Number);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto('http://localhost:4504/', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
for (const f of fr) {
  await p.evaluate((y) => scrollTo(0, y), Math.round(max * f));
  await p.waitForTimeout(1100);
  await p.screenshot({ path: `scrollcraft/builds/kashermybnb/lab/q-${tag}-${String(Math.round(f * 100)).padStart(3, '0')}.png` });
}
await b.close();

// A visitor's pass: scroll top to bottom at a reading pace, then turn the dial.
import { chromium } from 'playwright';
const [w, h, name, secs] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4], Number(process.argv[5] || 40)];
const dir = 'scrollcraft/builds/la-cholent/lab/video';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, recordVideo: { dir, size: { width: w, height: h } } });
const p = await ctx.newPage();
await p.goto('http://localhost:4503/', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(2500);
const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const steps = secs * 8;
for (let i = 1; i <= steps; i++) {
  const t = i / steps, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  await p.mouse.wheel(0, 0);
  await p.evaluate((y) => scrollTo(0, y), Math.round(max * (0.15 * t + 0.85 * e)));
  await p.waitForTimeout(1000 / 8);
}
await p.waitForTimeout(1500);
for (const i of [0, 2, 1]) { await p.click(`.size-pick button[data-i="${i}"]`); await p.waitForTimeout(1600); }
await p.waitForTimeout(1500);
const v = p.video(); await ctx.close(); await b.close();
console.log(name, await v.path());

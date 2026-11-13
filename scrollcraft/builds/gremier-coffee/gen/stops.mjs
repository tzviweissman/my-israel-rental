import { chromium } from 'playwright';
const out = process.argv[2], b = await chromium.launch({ channel: 'chrome' });
for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: m, hasTouch: m })).newPage();
  await p.goto('http://127.0.0.1:8937/gremier-coffee/index.html', { waitUntil: 'load' }); await p.waitForTimeout(3000);
  for (const f of [0, 0.15, 0.3, 0.5, 0.7, 0.995]) {
    await p.evaluate((f) => { const s = document.getElementById('film'); window.scrollTo({ top: (s.offsetHeight - innerHeight) * f, behavior: 'instant' }); }, f);
    await p.waitForTimeout(2200); await p.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
    await p.screenshot({ path: `${out}/k-${w}-${Math.round(f * 100)}.jpg`, quality: 70 });
  }
}
await b.close();

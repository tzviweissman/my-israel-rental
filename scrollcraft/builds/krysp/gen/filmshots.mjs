import { chromium } from 'playwright';
const out = process.argv[2], b = await chromium.launch();
for (const [w, h, tag] of [[1440, 900, 'd'], [390, 844, 'm']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: tag === 'm', hasTouch: tag === 'm' });
  await p.goto('http://127.0.0.1:8991/krysp/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  for (const q of [0, 0.2, 0.45, 0.58, 0.75, 0.95]) {
    await p.evaluate(q => { const f = document.getElementById('film'); scrollTo(0, f.offsetTop + q * (f.offsetHeight - innerHeight)); }, q);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}/${tag}-${q}.png` });
  }
  await p.close();
}
await b.close();

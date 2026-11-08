// Screens of every page at laptop and phone, plus the opening mid-way: node scrollcraft/builds/hadassah-prys/gen/shots.mjs <outdir>
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const out = process.argv[2], base = 'http://127.0.0.1:8997/hadassah-prys/';
const b = await chromium.launch();
for (const [name, w, h, mob] of [['l', 1440, 900, false], ['s', 1280, 650, false], ['p', 390, 844, true], ['q', 360, 640, true]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, deviceScaleFactor: 1 });
  const p = await c.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(base + 'index.html');
  await p.waitForTimeout(450); await p.screenshot({ path: `${out}/${name}-open-a.jpg`, quality: 70, type: 'jpeg' });
  await p.waitForTimeout(800); await p.screenshot({ path: `${out}/${name}-open-b.jpg`, quality: 70, type: 'jpeg' });
  await p.waitForTimeout(2200); await p.screenshot({ path: `${out}/${name}-open-c.jpg`, quality: 70, type: 'jpeg' });
  if (name === 'l' || name === 'p') {
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/${name}-home.jpg`, quality: 70, type: 'jpeg', fullPage: true });
    for (const pg of ['book', 'contact']) {
      await p.goto(base + pg + '.html'); await p.waitForTimeout(700);
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } scrollTo(0, 0); });
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${out}/${name}-${pg}.jpg`, quality: 70, type: 'jpeg', fullPage: true });
    }
  }
  await c.close();
}
await b.close();

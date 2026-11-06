// Contact sheets of the site to look at. From the repo root: node scrollcraft/builds/finest-cut/gen/shots.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const BASE = 'http://127.0.0.1:8987/finest-cut/', OUT = process.env.TEMP + '/fc';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const [name, w, h, mob] of [['lap', 1440, 900, false], ['short', 1280, 650, false], ['ph', 390, 844, true], ['ph2', 360, 640, true]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, deviceScaleFactor: 1 });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + 'index.html', { waitUntil: 'load' }); await p.waitForTimeout(1800);
  const run = await p.evaluate(() => { const s = document.getElementById('board'); return s.offsetHeight - innerHeight; });
  for (let i = 0; i <= 6; i++) {
    await p.evaluate((y) => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, y); }, run * i / 6);
    await p.waitForTimeout(450);
    await p.screenshot({ path: `${OUT}/${name}-open${i}.jpg`, type: 'jpeg', quality: 70 });
  }
  for (const pg of ['index', 'shop', 'contact']) {
    await p.goto(BASE + pg + '.html', { waitUntil: 'load' }); await p.waitForTimeout(600);
    await p.addStyleTag({ content: '.rev{opacity:1!important;filter:none!important}.open{height:100svh!important}.top,.bar{position:absolute!important}' });
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${OUT}/${name}-${pg}.jpg`, type: 'jpeg', quality: 70, fullPage: true });
  }
  if (errs.length) console.log(name, errs);
  await c.close();
}
await b.close();
console.log(OUT);

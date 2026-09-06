// The pass the skill's harness does not run: the same page mirrored for
// Hebrew, at desktop and phone width, at the scroll positions that matter.
//
// `playwright` resolves upward from this file to the repo's node_modules, so
// this runs in place. Serve the build first (serve.mjs on 4500).
//
//   node scrollcraft/builds/lechem-emek/lab/rtl-shots.mjs
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

// Not `URL`: that shadows the global this next line needs.
const PAGE = process.env.URL || 'http://localhost:4500/';
const OUT = new URL('./rtl', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const report = [];
for (const dir of ['ltr', 'rtl']) {
  for (const [width, height] of [[1280, 860], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(PAGE, { waitUntil: 'networkidle', timeout: 60000 });
    if (dir === 'rtl') await page.click('#dirToggle');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);

    // The positions: the landing view, the middle of the door act (the peak),
    // the middle of the counter rail, and the close.
    const stops = await page.evaluate(() => {
      const vh = innerHeight;
      const mid = (sel) => { const el = document.querySelector(sel); return el.offsetTop + (el.offsetHeight - vh) * 0.55; };
      return {
        hero: 0,
        door: mid('#door'),
        counter: mid('#counter'),
        close: document.querySelector('#order').offsetTop + document.querySelector('#order').offsetHeight - vh,
      };
    });
    for (const [name, y] of Object.entries(stops)) {
      await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${dir}-${width}-${name}.png` });
    }
    const facts = await page.evaluate(() => ({
      dir: document.documentElement.getAttribute('dir'),
      h1Font: getComputedStyle(document.querySelector('h1')).fontFamily.split(',')[0],
      railOver: (() => { const r = document.querySelector('.rail'); return r.scrollWidth - innerWidth; })(),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      clock: document.getElementById('clock').textContent,
      imagesOk: [...document.images].filter((i) => i.naturalWidth > 0).length + '/' + document.images.length,
    }));
    report.push({ dir, width, ...facts });
    await page.close();
  }
}
await browser.close();
console.table(report);

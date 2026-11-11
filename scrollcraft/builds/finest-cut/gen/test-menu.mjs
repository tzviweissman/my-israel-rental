// The whole menu on the shop and home pages, with the live listing's products put in the way frontend/server.js does.
// Test prices only (the real ones come from the owner). node gen/test-menu.mjs [base] [shots-dir]
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/tzviw/Documents/mir-finest-cut/frontend/package.json');
const { chromium } = require('playwright');
const fs = require('node:fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8987/finest-cut/';
const OUT = process.argv[3] || '.';
const CAT = fs.readFileSync('C:/Users/tzviw/Documents/mir-finest-cut/frontend/public/pages/mir-catalog.js', 'utf8');
const img = (k) => BASE + 'src/catalog/' + k + '.png';
const P = [
  { id: 'idx:0', name: 'Ultimate Feast', price: 215, currency: 'USD', description: 'XL Chicken Board with 4 types of chicken and 3 Sauces', image: BASE + 'assets/board.webp', in_stock: true },
  { id: 't1', name: 'Taster Board', price: 11, currency: 'USD', description: 'Mini board, 26x20cm', image: img('taster'), in_stock: true },
  { id: 't2', name: 'Signature Board', price: 22, currency: 'USD', description: 'Board, 34x24cm', image: img('signature'), in_stock: true },
  { id: 't3', name: 'Supreme Box', price: 33, currency: 'USD', image: img('supreme'), in_stock: true },
  { id: 't4', name: 'Flavour Feast', price: 44, currency: 'USD', image: img('flavour'), in_stock: false },
  { id: 't5', name: 'Savoury Snack', price: 55, currency: 'USD', image: img('savoury'), in_stock: true },
  { id: 't6', name: 'Wine', price: 66, currency: 'USD', image: img('wine'), in_stock: true },
];
const inject = `<script id="mir-live-products" type="application/json">${JSON.stringify(P)}</script><script>${CAT}</script></body>`;
const b = await chromium.launch();
const fail = [];
for (const [w, h, tag] of [[1440, 900, 'laptop'], [390, 844, 'phone']]) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route('**/*.html*', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace('</body>', () => inject) }); });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"track_url":"https://x/track"}' }));
  await pg.goto(BASE + 'shop.html', { waitUntil: 'load' }); await pg.evaluate(() => localStorage.clear()); await pg.reload({ waitUntil: 'load' });
  const tiles = await pg.$$eval('#more .fc', (a) => a.map((x) => x.querySelector('h3').textContent));
  if (tiles.length !== 7) fail.push(`${tag}: ${tiles.length} tiles on the shop`);
  console.log(tag, tiles.join(", ")); await pg.evaluate(() => scrollTo(0, document.getElementById("more").offsetTop - 60)); await pg.waitForTimeout(800);
  await pg.screenshot({ path: `${OUT}/menu-shop-${tag}.png` });
  await pg.click('#more .fc:has-text("Signature Board") a'); await pg.click('#more .fc:has-text("Wine") a'); await pg.click('#more .fc:has-text("Wine") a');
  await pg.click('#st-add');
  const total = await pg.textContent('#total');
  if (total !== '$369') fail.push(`${tag}: total ${total}, want $369 (215 + 22 + 2 × 66)`);
  if (await pg.$('#more .fc:has-text("Flavour Feast") a')) fail.push(`${tag}: out-of-stock item has a link`);
  await pg.goto(BASE + 'index.html', { waitUntil: 'load' }); await pg.waitForTimeout(400);
  const home = await pg.$$eval('#feast .fc', (a) => a.length);
  if (home !== 7) fail.push(`${tag}: ${home} items on the home page`);
  await pg.locator('#feast').scrollIntoViewIfNeeded(); await pg.waitForTimeout(800);
  await pg.screenshot({ path: `${OUT}/menu-home-${tag}.png` });
  await pg.click('#feast .fc:has-text("Supreme Box") a'); await pg.waitForLoadState('load'); await pg.waitForTimeout(400);
  const t2 = await pg.textContent('#total');
  if (t2 !== '$402') fail.push(`${tag}: after Supreme Box from home the total is ${t2}, want $402`);
  for (const e of errs) fail.push(`${tag}: page error ${e}`);
  await pg.close();
}
await b.close();
console.log(fail.length ? fail.join('\n') : 'menu: 7 tiles on shop and home, adding from both, totals right, out of stock not orderable');
process.exit(fail.length ? 1 : 0);

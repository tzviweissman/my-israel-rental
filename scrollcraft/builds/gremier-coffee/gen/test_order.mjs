// A real run through the order, on laptop and phone, with the save answered here (never their inbox; rule 3g.12).
// Serve the builds first: node scripts/serve-builds.mjs 8937   then: node scrollcraft/builds/gremier-coffee/gen/test_order.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:8937/gremier-coffee';
fs.mkdirSync('scrollcraft/builds/gremier-coffee/gen/look', { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, h, mobile] of [[1366, 768, false], [390, 844, true]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  const p = await c.newPage(); const errs = []; let body = null;
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.route('**/order-form/**/orders', (r) => { body = r.request().postData(); r.fulfill({ json: { track_url: 'https://example.test/track/1' } }); });
  await p.addInitScript(() => { window.open = () => ({ location: { set href(x) { window.__wa = x; } } }); });
  // add a Classic from the home page, then the coffee bar
  await p.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear());
  await p.click('#coffees [data-add="classic"]');
  await p.click('#bars .seg button[data-p="garden"]');
  const pic = await p.evaluate(() => document.querySelector('#bars .bar-ph img.on').getAttribute('src'));
  await p.click('#bars [data-add="bar-premium"]');
  await p.goto(`${BASE}/shop.html#order`, { waitUntil: 'load' });
  const first = (await p.textContent('#sum-list')).trim();
  const addon = await p.isVisible('#addon');
  await p.click('#addon-no');
  const addonGone = !(await p.isVisible('#addon'));
  // a product from the grid through its sheet
  await p.click('.pc-a[data-id="vanilla-latte"]'); await p.waitForSelector('#sheet[open]');
  await p.click('#sheet .step button[data-d="1"]');
  await p.screenshot({ path: `scrollcraft/builds/gremier-coffee/gen/look/sheet-${w}.png` });
  await p.click('#sh-add');
  await p.locator('#order').scrollIntoViewIfNeeded();
  await p.click('#send'); await p.waitForTimeout(400);
  await p.fill('#addr', ''); await p.click('#send'); const e2 = await p.textContent('#e-addr');
  await p.fill('#addr', 'Test Street 1, Jerusalem');
  await p.click('#send'); await p.waitForTimeout(400);
  await p.click('#send'); const e3 = await p.textContent('#e-me');
  await p.fill('#me', 'Test Person'); await p.fill('#ph', '0501234567'); await p.fill('#note', '50 guests');
  const btn = (await p.textContent('#send')).trim(), total = await p.textContent('#total');
  await p.screenshot({ path: `scrollcraft/builds/gremier-coffee/gen/look/step3-${w}.png` });
  await p.click('#send'); await p.waitForTimeout(800);
  const wa = await p.evaluate(() => decodeURIComponent(window.__wa || ''));
  console.log(w, JSON.stringify({ pic, first: first.slice(0, 90), addon, addonGone, e2, e3, btn, total, errs, body, sent: await p.textContent('#sent') }, null, 1), '\n' + wa);
  await c.close();
}
await b.close();

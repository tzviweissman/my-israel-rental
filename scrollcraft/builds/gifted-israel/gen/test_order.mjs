// A real run through the order, on laptop and phone, with the save answered here (never their inbox; rule 3g.12).
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, h, mobile] of [[1366, 768, false], [390, 844, true]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  const p = await c.newPage(); const errs = []; let body = null;
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.route('**/order-form/**/orders', (r) => { body = r.request().postData(); r.fulfill({ json: { track_url: 'https://example.test/track/1' } }); });
  await p.addInitScript(() => { window.open = () => { const t = { location: { set href(x) { window.__wa = x; } } }; return t; }; });
  await p.goto('http://127.0.0.1:8977/gifted-israel/index.html', { waitUntil: 'load' });
  // type an engraving on the home page and add it
  await p.fill('#engr-in', 'Cohen Family');
  const label = await p.textContent('#engr-add');
  await p.click('#engr-add'); await p.waitForURL('**/shop.html#order');
  const first = await p.textContent('#sum-list');
  // a piece with nusach from the grid
  await p.goto('http://127.0.0.1:8977/gifted-israel/shop.html?c=Chanukah', { waitUntil: 'load' });
  await p.click('.pc-a[href*="p="]:has-text("Pearlstone")');
  await p.waitForSelector('#sheet[open]');
  await p.screenshot({ path: `gen/look/sheet-${w}.png` });
  await p.click('label.chip:has-text("Sefard")'); await p.fill('#sh-engr', 'For Sara');
  await p.click('#sh-add');
  // empty step 2 refuses
  await p.locator('#order').scrollIntoViewIfNeeded();
  await p.click('#send'); await p.waitForTimeout(500);
  await p.screenshot({ path: `gen/look/step2-${w}.png` });
  await p.click('#send'); const e2 = await p.textContent('#e-addr');
  await p.fill('#addr', 'Test Street 1, Jerusalem');
  await p.click('#send'); await p.waitForTimeout(400);
  await p.click('#send'); const e3 = await p.textContent('#e-me');
  await p.fill('#me', 'Test Person'); await p.fill('#ph', '0501234567');
  const btn = await p.textContent('#send');
  await p.screenshot({ path: `gen/look/step3-${w}.png` });
  await p.click('#send'); await p.waitForTimeout(800);
  const wa = await p.evaluate(() => decodeURIComponent(window.__wa || ''));
  console.log(w, { label: label.trim(), first: first.trim().slice(0, 70), e2, e3, btn, errs, body, wa, sent: await p.textContent('#sent') });
  await c.close();
}
await b.close();

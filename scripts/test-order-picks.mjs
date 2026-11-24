/**
 * The order page groups products by their section and lets a customer choose up to N flavours of a platter
 * (backend ProductItem.picks; Bawk Bawk Chicken, 23 Nov 2026). Needs a local store whose first product is a
 * platter with picks: 3 and 6 options, in a section, beside products in other sections.
 *
 * Usage: APP_ORIGIN=http://localhost:3216 API_ORIGIN=http://localhost:8006 GIG=<id> node scripts/test-order-picks.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const API = process.env.API_ORIGIN || 'http://localhost:8001';
const GIG = process.env.GIG;
if (!GIG) { console.error('GIG=<store listing id> is required'); process.exit(2); }
const browser = await chromium.launch();
let failed = false;
const fail = (m) => { console.error('FAIL:', m); failed = true; };
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${APP}/order/${GIG}?lng=en`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('[data-testid="order-section"]').first().waitFor({ timeout: 60000 });
  const sections = await page.locator('[data-testid="order-section"]').allInnerTexts();
  console.log('sections:', sections.join(' | '));
  if (sections.length < 2) fail('expected section headings');
  // Three or more sections get tabs; the last tab scrolls its heading to the top, under the tabs.
  const tabs = page.locator('[data-testid="order-tabs"] button');
  if (sections.length > 2) {
    if ((await tabs.count()) !== sections.length) fail(`expected ${sections.length} tabs, got ${await tabs.count()}`);
    await tabs.last().click();
    await page.waitForTimeout(900);
    const top = await page.locator('[data-testid="order-section"]').last().evaluate((el) => el.getBoundingClientRect().top);
    const bar = await page.locator('[data-testid="order-tabs"]').evaluate((el) => el.getBoundingClientRect());
    console.log('last section top:', Math.round(top), 'tabs bar:', Math.round(bar.top), '-', Math.round(bar.bottom));
    if (top < bar.bottom - 2 || top > 160) fail('the last tab did not bring its section to the top, below the tabs');
    await page.screenshot({ path: 'screenshots/test-order-tabs.png' });
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  const picks = page.locator('[data-testid^="order-picks-"]').first();
  const chips = picks.locator('button');
  for (let k = 0; k < 4; k++) await chips.nth(k).click();
  const on = await picks.locator('button[aria-pressed="true"]').count();
  console.log('chosen after 4 taps:', on);
  if (on !== 3) fail(`expected 3 chosen (up to 3), got ${on}`);
  const add = page.locator('[data-testid^="order-add-"]').first();
  await add.click();
  const summary = await page.locator('body').innerText();
  const line = summary.split('\n').find((l) => /1 × .*\(.*,.*,.*\)/.test(l));
  console.log('order line:', line || '(none)');
  if (!line) fail('the order summary does not name the 3 chosen flavours');
  await page.screenshot({ path: 'screenshots/test-order-picks.png', fullPage: true });
  if (errors.length) fail(errors[0]);

  // The server: up to 3 accepted and named on the line, 4 refused.
  const store = await (await fetch(`${API}/api/marketplace/order-form/${GIG}`)).json();
  const p = (store.products || []).find((x) => x.picks);
  const date = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const order = (ids) => fetch(`${API}/api/marketplace/order-form/${GIG}/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'mir-check' },
    body: JSON.stringify({ lines: [{ product_id: p.id, qty: 1, option_ids: ids }], date, fulfilment: 'pickup',
      customer_name: 'Picks Test', customer_phone: '0501234567', customer_email: 'picks@local.test', lang: 'en' }),
  });
  const four = await order(p.options.slice(0, 4).map((o) => o.id));
  console.log('4 flavours ->', four.status);
  if (four.status !== 400) fail('4 flavours on an up-to-3 platter was not refused');
  const three = await order(p.options.slice(0, 3).map((o) => o.id));
  const body = await three.json().catch(() => ({}));
  console.log('3 flavours ->', three.status, JSON.stringify(body).slice(0, 160));
  if (three.status >= 300) fail('3 flavours was refused');
} finally { await browser.close(); }
if (failed) process.exit(1);
console.log('ok: sections, choose up to 3, the order names them');

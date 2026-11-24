/**
 * A services ("deliverable") listing can hold 60 rows, the same as a shop's products, and the add
 * button says so at the limit instead of vanishing. Bawk Bawk Chicken got 20 of its menu and no way
 * to add more (23 Nov 2026): the reader cut at 20 and the add button disappeared at 15.
 *
 * Usage: APP_ORIGIN=http://localhost:3211 node scripts/test-tier-limit.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const browser = await chromium.launch();
let failed = false;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${APP}/businesses/add?step=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // "Ask for a quote or a job" is a deliverable listing (the sign-up question since 24 Nov 2026).
  await page.locator('[data-testid="wizard-offer-quote"]').click({ timeout: 30000 });
  await page.goto(`${APP}/businesses/add?step=2`, { waitUntil: 'domcontentloaded' });
  const add = page.locator('[data-testid="wizard-tier-add"]');
  await add.waitFor({ timeout: 30000 });
  // "Small Platter 80" typed as a name becomes a name and a price when the box is left.
  await page.locator('[data-testid="wizard-tier-name-0"]').fill('Small Platter 80');
  await page.locator('[data-testid="wizard-tier-price-0"]').focus();
  const split = [await page.locator('[data-testid="wizard-tier-name-0"]').inputValue(),
    await page.locator('[data-testid="wizard-tier-price-0"]').inputValue()];
  console.log('typed "Small Platter 80" ->', JSON.stringify(split));
  if (split[0] !== 'Small Platter' || split[1] !== '80') { console.error('FAIL: name and price not split'); failed = true; }
  const rows = () => page.locator('[data-testid="wizard-tier-add"]').evaluate(
    (b) => b.parentElement.querySelectorAll('input[type="number"], input[inputmode="decimal"]').length);
  const perRow = await rows(); // the form opens with one row; a row can have several number boxes
  for (let i = 0; i < 65; i++) await add.click();
  const end = (await rows()) / perRow;
  console.log(`rows after 65 clicks: ${end}`);
  const toast = await page.getByText(/Up to 60/).count();
  if (end !== 60) { console.error(`FAIL: expected 60 rows, got ${end}`); failed = true; }
  if (!toast) { console.error('FAIL: no "Up to 60" message at the limit'); failed = true; }
  if (errors.length) { console.error('FAIL:', errors[0]); failed = true; }

  // A long priced menu read into a services listing offers "Make it a shop", which keeps every row.
  // The reader is faked here (no paid call); reading needs an account, so this signs in as the dev owner.
  const p2 = await browser.newPage();
  // API_ORIGIN: when the API this frontend was built for (frontend/.env) is not the one running,
  // e.g. API_ORIGIN=http://localhost:8002 while a stuck server holds 8001.
  if (process.env.API_ORIGIN) {
    await p2.route('http://localhost:8001/**', (r) => r.continue({ url: r.request().url().replace('http://localhost:8001', process.env.API_ORIGIN) }));
  }
  // Registered after the rewrite: Playwright tries the newest route first, so the fake wins.
  await p2.route('**/marketplace/products/extract', (r) => r.fulfill({ json: {
    products: Array.from({ length: 10 }, (_, i) => ({ name: `Menu item ${i + 1}`, price: 20 + i })) } }));
  await p2.goto(`${APP}/dashboard?as=owner&lng=en`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p2.waitForFunction(() => !location.search.includes('as='), null, { timeout: 30000 });
  await p2.goto(`${APP}/businesses/add?step=1`, { waitUntil: 'domcontentloaded' });
  await p2.locator('[data-testid="wizard-offer-quote"]').click({ timeout: 30000 });
  await p2.goto(`${APP}/businesses/add?step=2`, { waitUntil: 'domcontentloaded' });
  await p2.locator('[data-testid="wizard-services-paste-toggle"]').click();
  await p2.locator('[data-testid="wizard-services-paste"]').fill('menu');
  await p2.locator('[data-testid="wizard-services-paste-read"]').click();
  await p2.getByRole('button', { name: /Make it a shop|להפוך לחנות/ }).click({ timeout: 15000 }).catch(async (e) => {
    await p2.screenshot({ path: 'screenshots/test-tier-limit-fail.png' });
    console.error('page text:', (await p2.locator('body').innerText()).slice(0, 600).replace(/\s+/g, ' '));
    throw e;
  });
  await p2.locator('[data-testid="wizard-product-add"]').waitFor({ timeout: 10000 });
  const kept = await p2.locator('input[value^="Menu item"]').count();
  console.log(`after "Make it a shop": ${kept} menu rows`);
  if (kept !== 10) { console.error(`FAIL: expected 10 menu rows as products, got ${kept}`); failed = true; }
} finally { await browser.close(); }
if (failed) process.exit(1);
console.log('ok: name and price split, 60 rows with a message at the limit, menu to shop keeps every row');

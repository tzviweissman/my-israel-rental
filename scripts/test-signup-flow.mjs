/**
 * The whole add-business sign-up on a phone, end to end, on a LOCAL server (it publishes a real listing to the
 * local database for the dev owner, and uploads one small photo):
 *   1. a fresh sign-up opens on "Find your business" with only the finders and a skip button
 *   2. skip shows "What can customers do with you?", nothing ticked; tick Order items and Book a time
 *   3. fill the least the form needs, publish
 *   4. the published screen offers "Now add booking" and a "Make your page stronger" checklist
 * (plan docs/plans/one-business-type-signup.md, phase 1, 24 Nov 2026)
 *
 * Usage: APP_ORIGIN=http://localhost:3216 node scripts/test-signup-flow.mjs [en|he]
 */
import { chromium } from 'playwright';
import path from 'node:path';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const lng = process.argv[2] || 'en';
if (!/localhost|127\.0\.0\.1/.test(APP)) { console.error('local servers only: this publishes a listing'); process.exit(2); }
const shots = path.join('screenshots', 'one-type');
const browser = await chromium.launch();
let failed = false;
const fail = (m) => { console.error('FAIL:', m); failed = true; };
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${APP}/dashboard?as=owner&lng=${lng}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => !location.search.includes('as='), null, { timeout: 60000 });
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/create-gig|signup-draft/.test(k)) localStorage.removeItem(k); });
  await page.goto(`${APP}/businesses/add?lng=${lng}`, { waitUntil: 'networkidle', timeout: 90000 });

  // 1. Find your business, alone
  await page.locator('[data-testid="wizard-find-skip"]').waitFor({ timeout: 30000 });
  if (await page.locator('[data-testid="wizard-offers"]').count()) fail('the question shows before the finders are skipped');
  if (!(await page.locator('[data-testid="wizard-find-business"]').count())) fail('no Google finder on the first screen');
  await page.screenshot({ path: path.join(shots, `find-${lng}.png`) });

  // 2. The question, nothing ticked
  await page.locator('[data-testid="wizard-find-skip"]').click();
  await page.locator('[data-testid="wizard-offers"]').waitFor();
  const ticked = await page.locator('[data-testid^="wizard-offer-"][aria-pressed="true"]').count();
  if (ticked) fail(`${ticked} answers ticked before choosing`);
  await page.locator('[data-testid="wizard-offer-order"]').click();
  await page.locator('[data-testid="wizard-offer-book"]').click();

  // 3. The least the form needs
  await page.locator('[data-testid="wizard-title"]').fill('Signup flow test bakery');
  await page.locator('[data-testid="wizard-cat-select"]').selectOption('shops-products');
  await page.locator('[data-testid="wizard-next"]').click();
  await page.locator('[data-testid="wizard-description"]').fill('Challah, cakes and cookies baked fresh every Friday morning.');
  await page.locator('[data-testid="wizard-product-name-0"]').fill('Challah');
  await page.locator('[data-testid="wizard-product-price-0"]').fill('25');
  await page.locator('[data-testid="wizard-product-image-input-0"]').setInputFiles('frontend/public/brand-logo.png');
  await page.locator('[data-testid="wizard-next"]:not([disabled])').waitFor({ timeout: 60000 });
  await page.locator('[data-testid="wizard-next"]').click();
  await page.locator('[data-testid="wizard-area"]').fill('Jerusalem');
  await page.locator('[data-testid="wizard-whatsapp-input"]').first().fill('0501234567');
  await page.locator('[data-testid="wizard-publish"]:not([disabled])').click({ timeout: 30000 });

  // 4. Published: the other answer and the checklist
  await page.locator('[data-testid="wizard-published"]').waitFor({ timeout: 60000 });
  const add = await page.locator('[data-testid="wizard-live-add-book"]').count();
  if (!add) fail('no "Now add booking" button after publishing with two answers');
  await page.locator('[data-testid="wizard-live-todo"]').waitFor({ timeout: 90000 }).catch(() => fail("no checklist after publishing"));
  const items = await page.locator('[data-testid^="wizard-live-todo-"]').allInnerTexts();
  console.log('checklist:', items.join(' | '));
  if (!items.some((x) => /kashrut|כשרות/i.test(x))) fail('a food shop is not asked about kashrut');
  await page.locator('[data-testid="wizard-live-todo"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, `published-${lng}.png`) });
  if (add) {
    await page.locator('[data-testid="wizard-live-add-book"]').click();
    await page.locator('[data-testid="wizard-offer-book"][aria-pressed="true"]').waitFor({ timeout: 30000 })
      .catch(() => fail('"Now add booking" did not open the form with Book a time ticked'));
  }
  if (errors.length) fail(errors[0]);
} finally { await browser.close(); }
if (failed) process.exit(1);
console.log('ok: find first, nothing ticked, published, next answer offered, checklist shown');

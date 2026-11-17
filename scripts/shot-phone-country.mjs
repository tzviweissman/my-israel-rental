/**
 * The country selector on the signup form, and the bug it hid.
 *
 * `joinPhone` returns '' for an empty local number — correctly, because a
 * country code alone is not a phone number and must never be stored as
 * one. But the selector read its value straight back out of that stored
 * string, so choosing a country while the number box was empty round-
 * tripped to '', `splitPhone('')` answered with the default, and the
 * selector snapped back to +972. Every attempt to pick a country failed.
 *
 * Why it survived: typing the number FIRST works fine, and that is the
 * order a developer tests in. The natural order for a person is the other
 * one — the selector is the first control in the row — and the phone
 * field is optional, so the box is empty for everyone at signup.
 *
 * The check therefore drives it in the ORDER THAT WAS BROKEN: pick the
 * country on an empty box, confirm it stuck, then type the number and
 * confirm the combined value is right. A test that types first would
 * pass against the bug.
 *
 * Since 17 Nov 2026 sign-up asks no phone ("ours is very busy"), so the
 * check drives the same PhoneInput in Settings (WhatsApp number), signed in
 * as the local test owner (?as=owner, needs DEV_AUTOLOGIN on the API).
 *
 * Usage:
 *   node scripts/shot-phone-country.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const OUT = path.join('screenshots', 'phone-country');
const WIDTHS = [1280, 768, 375];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const failures = [];

/** Settings, where the phone field with the country picker lives now. */
async function openDetails(page) {
  await page.goto(`${APP}/dashboard?tab=settings&as=owner`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('[data-testid="settings-whatsapp-country"]').waitFor({ timeout: 30000 });
  await page.locator('[data-testid="settings-whatsapp-input"]').fill('');
  await page.waitForTimeout(600);
}

try {
  for (const rtl of [false, true]) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: 2,
      });
      if (rtl) {
        await ctx.addInitScript(() => {
          try { localStorage.setItem('i18nextLng', 'he'); } catch { /* private mode */ }
        });
      }
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));

      const label = `${rtl ? 'rtl' : 'ltr'}-${width}`;
      await openDetails(page);
      // The test owner's saved language wins over localStorage once signed in,
      // so the Hebrew pass switches with the toggle when it opened in English.
      if (rtl && await page.evaluate(() => document.documentElement.dir !== 'rtl')) {
        await page.locator('[data-testid="language-toggle"]').first().click();
        await page.waitForFunction(() => document.documentElement.dir === 'rtl', null, { timeout: 10000 });
        await page.locator('[data-testid="settings-whatsapp-country"]').waitFor({ timeout: 15000 });
      }

      const country = page.locator('[data-testid="settings-whatsapp-country"]');
      const number = page.locator('[data-testid="settings-whatsapp-input"]');

      // Every country in the list must be selectable, not just present.
      // Three spread across the list, including one whose dial code is a
      // prefix-collision risk (380 Ukraine vs 38).
      for (const dial of ['1', '44', '380']) {
        await country.selectOption(dial, { timeout: 15000 });
        const shown = await country.inputValue();
        if (shown !== dial) {
          failures.push(
            `${label}: picked +${dial} on an empty number box and the selector went to `
            + `+${shown} — the choice does not stick`,
          );
          break;
        }
      }

      // ...and it must still hold once a number is typed against it.
      await country.selectOption('1');
      await number.fill('7327238572');
      const after = await country.inputValue();
      if (after !== '1') {
        failures.push(`${label}: selector fell back to +${after} after typing a US number`);
      }

      await page.screenshot({ path: path.join(OUT, `${label}.png`) });
      console.log('  wrote', `${label}.png`);

      if (errors.length) {
        failures.push(`${label}: console errors ${JSON.stringify(errors.slice(0, 5))}`);
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('\nall checks passed');

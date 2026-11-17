/**
 * Every screen of the add-business form (/businesses/add), for each of the
 * three listing types, on a laptop and a phone, in English and Hebrew.
 *
 * Opens each screen directly with the development-only ?step=N (CreateGig.jsx),
 * so no photo has to be uploaded to get past "What you offer".
 *
 * If the category list is empty or the form shows "Network Error", the local
 * API is refusing this port: it is an old copy from before 16 Nov 2026
 * (server.py lets any localhost port in only since then). Restart it from an
 * up-to-date checkout.
 *
 * Usage:
 *   APP_ORIGIN=http://localhost:3222 node scripts/shot-business-form.mjs
 * Pictures go to screenshots/business-form/.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const OUT = path.join('screenshots', 'business-form');
const TYPES = { store: 0, deliverable: 1, appointment: 2 };
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const failures = [];
try {
  for (const lang of ['en', 'he']) {
    for (const [w, h, d] of [[1280, 800, 'laptop'], [390, 844, 'phone']]) {
      for (const [type, index] of Object.entries(TYPES)) {
        for (const step of [1, 2, 3, 4]) {
          const ctx = await browser.newContext({ viewport: { width: w, height: h } });
          await ctx.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch { /* private mode */ } }, lang);
          const page = await ctx.newPage();
          const errors = [];
          page.on('pageerror', (e) => errors.push(String(e)));
          await page.goto(`${APP}/businesses/add?step=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.locator('[data-testid="wizard-type-picker"]').waitFor({ timeout: 30000 });
          // The cards sit in the same order in both languages: store, deliverable, appointment.
          await page.locator('[data-testid="wizard-type-picker"] button').nth(index).click();
          if (step > 1) await page.goto(`${APP}/businesses/add?step=${step}`, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);
          await page.evaluate(() => document.querySelectorAll('#webpack-dev-server-client-overlay').forEach((e) => e.remove()));
          if (step === 1 && !(await page.locator('[data-testid^="wizard-cat-"]:not([data-testid*="group"])').count())) {
            failures.push(`${lang} ${d} ${type}: the category list is empty (see the note at the top)`);
          }
          const sw = await page.evaluate(() => document.documentElement.scrollWidth);
          if (sw > w) failures.push(`${lang} ${d} ${type} step ${step}: page is ${sw}px wide, scrolls sideways`);
          if (errors.length) failures.push(`${lang} ${d} ${type} step ${step}: ${errors[0]}`);
          const name = `${lang}-${d}-${type}-${step}.png`;
          await page.screenshot({ path: path.join(OUT, name), fullPage: true });
          console.log('  wrote', name);
          await ctx.close();
        }
      }
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
console.log('\nall screens opened');

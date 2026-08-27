/**
 * The Google button's place in the signup funnel, and the rule behind it.
 *
 * It used to sit on BOTH steps. On step 1 — the role picker — it could be
 * pressed with no card selected, and then nothing remembered what the
 * person came here to be: the account was created as a traveller in
 * silence. Somebody signing up to offer a service landed on a traveller's
 * dashboard with nothing on screen to say why or how to fix it.
 *
 * It now appears only on step 2, which is reachable only by choosing a
 * role, so the empty case cannot occur. And it sits ABOVE the form, so
 * the one-tap route is offered before anyone types a name, a phone number
 * and a password rather than after.
 *
 * Both of those are asserted here rather than left to the eye:
 *
 *   1. Step 1 has no Google button at all.
 *   2. On step 2 the Google button is ABOVE the first form field.
 *
 * The second is the one a screenshot flatters: at some widths a button
 * that has drifted below the fold still photographs fine, so the check is
 * on the measured vertical position, not on presence.
 *
 * Usage:
 *   node scripts/shot-signup-google.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const OUT = path.join('screenshots', 'signup-google');
const WIDTHS = [1280, 768, 375];

const settle = async (page) => {
  await page.waitForTimeout(1200);
  await page.addStyleTag({
    content: '*,*::before,*::after{animation-play-state:paused !important}',
  });
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const failures = [];

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
      // The page keeps a draft of step and role in localStorage, so a
      // previous run would otherwise drop this one straight onto step 2.
      await ctx.addInitScript(() => {
        try { localStorage.removeItem('draft:signup-join'); } catch { /* private mode */ }
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));

      const label = `${rtl ? 'rtl' : 'ltr'}-${width}`;

      // ---- Step 1: the role picker -----------------------------------
      await page.goto(`${APP}/signup`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('[data-testid="signup-join-page"]').waitFor({ timeout: 30000 });
      await settle(page);
      await page.screenshot({ path: path.join(OUT, `${label}-step1.png`), fullPage: true });
      console.log('  wrote', `${label}-step1.png`);

      const googleOnStep1 = await page.locator('[data-testid="google-signin-button"]').count();
      if (googleOnStep1 > 0) {
        failures.push(
          `${label}: step 1 still offers Google — it can be pressed with no role chosen`,
        );
      }

      // ---- Step 2: details, reached by choosing a role ---------------
      // The provider card, because that is the person the old behaviour
      // hurt: a business signing up and silently becoming a traveller.
      await page.locator('[data-testid="signup-role-provider"]').click({ timeout: 15000 });
      await page.locator('[data-testid="signup-continue-btn"]').click({ timeout: 15000 });
      await page.locator('[data-testid="signup-step-details"]').waitFor({ timeout: 20000 });
      await settle(page);
      await page.screenshot({ path: path.join(OUT, `${label}-step2.png`), fullPage: true });
      console.log('  wrote', `${label}-step2.png`);

      const google = page.locator('[data-testid="google-signin-button"]');
      if (await google.count() === 0) {
        failures.push(`${label}: step 2 has no Google button — the one-tap route is gone`);
      } else {
        /* ABOVE the form, measured. "It looks fine" is exactly the check
           that misses a button which has slipped below the first field on
           one breakpoint. */
        const gy = (await google.first().boundingBox())?.y ?? Infinity;
        const fy = (await page.locator('[data-testid="signup-name-input"]').first().boundingBox())?.y ?? -Infinity;
        if (!(gy < fy)) {
          failures.push(
            `${label}: Google button is at y=${Math.round(gy)}, below the first form field `
            + `at y=${Math.round(fy)} — it must come first`,
          );
        }
      }

      // A heading with an inline literal face name loses its Hebrew glyphs
      // silently, and the fallback is close enough to miss by eye.
      const head = await page.locator('h1').first()
        .evaluate((el) => getComputedStyle(el).fontFamily);
      const expect = rtl ? 'Frank Ruhl Libre' : 'Playfair Display';
      if (!head.includes(expect)) {
        failures.push(`${label}: heading font is "${head}", expected ${expect}`);
      }

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

/**
 * Settings → role switch: does the UI offer what the API allows?
 *
 * The bug this exists for: the card offered exactly ONE target per role,
 * and the one missing was `provider` — the business / service side. The
 * API has always accepted renter→provider (see the `allowed` set in
 * backend/routes/auth.py) and nothing on screen ever led there. A traveller
 * who actually runs a cleaning company could only press "Switch to lister",
 * which makes them a PROPERTY owner — the wrong role, and a dead end.
 *
 * So the check is not "does a button exist". It is: **every transition the
 * server accepts from this role has a button, and every button works.**
 * A screenshot cannot tell you about the option that isn't there, which is
 * exactly how this survived.
 *
 * The switch is exercised for real against the local database — renter →
 * provider → renter — because a button that renders and then 400s is the
 * failure mode a static check would miss.
 *
 * Usage:
 *   node scripts/shot-role-switch.mjs <jwt-for-a-renter>
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const token = process.argv[2];
if (!token) {
  console.error('usage: node scripts/shot-role-switch.mjs <jwt>');
  process.exit(1);
}

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const OUT = path.join('screenshots', 'role-switch');
const WIDTHS = [1280, 768, 375];

// Mirrors backend/routes/auth.py. If someone widens the server's set and
// not the UI, this list is where the two are compared.
const ALLOWED_FROM_RENTER = ['owner', 'provider'];

const open = async (browser, width, rtl) => {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript((t) => {
    try { sessionStorage.setItem('token', t); } catch { /* private mode */ }
  }, token);
  if (rtl) {
    await ctx.addInitScript(() => {
      try { localStorage.setItem('i18nextLng', 'he'); } catch { /* private mode */ }
    });
  }
  return ctx;
};

async function openSettings(page) {
  await page.goto(`${APP}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  /* Wait for the tab bar itself before asking which tabs exist. Without
     this the "is Settings on screen?" question is asked of an empty page,
     the answer is always no, and the run fails in the overflow-menu
     branch — a timeout that looks like a missing menu and is really just
     a race. */
  await page.locator('[data-testid="dashboard-tabs"]').waitFor({ timeout: 30000 });

  /* Settings moves into the overflow menu at narrow widths, so it cannot
     just be clicked by id — at some widths the direct tab is not rendered
     and the click would time out on a screen that is perfectly correct. */
  const direct = page.locator('[data-testid="tab-settings"]');
  if (await direct.count() > 0 && await direct.first().isVisible()) {
    await direct.first().click({ timeout: 15000 });
  } else {
    await page.locator('[data-testid="tab-more"]').click({ timeout: 15000 });
    await page.locator('[data-testid="tab-more-settings"]').click({ timeout: 15000 });
  }
  await page.locator('[data-testid="role-switch-card-provider"]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(900);
  await page.addStyleTag({
    content: '*,*::before,*::after{animation-play-state:paused !important}',
  });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const failures = [];

try {
  for (const rtl of [false, true]) {
    for (const width of WIDTHS) {
      const ctx = await open(browser, width, rtl);
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));

      const label = `${rtl ? 'rtl' : 'ltr'}-${width}`;
      await openSettings(page);
      await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: true });
      console.log('  wrote', `${label}.png`);

      // Every server-allowed target must be reachable from this screen.
      for (const target of ALLOWED_FROM_RENTER) {
        const n = await page.locator(`[data-testid="switch-role-btn-${target}"]`).count();
        if (n === 0) {
          failures.push(
            `${label}: no way to switch to "${target}" — the API accepts it but nothing offers it`,
          );
        }
      }

      const head = await page.locator('h3').first()
        .evaluate((el) => getComputedStyle(el).fontFamily).catch(() => '');
      if (errors.length) {
        failures.push(`${label}: console errors ${JSON.stringify(errors.slice(0, 5))}`);
      }
      void head;
      await ctx.close();
    }
  }

  // ---- The button has to actually work, not just render ---------------
  const ctx = await open(browser, 1280, false);
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());          // the confirm()
  await openSettings(page);

  await page.locator('[data-testid="switch-role-btn-provider"]').click();
  // Becoming a provider re-renders the card set: the provider option goes
  // away and "switch to lister" / "switch to renter" remain.
  await page.locator('[data-testid="switch-role-btn-renter"]').waitFor({ timeout: 20000 });
  const stillOffersProvider = await page
    .locator('[data-testid="switch-role-btn-provider"]').count();
  if (stillOffersProvider !== 0) {
    failures.push('after switching to provider the UI still offers switching to provider');
  }
  console.log('  renter -> provider: ok');

  // Put it back, so the seed account is left as it was found.
  await page.locator('[data-testid="switch-role-btn-renter"]').click();
  await page.locator('[data-testid="switch-role-btn-provider"]').waitFor({ timeout: 20000 });
  console.log('  provider -> renter: restored');
  await ctx.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('\nall checks passed');

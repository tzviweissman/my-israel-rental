/**
 * Screenshots of signed-in nav states.
 *
 * The account pill has no preview file to diff against, so these captures
 * ARE the review artifact rather than a check against one.
 *
 * Playwright runs its own browser profile with no session, so the token is
 * injected via addInitScript — that runs before any page script, which
 * matters: setting sessionStorage after navigation means React has already
 * mounted logged-out and read an empty store, so the first paint (the thing
 * being photographed) is the wrong state.
 *
 * The token is passed in as an argument and never written to disk here. It
 * is a local dev credential for a seeded test account on 127.0.0.1 — but
 * baking any token into a committed file is a habit worth not forming.
 *
 * Usage:
 *   node scripts/shot-authed.mjs <jwt>
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const token = process.argv[2];
if (!token) {
  console.error('usage: node scripts/shot-authed.mjs <jwt>');
  process.exit(1);
}

const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const OUT = path.join('screenshots', 'authed');

const open = async (browser, width) => {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2,
  });
  // Before any app script runs.
  await ctx.addInitScript((t) => {
    try { sessionStorage.setItem('token', t); } catch { /* private mode */ }
  }, token);
  return ctx;
};

const settle = async (page) => {
  await page.waitForTimeout(1500);
  await page.addStyleTag({
    content: '*,*::before,*::after{animation-play-state:paused !important}',
  });
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [1280, 375]) {
    const ctx = await open(browser, width);
    const page = await ctx.newPage();
    // /stays so the drawer is photographed over real content, which is the
    // whole point of the .92 alpha.
    await page.goto(`${APP}/stays`, { waitUntil: 'networkidle', timeout: 60000 });
    await settle(page);

    const label = width === 1280 ? 'desktop' : 'mobile';

    // Confirm we are actually signed in before shooting. Without this a
    // silent auth failure produces a logged-OUT screenshot that looks
    // perfectly fine and proves nothing.
    const signedIn = await page.evaluate(() => !!sessionStorage.getItem('token'));
    const pill = page.locator('[data-testid="nav-menu-button"]');
    if (!signedIn || !(await pill.count())) {
      console.error(`  !! ${label}: not signed in (token=${signedIn}) — aborting`);
      await ctx.close();
      continue;
    }

    await page.screenshot({ path: path.join(OUT, `${label}-closed.png`) });
    console.log('  wrote', `${label}-closed.png`);

    await pill.click();
    await page
      .locator('[data-testid="nav-menu-dropdown"]')
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(350);

    await page.screenshot({ path: path.join(OUT, `${label}-open.png`) });
    console.log('  wrote', `${label}-open.png`);

    await ctx.close();
  }
} finally {
  await browser.close();
}

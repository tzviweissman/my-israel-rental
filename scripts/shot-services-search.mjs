/**
 * `?q=` on /services still filters, and says that it is filtering.
 *
 * There is deliberately NO search box in the hero bar (removed 28 Aug 2026
 * — the reasoning is on ServicesHeroSearch itself). But the backend search
 * is real and `Services.jsx` still reads `q` from the URL and forwards it,
 * so a shared or hand-edited link carrying `?q=` filters the grid.
 *
 * That is the state worth pinning. A URL that quietly returns three
 * results out of two hundred, with nothing on screen explaining why and no
 * way back, is worse than one that does not filter at all — and it is easy
 * to reach that state by accident when the control that used to set the
 * parameter is gone. So:
 *
 *   * `?q=` reaches the API rather than being dropped
 *   * the chip appears, naming the query, and clears it in one tap
 *   * no free-text input has crept back into the hero bar unnoticed
 *
 * Usage: node scripts/shot-services-search.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const browser = await chromium.launch();
const failures = [];

try {
  for (const [name, term, rtl] of [['english', 'clean', false], ['hebrew', 'ניקיון', true]]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (rtl) {
      await ctx.addInitScript(() => {
        try { localStorage.setItem('i18nextLng', 'he'); } catch { /* private mode */ }
      });
    }
    const page = await ctx.newPage();
    const apiCalls = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/marketplace/gigs')) apiCalls.push(r.url());
    });

    await page.goto(`${APP}/businesses?q=${encodeURIComponent(term)}`, {
      waitUntil: 'domcontentloaded', timeout: 60000,
    });
    await page.locator('[data-testid="services-hero-search"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(1800);

    const sent = apiCalls.some((u) => {
      try { return new URL(u).searchParams.get('q') === term; } catch { return false; }
    });
    if (!sent) {
      failures.push(`${name}: "?q=${term}" never reached the API — a shared link silently does nothing`);
    }

    const chip = page.locator('[data-testid="active-filter-q"]');
    if (await chip.count() === 0) {
      failures.push(
        `${name}: the grid is filtered by "${term}" with no chip — nothing on screen `
        + 'explains the short list and there is no way to clear it',
      );
    } else {
      await chip.click();
      await page.waitForTimeout(1200);
      if (new URL(page.url()).searchParams.get('q')) {
        failures.push(`${name}: the chip did not clear the search`);
      }
    }
    console.log(`  ${name}: "?q=${term}" reached api=${sent}, chip present=${await chip.count() > 0 || 'cleared'}`);
    await ctx.close();
  }

  // ---- and no box has crept back in ------------------------------------
  for (const width of [1280, 375]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${APP}/businesses`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('[data-testid="services-hero-search"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(900);
    const inputs = await page.locator(
      '[data-testid="services-hero-search"] input[type="search"], [data-testid="services-hero-search"] input[type="text"]',
    ).count();
    if (inputs > 0) {
      failures.push(
        `@${width}: a free-text input is back in the hero bar. That may be intended — `
        + 'if so, update this check and the note on ServicesHeroSearch.',
      );
    }
    console.log(`  @${width}px: hero bar free-text inputs = ${inputs}`);
    await ctx.close();
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

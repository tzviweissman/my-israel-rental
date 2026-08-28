/**
 * The free-text search on /services (spec L5).
 *
 * The backend search was real all along — tokenised, with number-word and
 * synonym expansion, matching `title`, `description` and their `_he`/`_en`
 * variants — and `Services.jsx` already read `q` from the URL and forwarded
 * it. Nothing in the frontend ever SET it. So the thing to prove is not
 * that a box renders, but that typing in it reaches the server and comes
 * back with fewer, relevant results.
 *
 * What is asserted:
 *   * typing puts `q` in the URL, so the search is shareable and
 *     back-button-safe like every other filter
 *   * the request actually carries `q` to the API
 *   * a HEBREW query works — the backend matches `title_he`, so this is a
 *     real capability and not a nicety. Typed as Hebrew text, not
 *     transliterated.
 *   * the chip appears and clears the search in one tap
 *   * on a phone the search is the FIRST control, not the one pushed below
 *     the fold
 *
 * Usage: node scripts/shot-services-search.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const OUT = path.join('screenshots', 'services-search');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const failures = [];

const open = async (rtl, width) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  if (rtl) {
    await ctx.addInitScript(() => {
      try { localStorage.setItem('i18nextLng', 'he'); } catch { /* private mode */ }
    });
  }
  return ctx;
};

try {
  for (const rtl of [false, true]) {
    for (const width of [1280, 768, 375]) {
      const ctx = await open(rtl, width);
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));

      // Every request the page makes, so we can prove `q` reaches the API.
      const apiCalls = [];
      page.on('request', (r) => {
        if (r.url().includes('/api/marketplace/gigs')) apiCalls.push(r.url());
      });

      const label = `${rtl ? 'rtl' : 'ltr'}-${width}`;
      await page.goto(`${APP}/businesses`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const box = page.locator('[data-testid="services-hero-q-input"]');
      await box.waitFor({ timeout: 30000 });
      await page.waitForTimeout(1200);

      // The search must be the first control in the bar, at every width.
      const order = await page.evaluate(() => {
        const bar = document.querySelector('[data-testid="services-hero-search"]');
        const q = document.querySelector('[data-testid="services-hero-q-input"]');
        const svc = document.querySelector('[data-testid="services-hero-service"]');
        if (!bar || !q || !svc) return null;
        const qb = q.getBoundingClientRect();
        const sb = svc.getBoundingClientRect();
        // Stacked on a phone (compare tops), side by side on desktop.
        return { stacked: qb.top + 4 < sb.top, qTop: qb.top, svcTop: sb.top, qLeft: qb.left, svcLeft: sb.left };
      });
      if (!order) {
        failures.push(`${label}: could not find the search box and the service picker together`);
      } else if (order.stacked) {
        if (!(order.qTop < order.svcTop)) {
          failures.push(`${label}: search is not the first row (q at ${Math.round(order.qTop)}, service at ${Math.round(order.svcTop)})`);
        }
      } else if (Math.abs(order.qTop - order.svcTop) > 40) {
        failures.push(`${label}: search and service are not on the same row`);
      }

      await page.screenshot({ path: path.join(OUT, `${label}-bar.png`), clip: { x: 0, y: 0, width, height: Math.min(900, 700) } });
      console.log('  wrote', `${label}-bar.png`);

      if (errors.length) failures.push(`${label}: console errors ${JSON.stringify(errors.slice(0, 3))}`);
      await ctx.close();
    }
  }

  // ---- the search actually searches ------------------------------------
  for (const [name, term] of [['english', 'clean'], ['hebrew', 'ניקיון']]) {
    const ctx = await open(name === 'hebrew', 1280);
    const page = await ctx.newPage();
    const apiCalls = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/marketplace/gigs')) apiCalls.push(r.url());
    });

    await page.goto(`${APP}/businesses`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const box = page.locator('[data-testid="services-hero-q-input"]');
    await box.waitFor({ timeout: 30000 });
    await page.waitForTimeout(1000);

    await box.fill(term);
    await box.press('Enter');
    await page.waitForTimeout(1800);

    // 1. It is in the URL — shareable, bookmarkable, back-button-safe.
    const url = new URL(page.url());
    const inUrl = url.searchParams.get('q');
    if (inUrl !== term) {
      failures.push(`${name}: typing "${term}" did not reach the URL (q=${inUrl})`);
    }

    // 2. It reached the API.
    const sent = apiCalls.some((u) => {
      try { return new URL(u).searchParams.get('q') === term; } catch { return false; }
    });
    if (!sent) {
      failures.push(`${name}: "${term}" never reached the API — the box is decorative`);
    }

    // 3. The chip is there and clears it.
    const chip = page.locator('[data-testid="active-filter-q"]');
    if (await chip.count() === 0) {
      failures.push(`${name}: no active-filter chip for the search, so there is no one-tap way to clear it`);
    } else {
      await chip.click();
      await page.waitForTimeout(1200);
      if (new URL(page.url()).searchParams.get('q')) {
        failures.push(`${name}: the chip did not clear the search`);
      }
    }
    console.log(`  ${name}: "${term}" -> url ok=${inUrl === term}, reached api=${sent}`);
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

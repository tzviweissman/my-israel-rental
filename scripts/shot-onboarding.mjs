/**
 * Onboarding (T1 checklist, T2 tips, T7 help) — captures and the invariants
 * a capture cannot show.
 *
 * The one that matters most: **never more than one of these on screen at a
 * time**. Both T2 and T7 say it, and the tempting reading is that the tips
 * live on different screens so they cannot collide. That is a coincidence
 * of today's routing, not a guarantee — so this counts what is actually
 * visible rather than trusting the arrangement.
 *
 * Also checked, because none of it photographs:
 *   * the checklist is computed from RECORDS — the endowed row is ticked
 *     and an unfinished row is not, matching the API's own answer
 *   * a percentage never appears without the next action beside it
 *   * the help control exists on every width and both directions, and its
 *     menu opens with all three entries
 *   * headings resolve to a face that HAS Hebrew glyphs under dir=rtl
 *
 * Usage:
 *   node scripts/shot-onboarding.mjs <jwt>
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const token = process.argv[2];
if (!token) {
  console.error('usage: node scripts/shot-onboarding.mjs <jwt>');
  process.exit(1);
}

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const OUT = path.join('screenshots', 'onboarding');
const WIDTHS = [1280, 768, 375];

// Everything that competes for the single on-screen slot.
const SLOT_SELECTOR = '[data-testid^="onboarding-tip"], [data-testid^="show-around-"]';

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

/** How many slot-competing elements are actually visible right now. */
async function visibleSlotCount(page) {
  return page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    const shown = els.filter((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    });
    /* Only OUTERMOST matches count. A tip's own dismiss button carries a
       testid with the same prefix, so counting every match reported one
       visible tip as three and would have failed forever on correct code
       — a check that cries wolf gets ignored, which is worse than none. */
    return shown
      .filter((el) => !shown.some((other) => other !== el && other.contains(el)))
      .map((el) => el.dataset.testid);
  }, SLOT_SELECTOR);
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
      await page.goto(`${APP}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('[data-testid="dashboard-page"]').waitFor({ timeout: 30000 });
      // The checklist arrives with /onboarding/state, not with the page.
      await page.locator('[data-testid="setup-checklist"]').waitFor({ timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.addStyleTag({
        content: '*,*::before,*::after{animation-play-state:paused !important}',
      });

      await page.screenshot({ path: path.join(OUT, `${label}-dashboard.png`), fullPage: true });
      console.log('  wrote', `${label}-dashboard.png`);

      // ---- one slot, not two -------------------------------------------
      const visible = await visibleSlotCount(page);
      if (visible.length > 1) {
        failures.push(`${label}: ${visible.length} onboarding elements on screen at once: ${visible.join(', ')}`);
      }

      // ---- computed from records ---------------------------------------
      const endowed = page.locator('[data-testid="setup-item-biz.named"]');
      if (await endowed.count() === 0) {
        failures.push(`${label}: the endowed checklist row is missing`);
      } else if (await endowed.getAttribute('data-done') !== 'true') {
        failures.push(`${label}: endowed row is not ticked — nobody should start at zero`);
      }
      // The seeded business genuinely has no hours, so this must be open.
      const hours = page.locator('[data-testid="setup-item-biz.hours"]');
      if (await hours.count() && await hours.getAttribute('data-done') !== 'false') {
        failures.push(`${label}: "set your hours" is ticked but the record has no hours`);
      }

      // ---- a count is never shown without the next action ---------------
      const hasCount = await page.locator('[data-testid="setup-checklist"] [role="progressbar"]').count();
      const hasAction = await page.locator('[data-testid^="setup-action-"]').count();
      if (hasCount > 0 && hasAction === 0) {
        failures.push(`${label}: progress shown with no next action beside it`);
      }

      /* ---- the permanent help control ------------------------------
         It lives in the NAV MENU now, not in the dashboard header: one
         predictable home reachable from every page, rather than a "Help"
         button on the dashboard competing with a burger in the nav for
         the same job. */
      const help = page.locator('[data-testid="nav-menu-button"]');
      if (await help.count() === 0) {
        failures.push(`${label}: no help control in the dashboard header`);
      } else {
        await help.click();
        await page.locator('[data-testid="nav-menu-dropdown"]').waitFor({ timeout: 8000 });
        for (const entry of ['nav-show-around', 'nav-what-you-can-do', 'nav-faq']) {
          if (await page.locator(`[data-testid="${entry}"]`).count() === 0) {
            failures.push(`${label}: help menu is missing "${entry}"`);
          }
        }
        // The menu must hang inside the viewport, not off the edge — the
        // classic RTL failure for anything anchored to a button.
        const box = await page.locator('[data-testid="nav-menu-dropdown"]').boundingBox();
        if (box && (box.x < -1 || box.x + box.width > width + 1)) {
          failures.push(
            `${label}: help menu sits outside the viewport (x=${Math.round(box.x)}, w=${Math.round(box.width)}, vw=${width})`,
          );
        }
        await page.screenshot({ path: path.join(OUT, `${label}-help-menu.png`) });
        await page.keyboard.press('Escape');
      }

      // ---- RTL fonts -----------------------------------------------------
      const head = await page.locator('[data-testid="setup-checklist"] h2').first()
        .evaluate((el) => getComputedStyle(el).fontFamily);
      const expect = rtl ? 'Frank Ruhl Libre' : 'Playfair Display';
      if (!head.includes(expect)) {
        failures.push(`${label}: checklist heading font is "${head}", expected ${expect}`);
      }

      if (errors.length) {
        failures.push(`${label}: console errors ${JSON.stringify(errors.slice(0, 4))}`);
      }
      await ctx.close();
    }
  }

  // ---- a tip appears where its feature lives, and only one ------------
  const ctx = await open(browser, 1280, false);
  const page = await ctx.newPage();
  await page.goto(`${APP}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('[data-testid="tab-my-businesses"]').click({ timeout: 30000 });
  await page.locator('[data-testid="block-time-panel"]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const onTab = await visibleSlotCount(page);
  console.log('  slot occupants on the businesses tab:', onTab.join(', ') || 'none');
  if (onTab.length > 1) {
    failures.push(`businesses tab: ${onTab.length} onboarding elements at once: ${onTab.join(', ')}`);
  }
  if (!onTab.includes('onboarding-tip.availability')) {
    failures.push('businesses tab: the availability tip did not take the slot it should win');
  }
  await page.screenshot({ path: path.join(OUT, 'tip-availability.png'), fullPage: true });
  console.log('  wrote tip-availability.png');
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

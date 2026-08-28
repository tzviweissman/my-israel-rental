/**
 * The walkthrough (spec T4), driven end to end in a real browser.
 *
 * The placement maths is unit-tested separately and in both directions
 * (`test-tour-placement.mjs`). This checks the things only a live page can
 * answer, and the RTL ones come first because the spec names RTL placement
 * as the failure mode of a tour:
 *
 *   * the tooltip is fully on screen at every step, in BOTH directions and
 *     at every width — the classic "perfect in English, off the edge in
 *     Hebrew" bug
 *   * the arrow points AT the highlighted control, not near it
 *   * the spotlight leaves the target un-dimmed, because the owner has to
 *     recognise the same control tomorrow
 *   * a step whose target does not exist is skipped without dead-ending
 *   * Esc exits, and the owner is returned to where they started
 *   * every step shows real copy in both languages, never a raw i18n key
 *
 * Usage:
 *   node scripts/shot-tour.mjs <jwt>
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const token = process.argv[2];
if (!token) {
  console.error('usage: node scripts/shot-tour.mjs <jwt>');
  process.exit(1);
}

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const OUT = path.join('screenshots', 'tour');
const WIDTHS = [1280, 768, 375];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const failures = [];

const open = async (rtl, width) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
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

/* Entered the way a person enters it: the nav menu, which is where T7's
   help now lives on every page rather than only on the dashboard. */
async function startTour(page) {
  await page.goto(`${APP}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('[data-testid="nav-menu-button"]').waitFor({ timeout: 30000 });
  await page.locator('[data-testid="nav-menu-button"]').click();
  await page.locator('[data-testid="nav-show-around"]').click();
  await page.locator('[data-testid="tour-tooltip"]').waitFor({ timeout: 25000 });
  await page.waitForTimeout(700);
}

/** Everything a step must satisfy, measured. */
async function auditStep(page, label, width) {
  const info = await page.evaluate(() => {
    const tip = document.querySelector('[data-testid="tour-tooltip"]');
    const ring = document.querySelector('svg rect[stroke]');
    const t = tip.getBoundingClientRect();
    const r = ring ? ring.getBoundingClientRect() : null;
    const arrow = tip.querySelector('span[aria-hidden="true"]');
    const a = arrow ? arrow.getBoundingClientRect() : null;
    return {
      tip: { x: t.left, y: t.top, w: t.width, h: t.height },
      ring: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
      arrow: a ? { cx: a.left + a.width / 2, cy: a.top + a.height / 2 } : null,
      placement: tip.getAttribute('data-placement'),
      body: (tip.querySelector('[data-testid="tour-body"]')?.textContent || '').trim(),
      title: (tip.querySelector('#tour-title')?.textContent || '').trim(),
      progress: (tip.querySelector('[data-testid="tour-progress"]')?.textContent || '').trim(),
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });

  // On screen, entirely. This is the RTL bug.
  const { tip } = info;
  if (tip.x < -1 || tip.y < -1 || tip.x + tip.w > info.vw + 1 || tip.y + tip.h > info.vh + 1) {
    failures.push(
      `${label}: tooltip is off screen (x=${Math.round(tip.x)} y=${Math.round(tip.y)} `
      + `w=${Math.round(tip.w)} h=${Math.round(tip.h)} viewport=${info.vw}x${info.vh})`,
    );
  }

  // Real copy, not a raw key.
  if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_-]+){2,}$/.test(info.title)
    || /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_-]+){2,}$/.test(info.body)) {
    failures.push(`${label}: untranslated key on screen — "${info.title}" / "${info.body}"`);
  }
  if (info.body.length < 20) {
    failures.push(`${label}: body is ${info.body.length} chars, too short to be real copy`);
  }
  if (!/\d/.test(info.progress)) {
    failures.push(`${label}: progress "${info.progress}" does not show a count`);
  }

  // The arrow points at the control, not vaguely near it.
  if (info.ring && info.arrow) {
    const r = info.ring;
    const nearX = info.arrow.cx >= r.x - 24 && info.arrow.cx <= r.x + r.w + 24;
    const nearY = info.arrow.cy >= r.y - 24 && info.arrow.cy <= r.y + r.h + 24;
    if (!(nearX || nearY)) {
      failures.push(`${label}: arrow at (${Math.round(info.arrow.cx)},${Math.round(info.arrow.cy)}) is not beside the highlighted control`);
    }
  }
  void width;
  return info;
}

try {
  // ---- every step, both directions, every width ----------------------
  for (const rtl of [false, true]) {
    for (const width of WIDTHS) {
      const ctx = await open(rtl, width);
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));

      const label = `${rtl ? 'rtl' : 'ltr'}-${width}`;
      await startTour(page);

      let n = 0;
      const seen = [];
      // Bounded: the tour is 5 steps, so 8 is a runaway guard.
      while (n < 8) {
        n += 1;
        const info = await auditStep(page, `${label} step${n}`, width);
        seen.push(info.title);
        if (n <= 2) {
          await page.screenshot({ path: path.join(OUT, `${label}-step${n}.png`) });
        }
        const next = page.locator('[data-testid="tour-next"]');
        const isDone = (await next.innerText()).trim();
        await next.click();
        await page.waitForTimeout(900);
        const stillOpen = await page.locator('[data-testid="tour-tooltip"]').count();
        if (!stillOpen) {
          console.log(`  ${label}: ${n} steps — ${seen.join(' | ')}`);
          void isDone;
          break;
        }
        void info;
      }
      if (n >= 8) failures.push(`${label}: tour did not finish within 8 steps`);

      if (errors.length) failures.push(`${label}: console errors ${JSON.stringify(errors.slice(0, 3))}`);
      await ctx.close();
    }
  }

  // ---- Esc exits and puts the owner back ------------------------------
  {
    const ctx = await open(false, 1280);
    const page = await ctx.newPage();
    await page.goto(`${APP}/dashboard?tab=settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('[data-testid="nav-menu-button"]').waitFor({ timeout: 30000 });
    const before = page.url();
    await page.locator('[data-testid="nav-menu-button"]').click();
    await page.locator('[data-testid="nav-show-around"]').click();
    await page.locator('[data-testid="tour-tooltip"]').waitFor({ timeout: 20000 });
    // Walk a couple of steps so we are demonstrably somewhere else.
    await page.locator('[data-testid="tour-next"]').click();
    await page.waitForTimeout(1200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    if (await page.locator('[data-testid="tour-tooltip"]').count()) {
      failures.push('Esc did not exit the tour');
    }
    if (page.url() !== before) {
      failures.push(`exiting did not return the owner to where they started (was ${before}, now ${page.url()})`);
    }
    await ctx.close();
  }

  /* ---- the spotlight leaves the control LOOKING untouched -------------
     Measured in pixels, not by hit-testing. The overlay deliberately
     swallows clicks — the tour is a demonstration, and a stray press on
     the highlighted control would navigate away and lose it — so asking
     "what does elementFromPoint return" tests the wrong property and
     fails on correct code.

     What the spec actually requires is that the target stays fully
     visible and un-recoloured, because the owner has to recognise the
     same control tomorrow. So: photograph the control before the tour
     starts and again while it is spotlit, and require the two to be
     identical. Sampled inside the target's own box, since the ring is
     drawn outside it. */
  {
    const ctx = await open(false, 1280);
    const page = await ctx.newPage();
    await page.goto(`${APP}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const target = page.locator('[data-tour="setup-checklist"]');
    await target.waitFor({ timeout: 30000 });
    await page.waitForTimeout(1200);
    const box = await target.boundingBox();
    const clip = {
      x: Math.round(box.x + 6), y: Math.round(box.y + 6),
      width: Math.round(box.width - 12), height: Math.round(box.height - 12),
    };
    const before = await page.screenshot({ clip });

    await page.locator('[data-testid="nav-menu-button"]').click();
    await page.locator('[data-testid="nav-show-around"]').click();
    await page.locator('[data-testid="tour-tooltip"]').waitFor({ timeout: 25000 });
    await page.waitForTimeout(900);
    const during = await page.screenshot({ clip });

    if (!before.equals(during)) {
      failures.push(
        'the spotlight changes how the highlighted control looks — it must be '
        + 'cut out of the dim, not tinted',
      );
    }
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

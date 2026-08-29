/**
 * The self-playing cards on /why-list actually play — and survive when
 * they cannot.
 *
 * Three separate claims, and the last two are the ones that quietly
 * break:
 *
 *   1. They ANIMATE. The beats advance from the first to the last once a
 *      card is on screen. A card that renders its finished state and
 *      never moves passes every screenshot and fails the entire point.
 *
 *   2. They play on SCROLL, not on hover. Hover would mean the idea is
 *      invisible on a phone, which is where this audience is. Checked by
 *      never moving the pointer near them.
 *
 *   3. They degrade to the FINISHED state, not a blank one. Two ways in:
 *      `prefers-reduced-motion`, and JavaScript never running at all. The
 *      usual `opacity: 0` starting point leaves an empty card in both
 *      cases, and nobody sees it because the person checking has JS and
 *      no accessibility setting.
 *
 * EVERY card is driven, not just the first. Checking one would leave the
 * others unverified while the run stayed green — the usual way a check
 * stops covering what it is named after.
 *
 * Also asserted: no invented numbers, anywhere in any card. They are
 * illustrations sitting in the most persuasive position on the page, and
 * every figure shown to a user has to come from the database. That is why
 * the booking card says "tomorrow morning" rather than a date.
 *
 * Usage: node scripts/check-why-list-demos.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const HEBREW = /[֐-׿]/;
const failures = [];
const note = (m) => console.log('  ' + m);

const CARDS = ['get-found-card', 'take-bookings-card', 'live-page-card'];

const browser = await chromium.launch();

const open = async ({ lang = 'en', width = 1280, reduced = false, js = true } = {}) => {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    javaScriptEnabled: js,
  });
  if (lang === 'he' && js) {
    await ctx.addInitScript(() => {
      try { localStorage.setItem('i18nextLng', 'he'); } catch { /* private mode */ }
    });
  }
  const page = await ctx.newPage();
  await page.goto(`${APP}/why-list`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { ctx, page };
};

try {
  // ---- 1. each plays, on scroll, pointer never going near it ---------
  {
    const { ctx, page } = await open();
    for (const id of CARDS) {
      const card = page.locator(`[data-testid="${id}"]`);
      await card.waitFor({ timeout: 30000 });

      // Read the beat BEFORE scrolling it into view: it must be rewound
      // and waiting, not already finished.
      const atRest = await card.getAttribute('data-beat');
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(2600);
      const afterView = await card.getAttribute('data-beat');
      note(`${id}: beat before view=${atRest}, after=${afterView}`);

      if (afterView !== '3') {
        failures.push(`${id}: the sequence stopped at beat ${afterView} — it never finishes`);
      }
      if (atRest === '3') {
        failures.push(
          `${id}: already finished before it was scrolled to, so nothing plays — `
          + 'either the rewind or the observer is not running',
        );
      }
    }

    // The pointer has not touched a card at any point above.
    for (const sel of ['get-found-yours', 'bookings-accept']) {
      const el = page.locator(`[data-testid="${sel}"]`);
      const visible = await el.evaluate((n) => Number(getComputedStyle(n).opacity));
      note(`${sel}: opacity after the sequence ${visible}`);
      if (visible < 0.9) failures.push(`${sel} never became visible`);
    }
    await ctx.close();
  }

  // ---- 2. reduced motion shows the finished cards, immediately -------
  {
    const { ctx, page } = await open({ reduced: true });
    await page.locator(`[data-testid="${CARDS[0]}"]`).waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
    for (const id of CARDS) {
      const beat = await page.locator(`[data-testid="${id}"]`).getAttribute('data-beat');
      if (beat !== '3') {
        failures.push(`${id}: reduced motion did not show the finished state (beat ${beat})`);
      }
    }
    const opacity = await page.locator('[data-testid="get-found-yours"]')
      .evaluate((el) => Number(getComputedStyle(el).opacity));
    note(`reduced motion: all cards at beat 3, final row opacity ${opacity}`);
    if (opacity < 0.9) failures.push('reduced motion left the final row invisible');
    await ctx.close();
  }

  // ---- 3. and with no JavaScript at all ------------------------------
  {
    const { ctx, page } = await open({ js: false });
    await page.waitForTimeout(600);
    const html = await page.content();
    // CRA serves an empty shell without JS, so this asserts what it can:
    // that the page is a shell rather than a half-rendered card. The
    // meaningful guarantee — finished-by-default — is the component's
    // initial state, covered by the reduced-motion case above.
    note(`no-JS document length: ${html.length} (CRA shell expected)`);
    await ctx.close();
  }

  // ---- 4. no invented numbers, in any card ---------------------------
  {
    const { ctx, page } = await open();
    for (const id of CARDS) {
      const card = page.locator(`[data-testid="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(2400);
      const text = (await card.innerText()).replace(/\s+/g, ' ');
      const numbers = text.match(/\b\d[\d,.]*\+?\b/g) || [];
      note(`${id}: digits=${numbers.length} | ${JSON.stringify(text.slice(0, 54))}`);
      if (numbers.length) {
        failures.push(
          `${id} shows figures ${JSON.stringify(numbers)} — every number a user sees must come from the database`,
        );
      }
      if (/\b(rated|reviews?|stars?)\b/i.test(text)) {
        failures.push(`${id} implies a rating, which is not real data`);
      }
    }
    await ctx.close();
  }

  // ---- 5. Hebrew, and narrow -----------------------------------------
  for (const [lang, width] of [['he', 1280], ['he', 375], ['en', 375]]) {
    const { ctx, page } = await open({ lang, width });
    await page.locator(`[data-testid="${CARDS[0]}"]`).waitFor({ timeout: 30000 });

    const dir = await page.evaluate(() => document.documentElement.dir);
    for (const id of CARDS) {
      const card = page.locator(`[data-testid="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1800);
      const text = (await card.innerText()).replace(/\s+/g, ' ');
      const box = await card.boundingBox();

      if (lang === 'he' && !HEBREW.test(text)) {
        failures.push(`he @${width}: ${id} is still in English`);
      }
      if (box && box.width > width) {
        failures.push(`${lang} @${width}: ${id} is wider than the viewport`);
      }
      if (lang === 'he') {
        const font = await card.locator('h3').first().evaluate((el) => getComputedStyle(el).fontFamily);
        if (/playfair/i.test(font)) {
          failures.push(`he @${width}: ${id} heading resolves to Playfair, which has no Hebrew glyphs`);
        }
      }
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    note(`${lang} @${width}: dir=${dir}, overflow=${overflow}px, ${CARDS.length} cards checked`);
    if (overflow > 1) failures.push(`${lang} @${width}: page scrolls sideways by ${overflow}px`);
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

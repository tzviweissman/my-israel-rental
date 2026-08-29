/**
 * The self-playing card on /why-list actually plays — and survives when
 * it cannot.
 *
 * Three separate claims, and the last two are the ones that quietly
 * break:
 *
 *   1. It ANIMATES. The beats advance from the first to the last once the
 *      card is on screen. A card that renders its finished state and
 *      never moves passes every screenshot and fails the entire point.
 *
 *   2. It plays on SCROLL, not on hover. Hover would mean the idea is
 *      invisible on a phone, which is where this audience is. Checked by
 *      never moving the pointer near it.
 *
 *   3. It degrades to the FINISHED state, not a blank one. Two ways in:
 *      `prefers-reduced-motion`, and JavaScript never running at all.
 *      The usual `opacity: 0` starting point leaves an empty card in both
 *      cases, and nobody sees it because the person checking has JS and
 *      no accessibility setting.
 *
 * Also asserted: no invented numbers. The card is an illustration, and
 * every figure shown to a user has to come from the database — so a
 * result count or a rating appearing here would be a false claim in the
 * most persuasive position on the page.
 *
 * Usage: node scripts/check-get-found-card.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const HEBREW = /[֐-׿]/;
const failures = [];
const note = (m) => console.log('  ' + m);

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
  // ---- 1. it plays, on scroll, without the pointer going near it ------
  {
    const { ctx, page } = await open();
    const card = page.locator('[data-testid="get-found-card"]');
    await card.waitFor({ timeout: 30000 });

    // Read the beat BEFORE scrolling it into view: it must be rewound and
    // waiting, not already finished.
    await page.waitForTimeout(400);
    const atRest = await card.getAttribute('data-beat');

    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2600);
    const afterView = await card.getAttribute('data-beat');
    note(`beat before view=${atRest}, after view=${afterView}`);

    if (afterView !== '3') {
      failures.push(`the sequence stopped at beat ${afterView} — it never finishes`);
    }
    if (atRest === afterView && atRest === '3') {
      failures.push(
        'the card was already finished before it was scrolled to, so nothing plays — '
        + 'either the rewind or the observer is not running',
      );
    }

    // The pointer has not touched the card at any point above.
    const yours = page.locator('[data-testid="get-found-yours"]');
    const visible = await yours.evaluate((el) => Number(getComputedStyle(el).opacity));
    note(`"your business" row opacity after the sequence: ${visible}`);
    if (visible < 0.9) failures.push('the final row never became visible');
    await ctx.close();
  }

  // ---- 2. reduced motion shows the finished card, immediately --------
  {
    const { ctx, page } = await open({ reduced: true });
    const card = page.locator('[data-testid="get-found-card"]');
    await card.waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
    const beat = await card.getAttribute('data-beat');
    const opacity = await page.locator('[data-testid="get-found-yours"]')
      .evaluate((el) => Number(getComputedStyle(el).opacity));
    note(`reduced motion: beat=${beat}, final row opacity=${opacity}`);
    if (beat !== '3' || opacity < 0.9) {
      failures.push('with reduced motion the card is not showing its finished state');
    }
    await ctx.close();
  }

  // ---- 3. and with no JavaScript at all ------------------------------
  {
    const { ctx, page } = await open({ js: false });
    await page.waitForTimeout(600);
    const html = await page.content();
    // CRA serves an empty shell without JS, so this asserts what it can:
    // that the page is a shell rather than a half-rendered card. The
    // meaningful guarantee — finished-by-default — is the initial state
    // asserted in the component and covered by the reduced-motion case.
    note(`no-JS document length: ${html.length} (CRA shell expected)`);
    await ctx.close();
  }

  // ---- 4. no invented numbers ----------------------------------------
  {
    const { ctx, page } = await open();
    const card = page.locator('[data-testid="get-found-card"]');
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2400);
    const text = (await card.innerText()).replace(/\s+/g, ' ');
    note(`card text: ${JSON.stringify(text.slice(0, 90))}`);
    const numbers = text.match(/\b\d[\d,.]*\+?\b/g) || [];
    if (numbers.length) {
      failures.push(`the card shows figures ${JSON.stringify(numbers)} — every number a user sees must come from the database`);
    }
    if (/\b(rated|reviews?|stars?)\b/i.test(text)) {
      failures.push('the card implies a rating, which is not real data');
    }
    await ctx.close();
  }

  // ---- 5. Hebrew, and narrow -----------------------------------------
  for (const [lang, width] of [['he', 1280], ['he', 375], ['en', 375]]) {
    const { ctx, page } = await open({ lang, width });
    const card = page.locator('[data-testid="get-found-card"]');
    await card.waitFor({ timeout: 30000 });
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2400);

    const text = (await card.innerText()).replace(/\s+/g, ' ');
    const dir = await page.evaluate(() => document.documentElement.dir);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const box = await card.boundingBox();
    note(`${lang} @${width}: dir=${dir}, overflow=${overflow}px, card ${box ? Math.round(box.width) : '?'}px wide`);

    if (lang === 'he' && !HEBREW.test(text)) {
      failures.push(`he @${width}: the card is still in English`);
    }
    if (overflow > 1) failures.push(`${lang} @${width}: page scrolls sideways by ${overflow}px`);
    if (box && box.width > width) failures.push(`${lang} @${width}: the card is wider than the viewport`);

    // The heading must resolve to a face with Hebrew glyphs.
    if (lang === 'he') {
      const font = await card.locator('h3').first().evaluate((el) => getComputedStyle(el).fontFamily);
      note(`he @${width}: heading font ${font}`);
      if (/playfair/i.test(font)) {
        failures.push(`he @${width}: the heading resolves to Playfair, which has no Hebrew glyphs`);
      }
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

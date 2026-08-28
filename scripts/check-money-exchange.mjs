/**
 * Money exchange is listed as a directory, not as a money service.
 *
 * The category went live on 28 Aug 2026 on Tzvi's instruction, after the
 * regulatory note was put to him. Currency service providers in Israel
 * are licensed and supervised. Listing a licensed business is not the
 * same as facilitating exchange — and that difference has to be legible
 * to a visitor rather than merely true in our heads, which is the only
 * thing this file is about.
 *
 * Three assertions, and the second is the one that does the work:
 *
 *   1. A money-exchange listing carries the disclaimer, in the reader's
 *      own language.
 *   2. An ORDINARY listing does not. A disclaimer that renders on every
 *      page is not a conditional rule, it is a footer — and it would
 *      pass a test that only ever looked at the money-exchange page.
 *   3. The listing never claims we handle money: no phrase on the page
 *      offers a rate, a transfer or a conversion in OUR name.
 *
 * Usage: node scripts/check-money-exchange.mjs <fx-gig-id> <control-gig-id>
 */
import { chromium } from 'playwright';

const [FX, CONTROL] = process.argv.slice(2);
if (!FX || !CONTROL) {
  console.error('usage: node scripts/check-money-exchange.mjs <fx-gig-id> <control-gig-id>');
  console.error('  the control must be a listing in an ordinary category');
  process.exit(1);
}

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const HEBREW = /[֐-׿]/;
const browser = await chromium.launch();
const failures = [];
const note = (m) => console.log('  ' + m);

const open = async (lang, id, width = 1280) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  if (lang === 'he') {
    await ctx.addInitScript(() => {
      try { localStorage.setItem('i18nextLng', 'he'); } catch { /* private mode */ }
    });
  }
  const page = await ctx.newPage();
  await page.goto(`${APP}/businesses/${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('[data-testid="gig-detail-page"]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1800);
  return { ctx, page };
};

try {
  // ---- 1. it is there, in both languages -------------------------------
  for (const lang of ['en', 'he']) {
    const { ctx, page } = await open(lang, FX);
    const box = page.locator('[data-testid="gig-directory-disclaimer"]');
    const count = await box.count();
    const text = count ? (await box.first().innerText()).replace(/\s+/g, ' ').trim() : '';
    note(`${lang}: disclaimer present=${count > 0} — ${JSON.stringify(text.slice(0, 90))}`);

    if (!count) {
      failures.push(`${lang}: a money-exchange listing shows no directory disclaimer`);
    } else {
      if (!(await box.first().isVisible())) {
        failures.push(`${lang}: the disclaimer is in the DOM but not visible`);
      }
      if (lang === 'he' && !HEBREW.test(text)) {
        failures.push(`he: the disclaimer renders in English — a Hebrew reader is told nothing`);
      }
      if (lang === 'en' && HEBREW.test(text)) {
        failures.push('en: the disclaimer renders in Hebrew');
      }
    }

    // 3. Nothing on the page offers a money service in OUR name. Checked
    // on the whole body rather than the disclaimer, because the risk is
    // a sentence elsewhere undoing it.
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const claims = [
      /we (exchange|convert|transfer|hold) (your )?(money|funds|currency)/i,
      /our (exchange )?rate/i,
      /send money (with|through) myisraelrental/i,
    ].filter((re) => re.test(body));
    if (claims.length) {
      failures.push(`${lang}: the page appears to offer a money service in our name (${claims.length} phrase(s))`);
    }
    await ctx.close();
  }

  // ---- 2. and NOT on an ordinary listing -------------------------------
  {
    const { ctx, page } = await open('en', CONTROL);
    const count = await page.locator('[data-testid="gig-directory-disclaimer"]').count();
    note(`control listing: disclaimer present=${count > 0} (must be false)`);
    if (count) {
      failures.push(
        'the disclaimer renders on an ordinary listing too — it is not conditional, '
        + 'so the money-exchange assertion above proves nothing',
      );
    }
    await ctx.close();
  }

  // ---- narrow, RTL ------------------------------------------------------
  {
    const { ctx, page } = await open('he', FX, 375);
    const box = page.locator('[data-testid="gig-directory-disclaimer"]');
    const bb = await box.count() ? await box.first().boundingBox() : null;
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    note(`he @375: disclaimer box=${bb ? `${Math.round(bb.width)}px wide` : 'missing'}, page overflow=${overflow}px`);
    if (!bb) failures.push('he @375: the disclaimer is missing on a phone');
    else if (bb.x < -1 || bb.x + bb.width > 376) {
      failures.push(`he @375: the disclaimer sits off-screen (x=${Math.round(bb.x)})`);
    }
    if (overflow > 1) failures.push(`he @375: page scrolls sideways by ${overflow}px`);
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

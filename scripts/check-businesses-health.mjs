/**
 * The Businesses page and a listing still work.
 *
 * Written after a run of marketplace changes (L1, L4, and a search box that
 * was added and then removed) to answer one question directly: did any of
 * that damage the page people actually use?
 *
 * NOTE ON THE NAME. "Marketplace" in this product is the REQUESTS BOARD
 * (`/requests`), per the nav label. The services/gigs side is "Businesses"
 * (`/businesses`) — even though the backend calls it `marketplace`
 * everywhere (`routes/marketplace/`, `marketplace_gigs`). That collision is
 * why this file is named for the page rather than the code.
 *
 * What is asserted:
 *   * the board renders listings, with the hero bar's three segments
 *   * a category filter narrows it, and a LEGACY slug still resolves (L4)
 *   * a listing page opens and keeps its booking control
 *   * "Message on MyIsraelRental" goes to chat, not the booking form (L1)
 *   * no console errors anywhere on the way
 *
 * Usage: node scripts/check-businesses-health.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const browser = await chromium.launch();
const failures = [];
const note = (m) => console.log('  ' + m);

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  // ---- the board ------------------------------------------------------
  await page.goto(`${APP}/businesses`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('[data-testid="services-hero-search"]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);

  // Cards are click-handled divs, not anchors — `a[href^="/businesses/"]`
  // finds nothing here and would report a healthy board as empty.
  const CARD = '[data-testid^="services-gig-"]';
  const cards = await page.locator(CARD).count();
  if (cards === 0) failures.push('the board rendered no listings at all');
  note(`board: ${cards} card(s)`);

  // The hero bar is back to the three it had before the search experiment.
  const segments = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="services-hero-search"]');
    return bar ? bar.children.length : 0;
  });
  note(`hero bar segments: ${segments}`);
  if (segments < 3) failures.push(`hero bar has ${segments} segments — something was lost`);

  // ---- category filtering ---------------------------------------------
  await page.goto(`${APP}/businesses?category=cleaning-services`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const filtered = await page.locator(CARD).count();
  note(`?category=cleaning-services: ${filtered} card(s)`);
  if (filtered === 0) failures.push('filtering by a real category returned nothing');

  // L4: a legacy slug must not 400 the page.
  await page.goto(`${APP}/businesses?category=photography`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const legacyBroke = await page.locator('text=/something went wrong|error/i').count();
  if (legacyBroke > 0) failures.push('a legacy category slug showed an error state');
  note(`?category=photography (legacy): ${await page.locator(CARD).count()} card(s)`);

  // ---- a listing ------------------------------------------------------
  await page.goto(`${APP}/businesses`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const first = page.locator(CARD).first();
  if (await first.count() === 0) {
    failures.push('no listing to open — cannot check the detail page');
  } else {
    const id = (await first.getAttribute('data-testid')).replace('services-gig-', '');
    const href = `/businesses/${id}`;
    await page.goto(`${APP}${href}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="gig-detail-page"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    note(`listing page ${href} opened`);

    // The booking control must still exist. L1 changed the MESSAGE path
    // only; if it took the booking button with it that is a regression.
    const bookish = await page.locator('[data-testid="gig-book-btn"]').count();
    note(`booking button present: ${bookish === 1}`);
    if (bookish === 0) {
      failures.push('the listing has no booking button — L1 removed more than the message path');
    }

    // L1 proper: the on-site message channel goes to chat rather than
    // opening the booking form. Signed out it must send us to login and
    // come BACK to this listing, which is the half that silently rots.
    const msg = page.locator('[data-testid="gig-contact-in-platform"]');
    if (await msg.count() === 0) {
      failures.push('the on-site message channel is gone from the listing');
    } else {
      await msg.first().click();
      await page.waitForTimeout(1500);
      const url = new URL(page.url());
      const redirect = url.searchParams.get('redirect');
      note(`message (signed out) -> ${url.pathname}${redirect ? ` redirect=${redirect}` : ''}`);
      if (url.pathname.startsWith('/auth/login')) {
        if (redirect !== href) {
          failures.push(`sign-in returns to "${redirect}" instead of the listing "${href}"`);
        }
      } else if (!url.pathname.startsWith('/chat/')) {
        failures.push(`the message button went to ${url.pathname} — neither chat nor sign-in`);
      }
    }
  }

  if (errors.length) {
    failures.push(`console errors: ${JSON.stringify(errors.slice(0, 4))}`);
  } else {
    note('no console errors');
  }
  await ctx.close();

  // ---- and it still renders narrow, and in Hebrew ----------------------
  // The board is the page a business's customers actually land on, so
  // "intact" has to mean intact at 375 and in RTL too, not just on the
  // laptop the change was written on.
  for (const [width, lang] of [[1280, 'he'], [375, 'en'], [375, 'he']]) {
    const c = await browser.newContext({ viewport: { width, height: 900 } });
    if (lang === 'he') {
      await c.addInitScript(() => {
        try { localStorage.setItem('i18nextLng', 'he'); } catch { /* private mode */ }
      });
    }
    const p2 = await c.newPage();
    const errs = [];
    p2.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    p2.on('pageerror', (e) => errs.push(String(e)));

    await p2.goto(`${APP}/businesses`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p2.locator('[data-testid="services-page"]').waitFor({ timeout: 30000 });
    await p2.waitForTimeout(2500);

    const n = await p2.locator('[data-testid^="services-gig-"]').count();
    const dir = await p2.evaluate(() => document.documentElement.dir);
    // Horizontal overflow is the classic RTL-at-375 failure and it is
    // invisible in a screenshot cropped to the viewport.
    const overflow = await p2.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    console.log(`  @${width} ${lang} (dir=${dir}): ${n} card(s), overflow=${overflow}px, errors=${errs.length}`);
    if (n === 0) failures.push(`@${width} ${lang}: the board rendered no listings`);
    if (lang === 'he' && dir !== 'rtl') failures.push(`@${width} he: document dir is "${dir}", not rtl`);
    if (overflow > 1) failures.push(`@${width} ${lang}: page scrolls sideways by ${overflow}px`);
    if (errs.length) failures.push(`@${width} ${lang}: console errors ${JSON.stringify(errs.slice(0, 3))}`);
    await c.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('\nBusinesses is intact');

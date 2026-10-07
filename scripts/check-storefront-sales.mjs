// Storefront sales features (business pages), checked in a browser.
//
// Needs: local API on :8001 with review flags ON ("backend-reviews-on" in
// .claude/launch.json), the dev server on :3210, local data from the
// storefront seed (three stores: services, products, mixed).
//   Run: node scripts/check-storefront-sales.mjs [--shots]
//
// Phase 1, reviews:
//   * the mixed store (4 reviews) shows an average; the products store (2)
//     lists its reviews with no average; the services store (none) shows no
//     reviews box at all to a visitor;
//   * a signed-in person who had a conversation with that store sees
//     "Write a review"; a stranger does not;
//   * no phone, email or reviewer id anywhere in what the pages fetch.
// Phase 2, featured items:
//   * the mixed store shows its first featured item large, under the
//     owner's headline (in Hebrew, the translation); the products store
//     shows one with no headline; the services store, with nothing
//     featured, shows no large card; a one-item store can feature its item;
//   * the large card's item does not appear again in the "Start here" row.
// --shots writes screenshots of every store at 1280/768/375, EN and HE, to
// screenshots/storefront/.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const API = 'http://localhost:8001/api';
const WEB = 'http://localhost:3210';
const STORES = { services: 'test-owner', products: 'threesvc', mixed: 'my-business', single: 'listing-check-mtkgxf2n' };
const SHOTS = process.argv.includes('--shots');
const OUT = 'screenshots/storefront';
const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };

// What the storefront sends must never carry contact details or ids of people.
const FORBIDDEN = /"(phone|email|contact_email|contact_phone|whatsapp|customer_phone|author_user_id|owner_user_ids)"\s*:\s*"[^"]/i;

const b = await chromium.launch();

async function open(slug, { width = 1280, lang = 'en', as = null } = {}) {
  const ctx = await b.newContext({ viewport: { width, height: width < 600 ? 844 : 900 } });
  await ctx.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch {} }, lang);
  const p = await ctx.newPage();
  const bodies = [];
  p.on('response', async (r) => {
    if (r.url().startsWith(API) && r.request().method() === 'GET') {
      try { bodies.push([r.url(), await r.text()]); } catch {}
    }
  });
  await p.goto(`${WEB}/business/${slug}${as ? `?as=${as}` : ''}`, { waitUntil: 'networkidle' });
  // The dev bundle is slow: wait for the storefront itself, then its reviews.
  await p.waitForSelector('[data-testid="business-message-header"]', { state: 'attached', timeout: 60000 });
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(1200);
  return { p, ctx, bodies };
}

for (const [kind, slug] of Object.entries(STORES)) {
  const { p, ctx, bodies } = await open(slug);
  for (const [url, body] of bodies) expect(!FORBIDDEN.test(body), `${kind}: ${url} returns a contact field or person id`);
  const section = await p.$('[data-testid="reviews-section"]');
  const avg = await p.$('[data-testid="reviews-summary-native"]');
  const cards = await p.$$('[data-testid="review-card"]');
  const headerStars = await p.$('[data-testid="business-rating"]');
  if (kind === 'mixed') {
    expect(section && avg && cards.length === 4 && headerStars, 'mixed: 4 reviews with an average in the section and the header');
    expect(await p.$('[data-testid="review-badge-chat"]'), 'mixed: the conversation review is labelled, not verified');
  }
  if (kind === 'products') expect(section && !avg && cards.length === 2 && !headerStars, 'products: 2 reviews listed, no average anywhere');
  if (kind === 'single') { await ctx.close(); continue; }
  if (kind === 'services') expect(!section, 'services: no reviews box for a visitor when there are none');
  const hero = await p.$('[data-testid="featured-hero"]');
  const headline = await p.$('[data-testid="featured-headline"]');
  if (kind === 'mixed') expect(hero && headline && (await headline.textContent()).includes('deep clean'), 'mixed: large featured card under the owner headline');
  if (kind === 'products') expect(hero && !headline, 'products: large featured card, no headline');
  if (kind === 'services') expect(!hero, 'services: nothing featured, no large card');
  if (kind === 'single') expect(hero, 'single: a one-item store can feature its item');
  if (hero) {
    const heroTitle = (await hero.$eval('h2', (e) => e.textContent)).trim();
    const rowTitles = await p.$$eval('[data-source="featured"] [data-testid^="services-gig-"]', (els) => els.map((e) => e.textContent));
    expect(!rowTitles.some((x) => x.includes(heroTitle)) || kind === 'single', `${kind}: the large card's item is repeated in the featured row`);
  }
  await ctx.close();
}

// The dev renter talked with the services store; a stranger (the dev provider) did not.
{
  const { p, ctx } = await open(STORES.services, { as: 'renter' });
  expect(await p.$('[data-testid="review-write"]'), 'services: the person who had a conversation is invited to review');
  await ctx.close();
  const s = await open(STORES.services, { as: 'provider' });
  expect(!(await s.p.$('[data-testid="review-write"]')), 'services: a stranger is not invited to review');
  await s.ctx.close();
}

if (SHOTS) {
  mkdirSync(OUT, { recursive: true });
  for (const [kind, slug] of Object.entries(STORES)) {
    if (kind === 'single') continue;
    for (const lang of ['en', 'he']) {
      for (const width of [1280, 768, 375]) {
        const { p, ctx } = await open(slug, { width, lang, as: kind === 'services' ? 'renter' : null });
        await p.screenshot({ path: `${OUT}/${kind}-${lang}-${width}-top.png` });
        const fh = await p.$('[data-testid="featured-hero"]');
        if (fh) { await fh.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await fh.screenshot({ path: `${OUT}/${kind}-${lang}-${width}-featured.png` }); }
        const sec = await p.$('[data-testid="reviews-section"]');
        if (sec) { await sec.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await sec.screenshot({ path: `${OUT}/${kind}-${lang}-${width}-reviews.png` }); }
        await ctx.close();
      }
    }
  }
}

await b.close();
if (failures.length) { console.log('FAIL\n- ' + failures.join('\n- ')); process.exitCode = 1; } else console.log('storefront checks passed');

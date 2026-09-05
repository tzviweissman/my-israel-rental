#!/usr/bin/env node
/**
 * The requests board's item filters, and the FAQ editor, through the UI.
 *
 * WHY. Both were "accepted by the API, never offered by a screen" for
 * months (dead-ends audit 2026-09-03, #7 and #9). The API tests prove the
 * server side; this proves a person can reach it: the condition chips, the
 * price range and the sold toggle narrow the board, and a question typed
 * into the dashboard's edit sheet lands on the public listing.
 *
 * Local stack: the built app on APP_ORIGIN proxying to API_ORIGIN.
 *
 *   APP_ORIGIN=http://localhost:3200 API_ORIGIN=http://127.0.0.1:8002 node scripts/check-requests-filters.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const API = (process.env.API_ORIGIN || 'http://localhost:8001') + '/api';
const stamp = Date.now().toString(36);
const results = [];
const ok = (name, cond, detail = '') => {
  results.push(!!cond);
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' — ' + detail}`);
};
const json = async (r) => { try { return await r.json(); } catch { return null; } };

// ── a seller with three items, one sold, and one service with no FAQs ──
const password = `Pw-${stamp}-ok1`;
const email = `filters-${stamp}@example.com`;
const reg = await json(await fetch(`${API}/auth/register`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, name: 'Filters Check', role: 'owner' }),
}));
const token = reg?.token;
ok('account created', !!token);
if (!token) process.exit(1);
const auth = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

// The board has a per-account posting cooldown the rate-limit flag does
// not cover, so each item comes from its own account.
const owners = {};
const item = async (tag, title, condition, price) => {
  const r = await json(await fetch(`${API}/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `flt-${tag}-${stamp}@example.com`, password, name: `Item ${tag}`, role: 'owner' }),
  }));
  const h = { Authorization: `Bearer ${r?.token}`, 'content-type': 'application/json' };
  const id = (await json(await fetch(`${API}/marketplace/requests`, {
    method: 'POST', headers: h,
    body: JSON.stringify({
      request_type: 'item', post_kind: 'have', title, description: 'filters check, a description long enough',
      area: 'Jerusalem', budget_type: 'fixed', budget_amount: price, budget_currency: 'ILS', condition,
    }),
  })))?.id;
  if (id) owners[id] = h;
  return id;
};
const newCheap = await item('new', `TEST_flt_new_${stamp}`, 'new', 150);
const usedDear = await item('used', `TEST_flt_used_${stamp}`, 'used', 900);
const gone = await item('sold', `TEST_flt_sold_${stamp}`, 'good', 400);
ok('three items exist', !!(newCheap && usedDear && gone));
if (gone) await fetch(`${API}/marketplace/requests/${gone}/sold`, { method: 'POST', headers: owners[gone], body: JSON.stringify({ sold: true }) });

const gig = await json(await fetch(`${API}/marketplace/gigs`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    title: `TEST_flt_gig_${stamp}`, description: 'faq editor check', category: 'home-services-repair', area: 'Tel Aviv',
    gig_type: 'deliverable', budget_currency: 'ILS', booking_mode: 'whatsapp', whatsapp: '+972501234567',
    gallery: ['https://example.com/photo.jpg'],
    // The edit sheet refuses to save an option without a photo (its own,
    // older rule), so the fixture gives the tier one.
    tiers: [{ name: 'Basic', price: 200, currency: 'ILS', images: ['https://example.com/photo.jpg'] }],
  }),
}));
ok('a service exists', !!gig?.id);

const browser = await chromium.launch();
const cardsOn = async (page) => page.locator('[data-testid^="request-card-"]:not([data-testid^="request-card-photo-"])').evaluateAll((els) => els.map((e) => e.dataset.testid.replace('request-card-', '')));
const has = (ids, id) => ids.includes(id);
// The board draws no cards while it is loading, so "read the cards right
// after a click" reads an empty board. Wait for the answer instead.
const settle = async (page, action) => {
  const answer = page.waitForResponse((r) => r.url().includes('/marketplace/requests?') && r.request().method() === 'GET', { timeout: 10000 }).catch(() => null);
  await action();
  await answer;
  await page.waitForTimeout(500);
};

// ── the board ──────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${APP}/requests?type=item`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="requests-item-filters"]', { timeout: 15000 }).catch(() => {});
  ok('the item tab shows the item filters', await page.locator('[data-testid="requests-item-filters"]').count() === 1);
  await page.waitForSelector(`[data-testid="request-card-${newCheap}"]`, { timeout: 15000 }).catch(() => {});
  let ids = await cardsOn(page);
  ok('a sold item is hidden by default', has(ids, newCheap) && has(ids, usedDear) && !has(ids, gone), ids.filter((i) => [newCheap, usedDear, gone].includes(i)).join(','));

  await settle(page, () => page.click('[data-testid="requests-condition-new"]'));
  ids = await cardsOn(page);
  ok('the "New" chip keeps the new item and drops the used one', has(ids, newCheap) && !has(ids, usedDear));
  ok('and the URL carries it', page.url().includes('condition=new'), page.url());

  await settle(page, () => page.click('[data-testid="requests-condition-any"]'));
  await page.fill('[data-testid="requests-max-price"]', '500');
  await settle(page, () => page.press('[data-testid="requests-max-price"]', 'Enter'));
  ids = await cardsOn(page);
  ok('a max price of 500 keeps the 150 item and drops the 900 one', has(ids, newCheap) && !has(ids, usedDear), `${page.url()} new=${has(ids, newCheap)} used=${has(ids, usedDear)}`);

  // The controls stand as tall as the tab row above them, and the sold
  // toggle is a thumb-sized target rather than a 13px native box.
  const heights = await page.evaluate(() => {
    const h = (sel) => Math.round(document.querySelector(sel)?.getBoundingClientRect().height || 0);
    return { chip: h('[data-testid="requests-condition-new"]'), price: h('[data-testid="requests-max-price"]'),
      sold: Math.round(document.querySelector('[data-testid="requests-include-sold"]')?.closest('label')?.getBoundingClientRect().height || 0) };
  });
  ok('the filter controls are not 30px tall', heights.chip >= 36 && heights.price >= 36, JSON.stringify(heights));
  ok('and the sold toggle is a thumb-sized target', heights.sold >= 44, JSON.stringify(heights));
  // 12px text needs 4.5:1 (2026-09-05 audit, finding 4).
  const clearContrast = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="requests-item-filters-clear"]');
    if (!el) return null;
    const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
    const a = lum(getComputedStyle(el).color), b = lum('rgb(255,255,255)');
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  });
  ok('the Clear link is readable at 12px', clearContrast >= 4.5, `${clearContrast}:1`);

  await settle(page, () => page.click('[data-testid="requests-item-filters-clear"]'));
  await settle(page, () => page.click('[data-testid="requests-include-sold"]'));
  ids = await cardsOn(page);
  ok('"Show sold items too" brings the sold item back', has(ids, gone));

  await page.click('[data-testid="requests-type-all"]');
  await page.waitForTimeout(800);
  ok('the filters leave with the item tab', await page.locator('[data-testid="requests-item-filters"]').count() === 0);
  ok('board: no page errors', errors.length === 0, errors[0]);
  await ctx.close();
}

// ── the FAQ editor, through the dashboard's edit sheet ─────────────────
if (gig?.id) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${APP}/auth/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
  await page.goto(`${APP}/dashboard?tab=my-gigs`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`[data-testid="my-gigs-edit-listing-${gig.id}"]`, { timeout: 20000 }).catch(() => {});
  await page.click(`[data-testid="my-gigs-edit-listing-${gig.id}"]`);
  await page.waitForSelector('[data-testid="edit-listing-modal"]', { timeout: 10000 }).catch(() => {});
  ok('the edit sheet has the FAQ editor', await page.locator('[data-testid="edit-listing-faqs"]').count() === 1);
  // It opens with one row already there - the placeholders are what tell a
  // provider what a good question looks like (2026-09-05, the improvement).
  ok('and it opens with a row, not a button', await page.locator('[data-testid="edit-listing-faq-q-0"]').count() === 1);
  await page.fill('[data-testid="edit-listing-faq-q-0"]', 'How far ahead should I book?');
  await page.fill('[data-testid="edit-listing-faq-a-0"]', 'A week is plenty.');
  // an empty second row must not be saved
  await page.click('[data-testid="edit-listing-faq-add"]');
  await page.click('[data-testid="edit-listing-save"]');
  await page.waitForTimeout(2500);
  const saved = await json(await fetch(`${API}/marketplace/gigs/${gig.id}`));
  ok('the question is saved on the listing', JSON.stringify(saved?.faqs) === JSON.stringify([{ q: 'How far ahead should I book?', a: 'A week is plenty.' }]), JSON.stringify(saved?.faqs));

  for (const lng of ['en', 'he']) {
    await page.goto(`${APP}/businesses/${gig.id}?lng=${lng}`, { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
    const text = await page.locator('[data-testid="gig-detail-page"]').innerText().catch(() => '');
    ok(`${lng}: the listing shows the question under a translated heading`,
      text.includes('How far ahead should I book?') && text.includes(lng === 'he' ? 'שאלות ותשובות' : 'FAQs'));
  }
  ok('editor: no page errors', errors.length === 0, errors[0]);
  await ctx.close();
}

await browser.close();
for (const [id, h] of Object.entries(owners)) await fetch(`${API}/marketplace/requests/${id}`, { method: 'DELETE', headers: h });
if (gig?.id) await fetch(`${API}/marketplace/gigs/${gig.id}`, { method: 'DELETE', headers: auth });

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);

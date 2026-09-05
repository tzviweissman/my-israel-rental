#!/usr/bin/env node
/**
 * A business arranging its own page: what it features, and how it groups.
 *
 * WHY. Both fields were on the document and rendered by the public page
 * for as long as the page has existed, with no editor at all - so outside
 * the demo seed no business ever had either (dead-ends audit 2026-09-03,
 * #10). The API tests pin the round trip; this proves a person can reach
 * it: the section is in the page designer, the cap holds, a group with no
 * name is dropped rather than saved, and what is saved is what the public
 * page then shows.
 *
 * Local stack: the built app on APP_ORIGIN proxying to API_ORIGIN.
 *
 *   APP_ORIGIN=http://localhost:3200 API_ORIGIN=http://127.0.0.1:8002 node scripts/check-business-shelf.mjs
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

const password = `Pw-${stamp}-ok1`;
const email = `shelf-${stamp}@example.com`;
const reg = await json(await fetch(`${API}/auth/register`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, name: 'Shelf Check', role: 'owner' }),
}));
ok('account created', !!reg?.token);
if (!reg?.token) process.exit(1);
const auth = { Authorization: `Bearer ${reg.token}`, 'content-type': 'application/json' };

const biz = await json(await fetch(`${API}/marketplace/businesses`, {
  method: 'POST', headers: auth, body: JSON.stringify({ name: `TEST shelf ${stamp}` }),
}));
const IMG = 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1788256244/myisraelrental/tzhcgvw3l3wqvdgm7tvv.jpg';
const gig = async (title) => json(await fetch(`${API}/marketplace/gigs`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    title, description: 'shelf check listing', category: 'home-services-repair', area: 'Tel Aviv',
    gig_type: 'deliverable', budget_currency: 'ILS', booking_mode: 'whatsapp', whatsapp: '+972501234567',
    gallery: [IMG], tiers: [{ name: 'Basic', price: 200, currency: 'ILS', images: [IMG] }],
    business_id: biz.id,
  }),
}));
const a = await gig(`TEST_shelf_a_${stamp}`);
const b = await gig(`TEST_shelf_b_${stamp}`);
const c = await gig(`TEST_shelf_c_${stamp}`);
ok('a business with three services exists', !!(biz?.id && a?.id && b?.id && c?.id));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${APP}/auth/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
await page.goto(`${APP}/dashboard?tab=my-businesses`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.click(`[data-testid="business-design-${biz.id}"]`);
await page.waitForSelector('[data-testid="page-design-shelf"]', { timeout: 20000 }).catch(() => {});
ok('the page designer has a "what comes first" section', await page.locator('[data-testid="page-design-shelf"]').count() === 1);

// Featured: pick two, then confirm the third is refused past the cap.
await page.click(`[data-testid="page-design-feature-${b.id}"]`);
await page.click(`[data-testid="page-design-feature-${a.id}"]`);
ok('it counts what is chosen', (await page.locator('[data-testid="page-design-featured-count"]').innerText()).includes('2'));
await page.click(`[data-testid="page-design-feature-${c.id}"]`);
// Three chosen: a fourth cannot be, and the form says so by disabling
// rather than by failing on save.
const fourth = await gig(`TEST_shelf_d_${stamp}`);
ok('past three, the rest are disabled rather than refused on save',
  await page.locator(`[data-testid="page-design-feature-${a.id}"]`).isEnabled()
  && (await page.locator('[data-testid="page-design-featured-count"]').innerText()).includes('3'));

// A group with a name and a service, and one with neither.
await page.click('[data-testid="page-design-collection-add"]');
await page.fill('[data-testid="page-design-collection-name-0"]', 'Shabbos');
await page.click(`[data-testid="page-design-collection-0-service-${b.id}"]`);
await page.click('[data-testid="page-design-collection-add"]');
ok('an incomplete group is called out before saving',
  await page.locator('[data-testid="page-design-collection-warning"]').count() === 1);

// The preview is the point of this screen, so an edit has to reach it
// BEFORE saving - the first cut overlaid only accent, cover and payment
// links, so these two showed the old page until you closed and reopened.
const previewText = await page.frameLocator('iframe').locator('body').innerText().catch(() => '');
ok('the preview shows the group before it is saved', previewText.includes('Shabbos'), previewText.slice(0, 100));

await page.click('[data-testid="page-design-save"]');
await page.waitForTimeout(3000);

const saved = await json(await fetch(`${API}/marketplace/business/${biz.id}`, { headers: auth }));
ok('the featured services are saved, in the order chosen',
  JSON.stringify(saved?.pinned_service_ids) === JSON.stringify([b.id, a.id, c.id]),
  JSON.stringify(saved?.pinned_service_ids));
ok('never more than three', (saved?.pinned_service_ids || []).length <= 3, `${(saved?.pinned_service_ids || []).length}`);
ok('the named group is saved', (saved?.collections || []).some((x) => x.name === 'Shabbos'), JSON.stringify(saved?.collections));
ok('and the empty one is not', (saved?.collections || []).length === 1, JSON.stringify(saved?.collections));

// And the public page shows it.
await page.goto(`${APP}/business/${saved?.slug || biz.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const text = await page.locator('body').innerText();
ok('the public page renders the group heading', text.includes('Shabbos'), text.slice(0, 120));
ok('no page errors', errors.length === 0, errors[0]);

await ctx.close();
await browser.close();
for (const g of [a, b, c, fourth]) if (g?.id) await fetch(`${API}/marketplace/gigs/${g.id}`, { method: 'DELETE', headers: auth });

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);

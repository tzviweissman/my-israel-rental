#!/usr/bin/env node
/**
 * A business can put an offer on a listing, and it reaches every surface.
 *
 * WHY A BROWSER CHECK when the backend already has tests. The backend
 * proves the field is stored, filtered and served. None of that says a
 * customer can SEE it, and none of it says the business can turn it off:
 * the owner's sheet sends `discount: null` to remove one, and a form that
 * silently omits the field instead would pass every API test while making
 * the offer permanent. So this drives the real screens.
 *
 * Needs the built app on :3000 (or APP_ORIGIN) proxying to an API where a
 * throwaway account can publish — point both at the local stack:
 *
 *   node scripts/check-offers.mjs
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
const email = `offers-${stamp}@example.com`;
const reg = await fetch(`${API}/auth/register`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, name: 'Offer Check', role: 'owner' }),
});
const { token } = (await json(reg)) || {};
ok('account created', !!token, `status ${reg.status}`);
if (!token) process.exit(1);
const auth = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

const title = `TEST_offer_${stamp}`;
const post = await fetch(`${API}/marketplace/gigs`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    title, description: 'offer check', category: 'home-services-repair', area: 'Tel Aviv',
    gig_type: 'deliverable', booking_mode: 'whatsapp', whatsapp: '+972501234567',
    gallery: ['https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1788256244/myisraelrental/tzhcgvw3l3wqvdgm7tvv.jpg'],
    tiers: [{ name: 'Basic', price: 200, currency: 'ILS' }],
    discount: { percent: 25, label: 'New customers' },
  }),
});
const gig = await json(post);
ok('listing published with an offer', !!gig?.id, `status ${post.status}`);
if (!gig?.id) process.exit(1);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));

// ---- the listing page shows the offer, and does NOT restate the price ----
await page.goto(`${APP}/businesses/${gig.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const badge = page.locator('[data-testid="gig-offer"]');
ok('the listing page shows the offer', await badge.count() === 1);
const badgeText = await badge.innerText().catch(() => '');
ok('it states the percentage', /25/.test(badgeText), badgeText.replace(/\n/g, ' '));
ok('and what it is for', /New customers/.test(badgeText), badgeText.replace(/\n/g, ' '));
ok('it tells the customer to mention it', await page.locator('[data-testid="gig-offer-note"]').count() === 1);
const body = await page.innerText('body');
ok('the price is still the price the business wrote', /200/.test(body) && !/150/.test(body));

// The badge is the palette's accent chip, never green (green is status here).
const colours = await badge.evaluate((el) => {
  const cs = getComputedStyle(el);
  return { bg: cs.backgroundColor, fg: cs.color };
});
const wash = await page.evaluate(() => { const s = document.createElement('span'); s.style.background = 'var(--accent-soft)'; document.body.appendChild(s); const c = getComputedStyle(s).backgroundColor; s.remove(); return c; });
ok('the badge is the theme\'s accent wash with ink text', colours.bg === wash && colours.fg === 'rgb(17, 24, 39)', JSON.stringify({ ...colours, wash }));

// ---- the services board card carries the chip ----
await page.goto(`${APP}/businesses?q=${encodeURIComponent(title)}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const chip = page.locator(`[data-testid="gig-offer-${gig.id}"]`);
ok('the card on the board carries the offer chip', await chip.count() === 1);

// ---- the API shelf ----
const deals = await json(await fetch(`${API}/marketplace/deals`));
ok('the offer is on the deals shelf', (deals || []).some((d) => d.id === gig.id));

// ---- taking it down actually takes it down ----
await fetch(`${API}/marketplace/gigs/${gig.id}`, {
  method: 'PATCH', headers: auth, body: JSON.stringify({ discount: null }),
});
await page.goto(`${APP}/businesses/${gig.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
ok('removing the offer removes it from the listing page', await page.locator('[data-testid="gig-offer"]').count() === 0);
const deals2 = await json(await fetch(`${API}/marketplace/deals`));
ok('and from the shelf', !(deals2 || []).some((d) => d.id === gig.id));

// ---- the home page's carousel becomes real deals once four are running ----
// The section is "Today's picks" when nobody has an offer on and "Today's
// deals" when they do. That switch is the whole reason the wording was held
// back until the field existed, so it is worth proving rather than assuming.
// Four, not three: the carousel needs a ring to read as one, and the deals
// threshold and the section's own minimum are the same number for that reason.
const extra = [];
for (const pct of [30, 15, 40, 20]) {
  const r = await fetch(`${API}/marketplace/gigs`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      title: `TEST_offer_${stamp}_${pct}`, description: 'offer check', category: 'home-services-repair',
      area: 'Tel Aviv', gig_type: 'deliverable', booking_mode: 'whatsapp', whatsapp: '+972501234567',
      gallery: ['https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1788256244/myisraelrental/tzhcgvw3l3wqvdgm7tvv.jpg'],
      tiers: [{ name: 'Basic', price: 100, currency: 'ILS' }],
      discount: { percent: pct, label: 'Launch offer' },
    }),
  });
  const made = await json(r);
  if (made?.id) extra.push(made.id);
}
ok('four more offers published', extra.length === 4, `${extra.length}`);

await page.goto(`${APP}/home-preview`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.locator('#picks').scrollIntoViewIfNeeded();
await page.waitForTimeout(1500);
const heading = (await page.locator('#picks h2').innerText()).trim();
ok('the home carousel is headed with real deals', /deals/i.test(heading), heading);
const sub = (await page.locator('.hv2-coverflow p').nth(1).innerText()).trim();
ok('the centred card states its saving', /%/.test(sub), sub);
const openHref = await page.locator('[data-testid="home-preview-pick-open"]').getAttribute('data-href');
ok('and its button opens a business', /^\/businesses\//.test(openHref || ''), String(openHref));

for (const id of extra) {
  await fetch(`${API}/marketplace/gigs/${id}`, { method: 'DELETE', headers: auth });
}

ok('no page errors throughout', errors.length === 0, errors[0]);

await browser.close();
await fetch(`${API}/marketplace/gigs/${gig.id}`, { method: 'DELETE', headers: auth });

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);

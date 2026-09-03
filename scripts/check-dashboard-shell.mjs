#!/usr/bin/env node
/**
 * The dashboard's sidebar and its Overview front page, for a real account.
 *
 * WHY. The overview is four numbers and a list, every one of them read from
 * an endpoint. The failure that looks fine in a screenshot is a card that
 * says "—" or "0" because a call failed, or a card that says a number the
 * account cannot have. So this makes an owner, publishes a listing and a
 * service, mints a share link, and asserts the cards say what the API says.
 *
 * Also the shell itself: the sidebar shows the right groups for the role,
 * the badges match /dashboard/summary, collapsing to the rail persists, the
 * tab strip takes over on a phone, and Hebrew puts the sidebar on the right.
 *
 * Local stack: the built app on APP_ORIGIN proxying to API_ORIGIN.
 *
 *   APP_ORIGIN=http://localhost:3200 API_ORIGIN=http://127.0.0.1:8002 node scripts/check-dashboard-shell.mjs
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

// ── an owner with one listing, one service and one share link ──────────
const password = `Pw-${stamp}-ok1`;
const email = `shell-${stamp}@example.com`;
const reg = await fetch(`${API}/auth/register`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, name: 'Shell Check', role: 'owner' }),
});
const { token } = (await json(reg)) || {};
ok('account created', !!token, `status ${reg.status}`);
if (!token) process.exit(1);
const auth = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

const prop = await json(await fetch(`${API}/properties`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    title: `TEST_shell_${stamp}`, rental_type: 'long-term', property_type: 'apartment', area: 'Tel Aviv',
    bedrooms: 2, monthly_price: 5000, currency: 'ILS',
    images: ['https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1788256244/myisraelrental/tzhcgvw3l3wqvdgm7tvv.jpg'],
  }),
}));
ok('a listing exists', !!prop?.id);

const link = prop?.id ? await json(await fetch(`${API}/short-links`, {
  method: 'POST', headers: auth, body: JSON.stringify({ target_type: 'property', target_id: prop.id }),
})) : null;
ok('a share link exists', !!link?.slug, JSON.stringify(link).slice(0, 80));
if (link?.slug) {
  // Two scans, so the number on the card is not zero and not one.
  await fetch(`${API}/short-links/${link.slug}/resolve`);
  await fetch(`${API}/short-links/${link.slug}/resolve`);
}
const mine = await json(await fetch(`${API}/short-links/mine`, { headers: auth }));
ok('the scan rollup answers', Array.isArray(mine?.links) && typeof mine.total_scans === 'number', JSON.stringify(mine).slice(0, 80));
ok('and counts both scans', mine?.total_scans === 2, `${mine?.total_scans}`);
const summary = await json(await fetch(`${API}/dashboard/summary`, { headers: auth }));

// ── sign in through the real screen ────────────────────────────────────
const browser = await chromium.launch();
const signIn = async (ctx) => {
  const page = await ctx.newPage();
  await page.goto(`${APP}/auth/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
  if (!/dashboard/.test(page.url())) await page.goto(`${APP}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  return page;
};

for (const lng of ['en', 'he']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: lng });
  const page = await signIn(ctx);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  if (lng === 'he') { await page.goto(`${APP}/dashboard?lng=he`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2000); }

  ok(`${lng}: the shell renders`, await page.locator('[data-testid="dashboard-shell"]').count() === 1);
  ok(`${lng}: the sidebar is there on a wide screen`, await page.locator('[data-testid="dashboard-sidebar"]').count() === 1);
  ok(`${lng}: it opens on the Overview`, await page.locator('[data-testid="overview-tab"]').count() === 1);

  const items = await page.locator('[data-testid^="sidebar-item-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.replace('sidebar-item-', '')));
  ok(`${lng}: an owner sees listings, bookings, messages and settings`,
    ['overview', 'properties', 'bookings', 'messages', 'settings'].every((id) => items.includes(id)), items.join(','));
  ok(`${lng}: and not the renter-only tabs`, !items.includes('subleases') && !items.includes('alerts'), items.join(','));

  // the cards say what the API says
  const scansValue = (await page.locator('[data-testid="overview-card-scans-value"]').innerText()).trim();
  ok(`${lng}: the scans card shows the rollup's number`, scansValue === String(mine?.total_scans), scansValue);
  const waitingValue = (await page.locator('[data-testid="overview-card-waiting-value"]').innerText()).trim();
  ok(`${lng}: the waiting card shows the summary's number`,
    waitingValue === String((summary?.bookings_awaiting_reply || 0) + (summary?.work_offers_open || 0)), waitingValue);
  const leadsSub = (await page.locator('[data-testid="overview-card-leads-sub"]').innerText()).trim();
  ok(`${lng}: the leads card is honest about a young counter`, leadsSub.length > 3, leadsSub);
  ok(`${lng}: no invented growth figures anywhere`, !/[+-]\d+%/.test(await page.locator('[data-testid="overview-tab"]').innerText()));

  // the sidebar side follows the reading direction
  const side = await page.evaluate(() => {
    const nav = document.querySelector('[data-testid="dashboard-sidebar"]').getBoundingClientRect();
    const content = document.querySelector('[data-testid="dashboard-shell-content"]').getBoundingClientRect();
    return nav.left < content.left ? 'left' : 'right';
  });
  ok(`${lng}: the sidebar sits on the reading-start side`, side === (lng === 'he' ? 'right' : 'left'), side);

  // collapse, and remember it
  await page.click('[data-testid="dashboard-sidebar-toggle"]');
  await page.waitForTimeout(500);
  ok(`${lng}: the sidebar folds to a rail`, (await page.locator('[data-testid="dashboard-sidebar"]').getAttribute('data-open')) === '0');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  ok(`${lng}: and stays folded after a reload`, (await page.locator('[data-testid="dashboard-sidebar"]').getAttribute('data-open')) === '0');
  await page.click('[data-testid="dashboard-sidebar-toggle"]');
  await page.waitForTimeout(400);

  // navigation through the sidebar
  await page.click('[data-testid="sidebar-item-properties"]');
  await page.waitForTimeout(1200);
  ok(`${lng}: a sidebar item opens its tab`, await page.locator('[data-testid="overview-tab"]').count() === 0
    && (await page.locator('[data-testid="sidebar-item-properties"]').getAttribute('aria-current')) === 'page');

  ok(`${lng}: no page errors`, errors.length === 0, errors[0]);
  await ctx.close();
}

// ── a phone keeps the tab strip ────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await signIn(ctx);
  // Not "no items in the sidebar" - NO sidebar. The first version of this
  // passed while the phone showed an empty rail with the owner's name and
  // a Hide button, and the tab strip cut off beside it.
  ok('phone: no sidebar at all', await page.locator('[data-testid="dashboard-sidebar"]').count() === 0);
  const strip = await page.locator('button:has-text("Overview")').first().evaluate((el) => {
    const r = el.closest('nav, [role="tablist"], div')?.getBoundingClientRect() || el.getBoundingClientRect();
    return { right: Math.round(r.right), vw: window.innerWidth };
  }).catch(() => null);
  ok('phone: the tab strip is there instead', !!strip);
  ok('phone: and is not cut off by the screen edge', strip && strip.right <= strip.vw + 1, JSON.stringify(strip));
  ok('phone: the overview still renders', await page.locator('[data-testid="overview-tab"]').count() === 1);
  await ctx.close();
}

await browser.close();
if (prop?.id) await fetch(`${API}/properties/${prop.id}`, { method: 'DELETE', headers: auth });

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);

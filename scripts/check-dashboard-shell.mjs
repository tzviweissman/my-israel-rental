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

// A business, so the Businesses tab has a card to put a share button on.
const biz = await json(await fetch(`${API}/marketplace/businesses`, {
  method: 'POST', headers: auth, body: JSON.stringify({ name: `TEST shell ${stamp}` }),
}));
ok('a business exists', !!biz?.id, JSON.stringify(biz).slice(0, 120));
// ...and one service under it: the Businesses tab only shows for an account
// that can publish services or already has one (useDashboardNav).
const gig = biz?.id ? await json(await fetch(`${API}/marketplace/gigs`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    title: `TEST_shell_gig_${stamp}`, description: 'shell check', category: 'home-services-repair', area: 'Tel Aviv',
    gig_type: 'deliverable', budget_currency: 'ILS', booking_mode: 'whatsapp', whatsapp: '+972501234567',
    gallery: ['https://example.com/photo.jpg'], tiers: [{ name: 'Basic', price: 200, currency: 'ILS' }], business_id: biz.id,
  }),
})) : null;
ok('a service exists under it', !!gig?.id, JSON.stringify(gig).slice(0, 120));

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
  const mineNow = await json(await fetch(`${API}/short-links/mine`, { headers: auth }));
  ok(`${lng}: the scans card shows the rollup's number`, scansValue === String(mineNow?.total_scans), `${scansValue} vs ${mineNow?.total_scans}`);
  const waitingValue = (await page.locator('[data-testid="overview-card-waiting-value"]').innerText()).trim();
  ok(`${lng}: the waiting card shows the summary's number`,
    waitingValue === String((summary?.bookings_awaiting_reply || 0) + (summary?.work_offers_open || 0)), waitingValue);
  const leadsSub = (await page.locator('[data-testid="overview-card-leads-sub"]').innerText()).trim();
  ok(`${lng}: the leads card is honest about a young counter`, leadsSub.length > 3, leadsSub);
  ok(`${lng}: no invented growth figures anywhere`, !/[+-]\d+%/.test(await page.locator('[data-testid="overview-tab"]').innerText()));
  // A listing created a minute ago counts over one day, not a month it has
  // not had; and a card with nothing to count says 0, not a dash.
  const overviewText = await page.locator('[data-testid="overview-tab"]').innerText();
  ok(`${lng}: the visitors card's window is the listing's real age`, /(last 1 days|היום האחרון|1 הימים)/.test(overviewText) || /last 1 day/.test(overviewText), overviewText.match(/[^\n]*(days|הימים)[^\n]*/g)?.join(' | '));
  ok(`${lng}: no dash placeholders on the cards`, !/[—–]/.test(await page.locator('[data-testid="overview-card-visitors-value"]').innerText()));

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

  // ── the business card's link and QR code ────────────────────────────
  // The tab's own subtitle promises every business "their own page and QR
  // code". Until 4 Sep 2026 the card offered neither, though the backend
  // had minted business short links since the table was built.
  if (biz?.id) {
    await page.click('[data-testid="sidebar-item-my-businesses"]');
    await page.waitForSelector(`[data-testid="business-card-${biz.id}"]`, { timeout: 15000 }).catch(() => {});
    const toggle = page.locator(`[data-testid="business-share-${biz.id}-toggle"]`);
    ok(`${lng}: the business card has a Share & QR button`, await toggle.count() === 1);
    if (await toggle.count()) {
      await toggle.click();
      await page.waitForSelector(`[data-testid="business-share-${biz.id}-qr-svg"], [data-testid="business-share-${biz.id}-qr"] svg`, { timeout: 15000 }).catch(() => {});
      const link = await page.locator(`[data-testid="business-share-${biz.id}-link"] input`).inputValue().catch(() => '');
      ok(`${lng}: it shows a short link`, /\/p\/[A-Za-z0-9_-]+$/.test(link), link);
      ok(`${lng}: and a QR code`, await page.locator(`[data-testid="business-share-${biz.id}-panel"] svg`).count() >= 1);
      // ...that is actually visible: the card used to clip the popover at
      // its own edge, and a QR that is in the DOM but cut off scans nothing.
      const seen = await page.evaluate((id) => {
        const panel = document.querySelector(`[data-testid="business-share-${id}-panel"]`);
        const svg = panel?.querySelector('svg');
        if (!svg) return { ok: false };
        const r = svg.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { ok: !!hit && panel.contains(hit) && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth, r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] };
      }, biz.id);
      ok(`${lng}: the QR is on screen and not clipped`, seen.ok, JSON.stringify(seen));
      // The Copy button had a label the same blue as its fill - a blank
      // block - after the theme put the accent blue into the `--gold` names.
      const copyBtn = await page.evaluate((id) => {
        const el = document.querySelector(`[data-testid="business-share-${id}-link-copy-button"]`);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
        const a = lum(cs.color), b = lum(cs.backgroundColor);
        return { color: cs.color, bg: cs.backgroundColor, contrast: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100 };
      }, biz.id);
      ok(`${lng}: the Copy button's label is readable on its fill`, copyBtn && copyBtn.contrast >= 4.5, JSON.stringify(copyBtn));
      // the code has to open THIS business's page
      const slug = link.split('/p/')[1];
      const target = slug ? await json(await fetch(`${API}/short-links/${slug}/resolve`)) : null;
      ok(`${lng}: the link opens the business page`, target?.target?.startsWith(`/business/${biz.id}`), JSON.stringify(target));
      if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/business-share-${lng}.png`, clip: { x: 0, y: 0, width: 1280, height: 900 } });
      await page.keyboard.press('Escape');
    }
  }

  // ── pausing a listing, from the card that owns it ───────────────────
  // The status has been in the model since the marketplace was built and
  // nothing set it (dead-ends audit 2026-09-03, #11): a business going
  // away for a month had to delete the listing and rebuild it.
  if (gig?.id && lng === 'en') {
    await page.click('[data-testid="sidebar-item-my-gigs"]');
    await page.waitForSelector(`[data-testid="my-gigs-item-${gig.id}"]`, { timeout: 20000 }).catch(() => {});
    ok('a live listing shows no state badge', await page.locator(`[data-testid="my-gigs-status-${gig.id}"]`).count() === 0);
    await page.click(`[data-testid="my-gigs-pause-${gig.id}"]`);
    await page.waitForFunction((id) => document.querySelector(`[data-testid="my-gigs-item-${id}"]`)?.dataset.status === 'paused', gig.id, { timeout: 15000 }).catch(() => {});
    ok('pausing marks the card paused', (await page.locator(`[data-testid="my-gigs-item-${gig.id}"]`).getAttribute('data-status')) === 'paused');
    ok('and says so on the card', await page.locator(`[data-testid="my-gigs-status-${gig.id}"]`).count() === 1);

    // The point of pausing: it is off the public site, link included.
    const anonCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const anonPage = await anonCtx.newPage();
    const resp = await anonPage.goto(`${APP}/businesses/${gig.id}`, { waitUntil: 'networkidle' });
    await anonPage.waitForTimeout(1500);
    const anonText = await anonPage.locator('body').innerText();
    ok('a paused listing is not public at its own link',
      !anonText.includes(`TEST_shell_gig_${stamp}`), `${resp?.status()} ${anonText.slice(0, 80)}`);
    await anonCtx.close();

    // ...but its owner can still open it, and is told why it looks empty.
    await page.goto(`${APP}/businesses/${gig.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    ok('the owner still sees it, with a banner saying only they can',
      await page.locator('[data-testid="gig-not-live-banner"]').count() === 1);

    await page.goto(`${APP}/dashboard?tab=my-gigs`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`[data-testid="my-gigs-pause-${gig.id}"]`, { timeout: 20000 }).catch(() => {});
    await page.click(`[data-testid="my-gigs-pause-${gig.id}"]`);
    await page.waitForFunction((id) => document.querySelector(`[data-testid="my-gigs-item-${id}"]`)?.dataset.status === 'published', gig.id, { timeout: 15000 }).catch(() => {});
    ok('and putting it back on restores it', (await page.locator(`[data-testid="my-gigs-item-${gig.id}"]`).getAttribute('data-status')) === 'published');
  }

  ok(`${lng}: no page errors`, errors.length === 0, errors[0]);
  await ctx.close();
}

// ── the deep links two emails have carried for months ──────────────────
// `?edit=<property id>` opens that listing's edit form (the quarantine
// email's "Fix pricing now" 404ed on a route that never existed), and a
// signed-out visitor to a gated page is sent to sign in WITH the page in
// `redirect`. (Dead-ends audit 2026-09-03, #1, #3, #5.)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await signIn(ctx);
  if (prop?.id) {
    await page.goto(`${APP}/dashboard?tab=properties&edit=${prop.id}`, { waitUntil: 'networkidle' });
    // A controlled input carries its value as a property, not an attribute,
    // so `input[value=...]` never matches; read the property.
    await page.waitForFunction((title) => [...document.querySelectorAll('input')].some((e) => e.value === title), `TEST_shell_${stamp}`, { timeout: 15000 }).catch(() => {});
    // The title as it was posted; the create response does not echo it.
    const editState = await page.evaluate((title) => ({
      open: !!document.querySelector('[data-testid="add-property-modal"]'),
      titled: [...document.querySelectorAll('input')].some((e) => e.value === title),
      values: [...document.querySelectorAll('input')].map((e) => e.value).filter((v) => v.includes('TEST_')),
    }), `TEST_shell_${stamp}`);
    ok("?edit=<id> opens that listing's edit form", editState.open && editState.titled, JSON.stringify(editState));
    ok('and leaves the URL', !page.url().includes('edit='), page.url());
  }
  await ctx.close();

  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p3 = await signIn(ctx2);
  const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p2 = await anon.newPage();
  await p2.goto(`${APP}/dashboard?tab=bookings`, { waitUntil: 'networkidle' });
  ok('a signed-out visitor to the dashboard is sent to sign in with the page kept',
    p2.url().includes('/auth/login') && decodeURIComponent(p2.url()).includes('redirect=/dashboard?tab=bookings'), p2.url());
  // A tab id that does not exist falls back to the Overview rather than
  // rendering an empty pane. The owner checklist linked to `my-properties`
  // for months while the tab is `properties`. (Dead-ends audit 2026-09-04.)
  await p3.goto(`${APP}/dashboard?tab=my-properties`, { waitUntil: 'networkidle' });
  await p3.waitForSelector('[data-testid="dashboard-shell"]', { timeout: 20000 }).catch(() => {});
  await p3.waitForTimeout(2500);
  ok('an unknown ?tab= falls back to the Overview', await p3.locator('[data-testid="overview-tab"]').count() === 1);
  await p3.goto(`${APP}/dashboard?tab=properties`, { waitUntil: 'networkidle' });
  await p3.waitForSelector('[data-testid="sidebar-item-properties"]', { timeout: 20000 }).catch(() => {});
  await p3.waitForTimeout(1500);
  ok('and a real one still opens its tab', await p3.locator('[data-testid="overview-tab"]').count() === 0
    && (await p3.locator('[data-testid="sidebar-item-properties"]').getAttribute('aria-current')) === 'page');

  await p2.goto(`${APP}/businesses/post-job`, { waitUntil: 'networkidle' });
  ok('and to sign up from post-a-job, with the page kept',
    p2.url().includes('/signup') && decodeURIComponent(p2.url()).includes('redirect=/businesses/post-job'), p2.url());
  await anon.close();
  await ctx2.close();
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

  // The business share popover on a phone: a 360px panel hanging off a
  // button in the middle of a 390px card fits on no side, so there it is
  // pinned to the screen instead. The QR has to be wholly on screen.
  if (biz?.id) {
    await page.locator('button:has-text("Businesses")').first().click();
    await page.waitForSelector(`[data-testid="business-share-${biz.id}-toggle"]`, { timeout: 15000 }).catch(() => {});
    await page.locator(`[data-testid="business-share-${biz.id}-toggle"]`).scrollIntoViewIfNeeded().catch(() => {});
    await page.click(`[data-testid="business-share-${biz.id}-toggle"]`).catch(() => {});
    await page.waitForSelector(`[data-testid="business-share-${biz.id}-panel"] svg`, { timeout: 15000 }).catch(() => {});
    const seen = await page.evaluate((id) => {
      const panel = document.querySelector(`[data-testid="business-share-${id}-panel"]`);
      const svg = panel?.querySelector('svg');
      if (!svg) return { ok: false };
      const r = svg.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { ok: !!hit && panel.contains(hit) && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth, r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], vw: window.innerWidth };
    }, biz.id);
    ok('phone: the business QR is on screen and not clipped', seen.ok, JSON.stringify(seen));
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/business-share-phone.png` });
  }
  await ctx.close();
}

await browser.close();
if (prop?.id) await fetch(`${API}/properties/${prop.id}`, { method: 'DELETE', headers: auth });
if (gig?.id) await fetch(`${API}/marketplace/gigs/${gig.id}`, { method: 'DELETE', headers: auth });
if (biz?.id) await fetch(`${API}/marketplace/businesses/${biz.id}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ active: false }) });

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);

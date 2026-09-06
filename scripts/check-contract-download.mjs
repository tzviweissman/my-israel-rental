#!/usr/bin/env node
/**
 * Downloading a contract, from a real browser, on both sides of the link.
 *
 * WHY A BROWSER CHECK AND NOT JUST THE API TESTS. The API was never the
 * broken part. `/contracts/download/{id}` worked perfectly for anyone who
 * sent a bearer token - and the buttons could not send one, because they
 * were `window.open()` on a URL, and a browser opening a URL in a new tab
 * attaches no Authorization header. Every server-side test passed while the
 * feature was unusable for every human being. So the only test that would
 * have caught this is one that presses the button.
 *
 * Two sides, and the second is the serious one:
 *
 *   * the OWNER, in their dashboard, holding a token the request never
 *     used;
 *   * the SIGNER, on /sign/:signToken, who has no account here and never
 *     will. For them there was no login to route around it: they were
 *     asked to sign a legal document they could not obtain a copy of.
 *
 * Local stack: the built app on APP_ORIGIN proxying to API_ORIGIN.
 *
 *   APP_ORIGIN=http://localhost:3200 API_ORIGIN=http://127.0.0.1:8002 node scripts/check-contract-download.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const API = (process.env.API_ORIGIN || 'http://localhost:8001') + '/api';
const stamp = Date.now().toString(36);
const results = [];
const ok = (name, cond, detail = '') => {
  results.push(!!cond);
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' - ' + detail}`);
};
const json = async (r) => { try { return await r.json(); } catch { return null; } };

// A tiny real PDF, so the bytes that come back can be compared exactly.
// DELIBERATELY NOT A RENDERABLE DOCUMENT: it declares one page with no
// content stream, so a viewer shows a blank sheet. That is fine here,
// because what is being tested is that the bytes served are the bytes
// uploaded - but do not reuse it to eyeball a download by hand, which is
// a confusion it has already caused once.
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
  + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
  + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n'
  + 'trailer<</Root 1 0 R>>\n%%EOF\n',
  'latin1',
);

// ---------------------------------------------------------------- setup

const password = `Pw-${stamp}-ok1`;
const email = `contract-${stamp}@example.com`;
const reg = await json(await fetch(`${API}/auth/register`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, name: 'Contract Check', role: 'owner' }),
}));
ok('account created', !!reg?.token);
if (!reg?.token) process.exit(1);
const bearer = { Authorization: `Bearer ${reg.token}` };
const auth = { ...bearer, 'content-type': 'application/json' };

// The contracts tab only renders for someone who lists property.
const prop = await json(await fetch(`${API}/properties`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    title: `TEST_contract_${stamp}`, rental_type: 'long-term', property_type: 'apartment',
    area: 'Jerusalem', bedrooms: 2, monthly_price: 5200, currency: 'ILS',
  }),
}));

const sub = await json(await fetch(`${API}/subleases`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    title: `TEST_sublease_${stamp}`,
    description: 'A room for the summer, described at some length.',
    area: 'Jerusalem', price: 4200, price_type: 'monthly',
    available_from: '2026-10-01', available_to: '2027-01-31',
  }),
}));

const form = new FormData();
form.append('file', new Blob([PDF], { type: 'application/pdf' }), 'agreement.pdf');
const uploaded = await json(await fetch(`${API}/subleases/${sub.id}/contract`, {
  method: 'POST', headers: bearer, body: form,
}));
ok('a sublease with a contract on it exists',
  !!(prop?.id && sub?.id && uploaded?.id && uploaded?.sign_token), JSON.stringify(uploaded));
if (!uploaded?.sign_token) process.exit(1);

const bytesOf = async (download) => readFileSync(await download.path());

const browser = await chromium.launch({ acceptDownloads: true });

// ------------------------------- 1. the signer, with no account at all

for (const lng of ['en', 'he']) {
  const ctx = await browser.newContext({ acceptDownloads: true, locale: lng });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const denied = [];
  page.on('response', (r) => {
    if (r.url().includes('/contracts/') && [401, 403].includes(r.status())) {
      denied.push(`${r.status()} ${r.url()}`);
    }
  });

  await page.goto(`${APP}/sign/${uploaded.sign_token}?lng=${lng}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="sign-contract-card"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);

  // Nothing signed them in, and nothing should have.
  const signedIn = await page.evaluate(() => Boolean(
    localStorage.getItem('token') || localStorage.getItem('access_token'),
  ));
  ok(`${lng}: the signing page opens with no account`,
    (await page.locator('[data-testid="sign-contract-card"]').count()) === 1 && !signedIn);

  /* By test id, not by its label. Matching /download/i found the button in
     English and missed it entirely in Hebrew, which is the same class of
     mistake as the bug being tested: a check that only exercises one
     language proves the feature works for half the people using it. */
  const button = page.locator('[data-testid="download-contract-btn"]');
  ok(`${lng}: there is a Download button`, (await button.count()) === 1);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    button.click().catch(() => {}),
  ]);
  ok(`${lng}: pressing it actually produces a file`, !!download,
    download ? '' : 'no download event');
  if (download) {
    const got = await bytesOf(download);
    ok(`${lng}: and the file is the contract they were sent`, got.equals(PDF),
      `${got.length} bytes vs ${PDF.length}`);
    ok(`${lng}: named as it was uploaded`, /agreement/.test(download.suggestedFilename()),
      download.suggestedFilename());
  }

  // The whole bug, stated as an assertion.
  ok(`${lng}: nothing on this page was refused for want of a login`,
    denied.length === 0, denied[0]);
  ok(`${lng}: no page errors`, errors.length === 0, errors[0]);
  await ctx.close();
}

// ------------------------------- 2. a link that is not a link

{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${APP}/sign/not-a-real-token-${stamp}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const text = await page.locator('body').innerText();
  ok('a stale or wrong link says so, rather than showing a broken button',
    (await page.locator('[data-testid="sign-contract-card"]').count()) === 0
    && /invalid|expired|not found/i.test(text), text.slice(0, 80));
  await ctx.close();
}

// ------------------------------- 3. the owner, in their own dashboard

{
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const denied = [];
  page.on('response', (r) => {
    if (r.url().includes('/contracts/') && [401, 403].includes(r.status())) {
      denied.push(`${r.status()} ${r.url()}`);
    }
  });

  await page.goto(`${APP}/auth/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
  await page.goto(`${APP}/dashboard?tab=contracts`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="contract-manager"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // The row collapses its actions until it is opened.
  await page.click(`[data-testid="contract-${uploaded.id}"]`).catch(() => {});
  await page.waitForTimeout(800);
  const btn = page.locator(`[data-testid="download-btn-${uploaded.id}"]`);
  ok('the owner sees their contract, with a Download button', (await btn.count()) === 1);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    btn.click().catch(() => {}),
  ]);
  ok('and it downloads for them too', !!download, download ? '' : 'no download event');
  if (download) {
    const got = await bytesOf(download);
    ok('with the right bytes', got.equals(PDF), `${got.length} bytes`);
  }
  ok('nothing was refused on the way', denied.length === 0, denied[0]);
  ok('no page errors', errors.length === 0, errors[0]);
  await ctx.close();
}

await browser.close();

// ------------------------------- 4. and the file is still private

{
  // Straight at the API with no credential of any kind.
  const r = await fetch(`${API}/contracts/download/${uploaded.id}`);
  ok('the authenticated route still refuses a caller with no token',
    [401, 403].includes(r.status), `${r.status}`);
  const guess = await fetch(`${API}/contracts/sign/${crypto.randomUUID()}/file`);
  ok('and a guessed sign token gets nothing', guess.status === 404, `${guess.status}`);
}

await fetch(`${API}/contracts/${uploaded.id}`, { method: 'DELETE', headers: bearer });
if (prop?.id) await fetch(`${API}/properties/${prop.id}`, { method: 'DELETE', headers: auth });

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);

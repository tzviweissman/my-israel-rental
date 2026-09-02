#!/usr/bin/env node
/**
 * An owner can add a logo from the checklist, and the checklist notices.
 *
 * WHY. "Add a logo" opened a form with no logo field, so no business could
 * ever reach 100% — see scripts/test-completeness-actions.mjs for the
 * static half. This is the live half: a real browser, a real account, a
 * real upload, and the record read back from the API afterwards.
 *
 * Local stack only (build on :3000, API on :8001). Creates a throwaway
 * provider account and business. The image really is uploaded to
 * Cloudinary — it is a 1×1 PNG.
 *
 *   node scripts/check-business-logo.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const API = (process.env.API_ORIGIN || 'http://localhost:8001') + '/api';
const OUT = join(ROOT, 'screenshots', 'business-logo');
mkdirSync(OUT, { recursive: true });

const stamp = Date.now().toString(36);
const results = [];
const ok = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond });
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' — ' + detail}`);
};
const json = async (r) => { try { return await r.json(); } catch { return null; } };

// A valid 1×1 opaque PNG, so Cloudinary accepts it.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

// --- throwaway account + business, through the API ------------------------
const reg = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: `logocheck-${stamp}@example.com`, password: `Pw-${stamp}-ok1`, name: 'Logo Check', role: 'provider' }) });
const { token } = (await json(reg)) || {};
ok('provider account created', reg.status === 200 && !!token, `status ${reg.status}`);
if (!token) process.exit(1);
const auth = { Authorization: `Bearer ${token}` };

const mk = await fetch(`${API}/marketplace/businesses`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
  body: JSON.stringify({ name: `Logo Check ${stamp}` }) });
const biz = await json(mk);
ok('business created', mk.status === 200 && biz?.id, `status ${mk.status}`);
ok('it starts with no logo', !biz?.logo_url);

// --- the browser: checklist → form → upload → save ------------------------
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('token', t); } catch { /* */ } }, token);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${APP}/dashboard?tab=my-businesses&lng=en`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const item = page.locator(`[data-testid="business-completeness-${biz.id}"] [data-testid="completeness-logo"]`);
ok('"Add a logo" is on the checklist', await item.count() === 1);
await page.screenshot({ path: `${OUT}/1-checklist-before.png` });

await item.click();
const input = page.locator('[data-testid="biz-details-logo-input"]');
ok('clicking it opens a form WITH a logo control', await input.count() === 1);
await page.screenshot({ path: `${OUT}/2-form-open.png` });

await input.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
await page.waitForSelector('[data-testid="biz-details-logo-preview"]', { timeout: 30000 }).catch(() => null);
const previewSrc = await page.locator('[data-testid="biz-details-logo-preview"]').getAttribute('src').catch(() => null);
ok('the upload produced a preview URL', !!previewSrc && /^https?:\/\//.test(previewSrc), previewSrc || '(none)');
await page.screenshot({ path: `${OUT}/3-preview.png` });

await page.click('[data-testid="biz-details-save"]');
await page.waitForTimeout(2500);
ok('the form closed after saving', await page.locator('[data-testid="business-details-form"]').count() === 0);

const after = await json(await fetch(`${API}/marketplace/businesses`, { headers: auth }));
const saved = (after || []).find((b) => b.id === biz.id);
ok('the API now returns the logo on the business', !!saved?.logo_url && saved.logo_url === previewSrc,
  saved?.logo_url || '(none)');

await page.waitForTimeout(500);
const stillListed = await page.locator(`[data-testid="business-completeness-${biz.id}"] [data-testid="completeness-logo"]`).count();
ok('the checklist no longer asks for a logo', stillListed === 0);
await page.screenshot({ path: `${OUT}/4-checklist-after.png` });

// --- removing it clears it, so the field is a real control not a one-way door
await page.click(`[data-testid="business-card-${biz.id}"] button:has-text("Business details")`).catch(() => null);
await page.waitForTimeout(800);
const removeBtn = page.locator('[data-testid="biz-details-logo-remove"]');
if (await removeBtn.count()) {
  await removeBtn.click();
  await page.click('[data-testid="biz-details-save"]');
  await page.waitForTimeout(2000);
  const cleared = (await json(await fetch(`${API}/marketplace/businesses`, { headers: auth })) || []).find((b) => b.id === biz.id);
  ok('removing the logo clears it on the API', !cleared?.logo_url, cleared?.logo_url || '');
} else {
  ok('reopened the form to test Remove', false, 'could not find the details button or remove control');
}

ok('no page errors during the flow', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed; screenshots in ${OUT}\n`);
process.exit(failed ? 1 : 0);

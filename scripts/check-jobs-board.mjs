#!/usr/bin/env node
/**
 * The jobs board renders when there is something on it - in both languages.
 *
 * WHY. A locale-aware title helper was wired into the board's row
 * component without passing it the i18n instance, so every row threw
 * `ReferenceError: i18n is not defined`. The empty board rendered fine,
 * the build passed, the auth and listing checks never opened the board,
 * and it shipped. This posts a job, then loads the board in English and
 * Hebrew and asserts the row is there and no page error fired.
 *
 * Local stack (build on :3000, API on :8001).
 *
 *   node scripts/check-jobs-board.mjs
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

const reg = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: `jobscheck-${stamp}@example.com`, password: `Pw-${stamp}-ok1`, name: 'Jobs Check', role: 'owner' }) });
const { token } = (await json(reg)) || {};
ok('account created', !!token, `status ${reg.status}`);
if (!token) process.exit(1);
const auth = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

const title = `TEST_jobs_board_${stamp}`;
const post = await fetch(`${API}/marketplace/jobs`, { method: 'POST', headers: auth,
  body: JSON.stringify({ title, description: 'Board render check', category: 'home-services-repair', area: 'Tel Aviv', budget_type: 'open', budget_currency: 'ILS' }) });
const job = await json(post);
ok('job posted', post.status in { 200: 1, 201: 1 } && job?.id, `status ${post.status} ${JSON.stringify(job).slice(0, 120)}`);

const browser = await chromium.launch();
for (const lng of ['en', 'he']) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${APP}/businesses/jobs?lng=${lng}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const row = page.locator(`[data-testid="jobs-row-${job.id}"]`);
  ok(`${lng}: the posted job's row is on the board`, await row.count() === 1);
  // In Hebrew the board shows title_he once the background translator has
  // written it - which it usually has by the time this pass runs. Either
  // side counts; what must not appear is a raw key or nothing.
  const fresh = await json(await fetch(`${API}/marketplace/jobs/${job.id}`));
  const shown = [title, fresh?.title_he].filter(Boolean);
  const rowText = await row.innerText().catch(() => '');
  ok(`${lng}: the row shows the title (${lng === 'he' && fresh?.title_he ? 'translated' : 'source'})`, shown.some((s) => rowText.includes(s)), rowText.slice(0, 80));
  ok(`${lng}: no page errors`, errors.length === 0, errors[0]);
  await page.goto(`${APP}/businesses/jobs/${job.id}?lng=${lng}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const bodyText = await page.innerText('body');
  ok(`${lng}: the job page renders the title`, shown.some((s) => bodyText.includes(s)));
  ok(`${lng}: no page errors on the job page`, errors.length === 0, errors[0]);
  await page.context().close();
}
await browser.close();
await fetch(`${API}/marketplace/jobs/${job.id}`, { method: 'DELETE', headers: auth });

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);

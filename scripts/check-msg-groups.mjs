#!/usr/bin/env node
/**
 * Texts and emails shows each business only the customer messages its listings can send (Tzvi, 25 Nov 2026):
 * a shop never sees booking messages, a service with nothing to sell never sees order messages, and the
 * reminder shows only with appointments. For every business of the local test accounts, on a phone, it reads
 * what the server says the business uses (`uses` in /orders/settings) and fails when the page shows otherwise.
 *
 *   node scripts/check-msg-groups.mjs [--base http://localhost:3210]
 * Needs the local frontend and API (DEV_AUTOLOGIN=1), as every ?as= check.
 */
import { chromium, devices } from 'playwright';

const base = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3210';
const b = await chromium.launch();
const bad = [];
let seen = 0;
for (const as of ['owner', 'provider']) {
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const uses = {};
  p.on('response', async (r) => {
    const m = r.url().match(/businesses\/([^/]+)\/orders\/settings$/);
    if (m && r.request().method() === 'GET' && r.ok()) uses[m[1]] = (await r.json().catch(() => ({}))).uses;
  });
  p.on('pageerror', (e) => bad.push(`${as}: page error ${e.message}`));
  await p.goto(`${base}/dashboard?tab=text-notifications&as=${as}`, { waitUntil: 'load', timeout: 90000 });
  await p.waitForSelector('[data-testid="texts-tab-messages"], [data-testid="settings-pane-empty"]', { timeout: 60000 });
  if (!(await p.locator('[data-testid="texts-tab-messages"]').count())) { console.log(`${as}: no business`); continue; }
  const pick = p.locator('[data-testid="settings-pane-business"]');
  const ids = (await pick.count()) ? await pick.locator('option').evaluateAll((o) => o.map((x) => x.value)) : [null];
  for (const id of [...new Set(ids)]) {
    if (id) { await pick.selectOption(id); }
    await p.waitForSelector('[data-testid="texts-tab-messages"]');
    await p.waitForTimeout(1200);
    await p.click('[data-testid="texts-tab-messages"]');
    const got = await p.locator('[data-testid^="msgs-group-"]').evaluateAll((s) => s.map((x) => x.dataset.testid.slice(11)));
    const reminder = await p.locator('[data-testid="msgs-group-bookings"] [data-testid*="reminder"]').count();
    const u = uses[id || Object.keys(uses)[0]];
    const name = id || 'only business';
    seen += 1;
    if (!u) { bad.push(`${as} ${name}: no settings answer seen`); continue; }
    const all = !u.orders && !u.bookings;
    if (!all && got.includes('orders') !== !!u.orders) bad.push(`${as} ${name}: orders shown=${got.includes('orders')}, uses=${u.orders}`);
    if (!all && got.includes('bookings') !== !!u.bookings) bad.push(`${as} ${name}: bookings shown=${got.includes('bookings')}, uses=${u.bookings}`);
    if (!all && u.bookings && !u.reminders && reminder) bad.push(`${as} ${name}: reminder shown without appointments`);
    if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) bad.push(`${as} ${name}: sideways scroll`);
    console.log(`${as} ${name}: ${got.join(', ')}`);
  }
}
await b.close();
if (!seen) bad.push('no business checked');
if (bad.length) { console.error(`FAIL\n- ${bad.join('\n- ')}`); process.exit(1); }
console.log(`PASS: ${seen} businesses show only their own messages`);

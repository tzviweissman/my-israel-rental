#!/usr/bin/env node
/**
 * Sign-up and sign-in, end to end, in a real browser against the real app.
 *
 * WHY. In one week: a signup screen that said "your details are wrong"
 * for a request that never left the phone; a build that logged every
 * signed-in visitor out on their next page load; two rollouts that sent
 * every API call to the wrong place. None of those was caught by a unit
 * test, because none of them was a unit. They were the whole path — the
 * page, the bundle, the base URL, the proxy, the server — and the only
 * check that sees the whole path is a browser walking it.
 *
 * So this walks it. Every flow a person can take to get an account or a
 * session, with assertions on what THEY see (a toast that stays up long
 * enough to read, a dashboard that survives a reload) and on what the
 * server stored.
 *
 * Runs against the local stack — build served on :3000, API on :8001,
 * local MongoDB — and creates throwaway accounts there. The reset-link
 * token is read straight out of the local database, because the email
 * is not sent locally; that step needs backend/.venv.
 *
 *   node scripts/check-auth-flows.mjs
 *   APP_ORIGIN=http://localhost:3000 API_ORIGIN=http://localhost:8001
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const API = (process.env.API_ORIGIN || 'http://localhost:8001') + '/api';
const OUT = join(ROOT, 'screenshots', 'auth-flows');
mkdirSync(OUT, { recursive: true });

const stamp = Date.now().toString(36);
const PASSWORD = `Pw-${stamp}-ok1`;
const account = (role) => ({ email: `authcheck-${role}-${stamp}@example.com`, name: `Auth Check ${role}` });
// /join's cards are named for the person, not the backend role.
const CARD = { renter: 'traveler', owner: 'host', provider: 'provider' };

const results = [];
const ok = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond, detail });
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' — ' + detail}`);
};

const browser = await chromium.launch();
const fresh = async (lng = 'en') => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => results.push({ name: `page error: ${e.message.slice(0, 80)}`, ok: false }));
  page.__lng = lng;
  return { ctx, page };
};
const go = (page, path) => page.goto(`${APP}${path}${path.includes('?') ? '&' : '?'}lng=${page.__lng}`, { waitUntil: 'networkidle' });

/** The text of every toast currently on screen. */
const toasts = (page) => page.evaluate(() =>
  [...document.querySelectorAll('[data-sonner-toast], [role="status"], li[data-sonner-toast]')]
    .map((n) => n.innerText.trim()).filter(Boolean));

const token = (page) => page.evaluate(() => { try { return sessionStorage.getItem('token'); } catch { return null; } });

const me = async (page) => {
  const t = await token(page);
  if (!t) return null;
  const r = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
  return r.ok ? r.json() : null;
};

// ---------------------------------------------------------------------------
// 1. Sign up through /join, one account per role
// ---------------------------------------------------------------------------
console.log('\n1. sign up through /join\n');
for (const role of ['renter', 'owner', 'provider']) {
  const { ctx, page } = await fresh();
  const acct = account(role);
  await go(page, '/join');
  await page.click(`[data-testid="signup-role-${CARD[role]}"]`);
  await page.click('[data-testid="signup-continue-btn"]');
  await page.fill('[data-testid="signup-name-input"]', acct.name);
  await page.fill('[data-testid="signup-email-input"]', acct.email);
  await page.fill('[data-testid="signup-password-input"]', PASSWORD);
  await page.fill('[data-testid="signup-confirm-input"]', PASSWORD);
  await page.check('[data-testid="signup-terms-checkbox"]');
  await page.click('[data-testid="signup-submit-btn"]');
  await page.waitForTimeout(2500);

  const u = await me(page);
  ok(`${role}: account created and session valid`, u && u.email === acct.email && u.role === role,
    u ? `role=${u.role}` : `no session; toasts=${JSON.stringify(await toasts(page))}`);
  const url = page.url();
  const expected = role === 'provider' ? '/businesses/add' : '/dashboard';
  const landed = url.includes(expected) || url.includes('/join'); // renter/owner get a modal first
  ok(`${role}: landed somewhere sensible (${new URL(url).pathname})`, landed);
  await page.screenshot({ path: `${OUT}/signup-${role}.png` });
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 2. The session survives a reload (the bug that logged everyone out)
// ---------------------------------------------------------------------------
console.log('\n2. session survives a reload\n');
{
  const { ctx, page } = await fresh();
  const acct = account('renter');
  await go(page, '/auth/login');
  await page.fill('[data-testid="auth-email-input"]', acct.email);
  await page.fill('[data-testid="auth-password-input"]', PASSWORD);
  await page.click('[data-testid="auth-submit-button"]');
  await page.waitForTimeout(2000);
  ok('login with the new password', !!(await me(page)));
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await go(page, '/dashboard');
  await page.waitForTimeout(2500);
  ok('still signed in after a full page load', !!(await me(page)), `token=${!!(await token(page))}`);
  ok('no "API is not defined" / fetch user error on load',
    !errors.some((e) => /API is not defined|Failed to fetch user/.test(e)), errors.slice(0, 2).join(' | '));
  ok('dashboard rendered, not the login page', !page.url().includes('/auth/login'), page.url());
  await page.screenshot({ path: `${OUT}/dashboard-after-reload.png` });
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 3. Wrong password: a readable reason, on screen long enough to read
// ---------------------------------------------------------------------------
console.log('\n3. wrong password\n');
{
  const { ctx, page } = await fresh();
  const acct = account('renter');
  await go(page, '/auth/login');
  await page.fill('[data-testid="auth-email-input"]', acct.email);
  await page.fill('[data-testid="auth-password-input"]', 'definitely-wrong');
  await page.click('[data-testid="auth-submit-button"]');
  await page.waitForTimeout(3000);           // past the old 1.5s vanishing point
  const shown = await toasts(page);
  ok('an error is still visible 3s after submit', shown.length > 0, JSON.stringify(shown));
  ok('it says the credentials are wrong, not that something is "unknown"',
    shown.some((s) => /invalid|incorrect|wrong|credentials|לא נכון|שגוי/i.test(s)), JSON.stringify(shown));
  ok('no session was created', !(await token(page)));
  await page.screenshot({ path: `${OUT}/wrong-password.png` });
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 4. Duplicate email: told plainly
// ---------------------------------------------------------------------------
console.log('\n4. duplicate email\n');
{
  const { ctx, page } = await fresh();
  const acct = account('renter');
  await go(page, '/join');
  await page.click('[data-testid="signup-role-traveler"]');
  await page.click('[data-testid="signup-continue-btn"]');
  await page.fill('[data-testid="signup-name-input"]', 'Again');
  await page.fill('[data-testid="signup-email-input"]', acct.email);
  await page.fill('[data-testid="signup-password-input"]', PASSWORD);
  await page.fill('[data-testid="signup-confirm-input"]', PASSWORD);
  await page.check('[data-testid="signup-terms-checkbox"]');
  await page.click('[data-testid="signup-submit-btn"]');
  await page.waitForTimeout(2500);
  const shown = await toasts(page);
  ok('"already registered" is shown', shown.some((s) => /already/i.test(s)), JSON.stringify(shown));
  ok('no session was created', !(await token(page)));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 5. Forgot → reset → log in with the new password
// ---------------------------------------------------------------------------
console.log('\n5. forgot password, reset link, new password\n');
{
  const { ctx, page } = await fresh();
  const acct = account('owner');
  await go(page, '/auth/forgot-password');
  await page.fill('[data-testid="forgot-email-input"]', acct.email);
  await page.click('[data-testid="forgot-submit-btn"]');
  await page.waitForTimeout(2000);
  ok('"check your email" confirmation shown', /check your email|בדקו/i.test(await page.innerText('body')));

  // The email is not sent locally; the token is in the local database.
  let resetToken = '';
  try {
    resetToken = execFileSync(join(ROOT, 'backend', '.venv', 'Scripts', 'python.exe'), ['-c', `
import os; from dotenv import load_dotenv; load_dotenv(r'${join(ROOT, 'backend', '.env').replace(/\\/g, '\\\\')}')
from pymongo import MongoClient
db = MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
assert 'localhost' in os.environ['MONGO_URL'] or '127.0.0.1' in os.environ['MONGO_URL']
d = db.password_resets.find_one({'email': '${acct.email}', 'used': False}, sort=[('created_at', -1)])
print(d['token'] if d else '')
`], { encoding: 'utf8' }).trim();
  } catch (e) { ok('read reset token from local db', false, e.message.slice(0, 120)); }
  ok('a reset token was created', !!resetToken);

  if (resetToken) {
    const NEW = `${PASSWORD}-new`;
    await go(page, `/auth/reset-password?token=${resetToken}`);
    await page.fill('[data-testid="reset-new-password-input"]', NEW);
    await page.fill('[data-testid="reset-confirm-password-input"]', NEW);
    await page.click('[data-testid="reset-submit-btn"]');
    await page.waitForTimeout(2000);
    ok('reset confirmed on screen', /reset successfully|back to login|אופס|חזרה/i.test(await page.innerText('body')));

    const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: acct.email, password: NEW }) });
    ok('login works with the NEW password', r.status === 200, `status ${r.status}`);
    const r2 = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: acct.email, password: PASSWORD }) });
    ok('login is refused with the OLD password', r2.status === 401, `status ${r2.status}`);
    const r3 = await fetch(`${API}/auth/reset-password`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: resetToken, new_password: 'replay-attempt-1' }) });
    ok('the reset link cannot be used twice', r3.status === 400, `status ${r3.status}`);
  }
  await page.screenshot({ path: `${OUT}/reset-password.png` });
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 6. The older /auth/signup form still works too
// ---------------------------------------------------------------------------
console.log('\n6. /auth/signup (the older form)\n');
{
  const { ctx, page } = await fresh();
  const acct = { email: `authcheck-legacy-${stamp}@example.com`, name: 'Legacy Form' };
  await go(page, '/auth/signup');
  const hasForm = await page.$('[data-testid="auth-form"]');
  ok('/auth/signup renders its form', !!hasForm);
  if (hasForm) {
    await page.fill('[data-testid="auth-name-input"]', acct.name);
    await page.fill('[data-testid="auth-email-input"]', acct.email);
    await page.fill('[data-testid="auth-password-input"]', PASSWORD);
    await page.fill('[data-testid="auth-confirm-password-input"]', PASSWORD);
    const roleBtn = await page.$('[data-testid="auth-role-renter"]');
    if (roleBtn) await roleBtn.click();
    await page.check('[data-testid="auth-terms-checkbox"]');
    await page.click('[data-testid="auth-submit-button"]');
    await page.waitForTimeout(2500);
    const u = await me(page);
    ok('account created via /auth/signup', u && u.email === acct.email, u ? '' : JSON.stringify(await toasts(page)));
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 7. Hebrew: the login page is Hebrew and right-to-left
// ---------------------------------------------------------------------------
console.log('\n7. Hebrew\n');
{
  const { ctx, page } = await fresh('he');
  await go(page, '/auth/login');
  const dir = await page.evaluate(() => document.documentElement.dir);
  const body = await page.innerText('body');
  ok('dir=rtl on /auth/login?lng=he', dir === 'rtl', dir);
  ok('Hebrew copy is rendered', /[֐-׿]/.test(body));
  ok('no raw i18n keys visible', !/\b(auth|signupJoin|common)\.[a-zA-Z]+\b/.test(body));
  await page.screenshot({ path: `${OUT}/login-he.png` });
  await go(page, '/join');
  ok('/join in Hebrew shows Hebrew role cards', /[֐-׿]/.test(await page.innerText('[data-testid="signup-role-cards"]')));
  await page.screenshot({ path: `${OUT}/join-he.png` });
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 8. Google sign-in is offered where it should be
// ---------------------------------------------------------------------------
console.log('\n8. Google sign-in button present\n');
{
  const { ctx, page } = await fresh();
  for (const path of ['/auth/login', '/join']) {
    await go(page, path);
    if (path === '/join') { await page.click('[data-testid="signup-role-host"]'); await page.click('[data-testid="signup-continue-btn"]'); }
    const text = await page.innerText('body');
    ok(`${path}: a Google option is on the page`, /google/i.test(text));
  }
  await ctx.close();
}

// ── the sign-up page's photo sphere, from a keyboard ───────────────────
// It shipped as 36 focusable divs that unmounted as they rotated behind
// the sphere, so a keyboard user tabbing into it lost their place in the
// form within seconds, with no focus ring to show where they had been
// (2026-09-05 audit, finding 1). It is one tab stop now.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(`${APP}/signup`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="signup-sphere"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const shape = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="signup-right-panel"]');
    const sphere = document.querySelector('[data-testid="signup-sphere"]');
    return {
      stops: panel ? panel.querySelectorAll('[tabindex="0"], a[href], button, input, select, textarea').length : -1,
      nodes: document.querySelectorAll('[data-testid^="img-sphere-node-"]').length,
      tabbableNodes: document.querySelectorAll('[data-testid^="img-sphere-node-"][tabindex="0"]').length,
      role: sphere?.getAttribute('role'),
      named: !!sphere?.getAttribute('aria-label'),
    };
  });
  ok('the sphere is drawn', shape.nodes > 10, JSON.stringify(shape));
  ok('and is ONE tab stop, not one per photo', shape.stops === 1 && shape.tabbableNodes === 0, JSON.stringify(shape));
  ok('with a role and a name', shape.role === 'group' && shape.named, JSON.stringify(shape));

  // Focus has to survive the rotation that used to destroy it.
  await page.focus('[data-testid="signup-sphere"]');
  await page.waitForTimeout(4000);
  ok('focus survives the rotation', await page.evaluate(() => document.activeElement?.dataset?.testid) === 'signup-sphere');

  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('[data-testid="signup-sphere"]'));
    return cs.boxShadow !== 'none' || cs.outlineStyle !== 'none';
  });
  ok('and shows a focus ring the global rule would not have given it', ring);

  // Arrow keys turn it: a Shift step is 24 degrees, far more than the
  // auto-rotation covers in the same window, so the two cannot be confused.
  const angle = () => page.evaluate(() => Number(document.querySelector('[data-testid="signup-sphere"]').dataset.rotY));
  const turn = (a, b) => Math.abs(((b - a + 540) % 360) - 180);
  const a0 = await angle();
  await page.waitForTimeout(150);
  const drift = turn(a0, await angle());
  const a1 = await angle();
  await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(150);
  const moved = turn(a1, await angle());
  ok('arrow keys turn it', moved > drift + 10, `key ${moved}deg vs drift ${drift}deg in the same window`);
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed; screenshots in ${OUT}\n`);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
  process.exit(1);
}

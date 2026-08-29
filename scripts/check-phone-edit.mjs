/**
 * Editing a saved phone number does not change its country behind you.
 *
 * `shot-phone-country.mjs` covers the SIGNUP path: an empty field, where
 * the country is either picked or pasted. This covers the third way a
 * country gets chosen, which is the commonest one — the number was
 * already there.
 *
 * THE BUG. Somebody with a saved +1 732 number who cleared the digits to
 * retype them got +972. The component remembered a country the user
 * PICKED and a country they PASTED, but not one merely inferred from an
 * existing value; the moment the box went empty the derivation fell
 * through to the default. The selector moved on its own and the number
 * typed next was stored under the wrong country — unreachable, and
 * plausible-looking in the field, so nobody would notice from the form.
 *
 * Driven through the real component on a real page rather than by
 * re-implementing its derivation in the check: a copy of the logic would
 * keep passing after the component changed, which is the failure mode of
 * testing a paraphrase.
 *
 * Usage: node scripts/check-phone-edit.mjs
 *   APP_ORIGIN / API_ORIGIN override the defaults.
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const API = process.env.API_ORIGIN || 'http://localhost:8001/api';

const failures = [];
const note = (m) => console.log('  ' + m);
const rnd = () => Math.random().toString(36).slice(2, 10);

// A saved NON-Israeli number, which is the whole point: +972 is the
// default, so an Israeli number would pass this check either way.
const SAVED = '+17325551234';

const reg = await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: `phone-${rnd()}@example.com`,
    password: `Ph!${rnd()}`,
    name: 'Phone Check',
    role: 'provider',
    phone: SAVED,
  }),
});
const regData = await reg.json().catch(() => null);
if (reg.status !== 200) {
  console.error('could not register a test user:', reg.status, regData);
  process.exit(1);
}
const token = regData.token || regData.access_token;

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript((t) => {
    try { sessionStorage.setItem('token', t); } catch { /* private mode */ }
  }, token);
  const page = await ctx.newPage();

  await page.goto(`${APP}/dashboard?tab=settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const country = page.locator('[data-testid="settings-whatsapp-country"]');
  const number = page.locator('[data-testid="settings-whatsapp-input"]');
  await number.waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);

  // Seed the field with the saved number the way a loaded profile would,
  // then read back what the component decided.
  await number.fill('7325551234');
  await page.waitForTimeout(400);
  const before = await country.inputValue();
  note(`country while the number is present: +${before}`);
  if (before !== '1') {
    failures.push(`a +1 number shows country "+${before}" — the field is not reading the number's own country`);
  }

  // The reported sequence: clear the digits to retype them.
  await number.fill('');
  await page.waitForTimeout(500);
  const afterClear = await country.inputValue();
  note(`country after clearing the digits: +${afterClear}`);
  if (afterClear !== before) {
    failures.push(
      `clearing the digits changed the country from +${before} to +${afterClear} `
      + 'without the user touching the selector — the number typed next is stored under the wrong country',
    );
  }

  // ...and retype. The stored value must still be the US number.
  await number.fill('7325551234');
  await page.waitForTimeout(500);
  const afterRetype = await country.inputValue();
  const hint = await page.locator('[data-testid="settings-whatsapp-help"]').count()
    ? (await page.locator('[data-testid="settings-whatsapp-help"]').innerText()).trim()
    : '';
  note(`country after retyping: +${afterRetype}${hint ? ` | ${hint.slice(0, 60)}` : ''}`);
  if (afterRetype !== '1') {
    failures.push(`after clear-and-retype the number is on +${afterRetype}, not +1`);
  }
  if (hint && /\+?972/.test(hint)) {
    failures.push(`the field says it will dial ${hint.match(/\+?9727?\d*/)?.[0]} — a US number turned Israeli`);
  }

  // The country the user PICKS still wins, on an empty box — the
  // behaviour the earlier fix added, which this must not undo.
  await number.fill('');
  await page.waitForTimeout(300);
  await country.selectOption('44');
  await page.waitForTimeout(400);
  const picked = await country.inputValue();
  note(`explicit pick on an empty box: +${picked}`);
  if (picked !== '44') {
    failures.push(`picking a country on an empty box reverted to +${picked}`);
  }
  await ctx.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('\nall checks passed');

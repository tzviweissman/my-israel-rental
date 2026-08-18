/** Verify the S4 add-photo nudge in the provider dashboard. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('screenshots', { recursive: true });
const API = 'http://localhost:8001';
const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@rental.com', password: 'Admin1234!' }),
}).then((r) => r.json());

const browser = await chromium.launch();
for (const lang of ['en', 'he']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.addInitScript(([tk, l]) => {
    sessionStorage.setItem('token', tk);
    localStorage.setItem('i18nextLng', l);
  }, [login.token, lang]);
  await page.goto('http://localhost:3210/dashboard?tab=my-gigs', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // Reach the gigs tab however it is labelled.
  const tab = page.locator('[data-testid="dashboard-tabs"] button').filter({ hasText: /gigs|שירותים|עבודות/i }).first();
  try { await tab.click({ timeout: 4000 }); } catch { /* may already be there */ }
  await page.waitForTimeout(1800);

  const nudge = page.locator('[data-testid$="-nudge"]').first();
  const found = await nudge.count();
  console.log(`${lang}: nudge present = ${found > 0}`);
  if (found) {
    console.log(`${lang}: text = ${JSON.stringify((await nudge.innerText()).replace(/\s+/g, ' ').trim())}`);
    await page.screenshot({ path: `screenshots/photo-nudge-${lang}.png` });

    // Dismiss, and confirm it stays dismissed across a reload.
    await page.locator('[data-testid$="-dismiss"]').first().click();
    await page.waitForTimeout(400);
    console.log(`${lang}: after dismiss = ${await page.locator('[data-testid$="-nudge"]').count()}`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    console.log(`${lang}: after reload = ${await page.locator('[data-testid$="-nudge"]').count()} (0 = dismissal persisted)`);
  }
  // Any English left on a Hebrew dashboard card?
  const noImage = await page.locator('text=No image').count();
  console.log(`${lang}: stale "No image" labels = ${noImage}`);
  await page.close();
}
await browser.close();

/**
 * One-off capture of the dashboard share panel with the QR additions —
 * chart, share row, logo button — open, in both languages.
 * Scratch tooling in the spirit of screenshot.mjs; safe to delete.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const FRONT = 'http://localhost:3210';
const API = 'http://localhost:8001';

await mkdir('screenshots', { recursive: true });
const browser = await chromium.launch();

const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@test.com', password: 'Test1234!' }),
}).then((r) => r.json());

for (const lang of ['en', 'he']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await page.addInitScript(([token, lng]) => {
    sessionStorage.setItem('token', token);
    localStorage.setItem('i18nextLng', lng);
  }, [login.token, lang]);
  await page.goto(`${FRONT}/dashboard`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.click('[data-testid="share-listings-toggle"]');
  await page.waitForSelector('[data-testid="share-qr-card"]', { timeout: 15000 });
  await page.waitForTimeout(1200); // QR + chart settle
  const panel = page.locator('[data-testid="share-listings-panel"]');
  await panel.screenshot({ path: `screenshots/share-panel-${lang}.png` });
  console.log('wrote', `screenshots/share-panel-${lang}.png`);
  await page.close();
}
await browser.close();

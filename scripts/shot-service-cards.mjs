/** Screenshots of the services grid for the card-visibility spec. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('screenshots', { recursive: true });
const browser = await chromium.launch();
for (const lang of ['en', 'he']) {
  for (const width of [1280, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 1100 } });
    await page.addInitScript((l) => localStorage.setItem('i18nextLng', l), lang);
    await page.goto('http://localhost:3210/services?q=SPECFIX', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1200);
    const grid = page.locator('[data-testid^="services-gig-"]').first().locator('xpath=ancestor::div[contains(@class,"grid")]');
    try {
      await grid.screenshot({ path: `screenshots/svc-cards-${lang}-${width}.png` });
    } catch {
      await page.screenshot({ path: `screenshots/svc-cards-${lang}-${width}.png` });
    }
    console.log('wrote', `screenshots/svc-cards-${lang}-${width}.png`);
    await page.close();
  }
}
await browser.close();

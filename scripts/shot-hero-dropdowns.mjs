/** Open each hero-search picker and prove it opens DOWNWARD. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('screenshots', { recursive: true });
const browser = await chromium.launch();
const PICKERS = [
  ['service', '[data-testid="services-hero-service"]'],
  ['when', '[data-testid="services-hero-day"]'],
  ['budget', '[data-testid="services-hero-budget"]'],
];

for (const lang of ['en', 'he']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript((l) => localStorage.setItem('i18nextLng', l), lang);
  await page.goto('http://localhost:3210/services', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);

  for (const [name, sel] of PICKERS) {
    const trigger = page.locator(sel).first();
    if (!(await trigger.count())) { console.log(`${lang} ${name}: trigger not found (${sel})`); continue; }
    await trigger.click();
    await page.waitForTimeout(600);
    const panel = page.locator('[data-radix-popper-content-wrapper]').first();
    if (!(await panel.count())) { console.log(`${lang} ${name}: no panel opened`); continue; }
    const tb = await trigger.boundingBox();
    const pb = await panel.boundingBox();
    const below = pb.y >= tb.y + tb.height - 2;
    console.log(`${lang} ${name}: trigger.y=${Math.round(tb.y)} panel.y=${Math.round(pb.y)} -> ${below ? 'BELOW ok' : 'ABOVE  <-- wrong'}`);
    await page.screenshot({ path: `screenshots/hero-${name}-${lang}.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  await page.close();
}
await browser.close();

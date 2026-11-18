/**
 * The ad editor on a phone: every field you tap ends up where you can see it, never under the pinned preview.
 *
 * THE BUG (18 Nov 2026). The ad preview stays pinned over ~40% of a phone screen. A field scrolled into view
 * landed under it, the tap hit the ad, and the typing went nowhere. Nothing caught it: the editor looked fine
 * in every screenshot because the fields were only hidden once scrolled to.
 *
 * For each text field in the editor: scroll it into view the way a tap or the keyboard does, focus it, and
 * check its top is below the bottom of the preview. Also checks the page never scrolls sideways.
 *
 * Usage: node scripts/check-ad-editor-phone.mjs   (needs the local frontend and API with DEV_AUTOLOGIN=1)
 *   APP_ORIGIN overrides http://localhost:3210.
 */
import { chromium, devices } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const browser = await chromium.launch();
const failures = [];
try {
  const page = await browser.newPage({ ...devices['iPhone 13'], userAgent: `${devices['iPhone 13'].userAgent} mir-check` });
  await page.goto(`${APP}/dashboard?tab=advertising&as=owner&lng=en`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid=ad-extra]', { timeout: 90000 });
  const fields = page.locator('[data-testid=ad-maker] input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=date]), [data-testid=ad-maker] textarea');
  const n = await fields.count();
  for (let i = 0; i < n; i += 1) {
    const f = fields.nth(i);
    if (!(await f.isVisible())) continue;
    const r = await f.evaluate((el) => {
      // Above the pinned preview's own column, i.e. the editor's options, not the gallery over it.
      const col = document.querySelector('[data-testid=ad-preview-column]');
      if (!(col.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) return null;
      el.scrollIntoView({ block: 'start' });
      el.focus();
      return { top: el.getBoundingClientRect().top, under: col.getBoundingClientRect().bottom, name: el.getAttribute('aria-label') || el.placeholder || el.dataset.testid || el.tagName };
    });
    await page.waitForTimeout(250);
    if (!r) continue;
    const now = await f.evaluate((el) => ({ top: el.getBoundingClientRect().top, under: document.querySelector('[data-testid=ad-preview-column]').getBoundingClientRect().bottom }));
    if (now.top < now.under - 1) failures.push(`"${r.name}" sits under the preview (top ${Math.round(now.top)}px, preview ends ${Math.round(now.under)}px)`);
    await f.evaluate((el) => el.blur());
  }
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (wide > 0) failures.push(`the page scrolls sideways by ${wide}px`);
  console.log(`checked ${n} fields`);
} finally {
  await browser.close();
}
if (failures.length) {
  console.log(`FAIL\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('PASS: every ad editor field is clear of the preview on a phone');

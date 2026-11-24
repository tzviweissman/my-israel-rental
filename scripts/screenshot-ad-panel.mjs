/**
 * Pictures of the ad maker's side panel: every tab, on a phone and a laptop, in English and Hebrew.
 *
 * WHY (23 Nov 2026). Tidying the panel had to start from a 2-second screen recording, because nothing kept a
 * picture of it; checking each tab by hand in a small preview pane was slow. One run gives the whole panel.
 *
 * Usage: node scripts/screenshot-ad-panel.mjs [outDir]   (needs the local frontend and API with DEV_AUTOLOGIN=1)
 *   APP_ORIGIN overrides http://localhost:3210. Pictures go to outDir (default docs/ads/panel), named
 *   <phone|laptop>-<en|he>-<tab>.png, plus -text-bar.png: the words tapped on the ad, with the bar over them.
 *   Exits 1 if the text bar runs off the screen or wraps onto a second row.
 */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const OUT = process.argv[2] || 'docs/ads/panel';
mkdirSync(OUT, { recursive: true });
const TABS = ['words', 'look', 'extras', 'share'];
const browser = await chromium.launch();
const saved = [];
const problems = [];
try {
  for (const [name, opts] of [['phone', devices['iPhone 13']], ['laptop', { viewport: { width: 1366, height: 900 } }]]) {
    for (const lng of ['en', 'he']) {
      const page = await browser.newPage({ ...opts, userAgent: `${opts.userAgent || 'Mozilla/5.0'} mir-check` });
      await page.goto(`${APP}/dashboard?tab=advertising&as=owner&lng=${lng}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('[data-testid=ad-tabs]', { timeout: 90000 });
      await page.waitForSelector('[data-testid^=ad-piece-words]', { timeout: 90000 }).catch(() => {});
      console.error(`${name} ${lng} loaded`);
      for (const tab of TABS) {
        await page.click(`[data-testid=ad-tab-${tab}]`);
        await page.waitForTimeout(400);
        // The column under the tabs: the panel itself, from the tabs to its last control.
        const panel = page.locator('[data-testid=ad-tabs]').locator('..');
        const file = `${OUT}/${name}-${lng}-${tab}.png`;
        await panel.screenshot({ path: file });
        saved.push(file);
      }
      const words = page.locator('[data-testid=ad-piece-words]');
      if (await words.count()) {
        await words.scrollIntoViewIfNeeded();
        await words.click();
        await page.waitForSelector('[data-testid=ad-text-bar]', { timeout: 5000 });
        const file = `${OUT}/${name}-${lng}-text-bar.png`;
        await page.locator('[data-testid=ad-preview-column]').screenshot({ path: file });
        saved.push(file);
        // The text box is wider than a phone's ad on purpose; it must still never push the page sideways.
        const bar = await page.evaluate(() => {
          const r = document.querySelector('[data-testid=ad-text-bar]').getBoundingClientRect();
          return { left: r.left, right: r.right, rows: r.height > 60, wide: document.documentElement.scrollWidth > innerWidth };
        });
        const vw = page.viewportSize().width;
        if (bar.left < 0 || bar.right > vw || bar.wide) problems.push(`${name} ${lng}: the text bar runs off the screen`);
        if (bar.rows) problems.push(`${name} ${lng}: the text bar wraps onto a second row`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(saved.join('\n'));
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}

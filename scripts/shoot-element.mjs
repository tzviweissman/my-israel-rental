/**
 * Screenshot ONE element at 1280 / 768 / 375, in English and Hebrew.
 *
 *   node scripts/shoot-element.mjs "<url with ?as=role>" "<css selector>" <outPrefix>
 *
 * scripts/screenshot.mjs captures whole pages, which is right for a page
 * and useless for a panel that sits two screens down a dashboard: the
 * panel ends up a thumbnail in a 6,000px image. This scrolls the element
 * into view and captures just it. `?as=owner` (dev auto sign-in) works
 * because each width gets a fresh context and signs in on its own.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const [url, selector, prefix = 'element'] = process.argv.slice(2);
if (!url || !selector) {
  console.error('usage: node scripts/shoot-element.mjs <url> <selector> [prefix]');
  process.exit(2);
}

await mkdir('screenshots', { recursive: true });
const browser = await chromium.launch();
try {
  for (const lang of ['en', 'he']) {
    for (const width of [1280, 768, 375]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const sep = url.includes('?') ? '&' : '?';
      await page.goto(`${url}${sep}lng=${lang}`, { waitUntil: 'networkidle', timeout: 60000 });
      // ?as= signs in and strips itself; the page then re-renders.
      await page.waitForTimeout(1500);
      const el = page.locator(selector).first();
      try {
        await el.waitFor({ state: 'visible', timeout: 20000 });
      } catch {
        console.log(`MISSING ${selector} at ${lang} ${width} (url now ${page.url()})`);
        await ctx.close();
        continue;
      }
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const out = `screenshots/${prefix}-${lang}-${width}.png`;
      await el.screenshot({ path: out });
      console.log('wrote', out);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

/**
 * Open pages on the live site on a laptop and a phone, after a deploy (scripts/wait-deploy.mjs).
 * Fails on a page error, a page that scrolls sideways, or a page that does not load.
 *
 *   node scripts/check-live.mjs /join /businesses/add
 *   (in Git Bash: MSYS_NO_PATHCONV=1 node scripts/check-live.mjs ..., or /join becomes C:/Program Files/Git/join)
 *   SITE=https://staging.example.com node scripts/check-live.mjs /      (another origin)
 * Pictures go to screenshots/live/; look at them before saying the change is live.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SITE = process.env.SITE || 'https://myisraelrental.com';
const paths = process.argv.slice(2);
if (!paths.length) { console.error('Usage: node scripts/check-live.mjs /path [/path ...]'); process.exit(2); }
const OUT = path.join('screenshots', 'live');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const failures = [];
try {
  for (const [w, h, d] of [[1280, 800, 'laptop'], [390, 844, 'phone']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    for (const p of paths) {
      const errors = [];
      const onErr = (e) => errors.push(String(e));
      page.on('pageerror', onErr);
      // The query string skips any cached copy of the page from before the deploy.
      const res = await page.goto(`${SITE}${p}${p.includes('?') ? '&' : '?'}v=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => { errors.push(String(e)); return null; });
      await page.waitForTimeout(2500);
      if (res && res.status() >= 400) failures.push(`${d} ${p}: HTTP ${res.status()}`);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth).catch(() => 0);
      if (sw > w) failures.push(`${d} ${p}: page is ${sw}px wide, scrolls sideways`);
      if (errors.length) failures.push(`${d} ${p}: ${errors[0]}`);
      const slug = p.split('?')[0].replace(/\//g, '-');
      const name = `${d}${slug === '-' ? '-home' : slug}.png`;
      await page.screenshot({ path: path.join(OUT, name) });
      console.log('  wrote', name);
      page.off('pageerror', onErr);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log(`\nall pages opened on ${SITE}`);

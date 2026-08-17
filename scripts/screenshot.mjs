/**
 * Self-verify screenshots for the coding agent (no need to stall asking a human).
 *
 * Setup (once):
 *   npm i -D playwright && npx playwright install chromium
 *
 * Usage:
 *   node scripts/screenshot.mjs <url> [outPrefix]
 *   node scripts/screenshot.mjs http://localhost:3000/ home
 *   node scripts/screenshot.mjs "file://$(pwd)/home-redesign-preview.html" mockup
 *
 * Produces <outPrefix>-1280.png, <outPrefix>-768.png and <outPrefix>-375.png
 * in ./screenshots, full-page. The agent then visually compares against the
 * mockup. 768 is included on purpose — it's where two-column layouts (the
 * dual-door cards) most often collapse badly, and it's the width nobody checks.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.argv[2] || 'http://localhost:3000/';
const prefix = process.argv[3] || 'shot';
const widths = [1280, 768, 375];

await mkdir('screenshots', { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    // let fonts/hero images settle
    await page.waitForTimeout(1200);
    const out = `screenshots/${prefix}-${width}.png`;
    await page.screenshot({ path: out, fullPage: true });
    console.log('wrote', out);
    await page.close();
  }
} finally {
  await browser.close();
}

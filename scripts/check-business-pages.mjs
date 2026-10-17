#!/usr/bin/env node
/**
 * Opens every business page the way a visitor does and fails if one shows
 * a blank or dark screen, or throws an error (Tzvi, 17 Oct 2026, after The
 * Brown Box showed only a dark screen: "make sure all the business pages
 * are working properly ... how can we make sure this won't happen again").
 *
 * For each page: a laptop and a phone size, five scroll positions down the
 * page. At each, a screenshot is reduced to its brightness spread: a screen
 * that is almost one flat colour (dark or white) with no text on it counts
 * as blank. Any page error (an exception in the page's own script) fails it.
 *
 *   node scripts/check-business-pages.mjs [base-url] [slug ...]
 *   base-url defaults to https://myisraelrental.com; slugs default to every
 *   hand-built page (frontend/public/pages/pages.json) plus every business
 *   with a live listing.
 *
 * Needs playwright (frontend devDependency; npx playwright install chromium).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const require = createRequire(path.join(ROOT, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'https://myisraelrental.com').replace(/\/$/, '');
let slugs = process.argv.slice(3);
if (!slugs.length) {
  slugs = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend', 'public', 'pages', 'pages.json'), 'utf8'));
  // Every business with a live listing (the page takes a slug or an id).
  // Retried: right after a deploy the API can answer 502 for a minute, and
  // a silent fallback once checked only the hand-built pages.
  let found = 0;
  for (let attempt = 0; attempt < 5 && !found; attempt += 1) {
    try {
      const res = await fetch(`${BASE}/api/marketplace/gigs?limit=200`);
      if (res.ok) {
        for (const g of await res.json()) {
          if (g.business_id && !slugs.includes(g.business_id)) { slugs.push(g.business_id); found += 1; }
        }
      }
    } catch { /* retried below */ }
    if (!found) await new Promise((r) => setTimeout(r, 15000));
  }
  console.log(`${slugs.length} business pages to check (${found} from live listings)`);
  if (!found) console.error('WARNING: could not load the live listings; only the hand-built pages are checked.');
}

const SIZES = [{ name: 'laptop', width: 1366, height: 768 }, { name: 'phone', width: 390, height: 844 }];
const browser = await chromium.launch();
const problems = [];

for (const slug of slugs) {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(`${BASE}/business/${slug}`, { waitUntil: 'networkidle', timeout: 45000 });
    } catch (e) {
      problems.push(`${slug} (${size.name}): did not load: ${e.message.split('\n')[0]}`);
      await page.close();
      continue;
    }
    await page.waitForTimeout(2500);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const stops = [0, 0.2, 0.4, 0.6, 0.85].map((f) => Math.round((height - size.height) * f));
    for (const y of stops) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(1200);
      // Brightness spread of the visible screen, and whether any text is in view.
      const shot = await page.screenshot({ type: 'png' });
      const stat = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0, 64, 64);
        const d = x.getImageData(0, 0, 64, 64).data;
        let sum = 0; let sq = 0;
        for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; sum += l; sq += l * l; }
        const n = d.length / 4; const mean = sum / n;
        const textInView = [...document.querySelectorAll('h1,h2,h3,p,a,button,li')].some((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < innerHeight && r.width > 0 && (el.innerText || '').trim().length > 2
            && getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0.2;
        });
        return { mean: Math.round(mean), spread: Math.round(Math.sqrt(Math.max(0, sq / n - mean * mean))), textInView };
      }, shot.toString('base64'));
      if (stat.spread < 6 && !stat.textInView) {
        problems.push(`${slug} (${size.name}): blank screen at ${y}px (brightness ${stat.mean}, almost one colour, no text)`);
      }
    }
    for (const e of [...new Set(errors)]) problems.push(`${slug} (${size.name}): page error: ${e.slice(0, 200)}`);
    await page.close();
  }
  console.log(`checked ${slug}`);
}
await browser.close();

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nAll ${slugs.length} business pages show content at every scroll position, with no page errors.`);

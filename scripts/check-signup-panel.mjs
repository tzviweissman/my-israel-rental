/**
 * The sign-up / log-in panel (SignupSphere + WorkForYou): pictures at laptop, small laptop and phone, English and
 * Hebrew, at several moments of the live stream, and a check that nothing in it covers any of its text.
 *
 * Why (16 Nov 2026): the live work bar sat on top of the photo sphere and nobody's check noticed; and the in-app
 * browser pane crops wide pages, so pictures came from a one-off script. This is that script, kept.
 *
 *   node scripts/check-signup-panel.mjs [--base http://localhost:3210] [--out screenshots/signup-panel] [--sample]
 *
 * --sample fills the stream with made-up lines (pictures only: the live site may have too few to show it moving).
 * Exit 1 if any text is covered.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { covered, VIEWS } from './check-covered.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('--base', 'http://localhost:3210');
const out = arg('--out', 'screenshots/signup-panel');
const sample = process.argv.includes('--sample');
await mkdir(out, { recursive: true });

const now = Date.now();
const day = 864e5;
const SAMPLE = [
  ['confirmed', 'email', 'jerusalem', 1], ['ad_made', '', 'Tel Aviv - Florentin', 2], ['review_asked', 'text', 'Haifa', 3],
  ['page_built', '', 'Beit Shemesh', 4], ['order_alert', 'text', 'Rehavia', 5],
].map(([kind, channel, area, d]) => ({ kind, channel, area, at: new Date(now - d * day).toISOString() }));

const RUNS = VIEWS;
const problems = [];
const browser = await chromium.launch();
try {
  for (const [name, w, h, lang] of RUNS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch (e) { /* private mode */ } }, lang);
    if (sample) await page.route('**/site/work', (r) => r.fulfill({ json: { events: SAMPLE } }));
    await page.goto(`${base}/join`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // From lg up the panel holds the stream (the form's own copy is hidden); below lg only the form's copy exists.
    const sel = w >= 1024 ? '[data-testid="signup-right-panel"]' : '[data-testid="work-for-you"]';
    await page.waitForSelector(sel, { timeout: 30000 });
    await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' }));
    // Several moments: lines typing, the example card up, the full list.
    for (const t of [4000, 9000, 15000]) {
      await page.waitForTimeout(t === 4000 ? 4000 : t === 9000 ? 5000 : 6000);
      const bad = await page.$eval(sel, covered);
      for (const b of bad) problems.push(`${name} at ${t / 1000}s: ${b}`);
      await (await page.$(sel)).screenshot({ path: `${out}/${name}-${t / 1000}s.png` });
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`Pictures in ${out}`);
if (problems.length) {
  console.log(`Covered text (${problems.length}):\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exit(1);
}
console.log('No text in the panel is covered.');

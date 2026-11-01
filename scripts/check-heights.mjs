#!/usr/bin/env node
/**
 * Sections of different heights, so the page has a rhythm (Tzvi, 1 Nov 2026, rules 3v.6, from Payton
 * Clark Smith's by8f2vYoJAE: a short band, a tall block, a thin strip, a grid). A page of one block
 * height after another reads as a template.
 *
 * On each page, at a laptop (1366x800), the top-level sections of <main> (or of <body>) taller than
 * 60 px, measured in screens:
 *   MIX   at least two of the three sizes: thin or short (under 0.6 screen), middling (0.6 to 1.2), tall (over 1.2)
 *   RUN   never three sections in a row within 15% of each other's height
 * A page of fewer than four sections, or under 2.5 screens in all, is not judged (order steps, contact).
 *
 *   node scripts/check-heights.mjs <url> [more urls]      exit 1 on any page that fails
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-heights.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1366, height: 800 } });
let bad = 0;
for (const url of urls) {
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(500);
  const secs = await p.evaluate(() => {
    const root = document.querySelector('main') || document.body;
    return [...root.children].filter((e) => !/^(SCRIPT|STYLE|HEADER|FOOTER|NAV)$/.test(e.tagName) && getComputedStyle(e).position !== 'fixed' && e.offsetHeight > 60)
      .map((e) => ({ name: e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''), s: e.offsetHeight / innerHeight }));
  });
  const why = [];
  if (secs.length >= 4 && secs.reduce((t, x) => t + x.s, 0) >= 2.5) {
    const size = (s) => (s < 0.6 ? 'short' : s <= 1.2 ? 'middling' : 'tall');
    const kinds = new Set(secs.map((x) => size(x.s)));
    if (kinds.size < 2) why.push(`MIX: every section is ${[...kinds][0]}; mix a short band or a tall block in`);
    for (let i = 2; i < secs.length; i++) {
      const run = secs.slice(i - 2, i + 1).map((x) => x.s), lo = Math.min(...run), hi = Math.max(...run);
      if (hi <= lo * 1.15) why.push(`RUN: ${secs.slice(i - 2, i + 1).map((x) => `${x.name} ${x.s.toFixed(2)}`).join(', ')} are the same height`);
    }
  }
  if (why.length) { bad++; console.log(`HEIGHTS  ${url}\n  ${why.join('\n  ')}`); }
  console.log(`${url}: checked`);
}
await browser.close();
process.exit(bad ? 1 : 0);

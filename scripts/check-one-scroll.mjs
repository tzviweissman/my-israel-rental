#!/usr/bin/env node
/**
 * Effects, never too much (Tzvi, 29 Oct 2026: "there shouldnt be two scroll affects on one page
 * especially on mobile where people just want to see the products and order fast", then "we dont need
 * only 1 affect it just cant be too much"). Bake away's flavour spot held the page for eight screens
 * after the drizzle film.
 *
 * A scroll scene is a section that pins something (position: sticky) while the page scrolls past more
 * than half a screen of its own height. The first (the opening) may be any length; every later one is at
 * most 1.6 screens, and a page has at most three. Checked at phone and laptop sizes.
 *
 *   node scripts/check-one-scroll.mjs <url> [more urls]      exit 1 on any page with too much
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-one-scroll.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
let bad = 0;
for (const url of urls) {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
    const scenes = await p.evaluate(() => {
      const out = [];
      for (const e of document.querySelectorAll('body *')) {
        const s = getComputedStyle(e); if (s.position !== 'sticky' || e.closest('header, nav, [role=banner]') || e.offsetHeight < innerHeight * 0.5) continue;
        const par = e.parentElement; if (!par) continue;
        const extra = par.offsetHeight - e.offsetHeight;   // how far the page scrolls while this stays pinned
        if (extra > innerHeight * 0.5) out.push({ top: par.getBoundingClientRect().top + scrollY, name: (par.id ? '#' + par.id : par.tagName.toLowerCase() + (par.className ? '.' + String(par.className).split(' ')[0] : '')), screens: Math.round(extra / innerHeight * 10) / 10 });
      }
      const seen = {}; return out.filter((o) => !seen[o.name] && (seen[o.name] = 1)).sort((a, b) => a.top - b.top);
    });
    await p.close();
    const long = scenes.slice(1).filter((o) => o.screens > 1.6), list = scenes.map((o) => `${o.name} (${o.screens} screens)`).join(', ');
    if (long.length || scenes.length > 3) { bad++; console.log(`TOO MUCH  ${url} ${w}x${h}: ${list} (after the opening, each scroll scene at most 1.6 screens, at most three in all; make longer turning a tap)`); }
  }
  console.log(`${url}: checked`);
}
await browser.close();
console.log(bad ? `scroll scenes: ${bad} problem(s)` : 'scroll scenes: never too much on any page');
process.exit(bad ? 1 : 0);

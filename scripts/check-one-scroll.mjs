#!/usr/bin/env node
/**
 * One scroll effect per page (Tzvi, 29 Oct 2026: "there shouldnt be two scroll affects on one page
 * especially on mobile where people just want to see the products and order fast"). Bake away had the
 * drizzle film and then a flavour spot that also held the page while the scroll turned the flavours.
 *
 * A scroll effect is a section that pins something (position: sticky) while the page scrolls past more
 * than half a screen of its own height. More than one on a page fails, at phone and laptop sizes.
 *
 *   node scripts/check-one-scroll.mjs <url> [more urls]      exit 1 on any page with two
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
        if (extra > innerHeight * 0.5) out.push((par.id ? '#' + par.id : par.tagName.toLowerCase() + (par.className ? '.' + String(par.className).split(' ')[0] : '')) + ` (${Math.round(extra / innerHeight * 10) / 10} screens)`);
      }
      return [...new Set(out)];
    });
    await p.close();
    if (scenes.length > 1) { bad++; console.log(`TWO SCROLL  ${url} ${w}x${h}: ${scenes.join(', ')} (one scroll effect per page; make the others tap or plain)`); }
  }
  console.log(`${url}: checked`);
}
await browser.close();
console.log(bad ? `one scroll: ${bad} problem(s)` : 'one scroll: every page has at most one scroll effect');
process.exit(bad ? 1 : 0);

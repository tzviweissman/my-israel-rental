#!/usr/bin/env node
/**
 * The first screen says every kind of thing the business offers (page rules 3g.18, checklist R3g.18; Tzvi, 5 Nov 2026,
 * Aaron Dovid: "its onl showing kumzitz people may think theyre on the wrong site before they even scroll down", then
 * "make sure its in rules that the wow home page should how what they offer"). His small facts line already said
 * "Guitar lessons" under a big kumzits headline and that did not help, so only big words count: the h1, or a heading of
 * 40 px or more (28 on a phone).
 *
 * The home page carries <meta name="offers" content="kumzits|guitar lesson">: each different kind of offer, in the words a
 * customer looks for. With two or more, each must be in the big words, unscrolled, 4 s after load, at 1366x800 and
 * 390x844; menu, footer and fixed bars do not count. With one kind the picture may show it, which a script cannot judge:
 * that stays a LOOK in the checklist line.
 *
 *   node scripts/check-says-offer.mjs <urls of the site's pages>     exit 1 when it fails
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2), url = urls.find((u) => /\/index\.html$|\/$/.test(new URL(u).pathname)) || urls[0];
if (!url) { console.error('usage: node scripts/check-says-offer.mjs <home url>'); process.exit(2); }
// kumzitzes and kumzits, lessons and lesson: the same offer
const stem = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').map((w) => w.replace(/(zes|es|s)$/, '')).join(' ');
const browser = await chromium.launch({ channel: 'chrome' });
let bad = 0;
for (const [w, h, mobile] of [[1366, 800, false], [390, 844, true]]) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  const p = await c.newPage();
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(4000);
  const r = await p.evaluate(() => {
    const seen = (el) => {
      const q = el.getBoundingClientRect();
      if (!q.width || !q.height || q.top >= innerHeight || q.bottom <= 0 || el.closest('header, nav, footer')) return false;
      for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.position === 'fixed' || s.visibility === 'hidden' || s.display === 'none' || +s.opacity < 0.5) return false; }
      return true;
    };
    const big = [...document.querySelectorAll('h1, h2, h3')].filter((e) => seen(e) && (e.tagName === 'H1' || parseFloat(getComputedStyle(e).fontSize) >= (innerWidth < 760 ? 28 : 40)));
    return { offers: document.querySelector('meta[name="offers"]')?.content || '', big: big.map((e) => e.innerText.replace(/\s+/g, ' ').trim()).join(' / ') };
  });
  await c.close();
  const offers = r.offers.split('|').map((s) => s.trim()).filter(Boolean), why = [];
  if (!offers.length) why.push('no <meta name="offers" content="first offer|second offer"> on the home page');
  if (offers.length > 1) for (const o of offers) if (!stem(r.big).includes(stem(o))) why.push(`"${o}" is not in the big words of the first screen: "${r.big || 'none'}"`);
  if (why.length) { bad++; console.log(`OFFERS  ${url} ${w}x${h}\n  ${why.join('\n  ')}`); }
}
console.log(`${url}: checked`);
await browser.close();
process.exitCode = bad ? 1 : 0;

#!/usr/bin/env node
/**
 * The page holds up with the worst content (Tzvi, 20 Nov 2026, from a video on Claude design skills: Emil Kowalski's
 * "break-ui"; page rules 3e.11, which said so since 8 Oct 2026 but nothing tested it). On each page, at 1366x800 and
 * 390x844, the first six product cards get the worst an owner can type: a very long name, a four-digit price, and one
 * photo that fails to load. Then:
 *   SCROLL   the page scrolls sideways
 *   SPILL    a name or price runs out of its card
 *   OVERLAP  a name runs into its price or its Add button
 *   COLLAPSE a card whose photo failed shrinks to under 60% of its height
 * A card is the nearest li, article or .pc round a product name. Pages with no product cards pass.
 *
 *   node scripts/check-break-ui.mjs <urls of the site's pages>      exit 1 on a fault
 * Passes on: Cakes by Tova (20 Nov 2026), after its long-name fixes.
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-break-ui.mjs <urls>'); process.exit(2); }
const LONG = 'Extra Large Triple Chocolate Hazelnut Celebration Babka with Rainbow Sprinkles';
const browser = await chromium.launch();
let bad = 0;
for (const url of urls) {
  const why = [];
  for (const [w, h] of [[1366, 800], [390, 844]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
    const p = await c.newPage();
    try { await p.goto(url, { waitUntil: 'load', timeout: 45000 }); } catch (e) { why.push(`LOAD: ${e.message.split('\n')[0]}`); await c.close(); continue; }
    await p.waitForTimeout(700);
    const r = await p.evaluate(async (LONG) => {
      document.querySelectorAll('.rev').forEach((e) => e.classList.add('in'));
      const money = /[₪$€£]\s?\d|\d\s?(₪|NIS|USD|EUR)/;
      const names = [...document.querySelectorAll('[data-f="name"], .pc-t b, .fb-t b, article h3, li h3')]
        .filter((n) => n.getClientRects().length && !n.closest('dialog, footer, header, nav'))
        .filter((n) => { const k = n.closest('li, article, .pc'); return k && money.test(k.textContent); }).slice(0, 6);
      const cards = names.map((n) => n.closest('li, article, .pc'));
      const before = cards.map((k) => k.getBoundingClientRect().height);
      names.forEach((n) => { n.textContent = LONG; });
      cards.forEach((k) => { const pr = k.querySelector('.pr, .fb-pr, b:not([data-f])'); if (pr && money.test(pr.textContent)) pr.lastChild.textContent = pr.lastChild.textContent.replace(/\d[\d.,]*/, '1,299'); });
      const img = cards[0] && cards[0].querySelector('img');
      if (img) { img.removeAttribute('srcset'); img.src = 'assets/missing-photo.webp'; }
      await new Promise((res) => setTimeout(res, 400));
      const out = { n: cards.length, scroll: document.documentElement.scrollWidth > innerWidth + 1, spill: [], overlap: [], collapse: [] };
      const inside = (a, b) => a.left >= b.left - 2 && a.right <= b.right + 2;
      const hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      cards.forEach((k, i) => {
        // the words themselves, not their box: a name that cannot wrap runs past its own box too
        const rg = document.createRange(); rg.selectNodeContents(names[i]);
        const kr = k.getBoundingClientRect(), nr = rg.getBoundingClientRect();
        const pr = k.querySelector('.pr, .fb-pr'), add = k.querySelector('button');
        if (!inside(nr, kr)) out.spill.push(`card ${i + 1}: its name`);
        if (pr) { const rp = document.createRange(); rp.selectNodeContents(pr); if (!inside(rp.getBoundingClientRect(), kr)) out.spill.push(`card ${i + 1}: its price`); }
        if (pr && !names[i].contains(pr) && !pr.contains(names[i]) && hit(nr, pr.getBoundingClientRect())) out.overlap.push(`card ${i + 1}: name and price`);
        if (add && hit(nr, add.getBoundingClientRect())) out.overlap.push(`card ${i + 1}: name and Add`);
      });
      if (cards[0] && cards[0].getBoundingClientRect().height < before[0] * 0.6) out.collapse.push(`card 1 ${Math.round(before[0])} -> ${Math.round(cards[0].getBoundingClientRect().height)} px`);
      return out;
    }, LONG);
    const at = w < 500 ? 'phone' : 'laptop';
    if (!r.n) { await c.close(); continue; }
    if (r.scroll) why.push(`SCROLL (${at}): the page scrolls sideways with a long name (3e.11)`);
    for (const s of r.spill) why.push(`SPILL (${at}): ${s} runs out of the card (3e.11)`);
    for (const s of r.overlap) why.push(`OVERLAP (${at}): ${s} run into each other (3e.11)`);
    for (const s of r.collapse) why.push(`COLLAPSE (${at}): ${s} when its photo fails to load; give the photo box a fixed shape (3e.11)`);
    await c.close();
  }
  if (why.length) { bad++; console.log(`BREAK  ${url}\n  ${[...new Set(why)].join('\n  ')}`); }
  console.log(`${url}: checked`);
}
await browser.close();
process.exit(bad ? 1 : 0);

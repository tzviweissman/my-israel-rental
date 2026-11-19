#!/usr/bin/env node
/**
 * Beside the best of its kind (Tzvi, 19 Nov 2026: "compare her site to our inspo ... see why ours doesnt look as good";
 * rules 3ag). Cakes by Tova's home page beside bakery sites from Pinterest, Awwwards and Inspo
 * (docs/inspo/compare-2026-11-19) lost on five things; three of them can be measured, at a laptop (1366x800), over the
 * top-level sections of <main> after the opening:
 *   GROUNDS    the sections use at most 3 grounds (colours closer than 12 RGB count as one; a picture ground is not
 *              counted). Tova's had six (cream, white, ice blue, blush, charcoal, blush): every part looked like
 *              another site. The reference bakeries take turns between two.
 *   HEADINGS   the sections' biggest headings come in at most 2 sizes (within 3 px): one size for every section, and
 *              the one jump 3ad.3 asks for. Hers were 36, 36, 76 and 36 px with a 52 px card: it read as untidy.
 *   SMALL      a product photo (a picture inside a card that shows a price) is at least 200 px wide. Her weekly
 *              menu showed each bake as an 88 px circle beside a list of words; the references give each one a big
 *              photo card.
 * A page of fewer than three such sections is not judged.
 *
 *   node scripts/check-look.mjs <url> [more urls]      (home pages only; exit 1 on a fault)
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2).filter((u) => /(\/|index\.html)(\?.*)?$/.test(u));
if (!process.argv[2]) { console.error('usage: node scripts/check-look.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
let bad = 0;
for (const url of urls) {
  const p = await browser.newPage({ viewport: { width: 1366, height: 800 } });
  try { await p.goto(url, { waitUntil: 'load', timeout: 45000 }); } catch (e) { bad++; console.log(`LOOK  ${url}\n  LOAD: ${e.message.split('\n')[0]}`); continue; }
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const root = document.querySelector('main') || document.body;
    const secs = [...root.children].filter((e) => !/^(SCRIPT|STYLE|HEADER|FOOTER|NAV|NOSCRIPT|TEMPLATE)$/.test(e.tagName) && !e.hidden
      && !/\bfoot/.test(e.className) && getComputedStyle(e).position !== 'fixed' && e.offsetHeight > 60).slice(1);
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const ground = (e) => {
      if (getComputedStyle(e).backgroundImage !== 'none' && !/gradient/.test(getComputedStyle(e).backgroundImage)) return null;
      for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c.length && (c[3] ?? 1) > 0.5) return c.slice(0, 3); }
      return [255, 255, 255];
    };
    const money = /[₪$€£]\s?\d|\d\s?(₪|NIS|USD|EUR)/;
    const small = [];
    for (const img of root.querySelectorAll('img')) {
      // a picture with empty alt is decoration (a logo mark on a card), never a product photo (Cakes by Tova, 19 Nov 2026)
      const b = img.getBoundingClientRect(); if (b.width < 48 || b.height < 48 || img.closest('header, footer, nav') || img.getAttribute('alt') === '') continue;
      // the card: the nearest ancestor that holds a price, at most three levels up
      let card = img.parentElement; for (let i = 0; i < 3 && card && !money.test(card.textContent); i++) card = card.parentElement;
      if (card && money.test(card.textContent) && card.querySelectorAll('img').length <= 2 && b.width < 200) small.push(`${img.getAttribute('src')} is ${Math.round(b.width)}px wide`);
    }
    return {
      n: secs.length,
      grounds: secs.map(ground).filter(Boolean),
      heads: secs.map((e) => Math.max(0, ...[...e.querySelectorAll('h1, h2')].filter((h) => h.offsetHeight).map((h) => parseFloat(getComputedStyle(h).fontSize)))).filter((x) => x >= 20),
      small,
    };
  });
  const why = [];
  if (r.n >= 3) {
    const kinds = [];
    for (const g of r.grounds) if (!kinds.some((k) => Math.hypot(k[0] - g[0], k[1] - g[1], k[2] - g[2]) < 12)) kinds.push(g);
    if (kinds.length > 3) why.push(`GROUNDS: the sections use ${kinds.length} grounds (${kinds.map((k) => 'rgb(' + k.join(',') + ')').join(', ')}); take turns between two, three at most (3ag.3)`);
    const sizes = [];
    for (const h of r.heads.sort((a, b) => a - b)) if (!sizes.some((s) => Math.abs(s - h) <= 3)) sizes.push(h);
    if (sizes.length > 2) why.push(`HEADINGS: section headlines come in ${sizes.length} sizes (${sizes.map(Math.round).join(', ')} px); one size for every section and one jump (3ag.5)`);
  }
  for (const s of r.small) why.push(`SMALL: product photo ${s}; give each product a big photo card, 200 px wide or more (3ag.2)`);
  if (why.length) { bad++; console.log(`LOOK  ${url}\n  ${why.join('\n  ')}`); }
  console.log(`${url}: checked`);
  await p.close();
}
await browser.close();
process.exit(bad ? 1 : 0);

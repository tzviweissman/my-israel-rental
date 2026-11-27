#!/usr/bin/env node
/**
 * What 37 Awwwards Sites of the Day share and ours lacked (Tzvi, 27 Nov 2026: "Add all 4"; rules 3an,
 * docs/inspo/awwwards-2026-11-27). Each page at a laptop (1366x800):
 *   SMOOTH  the page eases the wheel (the starter's site.js sets <html data-smooth="on">; 30 of 40 winners use Lenis)
 *   BOXES   no row of three or more equal boxes for facts or steps: siblings side by side, the same size within a few
 *           percent, each a filled or bordered box (or a photo tile, six or more in a grid). None of the 37 has one;
 *           Gift Boutique's three step cards and 3x3 photo grid did. Product cards are exempt: a box holding an Add
 *           button or a price, or anything inside [data-products]
 *   STRIP   at most one strip that moves by itself (a marquee), marked data-strip, still under reduced motion
 *
 *   node scripts/check-award-body.mjs <url> [more urls]      exit 1 when a page fails
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-award-body.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
let bad = 0;
for (const url of urls) {
  const why = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const p = await ctx.newPage();
  try { await p.goto(url, { waitUntil: 'load', timeout: 45000 }); } catch (e) { bad++; console.log(`AWARD  ${url}\n  LOAD: ${e.message.split('\n')[0]}`); await ctx.close(); continue; }
  await p.waitForTimeout(800);
  // scroll through once so lazy sections and reveals are drawn, then back to the top
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 60)); } scrollTo({ top: 0, behavior: 'instant' }); });
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const out = { smooth: document.documentElement.dataset.smooth === 'on', rows: [], strips: [] };
    const painted = (e) => {
      const s = getComputedStyle(e);
      const bg = (s.backgroundColor.match(/[\d.]+/g) || []).map(Number);
      const fill = bg.length && (bg[3] ?? 1) > 0.05;
      const border = ['Top', 'Right', 'Bottom', 'Left'].filter((k) => parseFloat(s['border' + k + 'Width']) > 0 && !/transparent|rgba\(0, 0, 0, 0\)/.test(s['border' + k + 'Color'])).length >= 3;
      return fill || border || s.boxShadow !== 'none';
    };
    // a product card: an Add control, an order link, or a price (₪60, $52, from €9)
    const product = (e) => e.closest('[data-products]') || e.querySelector('[data-add], [data-f="price"], .price, [class*="price"], [aria-label*="Add" i], a[href*="add="]')
      // a price on its own (not "Delivery ₪25 in Ramat Eshkol" inside a fact)
      || [...e.querySelectorAll('*')].some((x) => !x.children.length && /^\s*(from\s+)?([₪$€£]\s?\d[\d,.]*|\d[\d,.]*\s?[₪$€£])\s*$/i.test(x.textContent));
    const photoTile = (e, b) => [...e.querySelectorAll('img, video, picture')].some((m) => { const c = m.getBoundingClientRect(); return c.width * c.height > 0.6 * b.width * b.height; });
    const name = (e) => e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '');
    const seen = new Set();
    for (const parent of document.querySelectorAll('body *')) {
      if (parent.closest('header, footer, nav, [role="dialog"]')) continue;
      const kids = [...parent.children].filter((k) => { const b = k.getBoundingClientRect(); return b.width >= 120 && b.height >= 90 && getComputedStyle(k).visibility !== 'hidden'; });
      if (kids.length < 3) continue;
      const boxes = kids.map((k) => ({ k, b: k.getBoundingClientRect() }));
      const ref = boxes[0].b;
      const same = boxes.filter(({ b }) => Math.abs(b.width - ref.width) <= 0.04 * ref.width && Math.abs(b.height - ref.height) <= 0.08 * ref.height);
      if (same.length < 3) continue;
      const tops = new Set(same.map(({ b }) => Math.round(b.top / 6)));
      if (tops.size === same.length) continue;   // stacked one under another, not side by side
      if (same.some(({ k }) => product(k))) continue;
      const tiles = same.filter(({ k, b }) => photoTile(k, b)).length;
      const filled = same.filter(({ k }) => painted(k)).length;
      let kind = '';
      // big two-across work tiles (Preymaker, 670 px of 1366) are an editorial layout; small tiles three or more across are the grid
      if (tiles >= 6 && tiles >= same.length * 0.8 && ref.width < 0.4 * innerWidth) kind = `a grid of ${tiles} equal photo tiles`;
      else if (filled >= 3 && filled >= same.length * 0.8 && tiles < same.length) kind = `a row of ${same.length} equal boxes`;
      if (!kind || seen.has(parent)) continue;
      seen.add(parent);
      out.rows.push(`${name(parent)}: ${kind} (${Math.round(ref.width)}x${Math.round(ref.height)})`);
    }
    for (const a of document.getAnimations()) {
      const t = a.effect && a.effect.target; if (!t || !(t instanceof Element)) continue;
      const iter = a.effect.getTiming().iterations;
      if (iter !== Infinity) continue;
      const b = t.getBoundingClientRect();
      if (b.width < 0.6 * innerWidth) continue;
      out.strips.push({ name: name(t), marked: !!t.closest('[data-strip]') });
    }
    return out;
  });
  if (!r.smooth) why.push('SMOOTH: the wheel is not eased (no <html data-smooth="on">); keep the starter\'s site.js smooth scrolling (3an.1)');
  for (const row of r.rows) why.push(`BOXES: ${row}; make facts and steps ruled rows or one per screen, photos a collage (3an.2)`);
  const strips = [...new Map(r.strips.map((s) => [s.name, s])).values()];
  if (strips.length > 1) why.push(`STRIP: ${strips.length} strips move by themselves (${strips.map((s) => s.name).join(', ')}); one at most (3an.4)`);
  for (const s of strips.filter((s) => !s.marked)) why.push(`STRIP: ${s.name} moves by itself but is not marked data-strip (3an.4)`);
  if (strips.length) {
    await p.emulateMedia({ reducedMotion: 'reduce' }); await p.waitForTimeout(300);
    const still = await p.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('[data-strip]') && a.effect.getTiming().iterations === Infinity).length);
    if (still) why.push('STRIP: the strip still moves with reduced motion on (3an.4)');
  }
  if (why.length) { bad++; console.log(`AWARD  ${url}\n  ${why.join('\n  ')}`); }
  console.log(`${url}: checked`);
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);

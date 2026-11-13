#!/usr/bin/env node
/**
 * Every order button looks the same (Tzvi, 12 Nov 2026: "make all the order buttons consistent", then "on mobile it
 * looks off why didnt the check catch it?" — the cards' buttons had a shadow the dark sections hid, and the order
 * form's <button> kept the browser's grey border).
 *
 * An order button is a filled link or button whose words start with "Order" (Order now, Order now, ₪330).
 * On every page, phone and laptop, it fails when two of them differ in fill, text colour, border, shadow, corner,
 * height (more than 4px), font, or when one has the dial and another does not.
 *
 *   node scripts/check-button-look.mjs <urls of the site's pages>      exit 1 when it fails
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: check-button-look.mjs <page urls>'); process.exit(2); }
const browser = await chromium.launch();
const sizes = [['phone', { width: 390, height: 844 }, true], ['laptop', { width: 1280, height: 800 }, false]];
const problems = [];

for (const [name, viewport, isMobile] of sizes) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile });
  const seen = [];
  for (const url of urls) {
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(800);
    const found = await p.evaluate(() => [...document.querySelectorAll('a, button')].filter((e) => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      const filled = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent';
      return r.width > 0 && r.height > 0 && filled && /^order\b/i.test(e.textContent.trim());
    }).map((e) => { const s = getComputedStyle(e); return {
      text: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 30),
      look: { fill: s.backgroundColor, ink: s.color, border: s.borderTopWidth === '0px' || s.borderTopStyle === 'none' ? 'none' : `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
        shadow: s.boxShadow, corner: s.borderTopLeftRadius, font: `${s.fontWeight} ${s.fontFamily.split(',')[0]}`, dial: !!e.querySelector('.btn-dial') },
      h: Math.round(e.getBoundingClientRect().height), bar: !!e.closest('header, .topbar') }; })); // the menu bar's button is smaller on purpose
    for (const f of found) seen.push({ ...f, page: url.replace(/^https?:\/\/[^/]+/, '') || '/' });
    await p.close();
  }
  if (!seen.length) continue;
  // the look most buttons share is the standard; every other one is reported against it
  const key = (b) => JSON.stringify(b.look);
  const count = new Map(); for (const b of seen) count.set(key(b), (count.get(key(b)) || 0) + 1);
  const std = JSON.parse([...count].sort((a, b) => b[1] - a[1])[0][0]);
  const hs = new Map(); for (const b of seen) hs.set(b.h, (hs.get(b.h) || 0) + 1);
  const stdH = [...hs].sort((a, b) => b[1] - a[1])[0][0];
  for (const b of seen) {

    const diff = Object.keys(std).filter((k) => String(b.look[k]) !== String(std[k])).map((k) => `${k} ${b.look[k]} (others ${std[k]})`);
    if (!b.bar && Math.abs(b.h - stdH) > 4) diff.push(`height ${b.h}px (others ${stdH}px)`);
    if (diff.length) problems.push(`${name} ${b.page} "${b.text}": ${diff.join('; ')}`);
  }
  console.log(`${name}: ${seen.length} order buttons on ${urls.length} pages`);
  await ctx.close();
}
await browser.close();
if (problems.length) { console.log(`\nOrder buttons that do not match the others (${problems.length}):\n  ` + problems.join('\n  ')); process.exit(1); }
console.log('every order button looks the same');

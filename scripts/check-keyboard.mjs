#!/usr/bin/env node
/**
 * What a keyboard, a screen reader and a price list meet (Tzvi, 22 Nov 2026: "All 7", from a video testing UI design
 * skills, where Vercel's Web Interface Guidelines audit found the two worst faults of a finished-looking app; rules 3aj.7).
 * check-web-basics already tests that a focus ring exists; these test what it did not:
 *
 *   OBSCURED  Tabbing through the page, the focused control is covered by something fixed or sticky (the menu bar,
 *             the phone order bar), so a keyboard user cannot see where they are. Laptop 1366x800 and phone 390x844.
 *   SWITCH    A choice that turns on and off is a real checkbox, radio or switch: a toggle drawn with a div or span
 *             says role="switch" or "checkbox" with aria-checked, or a button says aria-pressed; and a real checkbox
 *             is never display:none (then Tab cannot reach it; hide it visually instead, the .sr-only way).
 *   DIGITS    Prices use digits of one width (font-variant-numeric: tabular-nums), so a column of prices lines up and a
 *             total does not jump as it changes.
 *
 *   node scripts/check-keyboard.mjs <urls of the site's pages>      exit 1 when a page fails
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-keyboard.mjs <urls>'); process.exit(2); }
const browser = await chromium.launch();
let bad = 0;
for (const url of urls) {
  const why = new Set();
  for (const vp of [{ width: 1366, height: 800, name: 'laptop' }, { width: 390, height: 844, name: 'phone' }]) {
    const p = await (await browser.newContext({ viewport: vp, reducedMotion: 'reduce', hasTouch: vp.width < 500 })).newPage();
    await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(1200);
    await p.evaluate(() => { scrollTo(0, 0); document.activeElement?.blur(); });
    for (let i = 0; i < 40; i++) {
      await p.keyboard.press('Tab');
      await p.waitForTimeout(60);
      const hit = await p.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return null;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return null;
        const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
        const top = document.elementFromPoint(x, y);
        if (!top || e.contains(top) || top.contains(e)) return null;
        // covered: by something fixed or sticky, or inside it
        for (let n = top; n && n !== document.body; n = n.parentElement) {
          const pos = getComputedStyle(n).position;
          if (pos === 'fixed' || pos === 'sticky') {
            const name = (s) => `${s.tagName.toLowerCase()}${s.id ? '#' + s.id : ''}${s.classList[0] ? '.' + s.classList[0] : ''}`;
            return `${name(e)} "${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24)}" under ${name(n)}`;
          }
        }
        return null;
      });
      if (hit) why.add(`OBSCURED  ${vp.name}: ${hit} (scroll-padding-top / scroll-margin on focus, or keep the bar off it)`);
    }
    if (vp.name === 'laptop') {
      const r = await p.evaluate(() => {
        const seen = (e) => !!(e.offsetParent || e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden';
        const out = { fake: [], unreachable: [], price: [] };
        for (const e of document.querySelectorAll('div, span, a, li, label')) {
          const c = `${e.className && e.className.baseVal === undefined ? e.className : ''} ${[...e.attributes].map((a) => a.name).join(' ')}`.toLowerCase();
          if (!/\b(toggle|switch)\b|[-_](toggle|switch)\b|\bdata-toggle\b/.test(c) || !seen(e)) continue;
          if (e.querySelector('input[type=checkbox], input[type=radio], button, [role=switch], [role=checkbox]') || e.closest('label')?.querySelector('input')) continue;
          if (/^(switch|checkbox|radio|menuitemcheckbox|tab|button)$/.test(e.getAttribute('role') || '') && (e.hasAttribute('aria-checked') || e.hasAttribute('aria-pressed') || e.hasAttribute('aria-selected') || e.getAttribute('role') === 'button')) continue;
          if (e.tagName === 'A' && e.getAttribute('href') && !/^#?$/.test(e.getAttribute('href'))) continue;   // a link, not a toggle
          out.fake.push(`${e.tagName.toLowerCase()}.${String(e.className).split(/\s+/)[0]}`);
        }
        for (const i of document.querySelectorAll('input[type=checkbox], input[type=radio]')) {
          if (getComputedStyle(i).display === 'none' && (i.labels?.length || i.closest('label')) && [...(i.labels || [])].some(seen)) out.unreachable.push(i.name || i.id || i.type);
        }
        const PRICE = /(^|\s)(₪|\$|€|£)\s?\d|\d[\d,.]*\s?(₪|\$|€|£)/;
        for (const e of document.querySelectorAll('body *')) {
          if (!seen(e) || e.closest('script, style, [aria-hidden="true"]')) continue;
          const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
          if (!PRICE.test(own)) continue;
          const cs = getComputedStyle(e);
          if (!/tabular-nums/.test(cs.fontVariantNumeric) && !/tnum/.test(cs.fontFeatureSettings)) out.price.push(own.trim().slice(0, 18));
        }
        return out;
      });
      if (r.fake.length) why.add(`SWITCH    toggles drawn without a checkbox, switch role or aria-pressed: ${[...new Set(r.fake)].slice(0, 5).join(', ')}`);
      if (r.unreachable.length) why.add(`SWITCH    checkboxes hidden with display:none, so Tab cannot reach them: ${[...new Set(r.unreachable)].slice(0, 5).join(', ')} (hide them visually, the .sr-only way)`);
      if (r.price.length) why.add(`DIGITS    prices without tabular digits (font-variant-numeric: tabular-nums): ${[...new Set(r.price)].slice(0, 5).join(', ')}`);
    }
    await p.close();
  }
  if (why.size) { bad++; console.log(`KEYBOARD  ${url}\n  ${[...why].slice(0, 12).join('\n  ')}`); }
  console.log(`${url}: checked`);
}
await browser.close();
process.exitCode = bad ? 1 : 0;   // not process.exit: on Windows it can abort while connections close (as check-web-basics)

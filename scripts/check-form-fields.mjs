#!/usr/bin/env node
/**
 * Form fields on a phone (Tzvi, 12 Nov 2026, on an iPhone: "some of the boxes overlap" and "when I click on a box it
 * zooms in"). Fails when, on a 390px phone:
 *   - a visible input, select or textarea has a font under 16px (Safari zooms the page into it on every tap)
 *   - two visible fields overlap, or a field runs past its own grid or flex cell
 *   - a date field has no min-width: 0 (Safari gives it a built-in minimum width, wider than a half-width cell)
 * Chromium does not draw Safari's date width, hence the last rule is read from the CSS, not measured.
 *
 *   node scripts/check-form-fields.mjs <urls of the site's pages>      exit 1 when it fails
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: check-form-fields.mjs <page urls>'); process.exit(2); }
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const problems = [];
for (const url of urls) {
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(800);
  const found = await p.evaluate(() => {
    const out = [];
    const name = (e) => e.id || e.name || e.getAttribute('aria-label') || e.type || e.tagName.toLowerCase();
    const els = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    for (const e of els) {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      if (parseFloat(s.fontSize) < 16) out.push(`${name(e)}: font ${s.fontSize}, under 16px, so Safari zooms in when it is tapped`);
      if (e.type === 'date' && s.minWidth !== '0px') out.push(`${name(e)}: date field without min-width: 0 (Safari's own minimum width overflows a half-width cell)`);
      const cell = e.parentElement && e.parentElement.getBoundingClientRect();
      if (cell && r.right > cell.right + 1) out.push(`${name(e)}: runs ${Math.round(r.right - cell.right)}px past its box`);
      if (r.right > innerWidth + 1) out.push(`${name(e)}: runs past the screen edge`);
    }
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`${name(els[i])} and ${name(els[j])} overlap`);
    }
    return out;
  });
  for (const f of found) problems.push(`${url.replace(/^https?:\/\/[^/]+/, '') || '/'}: ${f}`);
  await p.close();
}
await browser.close();
if (problems.length) { console.log(`Form fields that misbehave on a phone (${problems.length}):\n  ` + problems.join('\n  ')); process.exit(1); }
console.log(`form fields fine on a phone (${urls.length} pages)`);

#!/usr/bin/env node
/*
 * Words fit inside what they are written on, on small phones (rule 3s.31; Tzvi, 16 Nov 2026, from the Clean Plus build:
 * the review found "Every two weeks" running out of its pill into "Just once" at 360 wide, and it took two rounds).
 * check-same-button only sees words that break onto a second line; a label kept on one line (nowrap) that is wider
 * than its pill is not a wrap, so it passed.
 *
 *   node scripts/check-text-fits.mjs <url> [more urls]        exit 1 on any OVERRUN
 *
 * At 320x640 and 360x640 as a touch phone, scrolled top to bottom: every button, link, label, tab, pill and chip whose
 * words reach past its own edge (more than 3px; the Clean Plus pill was 9px). A label made to end in "..." is not counted.
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-text-fits.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
const problems = [];
for (const [w, h] of [[320, 640], [360, 640]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const url of urls) {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const found = await page.evaluate(async () => {
      const out = new Map();
      const shown = (el) => { for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
      const measure = () => {
        for (const el of document.querySelectorAll('button, a, label, summary, [role="button"], [role="tab"], [class*="pill"], [class*="chip"]')) {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || !shown(el)) continue;
          const cs = getComputedStyle(el);
          // "..." on purpose, or a row of chips made to scroll sideways
          if (cs.textOverflow === 'ellipsis' || /auto|scroll/.test(cs.overflowX)) continue;
          const text = (el.innerText || el.textContent).replace(/\s+/g, ' ').trim();
          if (!text || out.has(el)) continue;
          // the words' own boxes against the element's box (a nowrap label that runs out sideways)
          let over = 0;
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent.trim() || !shown(n.parentElement)) continue;
            const rg = document.createRange(); rg.selectNodeContents(n);
            // only words that start inside the box: a hidden copy moved out of it for a hover roll is not an overrun
            for (const lr of rg.getClientRects()) if (lr.width > 1 && lr.top < r.bottom && lr.bottom > r.top && lr.left < r.right && lr.right > r.left) over = Math.max(over, lr.right - r.right, r.left - lr.left);
          }
          // words only, never scrollWidth: a decorative hover circle clipped by the button made it 140px (Aidy Yaniv)
          if (over > 3) out.set(el, { text: text.slice(0, 50), over: Math.round(over) });
        }
      };
      for (let y = 0; y <= document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.6)) {
        scrollTo(0, y); await new Promise((res) => setTimeout(res, 100)); measure();
      }
      return [...out.values()];
    });
    for (const f of found) problems.push(`OVERRUN "${f.text}" runs ${f.over}px past its edge at ${w}x${h}  (${url})`);
  }
  await ctx.close();
}
await browser.close();
for (const p of problems) console.log(p);
console.log(problems.length ? `${problems.length} label(s) wider than what they are written on` : 'every label fits at 320 and 360 wide');
process.exit(problems.length ? 1 : 0);

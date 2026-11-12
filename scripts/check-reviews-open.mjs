#!/usr/bin/env node
/*
 * Reviews stay open on a phone (rule 3ab.2; Tzvi, 12 Nov 2026, from "I Studied 1000 Landing Pages": "what is
 * hidden will not get seen"). Real reviews are stacked and fully shown, never in a swiping row or a fold-out.
 *
 *   node scripts/check-reviews-open.mjs <url> [more urls]
 *
 * At 390x844 finds every review (an element whose class or id says review or testimonial, or a blockquote)
 * and fails (exit 1):
 *   FOLDED   it sits in a closed <details> or an element hidden until tapped
 *   SWIPE    it sits in a sideways-scrolling row, or starts off the right or left of the screen
 * A page with no reviews passes.
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-reviews-open.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const problems = [];
let seen = 0;
for (const url of urls) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const found = await page.evaluate(() => {
    const sel = '[class*="review" i], [id*="review" i], [class*="testimonial" i], [id*="testimonial" i], blockquote';
    // the innermost review blocks only: a section called "reviews" holding cards is judged by its cards
    const all = [...document.querySelectorAll(sel)].filter((e) => !e.closest('footer, nav, header, form, button, a'));
    const items = all.filter((e) => !all.some((o) => o !== e && e.contains(o)) && e.textContent.trim().length > 40);
    return items.map((e) => {
      const r = e.getBoundingClientRect();
      const text = e.textContent.replace(/\s+/g, ' ').trim().slice(0, 50);
      let why = '';
      const det = e.closest('details');
      if (det && !det.open) why = 'FOLDED';
      for (let p = e.parentElement; !why && p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 20) why = 'SWIPE';
        else if (s.overflowX === 'hidden' && p.scrollWidth > p.clientWidth + 20 && (r.left >= innerWidth || r.right <= 0)) why = 'SWIPE';
      }
      if (!why && r.width && (r.left >= innerWidth - 4 || r.right <= 4)) why = 'SWIPE';
      if (!why && getComputedStyle(e).display === 'none') why = 'FOLDED';
      return { text, why };
    });
  });
  seen += found.length;
  for (const f of found) if (f.why) problems.push(`${f.why.padEnd(8)} ${url}: "${f.text}…" is hidden on a phone; stack the reviews open`);
}
await browser.close();
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log(`reviews-open: ${seen} review(s) all shown open on ${urls.length} page(s) at 390px`);

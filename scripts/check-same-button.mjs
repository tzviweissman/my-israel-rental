#!/usr/bin/env node
/*
 * Same button, same shape (rule 3s.29; Tzvi, 10 Nov 2026, on L.A. Cholent's size cards: "things need to be
 * consistent and here the middle one, the message to order, is two lines and the others are in 1 line").
 *
 *   node scripts/check-same-button.mjs <url> [more urls]
 *
 * Opens each page at the six sizes of rules 3p.6 (390x844, 360x640, 1280x650, 1440x900, 1536x753, 1920x1080) plus
 * 1024x768 and 1366x768, scrolls it top to bottom and measures every button and button-styled link that is laid out. L.A. Cholent's
 * Large card broke only between 1000 and 1350px wide, so the in-between widths are not optional. Fails (exit 1):
 *   WRAPS   a button's words break onto a second line
 *   DIFFERS the same button repeated in the same kind of place (each size card's) is not the same height
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-same-button.mjs <url> [more urls]'); process.exit(2); }

const browser = await chromium.launch();
const problems = [];
// the six sizes every check uses (rules 3p.6), plus 1024 and 1366, between which L.A. Cholent's button broke
for (const [w, h] of [[390, 844], [360, 640], [1024, 768], [1280, 650], [1366, 768], [1440, 900], [1536, 753], [1920, 1080]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const url of urls) {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const found = await page.evaluate(async () => {
      const seen = new Map();
      const measure = () => {
        for (const el of document.querySelectorAll('button, a.btn, a[class*="btn"], [role="button"]')) {
          const r = el.getBoundingClientRect();
          // measured wherever it is: line breaks do not depend on the scroll, and a smooth-scrolling page never
          // lands exactly where scrollTo asked, so an on-screen test missed L.A. Cholent's broken button
          if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
          const text = el.textContent.replace(/\s+/g, ' ').trim();
          if (!text) continue;
          // a run of words breaking: one text node laid out on more than one line (a picker card whose name,
          // servings and price are separate blocks is not a wrap)
          let lines = 1;
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent.trim()) continue;
            const rg = document.createRange(); rg.selectNodeContents(n);
            const tops = new Set([...rg.getClientRects()].filter((lr) => lr.width > 1).map((lr) => Math.round(lr.top / 4)));
            lines = Math.max(lines, tops.size);
          }
          // a repeat is the same button in the same kind of place (each size card's), not the bar's smaller copy
          const key = (el.parentElement?.className || '') + '|' + el.className + '|' + text.replace(/\d+/g, '#');
          const prev = seen.get(key) || { text, cls: String(el.className), heights: new Set(), lines: 1 };
          prev.heights.add(Math.round(r.height));
          prev.lines = Math.max(prev.lines, lines);
          seen.set(key, prev);
        }
      };
      for (let y = 0; y <= document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.6)) {
        scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); measure();
      }
      return [...seen.values()].map((v) => ({ text: v.text, cls: v.cls, heights: [...v.heights], lines: v.lines }));
    });
    for (const b of found) {
      if (b.lines > 1) problems.push(`WRAPS   ${w}px ${url}: "${b.text}" (${b.cls}) runs onto ${b.lines} lines`);
      else if (Math.max(...b.heights) - Math.min(...b.heights) > 3) problems.push(`DIFFERS ${w}px ${url}: "${b.text}" (${b.cls}) is ${b.heights.join(' / ')}px tall`);
    }
  }
  await page.close();
}
await browser.close();
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log(`same-button: clean on ${urls.length} page(s) at 8 screen sizes`);

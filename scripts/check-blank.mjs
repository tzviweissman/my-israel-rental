#!/usr/bin/env node
/**
 * No blank screen anywhere in the scroll (Tzvi, 29 Oct 2026, from Nate Herk's video QUI6Ug4cHnE, whose
 * harness looked for "an empty screen before the close"). Bake away showed about a screen of plain dark
 * ground between its film and its flavours (28 Oct); no check saw it, only the owner video's contact sheet.
 *
 * The page is scrolled top to bottom in steps of a third of a screen, each step held long enough for
 * entrance fades. At each stop a 5 x 7 grid of points below the top bar is tested: a point counts when the
 * topmost thing there is something to look at (words, a picture, a canvas or video, a button or field),
 * visible (not faded out). A stop where under 3 of the 35 points land on something is a blank screen.
 *
 *   node scripts/check-blank.mjs <url> [more urls]      exit 1 on any blank screen
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-blank.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
let bad = 0;
for (const url of urls) {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(700);
    const total = await p.evaluate(() => document.documentElement.scrollHeight);
    const blanks = [];
    for (let y = 0; y <= total - h; y += Math.round(h / 3)) {
      await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(650);
      const hits = await p.evaluate(() => {
        // elementFromPoint skips anything with pointer-events: none (a film canvas, a decorative picture): count it anyway
        let pe = document.getElementById('__blank_pe'); if (!pe) { pe = document.createElement('style'); pe.id = '__blank_pe'; pe.textContent = '* { pointer-events: auto !important; }'; document.head.appendChild(pe); }
        const top = (document.querySelector('header, .top, nav') || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom;
        const seen = (e) => { for (let n = e; n && n !== document.documentElement; n = n.parentElement) { const s = getComputedStyle(n); if (+s.opacity < 0.15 || s.visibility === 'hidden') return false; } return true; };
        const content = (e) => {
          if (!e) return false;
          if (e.matches('img, picture, canvas, video, svg, button, input, select, textarea, iframe')) return true;
          if ([...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) return true;
          const bg = getComputedStyle(e).backgroundImage; return bg && bg !== 'none' && !/gradient/.test(bg);
        };
        let n = 0;
        for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) {
          const x = innerWidth * (i + 0.5) / 5, y = top + (innerHeight - top) * (j + 0.5) / 7;
          const e = document.elementFromPoint(x, y); if (content(e) && seen(e)) n++;
        }
        return n;
      });
      if (hits < 3) blanks.push(y);
    }
    await p.close();
    if (blanks.length) { bad++; console.log(`BLANK  ${url} ${w}x${h}: nothing to see on screen at scroll ${blanks.map((y) => Math.round(y / h * 10) / 10 + ' screens').join(', ')} (rules 3s: never a blank screen)`); }
  }
  console.log(`${url}: checked`);
}
await browser.close();
console.log(bad ? `blank: ${bad} problem(s)` : 'blank: no blank screen anywhere in the scroll');
process.exit(bad ? 1 : 0);

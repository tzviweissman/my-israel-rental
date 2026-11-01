#!/usr/bin/env node
/**
 * Three true facts under the main button (Tzvi, 1 Nov 2026, rules 3v.14, from the landing pages in
 * K8xl96nOyF4: "Delivery Friday · Kosher · Cancel any time" under the button). The facts are the owner's
 * own (price, delivery, lead time, payment, certificate), never invented.
 *
 * On the home page (index.html among the urls, else the first): a list with class "btn-facts" of exactly three items, all on the first
 * screen once the opening has played (or right under it when the opening is a scroll film), within
 * 160 px of a button or link to the order or booking page. Phone and laptop.
 *
 *   node scripts/check-facts.mjs <urls of the site's pages>      exit 1 when it fails
 */
import { chromium } from 'playwright';

const all = process.argv.slice(2), url = all.find((u) => /\/index\.html$|\/$/.test(new URL(u).pathname)) || all[0];
if (!url) { console.error('usage: node scripts/check-facts.mjs <home url>'); process.exit(2); }
const browser = await chromium.launch();
let bad = 0;
for (const [w, h, mobile] of [[390, 844, true], [1366, 800, false]]) {
  const p = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' })).newPage();
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const lists = [...document.querySelectorAll('ul.btn-facts, ol.btn-facts')].filter((l) => l.offsetParent);
    if (!lists.length) return { why: 'no list with class "btn-facts" on the home page' };
    const l = lists[0], items = [...l.children].filter((c) => c.offsetParent);
    const box = l.getBoundingClientRect(), top = box.top + scrollY;
    const btns = [...document.querySelectorAll('main a[href], main button, section a[href]')].filter((b) => b.offsetParent && !l.contains(b) && /order|book|shop|quote|reserve|הזמ/i.test(b.getAttribute('href') + ' ' + b.innerText));
    const near = btns.some((b) => { const q = b.getBoundingClientRect(); return Math.abs((q.top + scrollY) - top) < 160 || Math.abs(q.bottom + scrollY - top) < 160; });
    return { n: items.length, top, near, text: items.map((i) => i.innerText.trim()).join(' · ') };
  });
  const why = [];
  if (r.why) why.push(r.why);
  else {
    if (r.n !== 3) why.push(`${r.n} facts, three exactly ("${r.text}")`);
    if (!r.near) why.push('the facts are not within 160 px of the main button');
    if (r.top > h * 2.2) why.push(`the facts start ${Math.round(r.top)} px down, past the first screens`);
  }
  if (why.length) { bad++; console.log(`FACTS  ${url} ${w}x${h}\n  ${why.join('\n  ')}`); }
}
console.log(`${url}: checked`);
await browser.close();
process.exit(bad ? 1 : 0);

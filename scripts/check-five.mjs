#!/usr/bin/env node
/**
 * A 5 the first time (Tzvi, 20 Nov 2026: "the rules should create a site well enough that it creates a 5/5 the first
 * time"; rules 3ah). Cakes by Tova passed every check and five reviews, then a judge put her beside the bakery sites in
 * docs/inspo/compare-2026-11-19 and gave her 3 of 5. Four of its reasons can be measured:
 *   OPENING  the home page's first screen (4 s after load; 1366x800 and 390x844) has one big statement: one block of
 *            text 28 px or bigger, outside the menu bar. Hers had the h1 plus three big tray names; the references
 *            have one line, one line under it and one button. Several offers are named inside that one headline
 *            (3g.18 still holds: check-says-offer reads the h1).
 *   CARDS    a product card (a photo whose card shows a price) is led by its photo: the photo is 85% of the card's
 *            width or more, and the card's words besides the name and price are 16 or fewer, so its choices live
 *            in the item's sheet. Hers had a cut-out on a coloured tile and every flavour as a button under it.
 *   SHOPTOP  a page of four or more product cards opens on pictures: they fill a third of the laptop's first screen
 *            or more, and every card photo is 240 px wide or more there. Her shop opened on a page of words above
 *            a row of small pictures (15% pictures); Magnolia Bakery's cakes page opens on a banner photo (2 rows of
 *            cards below).
 *   TEXT     words people read are 16 px or more at a laptop: paragraphs of four words or more, product names and
 *            prices. Small labels above headings, the footer and fine print under 4 words are not counted.
 *
 *   node scripts/check-five.mjs <urls of the site's pages>      exit 1 on a fault
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-five.mjs <urls of the site\'s pages>'); process.exit(2); }
const home = urls.find((u) => /(\/|index\.html)(\?.*)?$/.test(new URL(u).pathname)) || urls[0];
const browser = await chromium.launch();
let bad = 0;

function measure() {
  const money = /[₪$€£]\s?\d|\d\s?(₪|NIS|USD|EUR)/;
  const vis = (el) => {
    const q = el.getBoundingClientRect(); if (!q.width || !q.height) return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity < 0.3) return false; }
    return true;
  };
  const fixed = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };
  const own = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
  const root = document.querySelector('main') || document.body;
  // the site's own bars, not a page's title block: a <header> inside <main> (a shop's featured photo) counts
  const chrome = (el) => !!el.closest('footer, nav, dialog') || (!!el.closest('header') && !el.closest('main'));
  // big statements on the first screen: elements whose own words are 28 px or more, outside the menu bar and fixed bars
  const big = [];
  for (const el of root.querySelectorAll('*')) {
    const t = own(el); if (!t || t.length < 2 || el.closest('header.tv-shelf, nav, footer, dialog, .bar') || fixed(el) || !vis(el)) continue;
    const q = el.getBoundingClientRect(); if (q.top >= innerHeight || q.bottom <= 0) continue;
    if (parseFloat(getComputedStyle(el).fontSize) >= 28) { const blk = el.closest('h1, h2, h3, h4, p, li, a, button, div') || el; if (!big.includes(blk)) big.push(blk); }
  }
  // product cards
  const cards = [];
  for (const img of root.querySelectorAll('img')) {
    const b = img.getBoundingClientRect(); if (b.width < 48 || b.height < 48 || img.getAttribute('alt') === '' || chrome(img) || !vis(img)) continue;
    // a photo over a third of the screen wide is an opening, a banner or a shop's featured product (shopkit featured,
    // photo beside its words), never a grid card (its section may hold a price)
    if (b.width >= innerWidth * 0.35) continue;
    let card = img.parentElement; for (let i = 0; i < 4 && card && !money.test(card.textContent); i++) card = card.parentElement;
    if (!card || !money.test(card.textContent) || card.querySelectorAll('img:not([alt=""])').length > 1) continue;
    // a block of 60 words or more round a picture is a section with a price in it, not a product card (a contact page)
    if (card.innerText.split(/\s+/).length >= 60) continue;
    const c = card.getBoundingClientRect();
    const name = card.querySelector('h2, h3, h4, b, strong'), nm = name ? name.textContent : '';
    const words = card.innerText.replace(nm, '').replace(/[₪$€£]\s?[\d.,]+|[\d.,]+\s?(₪|NIS|USD|EUR)/g, '').split(/\s+/).filter((w) => /\p{L}{2}/u.test(w));
    cards.push({ src: img.getAttribute('src'), w: Math.round(b.width), share: b.width / c.width, words: words.length, top: Math.round(b.top + scrollY) });
  }
  // small words people read
  const small = [];
  for (const el of root.querySelectorAll('p, li, b, strong, h3, h4, span, a, label')) {
    const t = own(el); if (!t || !vis(el) || el.closest('footer, dialog, nav, header.tv-shelf') || fixed(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize), isPrice = money.test(t) && t.length < 14;
    const isName = !!el.closest('[data-id], .pc, .card') && /^(B|STRONG|H3|H4)$/.test(el.tagName);
    const isPara = el.tagName === 'P' && t.split(/\s+/).length >= 4;
    if ((isPrice || isName || isPara) && fs < 15.5) small.push(`"${t.slice(0, 40)}" ${Math.round(fs)}px`);
  }
  // how much of the first screen is pictures (each clipped to the screen)
  let pic = 0;
  for (const img of root.querySelectorAll('img, video')) {
    if (chrome(img) || !vis(img)) continue;
    const q = img.getBoundingClientRect(), w = Math.min(q.right, innerWidth) - Math.max(q.left, 0), hh = Math.min(q.bottom, innerHeight) - Math.max(q.top, 0);
    if (w > 0 && hh > 0) pic += w * hh;
  }
  return { pic: Math.min(1, pic / (innerWidth * innerHeight)), big: big.map((e) => e.innerText.replace(/\s+/g, ' ').trim().slice(0, 50)), cards, small: [...new Set(small)].slice(0, 6) };
}

for (const url of urls) {
  const why = [];
  for (const [w, h, phone] of [[1366, 800, false], [390, 844, true]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone });
    const p = await c.newPage();
    try { await p.goto(url, { waitUntil: 'load', timeout: 45000 }); } catch (e) { why.push(`LOAD: ${e.message.split('\n')[0]}`); await c.close(); continue; }
    await p.waitForTimeout(url === home ? 4000 : 800);
    const r = await p.evaluate(measure);
    const at = phone ? 'phone' : 'laptop';
    if (process.env.FIVE_DEBUG) console.log(at, url, 'big:', r.big, 'pictures:', Math.round(r.pic * 100) + '%', 'cards:', r.cards.length, r.cards.slice(0, 2), 'small:', r.small.length);
    if (url === home && r.big.length > 1) why.push(`OPENING (${at}): ${r.big.length} big statements on the first screen: ${r.big.map((t) => `"${t}"`).join(', ')}; one headline (naming every offer), one line under it, one button (3ah.1)`);
    if (!phone) {
      for (const k of r.cards) {
        if (k.share < 0.85) why.push(`CARDS: ${k.src} fills ${Math.round(k.share * 100)}% of its card's width; lead each card with its photo, edge to edge (3ah.2)`);
        if (k.words > 16) why.push(`CARDS: the card of ${k.src} has ${k.words} words besides its name and price; name, price and one short line, choices in its sheet (3ah.2)`);
      }
      if (url !== home && r.cards.length >= 4) {
        if (r.pic < 0.3) why.push(`SHOPTOP: pictures fill ${Math.round(r.pic * 100)}% of the first screen; a shop opens on its products (or one big photo), a third of the screen or more (3ah.3)`);
        const tiny = r.cards.filter((k) => k.w < 240);
        if (tiny.length) why.push(`SHOPTOP: ${tiny.length} product photos under 240 px wide (${tiny.slice(0, 3).map((k) => k.src + ' ' + k.w + 'px').join(', ')}); fewer to a row, bigger photos (3ah.3)`);
      }
      for (const s of r.small) why.push(`TEXT: ${s}; words people read are 16 px or more at a laptop (3ah.4)`);
    }
    await c.close();
  }
  const uniq = [...new Set(why)];
  if (uniq.length) { bad++; console.log(`FIVE  ${url}\n  ${uniq.slice(0, 14).join('\n  ')}${uniq.length > 14 ? `\n  ... and ${uniq.length - 14} more` : ''}`); }
  console.log(`${url}: checked`);
}
await browser.close();
process.exit(bad ? 1 : 0);

#!/usr/bin/env node
/**
 * The menu bar lists the site's pages (Tzvi, 1 Nov 2026, rules 3v.2). Real sites link their menu to their
 * own pages (Tartine: Locations, About Us, Order); Blazin' Boards' home menu was five jumps down its own
 * page while its other pages listed Home, Every board, Your order.
 *
 * Given every page of one site:
 *   PAGES  a site with a page besides Home and its order or booking steps has no #jump links in the menu
 *          bar, which lists its pages
 *   (a site of Home alone, or Home and its order steps, has no other pages to list, so its jumps stay)
 *   SAME   the menu bar links to the same pages on every page (order and booking steps may keep a quieter bar)
 *
 *   node scripts/check-menu.mjs <url> [more urls of the same site]      exit 1 when it fails
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-menu.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const step = (u) => /\/(order|book|basket|cart|checkout)[^/]*$/i.test(new URL(u).pathname.replace(/\.html$/, ''));
const home = (u) => /\/(index)?(\.html)?$/.test(new URL(u).pathname) || !/\.html$/.test(new URL(u).pathname) && urls.indexOf(u) === 0;
const others = urls.filter((u) => !step(u) && !home(u));
let bad = 0, first = null;
for (const url of urls) {
  await p.goto(url, { waitUntil: 'load' });
  const names = await p.evaluate(() => {
    // the menu bar: the first header or nav outside the footer that is pinned (fixed or sticky, itself or
    // its parent), else the first one with links; a page's own <header> under the bar is not it
    const cands = [...document.querySelectorAll('header, nav')].filter((e) => !e.closest('footer') && e.querySelector('a[href]'));
    const pinned = (e) => [e, e.parentElement].some((x) => x && /fixed|sticky/.test(getComputedStyle(x).position));
    const top = cands.find(pinned) || cands[0];
    if (!top) return null;
    const nav = top;
    return [...nav.querySelectorAll('a[href]')].filter((a) => a.innerText.trim()).map((a) => ({ t: a.innerText.trim().replace(/\s+/g, ' '), h: a.getAttribute('href') }));
  });
  const why = [];
  if (!names) why.push('no menu bar');
  else {
    const jumps = names.filter((n) => n.h.startsWith('#') && n.h !== '#top' && n.h !== '#');
    if (others.length && jumps.length) why.push(`PAGES: this site has other pages, but the menu bar jumps to ${jumps.map((j) => `"${j.t}" (${j.h})`).join(', ')}; list the pages instead`);
    // the same pages, whatever the wording (an order page may call its basket "Your order")
    // Home is left out: on the home page its link is often the name going to #top
    const base = new URL('.', urls[0]).pathname;
    const pg = (h) => { if (h.startsWith('#')) return null; const u = new URL(h, url); if (u.origin !== new URL(url).origin) return null;
      const rel = u.pathname.startsWith(base) ? u.pathname.slice(base.length) : u.pathname.split('/').pop(); return rel.replace(/\.html$/, '').replace(/^index$/, '') || null; };
    const same = [...new Set(names.map((n) => pg(n.h)).filter(Boolean))].sort().join(', ');
    // order and booking steps may keep a quieter bar, as real checkouts do; the other pages must match
    if (step(url)) { /* not compared */ } else if (first === null) first = same; else if (same !== first) why.push(`SAME: the menu bar here links to ${same || 'no pages'}, the first page's to ${first || 'no pages'}`);
  }
  if (why.length) { bad++; console.log(`MENU  ${url}\n  ${why.join('\n  ')}`); }
  console.log(`${url}: checked`);
}
await browser.close();
process.exit(bad ? 1 : 0);

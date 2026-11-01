#!/usr/bin/env node
/**
 * A full footer on every page (Tzvi, 1 Nov 2026, rules 3v.1, from the ten design videos and five real
 * business sites: Tartine, Blue Bottle, Sally Hershberger). Our footers were one line ("Bake away,
 * Jerusalem · on MyIsraelRental"); every real site ends with who they are, every page, how to reach them
 * and a base line.
 *
 * On every page given: one <footer> that
 *   PARTS    has at least three parts with a heading (h2 to h4), or two and a brand part (.fbrand)
 *   PAGES    links to every page the menu bar links to
 *   REACH    has a way to reach them (WhatsApp, phone or email; with none on record, their MyIsraelRental listing)
 *   BASE     has a base line with the year (©), the MyIsraelRental line and a privacy link
 *   SAME     reads the same on every page
 *
 *   node scripts/check-footer.mjs <url> [more urls]      exit 1 on any page that fails
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-footer.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1366, height: 800 } });
let bad = 0, first = null;
const path = (h) => { try { const u = new URL(h, 'http://x/'); return u.pathname.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/\/$/, '') || '/'; } catch { return h; } };
for (const url of urls) {
  await p.goto(url, { waitUntil: 'load' });
  const f = await p.evaluate(() => {
    const foot = document.querySelector('footer');
    if (!foot) return null;
    const bar = document.querySelector('header nav, nav[aria-label]:not(footer nav), .nav, .bar__nav');
    const menu = bar ? [...bar.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => !h.startsWith('#') && !/^(https?:|mailto:|tel:)/.test(h) && !/order|book|basket|cart/i.test(h.split('?')[0].split('#')[0].split('/').pop())) : [];
    const links = [...foot.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    const heads = foot.querySelectorAll('h2, h3, h4').length + (foot.querySelector('.fbrand') ? 1 : 0);
    const text = foot.innerText.replace(/\s+/g, ' ').trim();
    return { menu, links, heads, text };
  });
  const why = [];
  if (!f) why.push('no <footer>');
  else {
    if (f.heads < 3) why.push(`PARTS: ${f.heads} part(s) with a heading, at least 3 (who they are, pages, how to reach them, how ordering works, visit)`);
    const have = new Set(f.links.map(path));
    const missing = [...new Set(f.menu.map(path))].filter((m) => !have.has(m));
    if (missing.length) why.push(`PAGES: the footer does not link to ${missing.join(', ')}`);
    // a business that gave us no number or email is reached through its MyIsraelRental listing
    if (!f.links.some((h) => /wa\.me|whatsapp|^tel:|^mailto:|myisraelrental\.com\/business\//i.test(h))) why.push('REACH: no WhatsApp, phone, email or MyIsraelRental listing link');
    if (!/©/.test(f.text)) why.push('BASE: no "© <year> <name>"');
    if (!/MyIsraelRental/.test(f.text)) why.push('BASE: no MyIsraelRental line');
    if (!f.links.some((h) => /privacy/i.test(h))) why.push('BASE: no privacy link');
    const same = f.text.replace(/\d+/g, '');
    if (first === null) first = same; else if (same !== first) why.push('SAME: this footer reads differently from the first page\'s');
  }
  if (why.length) { bad++; console.log(`FOOTER  ${url}\n  ${why.join('\n  ')}`); }
  console.log(`${url}: checked`);
}
await browser.close();
process.exit(bad ? 1 : 0);

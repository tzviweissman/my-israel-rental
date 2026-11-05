#!/usr/bin/env node
/**
 * The web basics every site has (page rules 3x.8, checklist R3x.8; Tzvi, 4 Nov 2026: "yes do all five", from the
 * web rulebook in Jack Roberts' power-design, principles/web-principles.md). Our other checks already cover taps,
 * fit, layout shift and reduced motion; these are the ones nothing tested:
 *
 *   SKIP     the first thing Tab reaches is a "Skip to content" link to the main part of the page
 *   HEADS    exactly one h1, and no heading level skipped (h2 straight to h4)
 *   FOCUS    every link, button and field reached by Tab shows a ring (outline or shadow of 2 px or more)
 *   LABEL    every field has a label a screen reader reads (a placeholder is not one); phone, email and name
 *            fields have the right type and autocomplete, so a phone fills them in
 *   LIVE     a basket count, and a form's errors, are in a live region, so a screen reader hears them change
 *   IMAGES   the opening picture loads first (not lazy); pictures far down load lazily; at most two font families
 *   SCALE    the words use one type scale: at most 10 text sizes on the page (power-design-web, 4 Nov 2026: our
 *            sites used 12 to 22, each heading and label sized on its own); aria-hidden display names do not count
 *   SHARE    a title of 60 characters or less, a description of 155 or less, a share picture (og:image) of 1200x630,
 *            og:title; the home page describes the business for Google (JSON-LD, LocalBusiness or a kind of it)
 *
 *   node scripts/check-web-basics.mjs <urls of the site's pages>      exit 1 when a page fails
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-web-basics.mjs <urls>'); process.exit(2); }
const home = urls.find((u) => /\/index\.html$|\/$/.test(new URL(u).pathname)) || urls[0];
const browser = await chromium.launch();
let bad = 0;
for (const url of urls) {
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 800 }, reducedMotion: 'reduce' })).newPage();
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(1200);
  const why = [];
  const r = await p.evaluate(async (isHome) => {
    const seen = (e) => !!(e.offsetParent || e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden';
    const out = {};
    // HEADS
    const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(seen).map((h) => +h.tagName[1]);
    out.h1 = hs.filter((n) => n === 1).length;
    out.skipped = hs.some((n, i) => i > 0 && n > hs[i - 1] + 1) ? hs.join(' ') : '';
    // LABEL
    out.unlabelled = []; out.fill = [];
    for (const f of document.querySelectorAll('input, select, textarea')) {
      if (!seen(f) || /^(hidden|submit|button|reset|image)$/.test(f.type)) continue;
      const lab = (f.labels && [...f.labels].map((l) => l.innerText).join(' ').trim()) || f.getAttribute('aria-label') ||
        (f.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' ').trim();
      const name = f.name || f.id || '?';
      if (!lab) { out.unlabelled.push(name); continue; }
      const t = `${lab} ${f.name} ${f.id}`.toLowerCase(), ac = (f.getAttribute('autocomplete') || '').toLowerCase();
      if (/phone|\btel\b|mobile|whatsapp|טלפון|נייד/.test(t) && !/time|day|date/.test(t) && (f.type !== 'tel' || !/tel/.test(ac))) out.fill.push(`${name}: type="tel" autocomplete="tel"`);
      else if (/e-?mail|דוא"?ל|מייל/.test(t) && (f.type !== 'email' || !/email/.test(ac))) out.fill.push(`${name}: type="email" autocomplete="email"`);
      else if (/(^|\s)(your |full )?name\b|^שם/.test(t) && !/business|company|board|product/.test(t) && !/name/.test(ac)) out.fill.push(`${name}: autocomplete="name"`);
    }
    // LIVE
    const live = (e) => !!e.closest('[aria-live], [role="status"], [role="alert"], output');
    const counts = [...document.querySelectorAll('#count, .count, [data-count], [data-basket-count]')];
    out.deadCount = counts.length > 0 && !counts.some(live);
    out.form = !!document.querySelector('form, input:not([type=hidden]), textarea');
    out.liveRegion = !!document.querySelector('[aria-live], [role="status"], [role="alert"], output');
    // IMAGES: the biggest picture on the first screen, and those two screens or more down
    const imgs = [...document.images].filter((i) => i.getClientRects().length);
    const first = imgs.filter((i) => i.getBoundingClientRect().top < innerHeight).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    out.lcpLazy = first && first.loading === 'lazy' ? first.currentSrc.split('/').pop() : '';
    out.lcpPriority = first ? (first.getAttribute('fetchpriority') || '') : 'none';
    out.eager = imgs.filter((i) => i.getBoundingClientRect().top + scrollY > innerHeight * 2.5 && i.loading !== 'lazy').map((i) => (i.currentSrc || i.src).split('/').pop()).slice(0, 4);
    await document.fonts.ready;
    out.families = [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')))];
    // SCALE: distinct text sizes of the words a visitor reads
    const sizes = new Map(), tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) { const e = n.parentElement; if (!n.textContent.trim() || !e || !e.getClientRects().length || e.closest('[aria-hidden="true"], script, style, noscript')) continue; const z = Math.round(parseFloat(getComputedStyle(e).fontSize)); sizes.set(z, (sizes.get(z) || 0) + 1); }
    out.sizes = [...sizes.keys()].sort((a, b) => a - b);
    // SHARE
    const meta = (k) => document.querySelector(`meta[name="${k}"], meta[property="${k}"]`)?.content || '';
    out.title = document.title; out.desc = meta('description'); out.ogTitle = meta('og:title'); out.og = meta('og:image');
    if (out.og) out.ogSize = await new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = new URL(out.og, location.href).href.replace(/^https:\/\/myisraelrental\.com\/pages\/[^/]+\//, new URL('.', location.href).href); });
    if (isHome) {
      out.ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent); } catch { return null; } }).filter(Boolean)
        .flatMap((j) => (j['@graph'] || [j])).map((j) => [].concat(j['@type'] || []).join(',')).join(' ');
    }
    return out;
  }, url === home);

  // SKIP and FOCUS by the keyboard, as a keyboard user meets the page
  await p.evaluate(() => { scrollTo(0, 0); document.activeElement?.blur(); });
  const stops = [];
  for (let i = 0; i < 14; i++) {
    await p.keyboard.press('Tab');
    const s = await p.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const cs = getComputedStyle(e), ow = parseFloat(cs.outlineWidth) || 0;
      const ring = (cs.outlineStyle !== 'none' && ow >= 2) || (cs.boxShadow !== 'none' && /\d+px/.test(cs.boxShadow));
      return { tag: e.tagName.toLowerCase(), text: (e.innerText || e.getAttribute('aria-label') || e.name || '').trim().slice(0, 30), href: e.getAttribute('href') || '', ring };
    });
    if (s) stops.push(s);
  }
  if (!stops.length || !/^#/.test(stops[0].href) || !/skip|content|main|דלג/i.test(stops[0].text)) why.push(`SKIP   the first Tab stop is ${stops[0] ? `"${stops[0].text}"` : 'nothing'}, not a "Skip to content" link to the main part`);
  const noRing = stops.filter((s) => !s.ring).map((s) => `${s.tag} "${s.text}"`);
  if (noRing.length) why.push(`FOCUS  no visible focus ring (2 px or more) on: ${[...new Set(noRing)].slice(0, 5).join(', ')}`);

  if (r.h1 !== 1) why.push(`HEADS  ${r.h1} h1 headings, exactly one`);
  if (r.skipped) why.push(`HEADS  a heading level is skipped (levels in order: ${r.skipped})`);
  if (r.unlabelled.length) why.push(`LABEL  fields with no label a screen reader reads: ${r.unlabelled.join(', ')}`);
  if (r.fill.length) why.push(`LABEL  fields a phone cannot fill in: ${r.fill.join('; ')}`);
  if (r.deadCount) why.push('LIVE   the basket count is not in a live region (aria-live="polite")');
  if (r.form && !r.liveRegion) why.push('LIVE   a form with no live region for its errors and its sent message (role="status" or aria-live)');
  if (r.lcpLazy) why.push(`IMAGES the opening picture ${r.lcpLazy} is lazy-loaded; it loads first (fetchpriority="high")`);
  if (r.eager.length) why.push(`IMAGES pictures far down the page load at once: ${r.eager.join(', ')} (loading="lazy")`);
  if (r.families.length > 2) why.push(`IMAGES ${r.families.length} font families (${r.families.join(', ')}), two at most`);
  if (r.sizes.length > 10) why.push(`SCALE  ${r.sizes.length} text sizes (${r.sizes.join(', ')} px), 10 at most from one type scale (--t-1 to --t5 in starter/site.css)`);
  if (!r.title || r.title.length > 60) why.push(`SHARE  the title is ${r.title.length} characters ("${r.title}"), 1 to 60`);
  if (!r.desc || r.desc.length > 155) why.push(`SHARE  the description is ${r.desc.length} characters, 1 to 155`);
  if (!r.ogTitle) why.push('SHARE  no og:title');
  if (!r.og) why.push('SHARE  no og:image share picture');
  else if (!r.ogSize) why.push(`SHARE  the share picture ${r.og} does not load`);
  else if (r.ogSize[0] !== 1200 || r.ogSize[1] !== 630) why.push(`SHARE  the share picture is ${r.ogSize.join('x')}, 1200x630`);
  if (url === home && !/LocalBusiness|Store|Bakery|FoodEstablishment|Restaurant|Service|Organization|HealthAndBeautyBusiness|HomeAndConstructionBusiness|LodgingBusiness/.test(r.ld || '')) why.push('SHARE  the home page does not describe the business for Google (JSON-LD LocalBusiness or a kind of it)');

  if (why.length) { bad++; console.log(`BASICS  ${url}\n  ${why.join('\n  ')}`); }
  console.log(`${url}: checked`);
  await p.close();
}
await browser.close();
process.exitCode = bad ? 1 : 0;   // not process.exit: on Windows it aborts while fetch's connections are still closing (libuv assertion, exit 127)

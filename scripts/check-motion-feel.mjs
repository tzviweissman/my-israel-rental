#!/usr/bin/env node
/**
 * Motion that feels made by a designer (Tzvi, 20 Nov 2026, from a video on Claude design skills: Emil Kowalski's motion
 * rules; page rules 3e.16b). On each page at a laptop (1366x800), from the page's own style sheets and computed styles:
 *   SLOW     a control (button, link, tab, chip, summary, form field) animates longer than 300 ms. Reveals as you scroll
 *            and an opening are not controls and may be slower (3e.16, 3h).
 *   POP      something grows from nothing (scale(0)); start at 0.9 to 0.95 instead.
 *   BOUNCE   an easing curve that overshoots (cubic-bezier with a y outside 0 to 1): no bounce or elastic.
 *   EASEIN   a transition that eases in (ease-in alone): things that arrive or leave ease out.
 *   PRESS    no pressed state: a button that is pressed shrinks a little (scale about 0.97) so the press is felt.
 *
 *   node scripts/check-motion-feel.mjs <urls of the site's pages>      exit 1 on a fault
 * Passes on: none found yet. The award-winning bakeries it was tried on fail it (20 Nov 2026): Sonoma Bakery (a 500 ms
 * fade on a button, no pressed state) and Bernice Bakery (800 ms on its buttons and links). This is a stricter standard
 * than theirs, chosen by Tzvi from Emil Kowalski's rules; the first site built to it is looked at.
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-motion-feel.mjs <urls>'); process.exit(2); }
const browser = await chromium.launch();
let bad = 0;
for (const url of urls) {
  const p = await browser.newPage({ viewport: { width: 1366, height: 800 } });
  try { await p.goto(url, { waitUntil: 'load', timeout: 45000 }); } catch (e) { bad++; console.log(`FEEL  ${url}\n  LOAD: ${e.message.split('\n')[0]}`); continue; }
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const out = { slow: [], pop: [], bounce: [], easein: [], press: false };
    const sec = (v) => Math.max(0, ...String(v).split(',').map((x) => (x.trim().endsWith('ms') ? parseFloat(x) / 1000 : parseFloat(x) || 0)));
    // controls: their own transition, measured as the browser computes it
    const seen = new Set();
    for (const el of document.querySelectorAll('button, a[href], [role="tab"], [role="radio"], summary, input, select, textarea, .chip, .btn')) {
      if (el.closest('footer') || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el), d = sec(cs.transitionDuration);
      const props = cs.transitionProperty;
      if (d > 0.3 && props !== 'none' && props !== 'all' || (props === 'all' && d > 0.3)) {
        const name = el.tagName.toLowerCase() + (el.classList[0] ? '.' + el.classList[0] : '');
        if (!seen.has(name)) { seen.add(name); out.slow.push(`${name} ${Math.round(d * 1000)} ms (${props.slice(0, 40)})`); }
      }
    }
    // the style sheets: scale(0), overshooting curves, ease-in, a pressed state
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.cssRules && !(rule instanceof CSSKeyframesRule)) walk(rule.cssRules);
        const text = rule.cssText || '';
        if (rule instanceof CSSKeyframesRule) {
          if (/scale\(\s*0(\.0+)?\s*[,)]/.test(text)) out.pop.push(`@keyframes ${rule.name}`);
          continue;
        }
        if (!rule.selectorText) continue;
        // a decoration drawn by ::before or ::after (a ripple, an underline) may grow from nothing; a popover, a menu or a
        // card may not
        if (!/::?(before|after)/.test(rule.selectorText) && /transform:[^;]*scale\(\s*0(\.0+)?\s*[,)]/.test(text)) out.pop.push(rule.selectorText.slice(0, 60));
        for (const m of text.matchAll(/cubic-bezier\(([^)]+)\)/g)) {
          const v = m[1].split(',').map(Number);
          if (v[1] < 0 || v[1] > 1 || v[3] < 0 || v[3] > 1) out.bounce.push(`${rule.selectorText.slice(0, 50)} cubic-bezier(${m[1]})`);
        }
        if (/transition[^;]*\bease-in\b(?!-)/.test(text) || /animation[^;]*\bease-in\b(?!-)/.test(text)) out.easein.push(rule.selectorText.slice(0, 60));
        if (/:active/.test(rule.selectorText) && /scale\(\s*0?\.9\d*\s*\)/.test(text)) out.press = true;
      }
    };
    for (const ss of document.styleSheets) { try { walk(ss.cssRules); } catch { /* another site's sheet */ } }
    // STAGGER: the first screen's parts arrive in order (3e.16c); HOVER: hover transforms only under (hover: hover)
    const firstParts = [...document.querySelectorAll('main h1, main h1 ~ *, main h1 + *, main .btn')].filter((e) => e.getBoundingClientRect().top < innerHeight);
    out.delays = new Set(firstParts.map((e) => { const c = getComputedStyle(e); return c.animationDelay + '|' + c.transitionDelay; })).size;
    out.hover = [];
    const walkH = (rules, inHover) => { for (const r of rules) {
      if (r instanceof CSSMediaRule) { walkH(r.cssRules, inHover || /hover:\s*hover/.test(r.conditionText || r.media.mediaText)); continue; }
      if (r.selectorText && /:hover/.test(r.selectorText) && /transform\s*:/.test(r.cssText) && !inHover && !/^(button|\.btn)/.test(r.selectorText)) out.hover.push(r.selectorText.slice(0, 50));
    } };
    for (const ss of document.styleSheets) { try { walkH(ss.cssRules, false); } catch { /* other site */ } }
    out.pop = [...new Set(out.pop)]; out.bounce = [...new Set(out.bounce)]; out.easein = [...new Set(out.easein)];
    return out;
  });
  const why = [];
  for (const s of r.slow.slice(0, 6)) why.push(`SLOW: ${s}; a control answers in 300 ms or less (3e.16b)`);
  for (const s of r.pop.slice(0, 4)) why.push(`POP: ${s} grows from scale(0); start at 0.9 to 0.95 (3e.16b)`);
  for (const s of r.bounce.slice(0, 4)) why.push(`BOUNCE: ${s} overshoots; no bounce or elastic easing (3e.16b)`);
  for (const s of r.easein.slice(0, 4)) why.push(`EASEIN: ${s} eases in; arrivals and exits ease out (3e.16b)`);
  if (/index\.html$|\/$/.test(new URL(url).pathname) && r.delays < 3) why.push(`STAGGER: the first screen's parts arrive together (${r.delays} timing(s)); bring them in order, about 60 to 80 ms apart (3e.16c)`);
  if (!r.press) why.push('PRESS: no pressed state on buttons; a pressed button shrinks to about scale(0.97) (3e.16b)');
  if (why.length) { bad++; console.log(`FEEL  ${url}\n  ${why.join('\n  ')}`); }
  console.log(`${url}: checked`);
  await p.close();
}
await browser.close();
process.exit(bad ? 1 : 0);

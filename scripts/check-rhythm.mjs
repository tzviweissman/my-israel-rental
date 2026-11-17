#!/usr/bin/env node
/**
 * A home page with a rhythm, not one block after another (Tzvi, 17 Nov 2026: "all of ours look very basic";
 * rules 3ad.3). Real sites change ground from section to section, jump the type size once and open one
 * section edge to edge (docs/inspo/sameness-2026-11-17). Ours kept one ground, one h2 size and a 74rem column.
 * Heights are check-heights' (3v.6); this checks the other three.
 *
 * On the home page (index.html or /) at a laptop (1366x800), the top-level sections of <main> (or <body>) after
 * the opening and before the footer:
 *   GROUND  at least 2 changes of ground between neighbouring sections (a different colour, or a picture ground)
 *   SCALE   one section's biggest heading is at least 1.6x the middle size of the sections' biggest headings
 *   BLEED   one section holds a picture or video at least 95% of the screen wide and half a screen tall, or a
 *           collage: 3+ pictures of clearly different sizes (largest at least 1.6x the smallest by area)
 * A page of fewer than four such sections is not judged.
 *
 *   node scripts/check-rhythm.mjs <url> [more urls]      exit 1 on a home page that fails
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2).filter((u) => /(\/|index\.html)(\?.*)?$/.test(u));
if (!process.argv[2]) { console.error('usage: node scripts/check-rhythm.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
// 1.6x: Graza's 120px against 72px reads as a jump; our starter's .big at 1.46x (Finest Cuts, Noa Levi, Hadassah
// Prys) does not. Tried 2x first: it failed Graza, a site that plainly has the jump (17 Nov 2026).
const SCALE = 1.6;
let bad = 0;
for (const url of urls) {
  const p = await browser.newPage({ viewport: { width: 1366, height: 800 } });
  try { await p.goto(url, { waitUntil: 'load', timeout: 45000 }); } catch (e) { bad++; console.log(`RHYTHM  ${url}\n  LOAD: ${e.message.split('\n')[0]}`); continue; }
  await p.waitForTimeout(500);
  // a page that redirects itself after load (a shop's country switch) destroys the first read: wait and read again
  const measure = () => p.evaluate(() => {
    const root = document.querySelector('main') || document.body;
    const tops = [...root.children].filter((e) => !/^(SCRIPT|STYLE|HEADER|FOOTER|NAV|NOSCRIPT|TEMPLATE)$/.test(e.tagName)
      && !/\bfoot/.test(e.className) && getComputedStyle(e).position !== 'fixed' && e.offsetHeight > 60).slice(1);
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const ground = (e) => {
      // the colour or picture actually behind the section: its own, else the nearest painted ancestor
      const r = e.getBoundingClientRect();
      const pics = [...e.querySelectorAll('img, video, picture, canvas')].map((m) => m.getBoundingClientRect())
        .filter((b) => b.width * b.height > 0.8 * r.width * r.height);
      if (pics.length || getComputedStyle(e).backgroundImage !== 'none') return 'picture';
      // a see-through wrapper (Shopify's div.shopify-section) is painted by a child that fills it
      for (const k of e.querySelectorAll('*')) {
        const b = k.getBoundingClientRect(); if (b.width * b.height < 0.8 * r.width * r.height) continue;
        if (getComputedStyle(k).backgroundImage !== 'none' && !/gradient/.test(getComputedStyle(k).backgroundImage)) return 'picture';
        const c = rgb(getComputedStyle(k).backgroundColor); if (c.length && (c[3] ?? 1) > 0.5) return c.slice(0, 3).join(',');
      }
      for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c.length && (c[3] ?? 1) > 0.5) return c.slice(0, 3).join(','); }
      return '255,255,255';
    };
    return tops.map((e) => {
      const heads = [...e.querySelectorAll('h1, h2, h3, [class*="big"], [class*="huge"], [class*="display"]')].filter((h) => h.offsetHeight);
      const big = Math.max(0, ...heads.map((h) => parseFloat(getComputedStyle(h).fontSize)));
      const pics = [...e.querySelectorAll('img, video, picture > img, canvas')].map((m) => m.getBoundingClientRect()).filter((b) => b.width > 40 && b.height > 40);
      const wide = pics.some((b) => b.width >= 0.95 * innerWidth && b.height >= 0.5 * innerHeight) || (getComputedStyle(e).backgroundImage !== 'none' && e.offsetWidth >= 0.95 * innerWidth && e.offsetHeight >= 0.5 * innerHeight);
      const areas = pics.map((b) => b.width * b.height);
      const collage = areas.length >= 3 && Math.max(...areas) >= 1.6 * Math.min(...areas);
      return { name: e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''), ground: ground(e), big, bleed: wide || collage };
    });
  });
  let secs;
  try { secs = await measure(); } catch { await p.waitForLoadState('load').catch(() => {}); await p.waitForTimeout(1500); secs = await measure(); }
  const why = [];
  if (secs.length >= 4) {
    const dist = (a, b) => { if (a === b) return 0; if (a === 'picture' || b === 'picture') return 99; const [x, y] = [a, b].map((s) => s.split(',').map(Number)); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
    const changes = secs.slice(1).filter((s, i) => dist(s.ground, secs[i].ground) > 24).length;
    if (changes < 2) why.push(`GROUND: ${changes} change(s) of ground between sections (${[...new Set(secs.map((s) => s.ground))].join(' / ')}); give at least two sections a ground of their own`);
    const sizes = secs.map((s) => s.big).filter(Boolean).sort((a, b) => a - b);
    const mid = sizes[Math.floor(sizes.length / 2)] || 0, top = sizes[sizes.length - 1] || 0;
    // headings set in plain divs (Flamingo Estate) leave nothing to measure: not judged rather than failed
    if (top >= 24 && !(top >= SCALE * mid)) why.push(`SCALE: the biggest heading after the opening is ${Math.round(top)}px against a middle of ${Math.round(mid)}px; one section's headline should be at least ${SCALE}x`);
    if (!secs.some((s) => s.bleed)) why.push('BLEED: no section after the opening has an edge-to-edge picture or a collage of different-sized pictures');
  }
  if (why.length) { bad++; console.log(`RHYTHM  ${url}\n  ${why.join('\n  ')}`); }
  console.log(`${url}: checked`);
  await p.close();
}
await browser.close();
process.exit(bad ? 1 : 0);

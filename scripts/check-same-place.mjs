#!/usr/bin/env node
/**
 * Same thing, same place (rule 3s.27; Tzvi, 26 Oct 2026, on Blazin' Boards' sizes on his phone:
 * "the sizes are written in different places for different ones").
 *
 *   node scripts/check-same-place.mjs <url> [more urls]
 *
 * Scrolls each page top to bottom on a phone (390x844) and a laptop (1440x900). Inside every scene held
 * on screen (a sticky stage), headings and labels of one kind (same tag and classes, in the same stage)
 * that show different content in turn (each size, each step, each slide) must rest at the same spot.
 * A label is measured only when it is fully shown and still (opacity 1, not mid-move). Fails (exit 1):
 *   MOVES  a repeated label rests at different heights or sides from one state to the next
 * A heading of another section scrolling past is not a repeat: it belongs to another stage.
 * Started from the site-building session's sameplace.mjs (27 Oct); this one keys by stage and checks
 * the side as well as the height (KasherMyBnb's station card moved sideways).
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');

const TOL = 6;   // px
const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-same-place.mjs <url> [more urls]'); process.exit(2); }
const b = await chromium.launch();
let bad = 0;
for (const url of urls) {
  const name = url.replace(/^https?:\/\/[^/]+\//, '') || url;
  for (const [w, h, phone] of [[390, 844, true], [1440, 900, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone });
    const p = await ctx.newPage();
    try {
      await p.goto(url, { waitUntil: 'load', timeout: 90000 }); await p.waitForTimeout(1500);
      await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
      const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const seen = {}, many = {};
      const steps = Math.min(160, Math.max(40, Math.round(max / (h * 0.08))));
      for (let i = 0; i <= steps; i++) {
        await p.evaluate((y) => scrollTo(0, y), Math.round(max * i / steps)); await p.waitForTimeout(160);
        const rows = await p.evaluate(() => {
          const still = (e) => { for (let n = e; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (+s.opacity < 0.95 || s.visibility === 'hidden') return false; } return true; };
          const out = [];
          [...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).position === 'sticky').forEach((st, si) => {
            const sr = st.getBoundingClientRect(); if (sr.top > 80 || sr.bottom < innerHeight * 0.6) return;   // a stage held on screen
            for (const e of st.querySelectorAll('h1, h2, h3, h4, [class*="label"], [class*="size"], [class*="step"], [class*="title"], [class*="price"]')) {
              const r = e.getBoundingClientRect();
              if (!r.height || r.bottom < 0 || r.top > innerHeight || !still(e)) continue;
              let moving = false;
              for (let n = e; n && n !== st; n = n.parentElement) { const t = getComputedStyle(n).transform; if (t !== 'none' && !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(t)) { moving = true; break; } }
              if (moving) continue;
              const text = e.textContent.replace(/\s+/g, ' ').trim().slice(0, 30); if (!text) continue;
              out.push([`stage${si} ${e.tagName.toLowerCase()}${e.classList.length ? '.' + [...e.classList].join('.') : ''}`, text, Math.round(r.top), Math.round(r.left)]);
            }
          });
          return out;
        });
        const count = {};
        for (const [k] of rows) count[k] = (count[k] || 0) + 1;
        for (const [k, text, top, left] of rows) {
          if (count[k] > 1) { many[k] = 1; continue; }   // several on screen at once (a price list) is not one label changing
          ((seen[k] ||= {})[text] ||= []).push([top, left]);
        }
      }
      for (const [k, byText] of Object.entries(seen)) {
        const texts = Object.keys(byText);
        // one-offs are not a repeated kind; nor are two bare headings, which are two scenes of one stage
        // (L.A. Cholent's opening and closing h2, 27 Oct): a bare tag counts from three states
        if (texts.length < 2 || many[k] || (!/\s\w+\./.test(k) && texts.length < 3)) continue;
        // each state's resting place: where it sat most often
        const rest = texts.map((t) => { const c = {}; for (const [tp, lf] of byText[t]) { const key = `${tp},${lf}`; c[key] = (c[key] || 0) + 1; } return Object.entries(c).sort((a, z) => z[1] - a[1])[0][0].split(',').map(Number); });
        const dTop = Math.max(...rest.map((r) => r[0])) - Math.min(...rest.map((r) => r[0]));
        const dLeft = Math.max(...rest.map((r) => r[1])) - Math.min(...rest.map((r) => r[1]));
        if (dTop > TOL || dLeft > TOL) {
          bad++;
          console.log(`MOVES  ${name} ${w}x${h} ${k}: ${texts.length} states rest at ${texts.map((t, i) => `"${t}" ${rest[i][0]},${rest[i][1]}`).join('; ')} (they should share one place; rule 3s.27: hang them from a fixed top line)`);
        }
      }
    } catch (e) { bad++; console.log(`BROKEN ${name} ${w}x${h}: ${e.message.split('\n')[0]}`); }
    await ctx.close();
  }
  console.log(`${name}: checked`);
}
await b.close();
console.log(bad ? `same place: ${bad} problem(s)` : 'same place: every repeated label keeps its place');
process.exit(bad ? 1 : 0);

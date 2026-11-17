#!/usr/bin/env node
/**
 * The parts after the opening are this site's own, not the starter's (Tzvi, 17 Nov 2026: "they all look very
 * similar and they dont have any uniqueness to them other than the hero"; rules 3ad.2). Eight live sites had the
 * same menu bar (logo, pill tabs, pill button), the same three numbered steps and the same dark closing band, all
 * from scrollcraft/starter/sitekit.py; check-fingerprints only compared what each site's fingerprint SAID about them.
 *
 * Compares the markup of three parts of a home page with every published page (frontend/public/pages):
 *   nav    the first <header> or <nav>
 *   steps  the first <ol> of 3 to 6 items, or a section whose class or id says step/how
 *   close  the last top-level section before the footer
 * Each part becomes the set of its classed elements as tag.class (words, ids and the inside of svg left out).
 * Two parts sharing 60% or more of that set (shared / all) were written from one template: on 17 Nov 2026 the
 * starter's menu bar (header.top, a.mark, nav.nav, div.top-r, a.btn-line, button.menu-btn) differed only in the
 * logo inside it, so an exact match missed it.
 *   SAME   a part is 60% or more like another page's
 *
 *   node scripts/check-body-alike.mjs <build-folder-or-slug>    exit 1 on any SAME
 *   node scripts/check-body-alike.mjs --report                  every published page: which parts match which
 * The footer is left out: 3v.1 asks every site for the same five parts of a footer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const PAGES = path.join(ROOT, 'frontend', 'public', 'pages');
const BUILDS = path.join(ROOT, 'scrollcraft', 'builds');
const args = process.argv.slice(2);
if (!args.length) { console.error('usage: node scripts/check-body-alike.mjs <build-folder-or-slug> | --report'); process.exit(2); }

let published = {};
try { published = JSON.parse(fs.readFileSync(path.join(ROOT, 'scrollcraft', 'published.json'), 'utf8')); } catch { /* none */ }
const slugOf = (folder) => Object.entries(published).find(([, r]) => r?.folder === folder)?.[0];
const live = fs.readdirSync(PAGES).filter((s) => fs.existsSync(path.join(PAGES, s, 'index.html')));

const browser = await chromium.launch();
const ctx = await browser.newContext({ javaScriptEnabled: false });
const page = await ctx.newPage();
async function parts(file) {
  await page.setContent(fs.readFileSync(file, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, ''), { waitUntil: 'domcontentloaded' });
  return page.evaluate(() => {
    // the classed elements of a part, as tag.class tokens (words, ids and unclassed wrappers left out)
    const skel = (el) => {
      if (!el) return [];
      const out = new Set();
      for (const e of [el, ...el.querySelectorAll('*')]) {
        if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
        for (const c of e.classList) if (!/^(is-|js-)|^(on|active|open)$/.test(c)) out.add(`${e.tagName.toLowerCase()}.${c}`);
      }
      return [...out];
    };
    const nav = document.querySelector('header, nav');
    const steps = [...document.querySelectorAll('ol')].find((o) => o.children.length >= 3 && o.children.length <= 6)
      || [...document.querySelectorAll('section, div')].find((e) => /\b(steps?|how)\b/i.test(`${e.id} ${e.className}`));
    const root = document.querySelector('main') || document.body;
    const tops = [...root.children].filter((e) => !/^(SCRIPT|STYLE|HEADER|NAV|FOOTER|NOSCRIPT|TEMPLATE)$/.test(e.tagName) && !/\bfoot/.test(e.className));
    const close = tops[tops.length - 1];
    return { nav: skel(nav), steps: skel(steps), close: close && close !== tops[0] ? skel(close) : [] };
  });
}

const pool = new Map();
for (const s of live) pool.set(s, await parts(path.join(PAGES, s, 'index.html')));
const PART_NAMES = { nav: 'menu bar', steps: 'steps', close: 'closing band' };
// two parts are one template when most of their classed elements are the same: shared / all >= 0.6
const LIKE = 0.6;
const SMALL = (k) => !k || k.length < 3; // fewer than three classed elements is too little to call a template
const like = (a, b) => { if (SMALL(a) || SMALL(b)) return 0; const B = new Set(b), n = a.filter((x) => B.has(x)).length; return n / (a.length + b.length - n); };

if (args[0] === '--report') {
  for (const [n, p] of pool) {
    const same = Object.keys(PART_NAMES).map((k) => [k, [...pool].filter(([o, q]) => o !== n && like(p[k], q[k]) >= LIKE).map(([o]) => o)])
      .filter(([, os]) => os.length).map(([k, os]) => `${PART_NAMES[k]} = ${os.length} (${os.slice(0, 4).join(', ')}${os.length > 4 ? ' ...' : ''})`);
    console.log(`${n}: ${same.length ? same.join('; ') : 'own'}`);
  }
  await browser.close();
  process.exit(0);
}

let bad = 0;
for (const x of args) {
  const dir = fs.existsSync(path.join(BUILDS, x, 'index.html')) ? path.join(BUILDS, x) : fs.existsSync(path.join(x, 'index.html')) ? path.resolve(x) : path.join(PAGES, x);
  if (!fs.existsSync(path.join(dir, 'index.html'))) { console.error(`no page at ${x}`); bad++; continue; }
  const me = slugOf(path.basename(dir)) || path.basename(dir);
  const mine = await parts(path.join(dir, 'index.html'));
  for (const k of Object.keys(PART_NAMES)) {
    const others = [...pool].filter(([o, q]) => o !== me && like(mine[k], q[k]) >= LIKE).map(([o]) => o);
    if (others.length) { bad++; console.log(`SAME  ${me}: its ${PART_NAMES[k]} has the same markup as (60%+) ${others.join(', ')} (write this site's own; 3ad.2)`); }
  }
  console.log(`${me}: checked`);
}
await browser.close();
process.exit(bad ? 1 : 0);

#!/usr/bin/env node
/**
 * Businesses must not come out looking alike (Tzvi, 19 Oct 2026: "make sure
 * that businesses don't come out too similar"). Compares a new build with
 * every published designed page and every other build named, on what a
 * visitor sees first:
 *
 *   fonts    the same heading face, or the same body face with the same
 *            accent (script) face, is a clash
 *   palette  two or more of the page's BRAND colours (its :root colours
 *            with real colour in them, not the whites, creams, greys and
 *            near-blacks every page uses) alike is a clash
 *   design   the hand-written fingerprint (scrollcraft/fingerprints.json:
 *            hero, signature, nav, close, layout, ground): fewer than 4 of
 *            6 different is a clash (the scroll-craft uniqueness gate)
 *
 *   node scripts/check-fingerprints.mjs <build-folder-or-slug> [more ...]
 *   node scripts/check-fingerprints.mjs --all     every published page against the rest
 *
 * Exit 1 on any clash. Written after Nails by Elisheva came out with nearly
 * Aidy Yaniv's fonts (Cormorant Garamond, a script, Jost) and Chicken Munch
 * shared Anton with Michal Yodaiken.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const PAGES = path.join(ROOT, 'frontend', 'public', 'pages');
const BUILDS = path.join(ROOT, 'scrollcraft', 'builds');
const FP = path.join(ROOT, 'scrollcraft', 'fingerprints.json');
const manual = fs.existsSync(FP) ? JSON.parse(fs.readFileSync(FP, 'utf8')) : {};
// entries are keyed by build folder; a published page is found by its slug too
for (const [k, v] of Object.entries({ ...manual })) if (v && v.slug && !manual[v.slug]) manual[v.slug] = v;

function readSite(dir) {
  const files = ['index.html', 'site.css'].map((f) => path.join(dir, f)).filter((f) => fs.existsSync(f));
  const text = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const fams = [...text.matchAll(/family=([^"&:;]+)/g)].map((m) => decodeURIComponent(m[1]).replace(/\+/g, ' ').trim());
  const roots = [...text.matchAll(/:root\s*\{([\s\S]*?)\}/g)].map((m) => m[1]).join('\n');
  const colours = [...new Set([...roots.matchAll(/#([0-9a-f]{6})\b/gi)].map((m) => m[1].toLowerCase()))];
  return { fams: [...new Set(fams)], colours };
}
// heading face: the display face the page's h1 uses, else the first loaded
function headFace(site) { return site.fams[0] || ''; }
const SCRIPTS = /script|allura|vibes|parisienne|pinyon|dancing|satisfy|sacramento|tangerine|italianno|mrs|alex brush|great/i;
function rgb(h) { return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function brand(h) {
  const [r, g, b] = rgb(h).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  return sat > 0.3 && l > 0.18 && l < 0.82;
}
function near(a, b) { const [x, y] = [rgb(a), rgb(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 26; }

function compare(aName, a, bName, b) {
  const out = [];
  const sa = a.fams.filter((f) => SCRIPTS.test(f)), sb = b.fams.filter((f) => SCRIPTS.test(f));
  const body = (s) => s.fams.filter((f) => !SCRIPTS.test(f)).slice(-1)[0];
  if (headFace(a) && headFace(a) === headFace(b)) out.push(`same heading face (${headFace(a)})`);
  if (body(a) && body(a) === body(b) && sa.length && sb.length) out.push(`same body face (${body(a)}) and both use a script (${sa[0]} / ${sb[0]})`);
  // a business's own colours (from its logo or menu, listed in fingerprints.json as own_colours) never count against it
  const own = (n) => new Set((manual[n]?.own_colours || []).map((c) => c.replace('#', '').toLowerCase()));
  const oa = own(aName), ob = own(bName);
  const ba = a.colours.filter(brand).filter((c) => !oa.has(c)), bb = b.colours.filter(brand).filter((c) => !ob.has(c));
  const shared = ba.filter((c) => bb.some((d) => near(c, d)));
  if (shared.length >= 2) out.push(`${shared.length} brand colours alike (${shared.slice(0, 4).map((c) => '#' + c).join(' ')})`);
  const ma = manual[aName], mb = manual[bName];
  if (ma && mb) {
    const dims = ['hero', 'signature', 'nav', 'close', 'layout', 'ground'];
    const diff = dims.filter((d) => ma[d] && mb[d] && ma[d] !== mb[d]).length;
    const known = dims.filter((d) => ma[d] && mb[d]).length;
    if (known >= 4 && diff < 4) out.push(`design differs on only ${diff} of ${known} (${dims.filter((d) => ma[d] === mb[d]).join(', ')} the same)`);
  }
  return out;
}

const args = process.argv.slice(2);
const published = fs.readdirSync(PAGES).filter((s) => fs.existsSync(path.join(PAGES, s, 'index.html')));
const load = (x) => {
  if (fs.existsSync(path.join(PAGES, x, 'index.html'))) return [x, readSite(path.join(PAGES, x))];
  const dir = fs.existsSync(x) ? x : path.join(BUILDS, x);
  if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error(`no page at ${x}`);
  return [manual[path.basename(dir)]?.slug || path.basename(dir), readSite(dir)];
};
const targets = args[0] === '--all' ? published : args;
if (!targets.length) { console.error('usage: node scripts/check-fingerprints.mjs <build-folder-or-slug> ... | --all'); process.exit(2); }
const pool = new Map(published.map((s) => [s, readSite(path.join(PAGES, s))]));
const mine = targets.map(load);
for (const [n, s] of mine) if (!pool.has(n)) pool.set(n, s);
let clashes = 0;
const seen = new Set();
for (const [name, site] of mine) {
  for (const [other, os] of pool) {
    if (other === name) continue;
    const key = [name, other].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const found = compare(name, site, other, os);
    if (found.length) { clashes += 1; console.log(`CLASH ${name} ~ ${other}: ${found.join('; ')}`); }
  }
}
if (clashes) { console.error(`\n${clashes} pair(s) too alike. Change the new page's fonts, colours or design, never an existing page's to make room.`); process.exit(1); }
console.log(`${mine.map(([n]) => n).join(', ')}: different from all ${pool.size - 1} other pages`);

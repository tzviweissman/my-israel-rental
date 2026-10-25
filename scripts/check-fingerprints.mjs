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
 *   effects  each site's effects by id (fingerprints.json "effects", ids
 *            from "_effects"): shared effects worth more than 2 points is a
 *            clash, a loud (obvious) one worth 2 and a quiet one 1. A site
 *            being checked must list them.
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
import { readPublished } from './live-hash.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const PAGES = path.join(ROOT, 'frontend', 'public', 'pages');
const BUILDS = path.join(ROOT, 'scrollcraft', 'builds');
const FP = path.join(ROOT, 'scrollcraft', 'fingerprints.json');
const manual = fs.existsSync(FP) ? JSON.parse(fs.readFileSync(FP, 'utf8')) : {};
// entries are keyed by build folder; a published page is found by its slug too
for (const [k, v] of Object.entries({ ...manual })) if (v && v.slug && !manual[v.slug]) manual[v.slug] = v;
// a build is the same site as the page publish-page.mjs made from it (scrollcraft/published.json), so it is
// checked under that slug and never against itself (24 Oct 2026: RS Modest clashed with its own live page,
// ravit-hen, because fingerprints.json still named it by its folder)
const SLUG_OF = {};
for (const [slug, rec] of Object.entries(readPublished(ROOT))) {
  if (!rec?.folder) continue;
  SLUG_OF[rec.folder] = slug;
  if (manual[rec.folder] && !manual[slug]) manual[slug] = manual[rec.folder];
}

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

// Effects (Tzvi, 20 Oct 2026: "we already have rules to make effects different,
// like buttons and arrow effects, so why do you keep making everything so
// similar"). The rules said "search fresh for every effect" but nothing checked
// it, and all nine live pages faded their sections in the same way. Each site
// lists its effects in fingerprints.json by an id from _effects (the effects
// library's B/L/T/P/H codes plus ours). Two pages may share effects worth 2
// points between them ("it's ok if 2 effects match"); an obvious effect, one a
// visitor notices without hunting (marked loud), is worth 2, a quiet one 1.
// So two quiet ones may match, or one loud one alone, never more. An effect marked
// common (R1, the fade-in nearly every site has) scores 0 (Tzvi, 22 Oct 2026).
const VOCAB = manual._effects || {};
const EFFECTS_ALLOWED = 2;
const EFFECT_KINDS = ['button', 'link', 'tile', 'reveal', 'steps', 'price', 'heading', 'other'];
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter((x) => x && x !== 'none');
function effectsAlike(ea, eb) {
  const same = [];
  for (const kind of EFFECT_KINDS) {
    for (const id of list(ea[kind])) {
      if (!list(eb[kind]).includes(id)) continue;
      const v = VOCAB[id] || {};
      same.push({ kind, id, name: v.name || '', weight: v.common ? 0 : v.loud ? 2 : 1 });
    }
  }
  return same;
}
// a site being checked must list its effects, every one a known id
function effectsProblems(name) {
  const e = manual[name]?.effects;
  if (!e) return [`no effects listed for ${name} in scrollcraft/fingerprints.json (one id per kind: ${EFFECT_KINDS.join(', ')}; "none" where it has none)`];
  const out = [];
  for (const kind of EFFECT_KINDS.filter((k) => k !== 'other')) if (!(kind in e)) out.push(`${name}: effects.${kind} missing (write "none" if the site has none)`);
  for (const kind of EFFECT_KINDS) for (const id of list(e[kind])) {
    if (!VOCAB[id]) out.push(`${name}: effects.${kind} "${id}" is not in _effects (add it there with kind, name and loud)`);
    else if (VOCAB[id].kind !== kind) out.push(`${name}: "${id}" is a ${VOCAB[id].kind} effect, listed under ${kind}`);
  }
  return out;
}

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
  // a colour pair Tzvi has looked at and accepted (fingerprints.json _accepted_colours, with who and when) no longer counts
  const accepted = (manual._accepted_colours || []).some((x) => [aName, bName].every((n) => x.pair?.includes(n)));
  if (shared.length >= 2 && !accepted) out.push(`${shared.length} brand colours alike (${shared.slice(0, 4).map((c) => '#' + c).join(' ')})`);
  const ma = manual[aName], mb = manual[bName];
  if (ma?.effects && mb?.effects) {
    const same = effectsAlike(ma.effects, mb.effects);
    const score = same.reduce((n, e) => n + e.weight, 0);
    if (score > EFFECTS_ALLOWED) out.push(`effects alike (${same.map((e) => `${e.kind} ${e.id} ${e.name}${e.weight > 1 ? ', noticeable' : ''}`).join('; ')}): ${score} points, ${EFFECTS_ALLOWED} allowed`);
  }
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
  return [SLUG_OF[path.basename(dir)] || manual[path.basename(dir)]?.slug || path.basename(dir), readSite(dir)];
};
const targets = args[0] === '--all' ? published : args;
if (!targets.length) { console.error('usage: node scripts/check-fingerprints.mjs <build-folder-or-slug> ... | --all'); process.exit(2); }
const pool = new Map(published.map((s) => [s, readSite(path.join(PAGES, s))]));
const mine = targets.map(load);
for (const [n, s] of mine) if (!pool.has(n)) pool.set(n, s);
let clashes = 0;
const seen = new Set();
const missing = mine.flatMap(([n]) => effectsProblems(n));
if (missing.length) { console.log(missing.map((m) => `EFFECTS ${m}`).join('\n')); clashes += missing.length; }
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

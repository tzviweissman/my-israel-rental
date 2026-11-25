#!/usr/bin/env node
/**
 * Tzvi's corrections that came up on two or more sites (rules 3aj.6; Ben AI's /dream, 25 Nov 2026).
 * Reads every scrollcraft/builds/<site>/FEEDBACK.md, takes the quoted words of each "- open:" or "- done:" line, and
 * lists pairs from different sites that share most of their words. A repeat is proposed to Tzvi as a rule (the
 * add-a-rule steps at the top of docs/page-generation-rules.md); nothing is written. Run at the end of each build.
 *
 *   node scripts/feedback-repeats.mjs [--min 0.5]
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const builds = path.join(root, 'scrollcraft', 'builds');
const min = Number((process.argv.join(' ').match(/--min\s+([\d.]+)/) || [])[1] || 0.5);
const STOP = new Set('a an the and or but of to in on at is it its this that be are was for with as not no so too very i we you they he she them his her our your their do does dont can should make made more less just like it\'s'.split(' '));
const words = (s) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

export function similar(a, b) {
  const A = words(a), B = words(b); if (!A.size || !B.size) return 0;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}

export function corrections(text) {
  const out = [];
  for (const l of text.split(/\r?\n/)) {
    const m = /^\s*[-*]\s*(open|done)\s*:\s*["“]([^"”]+)["”]/i.exec(l);
    if (m) out.push(m[2]);
  }
  return out;
}

function main() {
  const all = [];
  for (const site of fs.existsSync(builds) ? fs.readdirSync(builds) : []) {
    const f = path.join(builds, site, 'FEEDBACK.md');
    if (fs.existsSync(f)) for (const c of corrections(fs.readFileSync(f, 'utf8'))) all.push({ site, c });
  }
  const pairs = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    if (all[i].site === all[j].site) continue;
    const s = similar(all[i].c, all[j].c);
    if (s >= min) pairs.push([s, all[i], all[j]]);
  }
  console.log(`${all.length} corrections in ${new Set(all.map((x) => x.site)).size} FEEDBACK.md files; ${pairs.length} repeated across sites`);
  for (const [s, a, b] of pairs.sort((x, y) => y[0] - x[0])) console.log(`\n${Math.round(s * 100)}%  ${a.site}: "${a.c}"\n      ${b.site}: "${b.c}"`);
}

if (process.argv.includes('--self-test')) {
  const ok = (t, m) => { if (!t) { console.error('FAIL ' + m); process.exit(1); } };
  const c = corrections('- open: "the opening is too zoomed in" (24 Nov)\n- done: "make the logo bigger" (1 Nov) proof: x.png\n- none yet');
  ok(c.length === 2 && c[0] === 'the opening is too zoomed in', 'parse');
  ok(similar('the opening is too zoomed in', 'opening film far too zoomed') >= 0.5, 'match');
  ok(similar('make the logo bigger', 'the opening is too zoomed in') < 0.5, 'no match');
  console.log('self-test ok');
} else main();

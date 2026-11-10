#!/usr/bin/env node
/**
 * Make ads from the rules, not check them afterwards (Tzvi, 5 Nov 2026: "make all rules the blueprint for making
 * ads so rules dont get skipped"). The same idea as scripts/blueprint.mjs for sites. The steps are in
 * docs/ad-rules-checklist.md; its header says how each mode is used.
 *
 * A line looks like:
 *   - [ ] A0.1 One job: ...
 *     plan: <what this ad does for this rule>, or "n/a: <why it has no such thing>"
 * Tick [x] once it is made. `auto` lines are filled in here and measured by check-ad-designs.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DIR = path.join(ROOT, 'docs', 'ads', 'blueprints');
// Made before the blueprint (5 Nov 2026): the auto lines still measure them, a blueprint is not asked for.
export const OLD_DESIGNS = new Set(['behind', 'phonepop', 'calling', 'notify', 'search', 'toggle', 'checklist', 'situation', 'mirror',
  'chat', 'post', 'versus', 'reasons', 'honest', 'moment', 'custom', 'phone', 'torn', 'clean', 'colour', 'bigwords', 'night', 'grid',
  'gallery', 'items', 'note', 'review', 'question', 'native', 'bgphoto', 'showcase', 'photo', 'call', 'beforeafter']);

function stages() {
  const out = [];
  for (const line of fs.readFileSync(path.join(ROOT, 'docs', 'ad-rules-checklist.md'), 'utf8').split(/\r?\n/)) {
    const h = /^##\s+([0-9]+)\.\s+(.*)$/.exec(line);
    if (h) { out.push({ n: Number(h[1]), name: h[2], items: [] }); continue; }
    const m = /^(A[0-9][0-9a-z]*\.[0-9]+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(decide|auto:[a-z-]+)(?:\s+since:(\d{4}-\d{2}-\d{2}))?\s*$/.exec(line);
    if (m && out.length) out[out.length - 1].items.push({ id: m[1], rule: m[2], how: m[4], since: m[5] || null });
  }
  return out;
}

// [{ id, ticked, plan }] from a blueprint file
function read(file) {
  const out = new Map();
  let cur = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^- \[( |x)\] (A[0-9][0-9a-z]*\.[0-9]+)\b/.exec(line);
    if (m) { cur = { id: m[2], ticked: m[1] === 'x', plan: '' }; out.set(m[2], cur); continue; }
    const p = /^\s+plan:\s*(.*)$/.exec(line);
    if (p && cur) cur.plan = p[1].trim();
  }
  return out;
}
// Rules answered by a sheet that must exist (A9.6: every added copy of the product beside the real photo, 9 Nov 2026).
const SHEET_RULES = new Set(['A9.6']);
const FIT_RULES = new Set(['A3.9']);
const STRANGER_RULES = new Set(['A2.10']);
const blank = (plan) => !plan || /^(\.\.\.|todo|tbd)$/i.test(plan);

function problems(name, upTo, finished) {
  const file = path.join(DIR, `${name}.md`);
  if (!fs.existsSync(file)) return [`no blueprint: run node scripts/ad-blueprint.mjs ${name}`];
  const got = read(file);
  const out = [];
  for (const s of stages()) {
    if (s.n > upTo) continue;
    for (const it of s.items) {
      const g = got.get(it.id);
      // A rule with a start date spares blueprints written before it: they have no such line (new-rules-spare-made-sites).
      if (!g && it.since) continue;
      if (!g) { out.push(`${it.id}: missing (rule added since? re-run node scripts/ad-blueprint.mjs ${name})`); continue; }
      if (blank(g.plan)) { out.push(`stage ${s.n}, ${it.id}: no answer. ${it.rule}`); continue; }
      // A sheet rule's answer is a picture someone looked at, not a sentence: the file it names must exist.
      // A fit rule's answer says the picture was laid with the tool that refuses to shrink it (A3.9, 10 Nov 2026).
      // The headline test is written as what a stranger takes from it, not as "clear" (A2.10, 10 Nov 2026).
      if (STRANGER_RULES.has(it.id) && !/^n\/a:/i.test(g.plan) && !/a stranger reads:/i.test(g.plan)) out.push(`stage ${s.n}, ${it.id}: write "A stranger reads:" and what someone who never heard of the business takes from the headline alone`);
      if (FIT_RULES.has(it.id) && !/^n\/a:/i.test(g.plan) && !/ad-fit-picture/.test(g.plan)) out.push(`stage ${s.n}, ${it.id}: name scripts/ad-fit-picture.py, the way the picture was laid on the ad, or n/a`);
      if (SHEET_RULES.has(it.id) && !/^n\/a:/i.test(g.plan)) {
        const files = [...g.plan.matchAll(/([\w./-]+\.(?:jpg|jpeg|png|webp))/gi)].map((x) => x[1]);
        if (!files.some((f) => fs.existsSync(path.resolve(ROOT, f)))) out.push(`stage ${s.n}, ${it.id}: name the sheet file it was checked on (none of ${files.length ? files.join(', ') : 'no file'} exists)`);
      }
      else if (finished && !g.ticked && !/^n\/a:/i.test(g.plan)) out.push(`stage ${s.n}, ${it.id}: not ticked`);
    }
  }
  return out;
}

function write(name) {
  const file = path.join(DIR, `${name}.md`);
  const old = fs.existsSync(file) ? read(file) : new Map();
  const lines = [`# Ad blueprint: ${name}`, '', 'Every ad rule, in making order (docs/ad-rules-checklist.md). Answer a stage before making it; tick [x] once made.', ''];
  for (const s of stages()) {
    lines.push(`## ${s.n}. ${s.name}`, '');
    for (const it of s.items) {
      const g = old.get(it.id);
      const auto = it.how.startsWith('auto:');
      lines.push(`- [${g?.ticked ? 'x' : ' '}] ${it.id} ${it.rule}`);
      lines.push(`  plan: ${g?.plan || (auto ? `measured by check-ad-designs (${it.how.slice(5)})` : '...')}`);
    }
    lines.push('');
  }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file, lines.join('\n'));
  console.log(`wrote ${path.relative(ROOT, file)}`);
}

// Every design key in the two ad areas: the gallery rows of AdMaker.jsx and DESIGNS in AdStudio.jsx.
function designKeys() {
  const maker = fs.readFileSync(path.join(ROOT, 'frontend/src/components/dashboard/AdMaker.jsx'), 'utf8');
  const studio = fs.readFileSync(path.join(ROOT, 'frontend/src/components/admin/AdStudio.jsx'), 'utf8');
  const keys = new Set([...maker.matchAll(/^\s*\['([a-z]+)', t\('ads\.[A-Za-z]+', '[^']*'\), /gm)].map((m) => m[1]));
  const d = /export const DESIGNS = \[([^\]]*)\]/.exec(studio);
  for (const m of (d ? d[1] : '').matchAll(/'([a-z]+)'/g)) keys.add(m[1]);
  return [...keys];
}

const args = process.argv.slice(2);
const rest = args.filter((a) => !a.startsWith('--'));
if (args.includes('--designs')) {
  const bad = [];
  for (const k of designKeys()) {
    if (OLD_DESIGNS.has(k)) continue;
    const p = problems(`design-${k}`, Infinity, true);
    if (p.length) bad.push(`design "${k}": ${p.length} step(s) open in docs/ads/blueprints/design-${k}.md, first: ${p[0]}`);
  }
  if (bad.length) { console.error(`A new ad design needs its blueprint finished first:\n${bad.join('\n')}`); process.exit(1); }
  console.log(`ad designs: ${designKeys().length} checked, all new ones have a finished blueprint`);
} else if (args.includes('--check') || args.includes('--done')) {
  const done = args.includes('--done');
  const p = problems(rest[0], done ? Infinity : Number(rest[1]), done);
  if (p.length) { console.error(`${rest[0]}: ${p.length} step(s) open:\n${p.join('\n')}`); process.exit(1); }
  console.log(`${rest[0]}: ${done ? 'every step done' : `stages 1 to ${rest[1]} answered`}`);
} else if (rest[0] && /^[a-z0-9-]+$/.test(rest[0])) {
  write(rest[0]);
} else {
  console.error('usage: node scripts/ad-blueprint.mjs <name> | --check <name> <stage> | --done <name> | --designs');
  process.exit(2);
}

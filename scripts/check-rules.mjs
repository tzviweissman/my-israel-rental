#!/usr/bin/env node
/**
 * Every rule looked at, every time (Tzvi, 22 Oct 2026: rules kept getting skipped on business
 * sites, e.g. page rule 8 "a set of images reads as one shoot" on LS Fruit Platter). The rules doc
 * is too long to hold in a builder's head and only some rules have scripts, so docs/rules-checklist.md
 * lists every rule that can be judged on a finished site, and each build answers every line in its
 * own RULES.md. This script refuses a build whose RULES.md is missing, incomplete, unresolved or stale.
 *
 *   node scripts/check-rules.mjs <build-folder-or-slug>              exit 1 and list what is wrong
 *   node scripts/check-rules.mjs --template <build-folder-or-slug>   write RULES.md with every id as `todo`
 *                                                                    (refuses to overwrite an existing one;
 *                                                                    add --force to replace it)
 *
 * RULES.md has one line per id:
 *   R8.1 pass: <what was looked at, or which script passed>
 *   R8.1 n/a: <why this site has no such thing>
 *   R8.1 fix: <what is wrong>        (fails until it is fixed and the line is changed to pass)
 *
 * Fails when: RULES.md is missing; a checklist id is missing from it; an id is not pass / n/a / fix
 * (todo and anything else fail); a pass or n/a has no reason; any fix remains; an id in RULES.md is
 * not in the checklist (a typo or a removed rule); or RULES.md is older than the newest .html, .css,
 * .js or .py in the build (folders named lab, gen, node_modules, .git are skipped), because then the
 * rules were looked at before the last change.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const CHECKLIST = path.join(ROOT, 'docs', 'rules-checklist.md');
const SKIP_DIRS = new Set(['lab', 'gen', 'node_modules', '.git']);
const WATCH = /\.(html|css|js|py)$/i;
const ID = /^(R[0-9][0-9a-z]*\.[0-9]+)\s*\|\s*(.*)$/;

const args = process.argv.slice(2);
const template = args.includes('--template');
const force = args.includes('--force');
const target = args.find((a) => !a.startsWith('--'));
if (!target) {
  console.error('usage: node scripts/check-rules.mjs [--template [--force]] <build-folder-or-slug>');
  process.exit(2);
}
const dir = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.resolve(target) : path.join(ROOT, 'scrollcraft', 'builds', target);
if (!fs.existsSync(dir)) { console.error(`no build folder: ${target}`); process.exit(2); }
if (!fs.existsSync(CHECKLIST)) { console.error('docs/rules-checklist.md is missing'); process.exit(2); }

// the checklist: id, rule, reference, how, and the group it sits in
const items = [];
let group = '';
for (const line of fs.readFileSync(CHECKLIST, 'utf8').split(/\r?\n/)) {
  const h = /^##\s+(.*)$/.exec(line); if (h) { group = h[1].trim(); continue; }
  const m = ID.exec(line); if (!m) continue;
  const parts = m[2].split('|').map((s) => s.trim());
  items.push({ id: m[1], rule: parts[0] || '', ref: parts[1] || '', how: parts.slice(2).join(' | '), group });
}
const seen = new Set();
for (const it of items) { if (seen.has(it.id)) { console.error(`docs/rules-checklist.md lists ${it.id} twice`); process.exit(2); } seen.add(it.id); }
if (!items.length) { console.error('docs/rules-checklist.md has no rule lines'); process.exit(2); }

const rulesFile = path.join(dir, 'RULES.md');

if (template) {
  if (fs.existsSync(rulesFile) && !force) { console.error(`${rulesFile} already exists; add --force to replace it`); process.exit(2); }
  const out = [
    `# Rules for ${path.basename(dir)} (docs/rules-checklist.md)`,
    '',
    'One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.',
    'Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/' + path.basename(dir) + '` must exit 0 before anyone is shown the site.',
    '',
  ];
  let last = null;
  for (const it of items) {
    if (it.group !== last) { out.push('', `## ${it.group}`); last = it.group; }
    out.push(`${it.id} todo`);
  }
  fs.writeFileSync(rulesFile, out.join('\n') + '\n');
  console.log(`wrote ${rulesFile} with ${items.length} rules, all todo`);
  process.exit(0);
}

const problems = [];
if (!fs.existsSync(rulesFile)) {
  console.error(`RULES.md is missing in ${dir}\nrun: node scripts/check-rules.mjs --template ${target}`);
  process.exit(1);
}

// RULES.md: first line starting with an id wins; later duplicates are reported
const answers = new Map();
fs.readFileSync(rulesFile, 'utf8').split(/\r?\n/).forEach((line, i) => {
  const m = /^[-*\s]*(R[0-9][0-9a-z]*\.[0-9]+)\b[\s:|-]*(.*)$/.exec(line); if (!m) return;
  if (answers.has(m[1])) { problems.push(`${m[1]}: appears twice (lines ${answers.get(m[1]).line} and ${i + 1})`); return; }
  answers.set(m[1], { rest: m[2].trim(), line: i + 1 });
});

const counts = { pass: 0, na: 0, fix: 0, todo: 0, missing: 0, bad: 0 };
const byGroup = new Map();
const note = (it, msg, kind) => { counts[kind]++; problems.push(`${it.id}: ${msg}`); const g = byGroup.get(it.group) || []; g.push(it.id); byGroup.set(it.group, g); };
for (const it of items) {
  const a = answers.get(it.id);
  if (!a) { note(it, `missing from RULES.md. Rule: ${it.rule.slice(0, 90)}`, 'missing'); continue; }
  const m = /^(pass|n\/a|fix|todo)\b\s*:?\s*(.*)$/i.exec(a.rest);
  if (!m) { note(it, `line ${a.line} must start with pass, n/a or fix (got "${a.rest.slice(0, 40)}")`, 'bad'); continue; }
  const kind = m[1].toLowerCase(), why = m[2].trim();
  if (kind === 'todo') { note(it, 'still todo', 'todo'); continue; }
  if (kind === 'fix') { note(it, `fix not done: ${why || '(no description)'}`, 'fix'); continue; }
  if (why.length < 4) { note(it, `${kind === 'pass' ? 'pass' : 'n/a'} needs a reason (what was looked at, which script passed, or why it does not apply)`, 'bad'); continue; }
  // n/a means the site has no such thing, never "I did not look" (22 Oct 2026: a rework marked 136 of 173 rules
  // "not judged in this pass", which passed the gate without checking anything)
  if (/not (been )?(judged|checked|looked at|re-?judged|verified|reviewed)|not judged in|earlier build unchanged|was not (run|looked)|skipped|no time|assumed|probably fine/i.test(why)) { note(it, `"${why.slice(0, 50)}" is not a reason: n/a and pass are only for a rule that was looked at (pass) or that the site has nothing for (n/a)`, 'bad'); continue; }
  counts[kind === 'pass' ? 'pass' : 'na']++;
}
for (const id of answers.keys()) if (!seen.has(id)) { problems.push(`${id}: not in docs/rules-checklist.md (typo, or the rule was removed)`); counts.bad++; }

// stale: RULES.md older than the newest page file. A file with no uncommitted change is dated by its last commit,
// not its mtime: a fresh clone or worktree stamps every file with the moment of checkout, in no set order, so
// mtimes there said "RULES.md is older" for every site at random (24 Oct 2026, all 17 builds in a new worktree)
const git = (a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 28 }).stdout || '';
const top = git(['rev-parse', '--show-toplevel']).trim();
const dirty = new Set(git(['status', '--porcelain', '-uall', '--', '.']).split(/\r?\n/).filter(Boolean).map((l) => path.resolve(top, l.slice(3).replace(/^.* -> /, ''))));
const committed = new Map();
let when = 0;
for (const l of git(['log', '--format=@%ct', '--name-only', '--', '.']).split(/\r?\n/)) {
  if (l.startsWith('@')) when = Number(l.slice(1)) * 1000;
  else if (l && top) { const f = path.resolve(top, l); if (!committed.has(f)) committed.set(f, when); }
}
const dated = (f) => (!dirty.has(f) && committed.has(f) ? committed.get(f) : fs.statSync(f).mtimeMs);
let newest = { t: 0, f: '' };
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(d, e.name)); continue; }
    if (!WATCH.test(e.name)) continue;
    const f = path.join(d, e.name), t = dated(f);
    if (t > newest.t) newest = { t, f };
  }
})(dir);
const rulesTime = dated(rulesFile);
if (newest.t > rulesTime) problems.push(`RULES.md is older than ${path.relative(dir, newest.f)} (changed ${new Date(newest.t).toISOString().replace('T', ' ').slice(0, 19)}, RULES.md ${new Date(rulesTime).toISOString().replace('T', ' ').slice(0, 19)}): look at every rule again against the current site, then save RULES.md`);

const name = path.basename(dir);
console.log(`${name}: ${items.length} rules in the checklist`);
console.log(`  pass ${counts.pass}   n/a ${counts.na}   fix ${counts.fix}   todo ${counts.todo}   missing ${counts.missing}   malformed ${counts.bad}`);
if (problems.length) {
  console.log('');
  for (const [g, ids] of byGroup) console.log(`  ${g}: ${ids.length} open (${ids.slice(0, 12).join(' ')}${ids.length > 12 ? ' ...' : ''})`);
  console.log('');
  for (const p of problems.slice(0, 60)) console.log('  FAIL ' + p);
  if (problems.length > 60) console.log(`  ... and ${problems.length - 60} more`);
  console.error(`\n${problems.length} problem(s). Do not show or publish ${name} until check-rules passes (docs/rules-checklist.md).`);
  process.exit(1);
}
console.log(`rules: every one of ${items.length} rules answered for ${name}`);

#!/usr/bin/env node
/**
 * Save a rule change in one step, in the right order (16 Nov 2026: rule 3ac went in with a stale contents list because
 * the files were staged first and the lists rebuilt on disk afterwards):
 *   1. check-rule-copies --sync: copies the skill's rules to ~/.claude and rebuilds every contents list (contents.mjs)
 *   2. git add every rules file that changed, plus any extra paths given
 *   3. git commit (the commit check runs as usual)
 *
 *   node scripts/commit-rules.mjs "<message>" [more paths to commit with it]
 *   node scripts/commit-rules.mjs --onto-main [--push] [--base <commit>] "<message>" [more paths]
 *
 * --onto-main (Tzvi, 19 Nov 2026, Burnt: "do all 3 improvemnets"): for a checkout whose main is behind origin and
 * carries other sessions' work. Another session had changed the same rule files on main; a plain three-way merge
 * flagged every line (Windows line endings on disk, none in git), and one new paragraph was dropped in the hand merge.
 * So, in order:
 *   1. git fetch; each rules file (and extra path) changed here is merged with origin/main's copy, three ways with HEAD
 *      as the base, all three read with the same line endings; a clash inside a contents list takes main's (the lists
 *      are rebuilt next), any other clash stops with its file named, nothing written
 *   2. check-rule-copies --sync, then check-rule-homes
 *   3. every line this change added (against HEAD) must still be there after the merge, contents lines aside; a
 *      missing one stops with the line shown
 *   4. one commit of only these files, made on origin/main with a separate index (the checkout's own index and branch
 *      are not touched), printed; --push sends it to main and checks main is that commit afterwards
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILES as CONTENTS_FILES } from './contents.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const onto = argv.includes('--onto-main'), push = argv.includes('--push');
const baseRev = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : null;
const [msg, ...extra] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base');
if (!msg) { console.error('usage: node scripts/commit-rules.mjs [--onto-main [--push]] "<message>" [more paths]'); process.exit(2); }
const RULE_FILES = [...CONTENTS_FILES, 'docs/rules-as-blueprint/rules.json', 'docs/rules-as-blueprint/ad-rules.json',
  'docs/ad-rules-checklist.md', '.claude/skills/build-business-page/SKILL.md', '.claude/skills/build-business-page/reference/full-rules.md'];
const run = (cmd, args, opt = {}) => { const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opt }); if (r.status !== 0) process.exit(r.status || 1); };
const git = (args, opt = {}) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opt });
const lf = (s) => s.replace(/\r\n/g, '\n');
const show = (rev, f) => { const r = git(['show', `${rev}:${f}`]); return r.status === 0 ? r.stdout : null; };
const isContents = (line) => /^- \d+: /.test(line);

if (!onto) {
  run(process.execPath, [path.join(ROOT, 'scripts', 'check-rule-copies.mjs'), '--sync']);
  const changed = git(['diff', 'HEAD', '--name-only', '--', ...RULE_FILES]).stdout.split('\n').filter(Boolean);
  if (!changed.length && !extra.length) { console.error('no rules file has changes to commit'); process.exit(1); }
  run('git', ['add', '--', ...changed, ...extra]);
  run('git', ['commit', '-m', msg]);
  process.exit(0);
}

// --onto-main
run('git', ['fetch', '-q', 'origin']);
const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...RULE_FILES, ...extra]).stdout.split('\n').filter(Boolean);
const files = [...new Set([...git(['diff', 'HEAD', '--name-only', '--', ...RULE_FILES, ...extra]).stdout.split('\n').filter(Boolean), ...untracked, ...extra])]
  .filter((f) => fs.existsSync(path.join(ROOT, f)));
if (!files.length) { console.error('no rules file has changes to commit'); process.exit(1); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-merge-'));
// the base of the merge: --base <commit>, or the last commit this script pushed from here (kept in .git), when main
// still holds it; else HEAD. A checkout behind main that pushed its own rule change is merged against what it pushed,
// so its own earlier change is never read as a clash with main (19 Nov 2026)
// in a worktree .git is a file, so ask git where its folder is (25 Nov 2026: the write after a push crashed there)
const RECORD = path.resolve(ROOT, git(['rev-parse', '--git-dir']).stdout.trim(), 'rules-last-push');
let since = baseRev || (fs.existsSync(RECORD) ? fs.readFileSync(RECORD, 'utf8').trim() : null);
if (since && git(['merge-base', '--is-ancestor', since, 'origin/main']).status !== 0) since = null;
if (since) console.log(`merging against ${since.slice(0, 8)}, the rules last pushed from here`);
const added = {};                                                          // the lines this change added, per file
// A clash against the recorded base is tried again against HEAD before stopping: the record can be older than what
// this checkout holds, so main's later lines read as clashes (25 Nov 2026: ad rule A9g.11, main 30 commits ahead).
function mergeOne(f, rev) {
  const disk = fs.readFileSync(path.join(ROOT, f), 'utf8'), eol = disk.includes('\r\n') ? '\r\n' : '\n';
  const mine = lf(disk), base = show(rev, f), theirs = show('origin/main', f);
  const baseLines = new Set(lf(base ?? '').split('\n'));
  const add = mine.split('\n').filter((l) => l.trim() && !baseLines.has(l) && !isContents(l));
  if (theirs === null || base === null || lf(theirs) === lf(base)) return { add };   // main has not changed it
  if (lf(theirs) === mine) return { add };                                           // already the same as main
  // this checkout is often behind main yet already holds main's change (an earlier push made from here): then main's
  // copy is the base, so that change is not mistaken for a clash (19 Nov 2026: the digest line pushed an hour before)
  const mineLines = new Set(mine.split('\n'));
  const theirsAdded = lf(theirs).split('\n').filter((l) => l.trim() && !baseLines.has(l) && !isContents(l));
  // a line edited twice here (pushed once, changed again) is held if this copy has a line that starts the same way;
  // each such line is printed, so a change main made to its end is seen, never dropped silently
  const head = (l) => l.slice(0, Math.min(120, l.length));
  const near = [];
  const held = theirsAdded.every((l) => mineLines.has(l) || (mine.split('\n').some((m) => m !== l && m.startsWith(head(l))) && near.push(l)));
  if (held && near.length) console.log(`${f}: taken as already here, edited again in this change:\n  ${near.map((l) => l.slice(0, 100) + '...').join('\n  ')}`);
  const from = held ? lf(theirs) : lf(base);
  const p = (n, s) => { const q = path.join(tmp, n); fs.writeFileSync(q, s); return q; };
  const r = git(['merge-file', '-p', p('mine', mine), p('base', from), p('theirs', lf(theirs))]);
  let out = r.stdout, bad = [];
  out = out.replace(/<<<<<<< [^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]*\n/g, (m, a, b) => {
    const both = (a + b).split('\n').filter(Boolean);
    if (both.length && both.every(isContents)) return b;                   // a contents list: main's, rebuilt next
    bad.push(a.split('\n')[0]); return m;
  });
  return { add, bad, out: out.replace(/\n/g, eol) };
}
for (const f of files) {
  const first = since && show(since, f) !== null ? since : 'HEAD';
  let m = mergeOne(f, first);
  if (m.bad?.length && first !== 'HEAD' && show('HEAD', f) !== null) {
    const again = mergeOne(f, 'HEAD');
    if (!again.bad?.length) { console.log(`${f}: clashed against ${first.slice(0, 8)}, merged against HEAD instead`); m = again; }
  }
  added[f] = m.add;
  if (m.bad?.length) { console.error(`${f}: a clash to settle by hand, nothing written:\n  ${m.bad.join('\n  ')}`); process.exit(1); }
  if (m.out !== undefined) { fs.writeFileSync(path.join(ROOT, f), m.out); console.log(`merged ${f} with main`); }
}
run(process.execPath, [path.join(ROOT, 'scripts', 'check-rule-copies.mjs'), '--sync']);
run(process.execPath, [path.join(ROOT, 'scripts', 'check-rule-homes.mjs')]);
const lost = [];
for (const f of files) {
  const now = new Set(lf(fs.readFileSync(path.join(ROOT, f), 'utf8')).split('\n'));
  for (const l of added[f]) if (!now.has(l)) lost.push(`${f}: ${l.slice(0, 110)}`);
}
if (lost.length) { console.error(`lines this change added are gone after the merge:\n  ${lost.join('\n  ')}`); process.exit(1); }
// these files, and the copies the sync rewrote from them (full-rules.md); only what differs from HEAD, so a file this
// checkout merely has older than main is never sent back over main's
const commitFiles = [...new Set([...files, ...git(['diff', 'HEAD', '--name-only', '--', ...RULE_FILES]).stdout.split('\n').filter(Boolean)])];
console.log(`committing: ${commitFiles.join(', ')}`);
const env = { ...process.env, GIT_INDEX_FILE: path.join(tmp, 'index') };
run('git', ['read-tree', 'origin/main'], { env });
for (const f of commitFiles) {
  const sha = git(['hash-object', '-w', f]).stdout.trim();
  run('git', ['update-index', '--add', '--cacheinfo', `100644,${sha},${f}`], { env });
}
const tree = git(['write-tree'], { env }).stdout.trim();
const commit = git(['commit-tree', tree, '-p', 'origin/main', '-m', msg]).stdout.trim();
console.log(`commit ${commit} on origin/main:`);
run('git', ['diff', '--stat', 'origin/main', commit]);
if (!push) { console.log(`not pushed: git push origin ${commit}:refs/heads/main`); process.exit(0); }
run('git', ['push', 'origin', `${commit}:refs/heads/main`]);
run('git', ['fetch', '-q', 'origin']);
const head = git(['rev-parse', 'origin/main']).stdout.trim();
if (head !== commit) { console.error(`main is ${head}, not ${commit}`); process.exit(1); }
fs.writeFileSync(RECORD, commit);
console.log(`main is ${commit}`);

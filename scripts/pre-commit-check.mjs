#!/usr/bin/env node
/**
 * The commit check (.githooks/pre-commit; Tzvi, 24 Oct 2026: "the rules get skipped a lot ... how do we make
 * sure these dont get skipped"). A rule written down is skipped; a commit that is refused is not.
 *
 * For every business site the commit touches:
 *   scrollcraft/builds/<folder>/...       check-rules (every checklist line answered in RULES.md, and answered
 *                                         after the last change) and check-concept must pass
 *   frontend/public/pages/<slug>/...      the live page must be exactly what publish-page.mjs wrote (its
 *                                         fingerprint in scrollcraft/published.json): a page edited by hand is
 *                                         refused, because the build falls behind and the next publish undoes it,
 *                                         and because publishing is where fits, site and motion run
 * The screen checks (fits, site, motion) take minutes, so they run when publishing, not here.
 * Exit 1 lists every problem. Nothing to check: exit 0 at once.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { liveHash, readPublished } from './live-hash.mjs';
import { stagedIsMeasured } from './ad-measured.mjs';
import { FILES as CONTENTS_FILES, withContents } from './contents.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
const lines = (r) => r.stdout.split('\n').filter(Boolean);
let staged = lines(git('diff', '--cached', '--name-only', '--diff-filter=ACMR'));
// A merge commit is checked only on what the merge itself changed (16 Nov 2026: merging main into a branch was
// refused over rule and ad files exactly as main has them, which passed this check when they went in there).
// A file staged exactly as the branch being merged has it is that branch's work; a resolved conflict is checked.
// The branch merged in: MERGE_HEAD once a conflict stopped the merge (pre-commit); during a clean merge
// (pre-merge-commit) git has not written it yet, but names it in GIT_REFLOG_ACTION ("merge origin/main").
const merging = git('rev-parse', '-q', '--verify', 'MERGE_HEAD').status === 0 ? 'MERGE_HEAD'
  : (/^merge (\S+)$/.exec(process.env.GIT_REFLOG_ACTION || '') || [])[1];
if (merging && git('rev-parse', '-q', '--verify', `${merging}^{commit}`).status === 0) {
  const differs = new Set(lines(git('diff', '--cached', '--name-only', merging)));
  staged = staged.filter((f) => differs.has(f));
}

// The checks below read files from disk, but a commit saves the staged copy. A file in the commit that has more
// changes on disk than were staged would be checked as one thing and saved as another (16 Nov 2026: rule 3ac's
// contents list passed on disk and went in stale), so the two must agree: stage the rest, or set it aside.
{
  const onTop = new Set(lines(git('diff', '--name-only')));
  const split = staged.filter((f) => onTop.has(f));
  if (split.length) { console.error(`Commit refused: ${split.join(', ')} changed again on disk after it was staged, so the checks would read something other than what is saved. git add it again (or git stash the rest), then commit.`); process.exit(1); }
}
// a staged script never leans on a file that was never added (15 Nov 2026: check-rules.mjs went in importing
// site-has.mjs, which sat untracked for days, and every other copy of the repo broke): its local imports are tracked or staged
{
  const tracked = new Set(spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).stdout.split('\n'));
  const missing = [];
  for (const f of staged.filter((x) => /\.(mjs|js)$/.test(x) && !/^frontend\//.test(x) && fs.existsSync(path.join(ROOT, x)))) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/^\s*(?:import|export)\b[^;\n]*?['"](\.{1,2}\/[^'"]+\.m?js)['"]|\bimport\(\s*['"](\.{1,2}\/[^'"]+\.m?js)['"]\s*\)/gm)) {
      const dep = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1] || m[2]));
      if (!tracked.has(dep) && !staged.includes(dep)) missing.push(`${f} imports ${dep}, which is not in the repo: git add it too`);
    }
  }
  if (missing.length) { console.error(`Commit refused:\n${missing.join('\n')}`); process.exit(1); }
}
const builds = new Set(), live = new Set();
for (const f of staged) {
  let m = f.match(/^scrollcraft\/builds\/([^/]+)\/(.+)$/);
  // working files of a build do not make it a new version of the site
  if (m && !/^(lab|src|gen|screenshots)\//.test(m[2]) && !/\.(mp4|frames)$/.test(m[2])) builds.add(m[1]);
  m = f.match(/^frontend\/public\/pages\/([^/]+)\//);
  if (m) live.add(m[1]);
}
// a rule changed in the repo copy of the skill or hooks must be changed in the copy sessions load too (1 Nov 2026)
if (staged.some((f) => /^(\.claude\/skills\/build-business-page|scripts\/hooks)\//.test(f))) {
  const c = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-rule-copies.mjs')], { cwd: ROOT, encoding: 'utf8' });
  if (c.status !== 0) { console.error(`Commit refused: ${c.stdout}`); process.exit(1); }
}
// each long rule file opens with a contents list that matches its sections (15 Nov 2026)
// The STAGED copy is what is saved, so that is what is read: the copy on disk passed while a stale list was committed
// (16 Nov 2026, rule 3ac: the files were staged, then check-rule-copies --sync rebuilt the lists on disk only)
const staleContents = staged.filter((f) => CONTENTS_FILES.includes(f)).filter((f) => { const s = git('show', `:${f}`).stdout; return s && withContents(s) !== s; });
if (staleContents.length) { console.error(`Commit refused: the contents list is out of date in the staged ${staleContents.join(', ')}. Run: node scripts/contents.mjs, then git add them again`); process.exit(1); }
// a rule copied by hand falls behind: the full rulebook is copied into the skill, and both copies must match (10 Nov 2026)
if (staged.includes('docs/page-generation-rules.md')) {
  const c = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-rule-copies.mjs')], { cwd: ROOT, encoding: 'utf8' });
  if (c.status !== 0) { console.error(`Commit refused: ${c.stdout}`); process.exit(1); }
}
// every rule has its home: a section of the short file a build reads, and a numbered section for each ad step (10 Nov 2026)
if (staged.some((f) => /^(docs\/(page-generation-rules|rules-checklist|static-ad-rules|ad-rules-checklist)\.md|\.claude\/skills\/build-business-page\/(SKILL|reference\/rules-digest)\.md|scripts\/check-rule-homes\.mjs|docs\/rules-as-blueprint\/(ad-)?rules\.json)$/.test(f))) {
  const c = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-rule-homes.mjs')], { cwd: ROOT, encoding: 'utf8' });
  if (c.status !== 0) { console.error(`Commit refused: ${c.stdout}`); process.exit(1); }
}
// a change to the moving-ad check (or its self-test) must still pass a good ad and refuse the broken ones (17 Nov 2026);
// it records four short ads, so it runs only then, never on other commits
if (staged.some((f) => /^scripts\/(check-moving-ad\.py|test-moving-ad-checks\.mjs)$/.test(f))) {
  console.log('check-moving-ad changed: running scripts/test-moving-ad-checks.mjs (four recordings, a few minutes)');
  const c = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'test-moving-ad-checks.mjs')], { cwd: ROOT, encoding: 'utf8' });
  if (c.status !== 0) { console.error(`Commit refused: the moving-ad check no longer tells good from broken:\n${c.stdout}${c.stderr}`); process.exit(1); }
}
// every checklist rule is a step of the build blueprint: a new section must have a stage (4 Nov 2026, "8d")
if (staged.includes('docs/rules-checklist.md') || staged.includes('scripts/blueprint.mjs')) {
  const c = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'blueprint.mjs'), '--order'], { cwd: ROOT, encoding: 'utf8' });
  if (c.status !== 0) { console.error(`Commit refused: ${c.stderr || c.stdout}`); process.exit(1); }
}
// every ad rule is a step of the ad blueprint: a new design in either ad area needs its blueprint finished (5 Nov 2026)
if (staged.some((f) => /^(frontend\/src\/components\/(dashboard\/AdMaker|admin\/AdStudio)\.jsx|docs\/ad-rules-checklist\.md|scripts\/ad-blueprint\.mjs)$/.test(f))) {
  const c = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'ad-blueprint.mjs'), '--designs'], { cwd: ROOT, encoding: 'utf8' });
  if (c.status !== 0) { console.error(`Commit refused: ${c.stderr || c.stdout}`); process.exit(1); }
  // and the drawing that goes out is the drawing that was measured (Tzvi, 5 Nov 2026: "make sure we always use the blueprint").
  // Only when this commit changes the drawing: otherwise it ships what HEAD has, measured when that was committed, and
  // another session's unsaved AdMaker edit no longer blocks a rules-only commit (16 Nov 2026, it did twice).
  const drawing = staged.some((f) => /^frontend\/src\/(components\/(dashboard\/AdMaker|admin\/AdStudio)\.jsx|utils\/sharpCanvas\.js)$/.test(f));
  if (drawing && !stagedIsMeasured(ROOT)) {
    console.error('Commit refused: the ad drawing changed since it was last measured. With the local servers up, run: node scripts/check-ad-designs.mjs (then stage the same files).');
    process.exit(1);
  }
}
if (!builds.size && !live.size) process.exit(0);

const problems = [];
const published = readPublished(ROOT);
for (const slug of live) {
  const dir = path.join(ROOT, 'frontend', 'public', 'pages', slug);
  if (!fs.existsSync(path.join(dir, 'index.html'))) continue;  // unpublished in this commit
  const rec = published[slug];
  if (!rec) { problems.push(`${slug}: live page not written by publish-page.mjs (no entry in scrollcraft/published.json). Change its build, then run: node scripts/publish-page.mjs <build-folder> ${slug}`); continue; }
  if (liveHash(dir) !== rec.hash) problems.push(`${slug}: the live page was changed after publishing (by hand?). Make the change in scrollcraft/builds/${rec.folder}, then run: node scripts/publish-page.mjs ${rec.folder} ${slug}`);
  builds.add(rec.folder);
}
// A site is checked against today's rules, not the ones this branch was cut with (Tzvi, 3 Nov 2026, after Krysp was
// built on a branch from 29 Oct and missed 27 rules made on main since: "make sure these issues dont happen in the
// future"). Any rule on main (local or origin) that this checkout's checklist lacks refuses the commit: merge main first.
if (builds.size) {
  const ids = (s) => new Set([...s.matchAll(/^(R[0-9][0-9a-z]*\.[0-9]+)\s*\|/gm)].map((m) => m[1]));
  const mine = ids(fs.readFileSync(path.join(ROOT, 'docs', 'rules-checklist.md'), 'utf8'));
  const behind = new Set();
  for (const ref of ['main', 'origin/main']) {
    const r = spawnSync('git', ['show', `${ref}:docs/rules-checklist.md`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.status === 0) for (const id of ids(r.stdout)) if (!mine.has(id)) behind.add(id);
  }
  if (behind.size) problems.push(`this checkout is behind main's rules (${[...behind].slice(0, 8).join(', ')}${behind.size > 8 ? ` and ${behind.size - 8} more` : ''}): merge main first (git merge main), then answer the new rules in RULES.md`);
}
// A RULES.md answers only rules the commit itself carries (16 Nov 2026: Gremier's RULES.md went to main answering R3ac.1
// while that rule sat only in the committing checkout's unstaged rules-checklist.md; check-rules read the working copy and
// passed, and every other checkout was refused). The checklist is read as it will be committed (the index), not from disk.
{
  const idx = spawnSync('git', ['show', ':docs/rules-checklist.md'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const known = new Set([...(idx.stdout || '').matchAll(/^(R[0-9][0-9a-z]*\.[0-9]+)\s*\|/gm)].map((m) => m[1]));
  for (const f of staged.filter((x) => /^scrollcraft\/builds\/[^/]+\/RULES\.md$/.test(x))) {
    const r = spawnSync('git', ['show', `:${f}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const unknown = [...new Set([...(r.stdout || '').matchAll(/^(R[0-9][0-9a-z]*\.[0-9]+)\s+(?:pass|n\/a|fix|todo)\b/gm)].map((m) => m[1]))].filter((id) => !known.has(id));
    if (known.size && unknown.length) problems.push(`${f} answers ${unknown.join(', ')}, not in docs/rules-checklist.md as committed: stage the rule's checklist line (and its rule homes) in this commit, or wait until it is on main`);
  }
}
for (const folder of builds) {
  const dir = path.join('scrollcraft', 'builds', folder);
  if (!fs.existsSync(path.join(ROOT, dir, 'index.html'))) continue;  // not a site (or deleted)
  for (const [script, what] of [['check-rules.mjs', 'rules not all answered'], ['check-concept.mjs', 'concept not ready']]) {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), dir], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) problems.push(`${folder}: ${what} (${script}):\n${`${r.stdout}${r.stderr}`.split('\n').filter((l) => /FAIL|^- |problem|missing|not /i.test(l)).slice(0, 12).join('\n')}`);
  }
}
if (problems.length) {
  console.error(`\nCommit refused: ${problems.length} problem(s). Fix them and commit again (page rules; scripts/pre-commit-check.mjs).\n\n${problems.join('\n\n')}\n`);
  process.exit(1);
}
console.log(`commit check: ${[...builds].join(', ')} pass`);

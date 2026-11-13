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

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const staged = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);

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
// every checklist rule is a step of the build blueprint: a new section must have a stage (4 Nov 2026, "8d")
if (staged.includes('docs/rules-checklist.md') || staged.includes('scripts/blueprint.mjs')) {
  const c = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'blueprint.mjs'), '--order'], { cwd: ROOT, encoding: 'utf8' });
  if (c.status !== 0) { console.error(`Commit refused: ${c.stderr || c.stdout}`); process.exit(1); }
}
// every ad rule is a step of the ad blueprint: a new design in either ad area needs its blueprint finished (5 Nov 2026)
if (staged.some((f) => /^(frontend\/src\/components\/(dashboard\/AdMaker|admin\/AdStudio)\.jsx|docs\/ad-rules-checklist\.md|scripts\/ad-blueprint\.mjs)$/.test(f))) {
  const c = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'ad-blueprint.mjs'), '--designs'], { cwd: ROOT, encoding: 'utf8' });
  if (c.status !== 0) { console.error(`Commit refused: ${c.stderr || c.stdout}`); process.exit(1); }
  // and the drawing that goes out is the drawing that was measured (Tzvi, 5 Nov 2026: "make sure we always use the blueprint")
  if (!stagedIsMeasured(ROOT)) {
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

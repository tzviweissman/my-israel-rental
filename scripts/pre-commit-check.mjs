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

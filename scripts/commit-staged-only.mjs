/**
 * Commit the staged copy of the files you name, and nothing else, while other sessions are working in the
 * same checkout (their staged files stay staged, their unsaved edits stay on disk).
 *
 * Why (24 Nov 2026): committing only my lines by hand misfired. A failed `git add` skipped the set-aside and
 * the restore step tried to apply another session's old stash; and a plain `git commit` would have taken the
 * twenty files another session had staged at that moment. This builds the commit in a separate index holding
 * HEAD plus your named files' staged copies, so nothing else can ride along, and uses no stash at all.
 *
 * The commit check reads files from disk, so a named file whose disk copy has more edits (someone else's) has
 * its staged copy put on disk for the commit and the disk copy put back after, whatever happens.
 *
 * Stage your lines first (git add, or write HEAD + your edits into the index), then:
 *   node scripts/commit-staged-only.mjs "commit message" path [path...]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [msg, ...files] = process.argv.slice(2);
if (!msg || !files.length) { console.error('usage: node scripts/commit-staged-only.mjs "message" path [path...]'); process.exit(2); }
const run = (args, env) => execFileSync('git', args, { encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const root = run(['rev-parse', '--show-toplevel']);
process.chdir(root);

const entries = files.map((f) => {
  const line = run(['ls-files', '-s', '--', f]);
  if (!line) { console.error(`${f} is not staged or tracked`); process.exit(1); }
  return { f, line };
});
const changed = files.filter((f) => run(['diff', '--cached', '--name-only', '--', f]));
if (!changed.length) { console.error('none of these has staged changes'); process.exit(1); }

const tmpIndex = path.join(os.tmpdir(), `commit-staged-only-${process.pid}.index`);
const env = { GIT_INDEX_FILE: tmpIndex };
const head = run(['rev-parse', 'HEAD']);
run(['read-tree', head], env);
execFileSync('git', ['update-index', '--index-info'], { input: entries.map((e) => e.line).join('\n') + '\n', env: { ...process.env, ...env } });

// Named files whose disk copy differs from the staged copy: the staged copy goes on disk while the checks run.
const backups = [];
for (const f of changed) {
  if (!run(['diff', '--name-only', '--', f])) continue;
  backups.push([f, fs.readFileSync(f)]);
  fs.writeFileSync(f, execFileSync('git', ['show', `:${f}`]));
}
let ok = false;
try {
  // Another session committing meanwhile would make this tree undo its commit: start again instead.
  if (run(['rev-parse', 'HEAD']) !== head) throw new Error('HEAD moved while preparing (another session committed): run this again');
  execFileSync('git', ['commit', '-m', msg], { stdio: 'inherit', env: { ...process.env, ...env } });
  ok = true;
} catch (e) { if (/HEAD moved/.test(e.message)) console.error(e.message); } finally {
  for (const [f, buf] of backups) fs.writeFileSync(f, buf);
  fs.rmSync(tmpIndex, { force: true });
}
if (!ok) { console.error('commit refused; files and index are as they were'); process.exit(1); }
const touched = run(['diff', '--name-only', 'HEAD~1', 'HEAD']).split('\n').filter(Boolean);
const extra = touched.filter((f) => !files.includes(f));
if (extra.length) { console.error(`WARNING: the commit also changed ${extra.join(', ')}. Check it before pushing.`); process.exit(1); }
console.log(run(['log', '--oneline', '-1']), '| put back on disk:', backups.map((b) => b[0]).join(', ') || 'nothing');

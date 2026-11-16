/**
 * Delete worktrees (extra copies of the code made with `git worktree add`) safely (16 Nov 2026).
 *
 *   node scripts/remove-worktree.mjs <path-to-worktree>     remove that one
 *   node scripts/remove-worktree.mjs --stale                list the copies whose work is already on main (deletes nothing)
 *   node scripts/remove-worktree.mjs --stale --yes          remove all of those
 *
 * setup-worktree.mjs links node_modules, frontend/node_modules and backend/.venv to the main checkout's own folders,
 * and older copies were linked by hand. Deleting a worktree the ordinary way can follow such a link and empty the
 * main checkout's packages. So every link in the copy (outside real node_modules and .git) is taken away first
 * (only the link, never what it points to), then git removes the worktree.
 *
 * Never removed: the main checkout, a copy with changes that are not committed, a copy whose commits are not all on
 * origin/main, a copy git has locked, and a copy something is still open inside (it says so).
 * "Stale" means: no uncommitted changes and its last commit already on origin/main.
 */
import { execSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const git = (c, cwd) => execSync(`git ${c}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const here = process.cwd();
const main = resolve(dirname(resolve(git('rev-parse --show-toplevel', here), git('rev-parse --git-common-dir', here))));

// Every link inside the copy, not following links and not walking real package folders.
function links(dir, depth = 0, out = []) {
  if (depth > 4) return out;
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const n of names) {
    const p = join(dir, n);
    let st;
    try { st = lstatSync(p); } catch { continue; }
    if (st.isSymbolicLink()) out.push(p);
    else if (st.isDirectory() && n !== '.git' && n !== 'node_modules' && n !== '.venv') links(p, depth + 1, out);
  }
  // A node_modules or .venv that is itself a link was caught above; one that is a real folder belongs to the copy.
  return out;
}

function why_not(top, info) {
  if (resolve(top) === main) return 'the main checkout';
  if (info.locked) return 'locked by git';
  if (!existsSync(top)) return 'folder already gone (run git worktree prune)';
  if (git('status --porcelain', top)) return 'has changes that are not committed';
  try { git('merge-base --is-ancestor HEAD origin/main', top); } catch { return 'has commits that are not on main'; }
  return '';
}

function remove(top) {
  for (const l of links(top)) {
    unlinkSync(l); // removes the link only
    console.log(`  link removed: ${l.slice(top.length + 1)}`);
  }
  process.chdir(main); // Windows will not delete a folder a program is standing in
  try {
    git(`worktree remove --force "${top}"`, main);
    console.log(`OK      removed ${top}`);
    return true;
  } catch (e) {
    console.log(`FAILED  ${top}: ${String(e.stderr || e.message).trim()}\n        (usually a terminal, editor or dev server is still open inside it)`);
    return false;
  }
}

function worktrees() {
  const out = [];
  let cur = null;
  for (const line of git('worktree list --porcelain', main).split('\n')) {
    if (line.startsWith('worktree ')) out.push(cur = { path: resolve(line.slice(9)) });
    else if (cur && line.startsWith('branch ')) cur.branch = line.slice(7).replace('refs/heads/', '');
    else if (cur && line.startsWith('locked')) cur.locked = true;
  }
  return out;
}

const args = process.argv.slice(2);
try { git('fetch -q origin main', main); } catch { /* offline: compare with the last fetched main */ }

if (args.includes('--stale')) {
  const yes = args.includes('--yes');
  const all = worktrees().filter((w) => w.path !== main);
  const stale = [];
  for (const w of all) {
    const no = why_not(w.path, w);
    console.log(`${no ? 'KEEP   ' : 'STALE  '} ${w.path}${w.branch ? ` [${w.branch}]` : ''}${no ? `: ${no}` : ''}`);
    if (!no) stale.push(w.path);
  }
  console.log(`\n${stale.length} of ${all.length} copies are stale.`);
  if (!yes) {
    if (stale.length) console.log('Nothing was deleted. Run again with --yes to remove the stale ones.');
    process.exit(0);
  }
  let failed = 0;
  for (const p of stale) if (!remove(p)) failed += 1;
  process.exit(failed ? 1 : 0);
}

const target = args[0] && resolve(args[0]);
if (!target) {
  console.log('Usage: node scripts/remove-worktree.mjs <path> | --stale [--yes]');
  process.exit(2);
}
const info = worktrees().find((w) => w.path === target);
if (!info) { console.log(`Not a worktree of this repo: ${target}`); process.exit(1); }
const no = why_not(target, info);
// A single named copy may have commits not on main (its branch is kept by git); only uncommitted work blocks it.
if (no && no !== 'has commits that are not on main') { console.log(`Not removed: ${no}.`); process.exit(1); }
process.exit(remove(target) ? 0 : 1);

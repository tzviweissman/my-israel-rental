/**
 * Make a fresh worktree (a second copy of the code made with `git worktree add`) ready to run, in one step
 * (16 Nov 2026: each new copy needed its packages linked and its settings copied by hand, and publish-page, the
 * dev server and pytest all fail in a bare one).
 *
 *   node scripts/setup-worktree.mjs        (run from inside the new worktree)
 *
 * From the main checkout it links, never copies: node_modules (repo root, for Playwright), frontend/node_modules
 * and backend/.venv. It copies frontend/.env and backend/.env only where the worktree has none, and never prints
 * them. It turns on the commit check (.githooks). Safe to run twice.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const git = (c) => execSync(`git ${c}`, { encoding: 'utf8' }).trim();
const here = git('rev-parse --show-toplevel');
const main = resolve(dirname(resolve(here, git('rev-parse --git-common-dir'))));
if (resolve(here) === main) {
  console.log('This is the main checkout, nothing to set up.');
  process.exit(0);
}

const say = (ok, what) => console.log(`${ok ? 'OK     ' : 'SKIPPED'} ${what}`);
for (const p of ['node_modules', 'frontend/node_modules', 'backend/.venv']) {
  const from = join(main, p);
  const to = join(here, p);
  if (existsSync(to)) { say(true, `${p} already there`); continue; }
  if (!existsSync(from)) { say(false, `${p}: the main checkout has none`); continue; }
  // A junction on Windows needs no admin rights; elsewhere a plain directory link.
  symlinkSync(from, to, process.platform === 'win32' ? 'junction' : 'dir');
  say(true, `${p} linked to the main checkout`);
}
for (const p of ['frontend/.env', 'backend/.env']) {
  const from = join(main, p);
  const to = join(here, p);
  if (existsSync(to)) { say(true, `${p} already there`); continue; }
  if (!existsSync(from)) { say(false, `${p}: the main checkout has none`); continue; }
  copyFileSync(from, to);
  say(true, `${p} copied (not shown)`);
}
git('config core.hooksPath .githooks');
say(true, 'commit check on (.githooks)');

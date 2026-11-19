#!/usr/bin/env node
// Put your own commits on top of the live main without a checkout, branch switch or stash
// (the shared main checkout carries other sessions' unpushed work; 19 Nov 2026).
//   node scripts/push-onto-main.mjs <commit>... [--push]
// Rebuilds each commit, in order, on origin/main (git merge-tree + commit-tree), parse-checks
// every changed .js/.jsx/.py in the result, and prints the new head. --push sends it to main
// (it restarts the live site: ask Tzvi first), then run scripts/wait-deploy.mjs <head>.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = join(import.meta.dirname, '..');
const git = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', input }).trim();
const push = process.argv.includes('--push');
const commits = process.argv.slice(2).filter((a) => a !== '--push');
if (!commits.length) { console.log('usage: node scripts/push-onto-main.mjs <commit>... [--push]'); process.exit(1); }

git(['fetch', '-q', 'origin']);
let base = git(['rev-parse', 'origin/main']);
const start = base;
for (const c of commits) {
  if (git(['rev-list', '--parents', '-n', '1', c]).split(' ').length > 2) { console.log(`${c} is a merge: push its own commits instead.`); process.exit(1); }
  let tree;
  try { tree = git(['merge-tree', '--write-tree', `--merge-base=${c}^`, base, c]); }
  catch (e) { console.log(`CONFLICT putting ${c} on main:\n${e.stdout}`); process.exit(1); }
  base = git(['commit-tree', tree.split('\n')[0], '-p', base], git(['log', '-1', '--format=%B', c]));
  console.log(`${c} -> ${base.slice(0, 8)}`);
}

const dir = mkdtempSync(join(tmpdir(), 'push-onto-main-'));
const changed = git(['diff', '--name-only', '--diff-filter=AM', start, base]).split('\n').filter(Boolean);
const babel = createRequire(join(root, 'frontend', 'package.json'))('@babel/parser');
const py = join(root, 'backend', '.venv', 'Scripts', 'python');
let bad = 0;
for (const f of changed) {
  const src = git(['show', `${base}:${f}`]);
  try {
    if (/\.(jsx?|mjs)$/.test(f)) babel.parse(src, { sourceType: 'module', plugins: ['jsx'] });
    else if (f.endsWith('.py')) { const p = join(dir, 'x.py'); writeFileSync(p, src); execFileSync(py, ['-c', 'import ast,sys;ast.parse(open(sys.argv[1],encoding="utf8").read())', p]); }
  } catch (e) { bad++; console.log(`DOES NOT PARSE: ${f}\n  ${String(e.message || e).split('\n')[0]}`); }
}
if (bad) process.exit(1);
console.log(`${changed.length} files changed, code parses. New head: ${base}`);
if (!push) { console.log(`Push it: node scripts/push-onto-main.mjs ${commits.join(' ')} --push`); process.exit(0); }
execFileSync('git', ['push', 'origin', `${base}:refs/heads/main`], { cwd: root, stdio: 'inherit' });
console.log(`Pushed. Wait for the deploys: node scripts/wait-deploy.mjs ${base.slice(0, 8)}`);

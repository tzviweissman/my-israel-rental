#!/usr/bin/env node
/**
 * One set of rules, the same everywhere (Tzvi, 1 Nov 2026: "how do we make sure nothing gets skipped because it
 * keeps happening", then "lets bring everything onto main so its all in one place"). The page-builder skill exists
 * twice: in the repo (.claude/skills/build-business-page) and in ~/.claude/skills/build-business-page, the copy
 * every session actually loads. On 1 Nov they had drifted both ways: the repo lacked the 29 Oct ideas rule, the
 * loaded copy lacked the phone-photo rule and step 2b, so each session built without one or the other. The two gate
 * hooks were only in ~/.claude/hooks. This compares every pair and fails on any difference.
 *
 *   node scripts/check-rule-copies.mjs          exit 1 and name the files that differ
 *   node scripts/check-rule-copies.mjs --sync   copy the repo's versions over the loaded ones (the repo is the one home)
 *
 * Run by the commit check whenever a commit touches one of them, so a rule cannot be changed in one copy only.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const HOME = path.join(os.homedir(), '.claude');
const PAIRS = [[path.join(ROOT, '.claude', 'skills', 'build-business-page'), path.join(HOME, 'skills', 'build-business-page')],
  [path.join(ROOT, 'scripts', 'hooks'), path.join(HOME, 'hooks')]];
const sync = process.argv.includes('--sync');
const text = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const walk = (d, base = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name))]);

if (!fs.existsSync(HOME)) { console.log('no ~/.claude on this machine: nothing to compare'); process.exit(0); }
const differ = [];
for (const [repo, home] of PAIRS) {
  if (!fs.existsSync(repo)) continue;
  for (const rel of walk(repo).filter((f) => /\.(md|mjs|js|py|html|css)$/.test(f) && f !== 'README.md')) {
    const a = path.join(repo, rel), b = path.join(home, rel);
    if (fs.existsSync(b) && text(a) === text(b)) continue;
    if (sync) { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); console.log(`synced ${b}`); continue; }
    differ.push(`${path.relative(ROOT, a)} ${fs.existsSync(b) ? 'differs from' : 'is missing from'} ${b}`);
  }
}
if (differ.length) {
  console.log(`The rules are not the same in both places:\n  ${differ.join('\n  ')}\nChange the repo copy, then run: node scripts/check-rule-copies.mjs --sync`);
  process.exit(1);
}
if (!sync) console.log('rule copies: the repo and ~/.claude agree');

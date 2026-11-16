#!/usr/bin/env node
/**
 * Save a rule change in one step, in the right order (16 Nov 2026: rule 3ac went in with a stale contents list because
 * the files were staged first and the lists rebuilt on disk afterwards):
 *   1. check-rule-copies --sync: copies the skill's rules to ~/.claude and rebuilds every contents list (contents.mjs)
 *   2. git add every rules file that changed, plus any extra paths given
 *   3. git commit (the commit check runs as usual)
 *
 *   node scripts/commit-rules.mjs "<message>" [more paths to commit with it]
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILES as CONTENTS_FILES } from './contents.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [msg, ...extra] = process.argv.slice(2);
if (!msg) { console.error('usage: node scripts/commit-rules.mjs "<message>" [more paths]'); process.exit(2); }
const RULE_FILES = [...CONTENTS_FILES, 'docs/rules-as-blueprint/rules.json', 'docs/rules-as-blueprint/ad-rules.json',
  'docs/ad-rules-checklist.md', '.claude/skills/build-business-page/SKILL.md', '.claude/skills/build-business-page/reference/full-rules.md'];
const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' }); if (r.status !== 0) process.exit(r.status || 1); };

run(process.execPath, [path.join(ROOT, 'scripts', 'check-rule-copies.mjs'), '--sync']);
const changed = spawnSync('git', ['diff', 'HEAD', '--name-only', '--', ...RULE_FILES], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
if (!changed.length && !extra.length) { console.error('no rules file has changes to commit'); process.exit(1); }
run('git', ['add', '--', ...changed, ...extra]);
run('git', ['commit', '-m', msg]);

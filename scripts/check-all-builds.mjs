#!/usr/bin/env node
/**
 * Every build's rule checks in one table, before and after a rules change (Tzvi, 22 Nov 2026: the reorder agent typed
 * this loop by hand and briefly stashed its own work inside it). Runs check-rules, check-concept and check-ideas on
 * every folder in scrollcraft/builds and prints pass/FAIL per build. Reads only; changes nothing.
 *
 *   node scripts/check-all-builds.mjs --save before.json      run, print, save the results
 *   node scripts/check-all-builds.mjs --compare before.json   run, print, and list every build that got worse
 *                                                             (exit 1 if any did)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const CHECKS = ['check-rules', 'check-concept', 'check-ideas'];
const builds = fs.readdirSync(path.join(ROOT, 'scrollcraft', 'builds'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.')).map((d) => d.name).sort();

const now = {};
for (const b of builds) {
  now[b] = {};
  for (const c of CHECKS) {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', `${c}.mjs`), path.join(ROOT, 'scrollcraft', 'builds', b)], { cwd: ROOT, encoding: 'utf8' });
    now[b][c] = r.status === 0 ? 'pass' : 'FAIL';
  }
  console.log(`${b.padEnd(28)} ${CHECKS.map((c) => `${c.replace('check-', '')} ${now[b][c]}`.padEnd(16)).join('')}`);
}
const fails = Object.values(now).flatMap((r) => Object.values(r)).filter((v) => v === 'FAIL').length;
console.log(`\n${builds.length} builds, ${builds.length * CHECKS.length - fails} passes, ${fails} failures`);

if (arg('--save')) { fs.writeFileSync(arg('--save'), JSON.stringify(now, null, 1)); console.log(`saved ${arg('--save')}`); }
if (arg('--compare')) {
  const before = JSON.parse(fs.readFileSync(arg('--compare'), 'utf8'));
  const worse = [];
  for (const b of builds) for (const c of CHECKS) if (before[b]?.[c] === 'pass' && now[b][c] === 'FAIL') worse.push(`${b}: ${c} passed before, fails now`);
  console.log(worse.length ? `\nWORSE:\n${worse.join('\n')}` : '\nno build got worse');
  process.exitCode = worse.length ? 1 : 0;
}

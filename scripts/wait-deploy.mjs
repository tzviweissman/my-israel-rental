#!/usr/bin/env node
// Wait for Railway to deploy one commit on the backend and the frontend, saying how long it has been.
//
//   node scripts/wait-deploy.mjs [commit]      (default: HEAD)
//
// Prints each status change with the time since the start, and exits 0 only when both built (SUCCESS).
// SKIPPED means Railway's watch paths did not see that side in the commit's own files (CLAUDE.md, Railway deploy).
// Why it exists: 16 Nov 2026 a normal build was taken for one stuck half an hour after four minutes.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SERVICES = { backend: 'my-israel-rental Backend', frontend: 'My Israel Rental Frontend' };
const DONE = ['SUCCESS', 'SKIPPED', 'FAILED', 'CRASHED', 'REMOVED'];
const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 1 << 26 });

const sha = run('git', ['rev-parse', process.argv[2] || 'HEAD']).stdout.trim();
if (!sha) { console.error('Unknown commit'); process.exit(2); }
// The Railway CLI link lives in the main checkout, not in a worktree.
const main = path.dirname(path.resolve(run('git', ['rev-parse', '--git-common-dir']).stdout.trim()));

const status = (service) => {
  const r = run('railway', ['deployment', 'list', '--service', `"${service}"`, '--json'], main);
  try { return (JSON.parse(r.stdout).find((d) => (d.meta?.commitHash || '') === sha) || {}).status || 'NOT STARTED'; }
  catch { return 'UNKNOWN'; }
};

const start = Date.now();
const since = () => { const s = Math.round((Date.now() - start) / 1000); return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`; };
const seen = {};
console.log(`Waiting for ${sha.slice(0, 8)} (builds usually take 5 to 12 minutes)`);
for (;;) {
  for (const [side, service] of Object.entries(SERVICES)) {
    const s = status(service);
    if (s !== seen[side]) { console.log(`[${since()}] ${side}: ${s}`); seen[side] = s; }
  }
  const all = Object.values(seen);
  const late = Date.now() - start > 40 * 60_000;
  const absent = Date.now() - start > 3 * 60_000 && all.every((s) => s === 'NOT STARTED');
  if (all.every((s) => DONE.includes(s)) || late || absent) break;
  await new Promise((r) => setTimeout(r, 20_000));
}
// REMOVED: a later push's deploy replaced this one, which carries this commit's code too.
const ok = Object.values(seen).every((s) => s === 'SUCCESS' || s === 'REMOVED');
for (const [side, s] of Object.entries(seen)) {
  if (s === 'SKIPPED') console.log(`${side} was SKIPPED: the commit's own files do not touch ${side}/, so nothing of it shipped.`);
  else if (s === 'REMOVED') console.log(`${side}: replaced by a newer deploy, which includes this commit; check that one if in doubt.`);
  else if (s !== 'SUCCESS') console.log(`${side} ended ${s} after ${since()}: look at its build log.`);
}
console.log(ok ? `Both live after ${since()}.` : 'Not both built.');
process.exit(ok ? 0 : 1);

#!/usr/bin/env node
// Is the local API on :8001 (or the port given) running the code on disk?
// On Windows, uvicorn --reload can say "Reloading..." and never finish, and the
// old worker keeps answering: new routes 404 and fixes seem not to work
// (15-18 Nov 2026, twice in one session). This compares the start time of the
// process holding the port (and its children, which own the socket after a
// reload) with the newest change to a backend .py file.
//   node scripts/check-local-api.mjs [port]     exit 1 = stale or not running
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const port = Number(process.argv[2] || 8001);
const backend = join(import.meta.dirname, '..', 'backend');

function newestPy(dir) {
  let best = { t: 0, f: '' };
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['.venv', 'tests', '__pycache__', 'node_modules', 'private_contracts', 'uploads'].includes(e.name) || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    const b = e.isDirectory() ? newestPy(p) : e.name.endsWith('.py') ? { t: statSync(p).mtimeMs, f: p } : best;
    if (b.t > best.t) best = b;
  }
  return best;
}

const ps = `$ErrorActionPreference='SilentlyContinue';
$l = Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess -Unique;
$all = @($l) + @($l | ForEach-Object { Get-CimInstance Win32_Process -Filter "ParentProcessId=$_" | Select-Object -ExpandProperty ProcessId });
$all | ForEach-Object { $p = Get-Process -Id $_; if ($p) { "$_ " + ([DateTimeOffset]$p.StartTime).ToUnixTimeMilliseconds() } }`;
const out = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).trim();
if (!out) { console.log(`Nothing is listening on :${port}. Start it: preview_start "backend" (scripts/dev-backend.ps1).`); process.exit(1); }

const started = Math.max(...out.split(/\r?\n/).map((l) => Number(l.split(' ')[1])));
const code = newestPy(backend);
const fmt = (t) => new Date(t).toLocaleString();
if (code.t > started) {
  console.log(`STALE: the API on :${port} started ${fmt(started)}, but ${code.f.replace(backend, 'backend')} changed ${fmt(code.t)}.`);
  console.log(`Restart it: stop every process on :${port} and its children (Get-NetTCPConnection -LocalPort ${port}; Get-CimInstance Win32_Process -Filter "ParentProcessId=<pid>"), then preview_start "backend".`);
  process.exit(1);
}
console.log(`OK: the API on :${port} started ${fmt(started)}, after the newest backend change (${fmt(code.t)}).`);

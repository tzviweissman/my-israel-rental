#!/usr/bin/env node
// Lists (and with --yes stops) local dev servers and headless browsers left running
// by sessions that finished: python http.server, uvicorn, the CRA/craco dev server,
// serve-builds.mjs, MCP npx helpers and Playwright's chrome-headless-shell.
// Usage: node scripts/stop-stale-servers.mjs [--hours 6] [--yes]
// Default is a dry run. Only processes older than --hours are touched, so a check
// another session is running right now is left alone.
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const hours = Number(args[args.indexOf('--hours') + 1]) || 6;
const yes = args.includes('--yes');

const PATTERNS = [
  /-m http\.server/, /-m uvicorn/, /craco/, /serve-builds\.mjs/,
  /chrome-headless-shell/, /npx-cli\.js" "-y" "@modelcontextprotocol/,
];

const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | ` +
  `Select-Object ProcessId,Name,@{n='Start';e={$_.CreationDate.ToString('o')}},` +
  `@{n='MB';e={[int]($_.WorkingSetSize/1MB)}},CommandLine | ConvertTo-Json -Compress`;
const rows = JSON.parse(execFileSync('powershell', ['-NoProfile', '-Command', ps],
  { encoding: 'utf8', maxBuffer: 64 << 20 }));

const cutoff = Date.now() - hours * 3600e3;
const stale = rows.filter(r => PATTERNS.some(p => p.test(r.CommandLine))
  && new Date(r.Start).getTime() < cutoff);

if (!stale.length) { console.log(`Nothing older than ${hours}h.`); process.exit(0); }
let mb = 0;
for (const r of stale) {
  mb += r.MB;
  console.log(`${r.ProcessId}\t${r.Start.slice(0, 16)}\t${r.MB} MB\t${r.CommandLine.slice(0, 90)}`);
}
console.log(`\n${stale.length} processes, ${mb} MB, older than ${hours}h.`);
if (!yes) { console.log('Dry run. Add --yes to stop them.'); process.exit(0); }
for (const r of stale) {
  try { process.kill(r.ProcessId); } catch { /* already gone */ }
}
console.log('Stopped.');

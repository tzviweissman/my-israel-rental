#!/usr/bin/env node
/**
 * Run THIS copy's API and app side by side with any other copy's, to look at new backend code on screen
 * (22 Nov 2026: testing free-delivery codes took a hand-started uvicorn, a hand-started frontend and three tries).
 *
 *   node scripts/dev-worktree.mjs            free ports, printed; Ctrl+C stops both
 *   node scripts/dev-worktree.mjs --api 8011 --app 3222
 *
 * The API runs this copy's backend/ (DISABLE_RATE_LIMIT=1, the .env's DEV_AUTOLOGIN still applies, so ?as=owner
 * signs in), and the app is pointed at it with REACT_APP_BACKEND_URL. Both use the local MongoDB: start it first with
 * scripts/dev-backend.ps1 (or the "backend" preview) if it is not running. Run setup-worktree.mjs once in a new copy.
 */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const free = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const up = (url) => fetch(url).then((r) => r.ok).catch(() => false);
const mongoUp = () => new Promise((res) => { const s = net.connect(27017, '127.0.0.1'); s.on('connect', () => { s.end(); res(true); }); s.on('error', () => res(false)); });

const py = ['backend/.venv/Scripts/python.exe', 'backend/.venv/bin/python'].map((p) => path.join(ROOT, p)).find((p) => fs.existsSync(p));
if (!py) { console.error('no backend/.venv here: run node scripts/setup-worktree.mjs first'); process.exit(1); }
if (!fs.existsSync(path.join(ROOT, 'frontend/node_modules'))) { console.error('no frontend/node_modules here: run node scripts/setup-worktree.mjs first'); process.exit(1); }
if (!(await mongoUp())) { console.error('MongoDB is not running on :27017: start it with scripts/dev-backend.ps1 (or the "backend" preview), then run this again'); process.exit(1); }

const api = +(arg('--api') || await free()), app = +(arg('--app') || await free());
const kids = [];
const run = (cmd, opts) => { const c = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], ...opts }); kids.push(c); return c; };
const stop = () => {
  for (const c of kids) {
    try { if (process.platform === 'win32') execSync(`taskkill /PID ${c.pid} /T /F`, { stdio: 'ignore' }); else process.kill(-c.pid); } catch { /* already gone */ }
  }
};
// any way this is stopped stops both (a timeout's SIGTERM left them running, 22 Nov 2026)
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) process.on(sig, () => { stop(); process.exit(0); });
process.on('exit', stop);

const apiLog = [], appLog = [];
const a = run(`"${py}" -m uvicorn server:app --port ${api}`, { cwd: path.join(ROOT, 'backend'), env: { ...process.env, DISABLE_RATE_LIMIT: '1' } });
a.stdout.on('data', (d) => apiLog.push(String(d))); a.stderr.on('data', (d) => apiLog.push(String(d)));
const f = run('npm --prefix frontend start', { cwd: ROOT, env: { ...process.env, PORT: String(app), BROWSER: 'none', REACT_APP_BACKEND_URL: `http://localhost:${api}` } });
f.stdout.on('data', (d) => appLog.push(String(d))); f.stderr.on('data', (d) => appLog.push(String(d)));
for (const [c, name, log] of [[a, 'API', apiLog], [f, 'app', appLog]]) {
  c.on('exit', (code) => { console.error(`the ${name} stopped (exit ${code}). Its last lines:\n${log.join('').split('\n').slice(-15).join('\n')}`); stop(); process.exit(1); });
}

console.log(`starting this copy's API on :${api} and app on :${app} (the app takes a minute or two)...`);
const t0 = Date.now();
for (let apiOk = false, appOk = false; !(apiOk && appOk);) {
  if (Date.now() - t0 > 300000) { console.error('not up after 5 minutes'); process.exit(1); }
  await new Promise((r) => setTimeout(r, 2000));
  apiOk = apiOk || await up(`http://localhost:${api}/api/health`);
  appOk = appOk || await up(`http://localhost:${app}/`);
}
console.log(`ready:\n  API  http://localhost:${api}/api\n  app  http://localhost:${app}/dashboard?as=owner\n  tests: TEST_API_BASE=http://localhost:${api}/api\nCtrl+C stops both.`);
await new Promise(() => {});

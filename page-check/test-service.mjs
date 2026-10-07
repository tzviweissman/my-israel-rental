// End-to-end test of the page-check service, locally, touching no real API
// or database: a stand-in API serves one version behind a preview token and
// records the verdict the service posts back. Needs the frontend dev server
// pointed at the stand-in (REACT_APP_BACKEND_URL=http://localhost:8790,
// PORT=3212) and a payload file from scripts/page-v3-effects-fixtures.py.
//   Run: node page-check/test-service.mjs fx.json [label]
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const fixtures = JSON.parse(await readFile(process.argv[2], 'utf8'));
const good = fixtures.find((f) => f.label === (process.argv[3] || 'rich-cover-0')).biz;
// The same page with its text the colour of its ground: the check must fail it.
const broken = { ...good, design_brief: { ...good.design_brief, palette: { ...good.design_brief.palette, text: good.design_brief.palette.ground } } };
const SECRET = 'local-test-secret-not-real';
const TOKENS = { 'good-token-aaaaaaaaaaaaaaaaaaaa': good, 'broken-token-aaaaaaaaaaaaaaaaaa': broken };
const verdicts = {};

const api = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const u = new URL(req.url, 'http://x');
  const m = u.pathname.match(/^\/api\/marketplace\/businesses\/[^/]+\/page-versions\/([a-f0-9]{32})\/check$/);
  if (m && req.method === 'POST') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      verdicts[m[1]] = { secret: req.headers['x-page-check-secret'] === SECRET, ...JSON.parse(raw) };
      res.writeHead(200); res.end('{}');
    });
    return undefined;
  }
  if (u.pathname.startsWith('/api/marketplace/business/')) {
    const biz = TOKENS[u.searchParams.get('pv')];
    // No valid token: the live page, which here is not a v3 page.
    const body = biz || { ...good, page_v3: undefined, design_brief: undefined };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(body));
  }
  res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}');
  return undefined;
});
await new Promise((r) => api.listen(8790, r));

const svc = spawn(process.execPath, ['page-check/server.mjs'], {
  env: { ...process.env, PAGE_CHECK_SECRET: SECRET, SITE_URL: 'http://localhost:3212', API_URL: 'http://localhost:8790/api', PORT: '8791' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
svc.stdout.on('data', (d) => process.stdout.write(`  [service] ${d}`));
svc.stderr.on('data', (d) => process.stdout.write(`  [service] ${d}`));
await new Promise((r) => setTimeout(r, 1500));

const fails = [];
const post = (body, secret = SECRET) => fetch('http://localhost:8791/check', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Page-Check-Secret': secret }, body: JSON.stringify(body),
});
const job = (version, token) => ({ business_id: 'biz1', slug: 'rp-exp', version_id: version, token });
const V = { good: 'a'.repeat(32), broken: 'b'.repeat(32), expired: 'c'.repeat(32) };

const health = await (await fetch('http://localhost:8791/health')).json();
if (!health.ok) fails.push('health does not answer ok');
if ((await post(job(V.good, 'good-token-aaaaaaaaaaaaaaaaaaaa'), 'wrong')).status !== 403) fails.push('a wrong secret was not refused');
if ((await post({ ...job(V.good, 'good-token-aaaaaaaaaaaaaaaaaaaa'), slug: '../admin' })).status !== 400) fails.push('a bad slug was not refused');
for (const [k, t] of [['good', 'good-token-aaaaaaaaaaaaaaaaaaaa'], ['broken', 'broken-token-aaaaaaaaaaaaaaaaaa'], ['expired', 'expired-token-aaaaaaaaaaaaaaaaa']]) {
  if ((await post(job(V[k], t))).status !== 202) fails.push(`the ${k} job was not queued`);
}
const t0 = Date.now();
while (Object.keys(verdicts).length < 3 && Date.now() - t0 < 15 * 60 * 1000) await new Promise((r) => setTimeout(r, 2000));
svc.kill();
api.close();

const v = (k) => verdicts[V[k]];
if (!v('good') || !v('good').passed) fails.push(`the good version did not pass: ${JSON.stringify(v('good') && v('good').failures.slice(0, 3))}`);
if (!v('broken') || v('broken').passed) fails.push('the broken version passed');
else if (!v('broken').failures.some((f) => /too faint/.test(f))) fails.push(`the broken version failed for the wrong reason: ${v('broken').failures[0]}`);
if (!v('expired') || v('expired').passed || !/did not open/.test(v('expired').failures[0])) fails.push('the expired link was not reported as such');
if (Object.values(verdicts).some((x) => !x.secret)) fails.push('a verdict was posted without the secret');
console.log(fails.length ? `FAIL\n${fails.join('\n')}` : `PASS: service refuses bad jobs, passes the good version, fails the broken one and the expired link (${Math.round((Date.now() - t0) / 1000)}s)`);
process.exit(fails.length ? 1 : 0);

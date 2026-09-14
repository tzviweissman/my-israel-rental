#!/usr/bin/env node
/**
 * Business subdomains, end to end through frontend/server.js.
 *
 * WHY. blazinboards.myisraelrental.com is the same page as
 * /business/blazinboards, and the decision about what a Host header means
 * is made in three places (backend slug minting, the Node server, the
 * browser app). This checks that the three agree, and that the server:
 *
 *   * gives a link-preview crawler the BUSINESS card on a business host,
 *     where the path is "/" and the old path matcher would have missed it;
 *   * does the same for a retired address, canonicalised to the live one;
 *   * serves the app, and the build's own files, on a business host;
 *   * sends every other path on a business host to the main site;
 *   * still proxies /api first, and leaves the apex, www and reserved
 *     hosts alone.
 *
 * Needs the built bundle and the local API (DISABLE_RATE_LIMIT=1, since it
 * registers two accounts):
 *
 *   cd frontend && npm run build
 *   node scripts/test-business-hosts.mjs
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const serverRules = require(join(ROOT, 'frontend', 'businessHost.js'));
const appRules = await import(pathToFileURL(join(ROOT, 'frontend', 'src', 'utils', 'businessHost.js')).href);

const APEX = 'myisraelrental.com';
const API = process.env.CHECK_API || 'http://localhost:8001';
const PORT = Number(process.env.CHECK_PORT) || 3998;
const BOT_UA = 'WhatsApp/2.23.20.0 A';
const HUMAN_UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/126 Safari/537.36';

let fails = 0;
const check = (name, cond, detail = '') => {
  if (!cond) fails += 1;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${!cond && detail ? ` - ${detail}` : ''}`);
};

// ---------------------------------------------------------------- 1. parsing
const CASES = [
  ['myisraelrental.com', null], ['www.myisraelrental.com', null],
  ['blazinboards.myisraelrental.com', 'blazinboards'], ['BlazinBoards.MyIsraelRental.com', 'blazinboards'],
  ['blazinboards.myisraelrental.com:8443', 'blazinboards'], ['blazinboards.myisraelrental.com.', 'blazinboards'],
  ['api.myisraelrental.com', null], ['a.b.myisraelrental.com', null], ['-x.myisraelrental.com', null],
  ['myisraelrental.com.evil.com', null], ['x.other.com', null], ['', null], [undefined, null], ['[::1]:3000', null],
];
for (const [host, want] of CASES) {
  check(`server parses ${JSON.stringify(host)}`, serverRules.slugFromHost(host, APEX) === want, serverRules.slugFromHost(host, APEX));
  check(`app parses ${JSON.stringify(host)}`, appRules.slugFromHost(host, APEX) === want, appRules.slugFromHost(host, APEX));
}

// ------------------------------------------------ 2. one list, three copies
const py = readFileSync(join(ROOT, 'backend', 'utils', 'businesses.py'), 'utf8');
const pyBlock = /RESERVED_SLUGS = frozenset\("""([\s\S]*?)"""/.exec(py);
const pySet = new Set((pyBlock ? pyBlock[1] : '').split(/\s+/).filter(Boolean));
const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
check('reserved list: backend has one', pySet.size > 40, pySet.size);
check('reserved list: server copy matches backend', same(pySet, serverRules.RESERVED_SLUGS));
check('reserved list: app copy matches backend', same(pySet, appRules.RESERVED_SLUGS));
check('slug pattern: server and app agree', String(serverRules.SLUG_PATTERN) === String(appRules.SLUG_PATTERN));

// ---------------------------------------------------- 3. the running server
const BUILD = join(ROOT, 'frontend', 'build');
if (!existsSync(join(BUILD, 'index.html'))) {
  console.log('\nSKIP server checks: frontend/build is missing (npm run build)');
} else {
  const json = async (method, url, body, token) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${text.slice(0, 200)}`);
    return JSON.parse(text);
  };

  // A business with a live address AND a retired one.
  const stamp = Date.now().toString(36);
  const { token } = await json('POST', `${API}/api/auth/register`, {
    email: `hosts-${stamp}@example.com`, password: `Pw-${stamp}-ok1`, name: 'Host Check', role: 'owner',
  });
  const name = `Host Check ${stamp}`;
  const biz = await json('POST', `${API}/api/marketplace/businesses`, { name }, token);
  const retired = `hostcheck-old-${stamp}`;
  const live = `hostcheck-${stamp}`;
  await json('PUT', `${API}/api/marketplace/businesses/${biz.id}/web-address`, { address: retired }, token);
  await json('PUT', `${API}/api/marketplace/businesses/${biz.id}/web-address`, { address: live }, token);

  const server = spawn(process.execPath, [join(ROOT, 'frontend', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), OG_API_ORIGIN: API, API_PROXY_TARGET: API, PUBLIC_SITE_HOST: APEX },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  // Raw http, not fetch: fetch will not let a caller set Host.
  const get = (path, { host, ua = HUMAN_UA } = {}) => new Promise((ok, bad) => {
    const headers = { 'user-agent': ua };
    if (host !== undefined) headers.host = host;
    const req = http.request({ host: '127.0.0.1', port: PORT, path, method: 'GET', headers, setHost: host === undefined }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => ok({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', bad);
    req.end();
  });

  for (let i = 0; i < 60; i += 1) {
    try { await get('/'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  try {
    const bizHost = `${live}.${APEX}`;
    const canonical = `https://${APEX}/business/${live}`;

    let r = await get('/', { host: bizHost, ua: BOT_UA });
    check('bot on a business host gets the business card', r.status === 200 && r.body.includes(`content="${name}"`), r.body.slice(0, 200));
    check('...with the canonical', r.body.includes(`<link rel="canonical" href="${canonical}"/>`));

    r = await get('/', { host: `${retired}.${APEX}`, ua: BOT_UA });
    check('bot on a RETIRED address gets the same business', r.body.includes(`content="${name}"`));
    check('...canonicalised to the live address', r.body.includes(`<link rel="canonical" href="${canonical}"/>`));

    r = await get('/', { host: `BlazinCase-${live}.${APEX}:443`.replace('BlazinCase-', '').toUpperCase(), ua: BOT_UA });
    check('an upper-case host with a port still resolves', r.body.includes(`content="${name}"`));

    r = await get('/', { host: bizHost });
    check('a person on a business host gets the app', r.status === 200 && r.body.includes('id="root"'), r.status);

    const mainJs = readdirSync(join(BUILD, 'static', 'js')).find((f) => /^main\.[0-9a-f]+\.js$/.test(f));
    r = await get(`/static/js/${mainJs}`, { host: bizHost });
    check('the build\'s own files load on a business host', r.status === 200 && /javascript/.test(r.headers['content-type'] || ''), r.status);

    r = await get('/businesses/123?src=qr', { host: bizHost });
    check('any other path on a business host goes to the main site', r.status === 302 && r.headers.location === `https://${APEX}/businesses/123?src=qr`, `${r.status} ${r.headers.location}`);

    r = await get('/api/health', { host: bizHost });
    check('/api on a business host is still the API', r.status === 200 && r.body.includes('"status"'), `${r.status} ${r.body.slice(0, 80)}`);

    r = await get(`/business/${live}`, { host: APEX, ua: BOT_UA });
    check('the path form still previews on the apex', r.body.includes(`content="${name}"`));

    for (const host of [APEX, `www.${APEX}`, `api.${APEX}`]) {
      r = await get('/stays', { host });
      check(`${host} is not treated as a business`, r.status === 200 && r.body.includes('id="root"'), r.status);
    }

    r = await get('/', { host: '' });
    check('an empty Host header is served normally', r.status === 200, r.status);

    r = await get('/', { host: `nobody-${stamp}.${APEX}`, ua: BOT_UA });
    check('an unclaimed subdomain falls back to the generic card, not an error', r.status === 200 && r.body.includes('<title>'), r.status);

    const security = await get('/', { host: bizHost, ua: BOT_UA });
    check('security headers on the subdomain card', security.headers['strict-transport-security'] === 'max-age=15552000; includeSubDomains'
      && security.headers['x-content-type-options'] === 'nosniff');
  } finally {
    server.kill();
  }
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'}`);
process.exit(fails ? 1 : 0);

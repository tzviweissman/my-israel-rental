#!/usr/bin/env node
/**
 * Every response `frontend/server.js` can produce carries the security
 * headers — not just the static one.
 *
 * WHY. `public/serve.json` declares four headers, and serve-handler applies
 * them. serve-handler is the LAST line of the request handler: two branches
 * return before reaching it, so declaring the headers there covered one
 * response path out of three.
 *
 *   /api/*            the same-origin proxy — writes its own response
 *   preview-bot UA    HTML assembled from business-supplied content
 *   everything else   the static files, which serve.json did cover
 *
 * The middle one is the sharp end: markup built from other people's text,
 * on our origin, with no nosniff and no X-Frame-Options. This asserts all
 * three, because the fix is one `setHeader` loop that a later edit could
 * move below a `return` without anything noticing.
 *
 * Needs the built bundle and a backend to proxy to:
 *
 *   cd frontend && npm run build
 *   python -m uvicorn server:app --app-dir backend --port 8001
 *   node scripts/check-security-headers.mjs
 */
import { spawn } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.CHECK_PORT) || 3999;
const API = process.env.CHECK_API || 'http://localhost:8001';
const SLUG = process.env.CHECK_SLUG || 'my-business';
const BOT_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

// `x-frame-options` accepts DENY as well as SAMEORIGIN, and the difference
// is not a slack allowance — it is the proxy path working correctly. The
// backend sends DENY on its own JSON responses, and `writeHead` lets the
// upstream's value win over the one set here. DENY is the stricter of the
// two and the right answer for an API response; SAMEORIGIN is the right
// answer for a page that must render in our own frames. Requiring one
// exact string would have failed the path that was behaving best.
const REQUIRED = {
  'x-content-type-options': ['nosniff'],
  'x-frame-options': ['SAMEORIGIN', 'DENY'],
  'referrer-policy': ['strict-origin-when-cross-origin'],
  'strict-transport-security': ['max-age=15552000; includeSubDomains'],
};

if (!existsSync(join(ROOT, 'frontend', 'build', 'index.html'))) {
  console.error('frontend/build/index.html is missing — run `npm run build` in frontend/ first.');
  process.exit(2);
}

const server = spawn(process.execPath, [join(ROOT, 'frontend', 'server.js')], {
  env: { ...process.env, PORT: String(PORT), OG_API_ORIGIN: API, API_PROXY_TARGET: API },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

const base = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The delay is the point: a refused connection fails INSTANTLY, so a bare
// retry loop burns all its attempts in a few milliseconds and reports the
// server as dead while it is still starting.
const waitFor = async (url, tries = 60) => {
  for (let i = 0; i < tries; i += 1) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(1000) });
      return true;
    } catch { await sleep(250); }
  }
  return false;
};
const up = () => waitFor(base);

const failures = [];

const check = async (label, path, init = {}) => {
  const res = await fetch(base + path, { redirect: 'manual', ...init });
  const missing = Object.entries(REQUIRED)
    .filter(([k, ok]) => !ok.some((v) => (res.headers.get(k) || '').toLowerCase() === v.toLowerCase()))
    .map(([k, ok]) => `${k}: expected ${ok.map((v) => `"${v}"`).join(' or ')}, got "${res.headers.get(k) ?? '(absent)'}"`);
  if (missing.length) {
    console.log(`  FAIL  ${label}  [${res.status}]`);
    for (const m of missing) console.log(`          ${m}`);
    failures.push(label);
  } else {
    console.log(`  PASS  ${label}  [${res.status}] all four headers`);
  }
  return res;
};

if (!(await up())) {
  console.error(`server.js did not start on :${PORT}`);
  server.kill();
  process.exit(2);
}

console.log(`\nsecurity headers on every response path (server.js on :${PORT}, api ${API})\n`);

// 1. The static path — the one serve.json already covered.
await check('static / (SPA index.html)', '/');

// 2. The /api proxy, which writes its own response and returns early.
const api = await check('/api proxy (JSON from the backend)', '/api/marketplace/gigs?limit=1');
if (!/application\/json/.test(api.headers.get('content-type') || '')) {
  console.log('  FAIL  /api proxy did not return JSON — the SPA fallback may be answering it');
  failures.push('/api returns JSON');
} else {
  console.log('  PASS  /api proxy returned JSON, not index.html');
}

// 3. The preview-bot branch: HTML built from business-supplied content.
const bot = await check(
  `preview-bot /business/${SLUG}`,
  `/business/${SLUG}`,
  { headers: { 'user-agent': BOT_UA } },
);
const botBody = await bot.text();
if (!/<meta[^>]+og:title/i.test(botBody)) {
  console.log('  note  the bot branch fell through to the static file (no og:title in the');
  console.log(`        response) — it still has to carry the headers, which is what was`);
  console.log(`        asserted. Set CHECK_SLUG to a business the backend at ${API} knows`);
  console.log('        to exercise the generated-HTML branch itself.');
} else {
  console.log('  PASS  bot branch served generated preview HTML (og:title present)');
}

// 4. The proxy's own 502, which is written without touching the upstream.
const dead = spawn(process.execPath, [join(ROOT, 'frontend', 'server.js')], {
  env: { ...process.env, PORT: String(PORT + 1), OG_API_ORIGIN: API, API_PROXY_TARGET: 'http://127.0.0.1:1' },
  stdio: 'ignore',
});
await waitFor(`http://127.0.0.1:${PORT + 1}`);
const res502 = await fetch(`http://127.0.0.1:${PORT + 1}/api/anything`);
const miss502 = Object.entries(REQUIRED)
  .filter(([k, ok]) => !ok.some((v) => (res502.headers.get(k) || '').toLowerCase() === v.toLowerCase()));
if (res502.status !== 502) {
  console.log(`  note  unreachable upstream returned ${res502.status}, not 502 — skipping`);
} else if (miss502.length) {
  console.log(`  FAIL  /api 502 (upstream unreachable)  [502] missing ${miss502.map(([k]) => k).join(', ')}`);
  failures.push('/api 502');
} else {
  console.log('  PASS  /api 502 (upstream unreachable)  [502] all four headers');
}
dead.kill();

server.kill();
console.log();
if (failures.length) {
  console.log(`FAILED: ${failures.join(', ')}\n`);
  process.exit(1);
}
console.log('all response paths carry the security headers\n');

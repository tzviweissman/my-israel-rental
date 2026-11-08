#!/usr/bin/env node
/**
 * The API proxy in server.js sends a GET once more when the connection drops before any reply (8 Nov 2026,
 * "Failed to load marketplace" after clearing a search). A fake API drops the first connection of every
 * request path; a GET must still come back 200 (second try), a POST must come back 502 (never resent).
 *
 *   node frontend/scripts/test-proxy-retry.js      exit 1 when it fails
 */
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const seen = new Map();
const api = http.createServer((req, res) => {
  const n = (seen.get(req.method + req.url) || 0) + 1;
  seen.set(req.method + req.url, n);
  if (n === 1) { req.socket.destroy(); return; } // the dropped connection
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, try: n }));
});

const get = (port, method) => new Promise((resolve) => {
  const r = http.request({ port, method, path: '/api/marketplace/gigs?limit=0' }, (res) => {
    let body = ''; res.on('data', (c) => { body += c; }); res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  r.on('error', (e) => resolve({ status: 0, body: e.message }));
  r.end(method === 'POST' ? '{}' : undefined);
});

api.listen(0, async () => {
  const apiPort = api.address().port, port = 3900 + Math.floor(Math.random() * 90);
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` }, stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 1500));
  const g = await get(port, 'GET');
  seen.clear();
  const p = await get(port, 'POST');
  srv.kill(); api.close();
  const ok = g.status === 200 && /"try":2/.test(g.body) && p.status === 502;
  console.log(`GET ${g.status} ${g.body} | POST ${p.status}`);
  console.log(ok ? 'proxy retry: ok' : 'proxy retry: FAILED');
  process.exit(ok ? 0 : 1);
});

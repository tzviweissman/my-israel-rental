#!/usr/bin/env node
/**
 * Serves scrollcraft/builds at http://127.0.0.1:8990/<folder>/ for the page checks
 * (check-build.mjs and the scripts it runs read from here; CHECK_BASE changes it).
 * The checks named this file but it was never committed; recreated 29 Oct 2026 for Krysp.
 *
 *   node scripts/serve-builds.mjs [port]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'scrollcraft', 'builds');
const PORT = Number(process.argv[2] || process.env.PORT || 8990);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

// A port already taken is never served over in silence (27 Nov 2026, Boxed Israel: another session's server held the
// port, so every screenshot was of its 404 page for a build it did not have). Each server answers /__root with the
// folder it serves; a second start on a taken port says whose it is and prints a free port to use instead.
const server = http.createServer((req, res) => {
  if (req.url === '/__root') { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); return res.end(ROOT); }
  let p = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { location: p + '/' }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
  // part-of-file requests (Range), as every real server answers: without them a video cannot jump to a moment, and a
  // film tied to the scroll stood still (Krysp, 4 Nov 2026)
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', size = fs.statSync(file).size;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (!m || (!m[1] && !m[2])) { res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' }); return fs.createReadStream(file).pipe(res); }
  const start = m[1] ? +m[1] : Math.max(0, size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
  if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end(); }
  res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
  fs.createReadStream(file, { start, end }).pipe(res);
});
server.on('error', async (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  const theirs = await fetch(`http://127.0.0.1:${PORT}/__root`, { signal: AbortSignal.timeout(3000) }).then((r) => (r.ok ? r.text() : '')).catch(() => '');
  if (path.resolve(theirs || '.') === ROOT) { console.log(`builds already served from this checkout on http://127.0.0.1:${PORT}/ (reuse it)`); process.exit(0); }
  const free = await new Promise((ok) => { const s = http.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
  console.error(`port ${PORT} is taken by ${theirs ? `a server for another checkout (${theirs})` : 'another program'}; its pages are not this checkout's builds.\n`
    + `Start on a free port instead: node scripts/serve-builds.mjs ${free}   (and pass CHECK_BASE=http://127.0.0.1:${free} to the checks)`);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => console.log(`builds on http://127.0.0.1:${PORT}/`));

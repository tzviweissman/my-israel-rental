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

http.createServer((req, res) => {
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
}).listen(PORT, '127.0.0.1', () => console.log(`builds on http://127.0.0.1:${PORT}/`));

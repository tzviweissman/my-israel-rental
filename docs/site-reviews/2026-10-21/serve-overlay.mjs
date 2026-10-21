// serves <overlay> first, then falls back to <base> for anything the overlay does not have
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const [overlay, base, port] = process.argv.slice(2);
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.gif': 'image/gif' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  for (const root of [overlay, base]) {
    const f = path.join(root, p); if (!f.startsWith(path.resolve(root))) continue;
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      const st = fs.statSync(f), type = T[path.extname(f).toLowerCase()] || 'application/octet-stream', range = req.headers.range;
      if (range) { const [a, b] = range.replace('bytes=', '').split('-'); const s = +a, e = b ? +b : st.size - 1;
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${s}-${e}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1 }); fs.createReadStream(f, { start: s, end: e }).pipe(res); return; }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(res); return;
    }
  }
  res.writeHead(404); res.end('not found');
}).listen(+port, () => console.log('overlay on', port));

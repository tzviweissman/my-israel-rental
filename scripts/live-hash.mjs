/**
 * A fingerprint of a live page folder (frontend/public/pages/<slug>), so the commit check can tell a page that
 * publish-page.mjs wrote from one edited by hand afterwards (24 Oct 2026: L.A. Cholent's olive panel was changed
 * on the live page only, so its build fell behind and the next publish would have undone it).
 * Text files are hashed with LF line endings, so a CRLF checkout gives the same fingerprint.
 * publish-page.mjs records it in scrollcraft/published.json; scripts/pre-commit-check.mjs compares it.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const TEXT = /\.(html|css|js|mjs|json|txt|svg|md)$/i;

export function liveHash(dir) {
  const h = crypto.createHash('sha1');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1)).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    let buf = fs.readFileSync(p);
    if (TEXT.test(e.name)) buf = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'));
    h.update(path.relative(dir, p).replace(/\\/g, '/')).update('\0').update(buf).update('\0');
  });
  walk(dir);
  return h.digest('hex');
}

export const PUBLISHED = (root) => path.join(root, 'scrollcraft', 'published.json');

export function readPublished(root) {
  try { return JSON.parse(fs.readFileSync(PUBLISHED(root), 'utf8')); } catch { return {}; }
}

export function recordPublished(root, slug, folder, dir) {
  const all = readPublished(root);
  all[slug] = { folder, hash: liveHash(dir) };
  const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]));
  fs.writeFileSync(PUBLISHED(root), `${JSON.stringify(sorted, null, 2)}\n`);
}

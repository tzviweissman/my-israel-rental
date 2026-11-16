/**
 * The work we do by hand for businesses, for the live work stream (GET /api/site/work): every business website we
 * built and every ad we made (Tzvi, 16 Nov 2026: "all our website builds and ads we make for businesses should also
 * be coming up"). Those live in git, not the database, so this writes them to backend/data/work_log.json, which the
 * API reads alongside the database rows.
 *
 *   node scripts/build-work-log.mjs        (publish-page.mjs runs it after every publish)
 *
 *  - a website: when frontend/public/pages/<slug>/index.html was first committed (its first publish)
 *  - an ad: when docs/ads/<name>-status-ad.jpg or docs/ads/gen/<name>/ad.html was first committed; our own
 *    MyIsraelRental ads and the design samples are left out
 * Each is tied to its business through frontend/public/showcase/showcase.json (slug, name, business_id), so the
 * stream can name its area. An ad whose business cannot be found is left out and named here.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const showcase = JSON.parse(readFileSync(join(ROOT, 'frontend/public/showcase/showcase.json'), 'utf8'));
const n = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// First commit that added each matching file: [{ at, path }].
function added(...paths) {
  const out = execSync(`git log --diff-filter=A --format=@%aI --name-only -- ${paths.map((p) => `"${p}"`).join(' ')}`,
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const rows = [];
  let at = '';
  for (const line of out.split('\n')) {
    if (line.startsWith('@')) at = line.slice(1);
    else if (line.trim()) rows.push({ at, path: line.trim() });
  }
  return rows;
}

// An ad's name ("la-cholent-chanukah", "mn-jewelry-infinity") to its business: the longest run of its first words
// that starts a business's slug or name. "mn" is how the ad files spell M and N.
function businessFor(adName) {
  const words = adName.split('-');
  for (let k = words.length; k >= Math.min(2, words.length); k -= 1) {
    const q = n(words.slice(0, k).join('')).replace(/^mn/, 'mandn');
    const hit = showcase.find((b) => n(b.slug).startsWith(q) || n(b.name).startsWith(q));
    if (hit) return hit;
  }
  return null;
}

const rows = [];
for (const { at, path } of added('frontend/public/pages/*/index.html')) {
  const slug = path.split('/')[3];
  const biz = showcase.find((b) => b.slug === slug);
  rows.push({ kind: 'site_built', business_id: biz?.business_id || null, at, ref: slug });
}
const missed = [];
for (const { at, path } of added('docs/ads/*-status-ad.jpg', 'docs/ads/gen/*/ad.html')) {
  const name = path.startsWith('docs/ads/gen/') ? path.split('/')[3] : path.split('/')[2].replace(/-status-ad\.jpg$/, '');
  if (/^(myisraelrental|mir-|design-)/.test(name)) continue;
  const biz = businessFor(name);
  if (!biz) { missed.push(name); continue; }
  rows.push({ kind: 'ad_made', business_id: biz.business_id || null, at, ref: name });
}
rows.sort((a, b) => (a.at < b.at ? 1 : -1));
mkdirSync(join(ROOT, 'backend/data'), { recursive: true });
writeFileSync(join(ROOT, 'backend/data/work_log.json'), `${JSON.stringify(rows, null, 1)}\n`);
console.log(`work log: ${rows.filter((r) => r.kind === 'site_built').length} websites, ${rows.filter((r) => r.kind === 'ad_made').length} ads`
  + (missed.length ? `; no business found for: ${missed.join(', ')}` : ''));

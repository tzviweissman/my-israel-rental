#!/usr/bin/env node
// Every tile on the business pages list shows its page as it is now (Tzvi,
// 18 Oct 2026: The Gift Boutique's tile showed an older version of its page).
// showcase-preview.mjs stores a hash of the published page in showcase.json;
// this fails when a page has changed since its clip was made.
//   node scripts/check-showcase-previews.mjs
// Fix: node scripts/showcase-preview.mjs <slug> <url> (publish-page.mjs does
// it automatically for a listed page).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend/public/showcase/showcase.json'), 'utf8'));
const stale = [];
for (const item of list) {
  const page = path.join(ROOT, 'frontend/public/pages', item.slug, 'index.html');
  if (!fs.existsSync(page)) continue;
  const now = crypto.createHash('sha1').update(fs.readFileSync(page)).digest('hex').slice(0, 12);
  if (item.page !== now) stale.push(`${item.slug}: the page changed since its preview was made${item.page ? '' : ' (never recorded against a page)'}`);
}
if (stale.length) { console.error('Business pages previews out of date:\n  ' + stale.join('\n  ')); process.exit(1); }
console.log(`${list.length} business pages previews match their pages`);

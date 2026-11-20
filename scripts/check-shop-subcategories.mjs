#!/usr/bin/env node
/**
 * Every shop sits in a subcategory, so /businesses can sort it (Tzvi, 20 Nov 2026: "more subcategories for
 * shops and products"). Shops were 27 of 78 live listings, all in one unsorted list.
 *
 *   MIRROR   the shops-products subcategories in backend shared.py and frontend lib/categories.js are the same
 *   MISSING  a live shops-products listing has no subcategory, or one not on the list (names each one)
 *
 *   node scripts/check-shop-subcategories.mjs [--api https://myisraelrental.com/api]   exit 1 on either
 */
import { readFileSync } from 'fs';

const api = process.argv.includes('--api') ? process.argv[process.argv.indexOf('--api') + 1] : 'https://myisraelrental.com/api';
const block = (src, start) => { const i = src.indexOf(start); return src.slice(i, src.indexOf(']', i)); };
const py = [...block(readFileSync('backend/routes/marketplace/shared.py', 'utf8'), '"shops-products": [').matchAll(/"slug":\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
const js = [...block(readFileSync('frontend/src/lib/categories.js', 'utf8'), "'shops-products': [").matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
const why = [];
if (!py.length) why.push('MIRROR: no shops-products subcategories in shared.py');
if (py.join() !== js.join()) why.push(`MIRROR: shared.py has ${py.join(', ')}; categories.js has ${js.join(', ')}`);

const known = new Set(py);
const shops = [];
for (let skip = 0; ; skip += 200) {
  const r = await fetch(`${api}/marketplace/gigs?category=shops-products&limit=200&skip=${skip}`);
  if (!r.ok) { why.push(`LOAD: ${api} answered ${r.status}`); break; }
  const page = await r.json(); shops.push(...page); if (page.length < 200) break;
}
const missing = shops.filter((g) => !known.has(g.subcategory));
if (missing.length) why.push(`MISSING: ${missing.length} of ${shops.length} shops have no subcategory from the list:\n    ${missing.map((g) => `${g.title} (${g.subcategory || 'none'})`).join('\n    ')}`);
if (why.length) { console.log(`SHOP SUBCATEGORIES\n  ${why.join('\n  ')}`); process.exit(1); }
console.log(`shop subcategories: all ${shops.length} shops sorted, lists match`);

#!/usr/bin/env node
/**
 * Everything the business sells can be ordered on its site (Tzvi, 20 Nov 2026; rules 3ah.6). Cakes by Tova's weekly
 * menu listing priced "Specialty Decorated Cakes, Cupcakes, and Cake Pops" at ₪140; the home page mentioned them, but
 * her shop had no way to order one, and Tzvi found it, not a check.
 *
 * Reads the listings in <build>/src/record.json (from fetch_business.py): every tier and product with a price above 1.
 * Each must match an item in the site's catalogue (assets/*.js holding window.<NAME> = {"items": [...]}) with the same
 * price and at least one shared word (three letters or more; "Cakepops" matches "Cake Pops"). One the owner does not sell on the site is named in
 * <build>/not-sold.txt, one per line, "<name as in the listing>: <why>". A site with no catalogue (not a shop) passes.
 *
 *   node scripts/check-listing-prices.mjs <build folder>      exit 1 when something sold is missing
 * Passes on: none outside ours (it reads our own build files); fails Cakes by Tova before 20 Nov 2026, passes after.
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/check-listing-prices.mjs <build folder>'); process.exit(2); }
const recF = path.join(dir, 'src', 'record.json');
if (!fs.existsSync(recF)) { console.log(`${dir}: no src/record.json, nothing to check`); process.exit(0); }
const items = [];
const aDir = path.join(dir, 'assets');
for (const f of fs.existsSync(aDir) ? fs.readdirSync(aDir).filter((x) => x.endsWith('.js')) : []) {
  const m = fs.readFileSync(path.join(aDir, f), 'utf8').match(/window\.\w+\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
  if (!m) continue;
  try { for (const it of JSON.parse(m[1]).items || []) if (it.name && it.price != null) items.push(it); } catch { /* not a catalogue */ }
}
if (!items.length) { console.log(`${dir}: no shop catalogue, nothing to check`); process.exit(0); }
const words = (s) => new Set(String(s).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/)
  .map((w) => (/ss$/.test(w) ? w : w.replace(/s$/, ''))).filter((w) => w.length >= 3 && !['and', 'the', 'for', 'with'].includes(w)));
const squash = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const notF = path.join(dir, 'not-sold.txt');
const notSold = fs.existsSync(notF) ? fs.readFileSync(notF, 'utf8').split('\n').map((l) => l.split(':')[0].trim().toLowerCase()).filter(Boolean) : [];
const rec = JSON.parse(fs.readFileSync(recF, 'utf8'));
const missing = [];
for (const l of rec.listings || []) {
  for (const t of [...(l.tiers || []), ...(l.products || [])]) {
    const price = Number(t.price), name = t.name || t.title || '';
    if (!(price > 1) || !name || notSold.includes(name.trim().toLowerCase())) continue;
    const w = words(name);
    const hit = items.some((it) => Math.abs(Number(it.price) - price) < 0.5 && ([...words(it.name)].some((x) => w.has(x)) || [...w].some((x) => x.length >= 4 && squash(it.name).includes(x))));
    if (!hit) missing.push(`"${name}" (${price} ${t.currency || ''}, listing "${l.title}")`);
  }
}
if (missing.length) {
  console.log(`LISTING  ${dir}\n  ${missing.map((m) => `NOT SOLD: ${m} is priced in the listing but cannot be ordered on the site`).join('\n  ')}\n  ` +
    `Add it to the shop's catalogue at its listing price, or name it in not-sold.txt with why (3ah.6).`);
  process.exit(1);
}
console.log(`${dir}: every priced item in the listings can be ordered (${items.length} catalogue items)`);

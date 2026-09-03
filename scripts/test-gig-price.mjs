#!/usr/bin/env node
/**
 * The price a service card prints carries the currency the business typed.
 *
 * WHY. `gigPriceParts` read `gig.tiers[0].currency`, and a STORE listing
 * prices itself through `products` — tiers is empty — so every store fell
 * through to the `|| 'ILS'` default. A butcher who had entered $215 had
 * his card print ₪215, on the board, on his business page and in the home
 * page's rails. Nothing was blank and nothing threw; only the symbol was
 * wrong, which is why it reached the business before it reached us.
 *
 * Pure functions, so this runs with no server and no browser:
 *
 *   node scripts/test-gig-price.mjs
 */
import { readFileSync } from 'node:fs';

// The module imports a sibling for the FX constant; both are plain ESM, so
// they are loaded directly rather than being duplicated here.
const url = new URL('../frontend/src/utils/gigPrice.js', import.meta.url);
const { gigPriceParts, cheapestRow, priceRows } = await import(url);

const results = [];
const ok = (name, cond, detail = '') => {
  results.push(!!cond);
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' — ' + detail}`);
};

// ---- the reported bug ----
const store = {
  gig_type: 'store',
  tiers: [],
  products: [{ name: 'Ulimate Feast', price: 215, currency: 'USD' }],
  cheapest_price: 215,
};
ok('a store priced in dollars prints dollars', gigPriceParts(store).text === '$215', gigPriceParts(store).text);
ok('and reports its currency', gigPriceParts(store).currency === 'USD');

// ---- the cases that must not regress ----
const shekelStore = {
  gig_type: 'store',
  tiers: [],
  products: [{ name: 'Board', price: 180, currency: 'ILS' }],
};
ok('a store priced in shekels still prints shekels', gigPriceParts(shekelStore).text === '₪180');

const tiered = {
  gig_type: 'deliverable',
  tiers: [{ name: 'Basic', price: 300, currency: 'USD' }, { name: 'Full', price: 800, currency: 'USD' }],
};
const t = gigPriceParts(tiered);
ok('a tiered listing quotes its cheapest tier', t.text === '$300', t.text);
ok('and says "from" when there is more than one', t.from === true);

const single = { gig_type: 'deliverable', tiers: [{ name: 'Only', price: 90, currency: 'ILS' }] };
ok('a single option does not say "from"', gigPriceParts(single).from === false);

const noPrice = { gig_type: 'deliverable', tiers: [] };
ok('no price at all asks for a quote', gigPriceParts(noPrice).quote === true);

// ---- mixed currencies: cheapest means cheapest, not smallest number ----
const mixed = {
  gig_type: 'store',
  tiers: [],
  products: [
    { name: 'Import', price: 30, currency: 'USD' },   // ~₪111
    { name: 'Local', price: 90, currency: 'ILS' },
  ],
};
ok('the cheapest option is chosen across currencies', cheapestRow(mixed).currency === 'ILS', JSON.stringify(cheapestRow(mixed)));
ok('and it is quoted in its own currency', gigPriceParts(mixed).text === '₪90', gigPriceParts(mixed).text);

// ---- rows with no usable price are ignored, not counted ----
const partly = {
  gig_type: 'store',
  tiers: [],
  products: [{ name: 'Ask', price: null, currency: 'ILS' }, { name: 'Set', price: 120, currency: 'USD' }],
};
ok('rows without a price are skipped', gigPriceParts(partly).text === '$120', gigPriceParts(partly).text);
ok('priceRows returns only priced rows', priceRows(partly).length === 1);

// ---- the guard against the original mistake coming back ----
const src = readFileSync(new URL('../frontend/src/utils/gigPrice.js', import.meta.url), 'utf8');
ok('the currency is not read from tiers[0] any more', !/tiers\?\.\[0\]\?\.currency/.test(src));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);

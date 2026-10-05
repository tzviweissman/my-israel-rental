#!/usr/bin/env node
/**
 * Page builder v3, "say it once" (docs/page-builder-design-rules.md, rule
 * 1.4): the pure helpers in frontend/src/components/pagebuilder/v3/ledger.js.
 *   node scripts/test-page-v3-ledger.mjs
 */
const { limitRepeats, v3BodyBlocks } = await import(new URL('../frontend/src/components/pagebuilder/v3/ledger.js', import.meta.url));

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok  ' : '  FAIL'} ${name}${cond ? '' : `  ${detail}`}`); if (!cond) failed += 1; };

const facts = ['kosher', 'price', 'kosher', 'area', 'kosher', 'price'];
const kept = limitRepeats(facts, (x) => x, 2);
ok('a fact that appears three times renders at most twice', kept.filter((x) => x === 'kosher').length === 2, kept.join(','));
ok('order is kept', kept.join(',') === 'kosher,price,kosher,area,price', kept.join(','));
ok('a null key is never limited', limitRepeats([1, 2, 3], () => null, 1).length === 3);

const body = v3BodyBlocks([
  { type: 'hero' }, { type: 'facts' }, { type: 'services', id: 'a' }, { type: 'facts' },
  { type: 'contact' }, { type: 'services', id: 'b' }, { type: 'gallery' }, { type: 'cover' },
]);
const types = body.map((b) => b.type).join(',');
ok('no second hero, cover or fourth chat button under a v3 hero', !/hero|cover|contact/.test(types), types);
ok('each other block type once; several services blocks allowed', types === 'facts,services,services,gallery', types);
ok('missing blocks are an empty list', v3BodyBlocks(undefined).length === 0);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);

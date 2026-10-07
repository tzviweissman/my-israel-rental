// node scripts/test-store-basket.mjs : the basket's link to the order form round-trips.
import assert from 'node:assert/strict';
const { orderHref, parseItems } = await import('../frontend/src/utils/storeBasket.js');
const href = orderHref('gig-1', { 'idx:0': 2, abc123: 1, gone: 0 });
const items = new URL(`http://x${href}`).searchParams.get('items');
assert.deepEqual(parseItems(items, ['idx:0', 'abc123', 'other']), { 'idx:0': 2, abc123: 1 });
assert.deepEqual(parseItems('nope~3,abc123~999,abc123~x', ['abc123']), { abc123: 99 });
console.log('storeBasket ok');

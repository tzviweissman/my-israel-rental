/**
 * The grouped category picker keeps every category (spec N2).
 *
 * N2 is the condition on ruling 2 — the new top-level categories do not
 * ship unless the picker is grouped — so the thing worth pinning is not
 * that groups render, but that grouping is LOSSLESS. A category that
 * quietly falls out of the picker cannot be chosen, and nobody finds out
 * until a business asks why their trade is missing.
 *
 * The backend list is parsed out of `shared.py` rather than typed in
 * here, so adding a category there and forgetting to group it fails this
 * test instead of shipping.
 *
 * Usage: node scripts/test-category-groups.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

// The module is ESM inside a CommonJS package, so Node will not import
// the .js directly. Copy it to a .mjs and import that — no transform,
// no bundler, the same source either way.
const SRC = 'frontend/src/lib/categoryGroups.js';
const dir = join(tmpdir(), 'mir-category-groups');
mkdirSync(dir, { recursive: true });
const shim = join(dir, 'categoryGroups.mjs');
writeFileSync(shim, readFileSync(SRC, 'utf8'));

const { CATEGORY_GROUPS, OTHER_GROUP, groupCategories, flattenGrouped } =
  await import(pathToFileURL(shim).href);

const failures = [];
const eq = (a, b, msg) => { if (a !== b) failures.push(`${msg} (got ${a}, want ${b})`); };

// ---- the real backend list -------------------------------------------
const py = readFileSync('backend/routes/marketplace/shared.py', 'utf8');
const parseList = (start, end) => [
  ...py.slice(py.indexOf(start), py.indexOf(end)).matchAll(/\{"slug":\s*"([a-z0-9-]+)"[^}]*"label":\s*"([^"]+)"/g),
].map(([, slug, label]) => ({ slug, label }));

// Two lists, and the boundary matters: CATEGORIES is what ships,
// CATEGORIES_PENDING_REVIEW is held behind an env flag until three legal
// questions are answered. Slicing to `_CATEGORY_SLUGS` would swallow
// both and quietly assert the wrong thing.
const backend = parseList('CATEGORIES = [', 'CATEGORIES_PENDING_REVIEW = [');
const pending = parseList('CATEGORIES_PENDING_REVIEW = [', '_CATEGORY_SLUGS');
console.log(`  backend ships ${backend.length} categories (+${pending.length} held for review)`);
if (!pending.length) {
  failures.push('CATEGORIES_PENDING_REVIEW is empty — if those categories were released, say so deliberately');
}
if (backend.length < 10) {
  failures.push(`only parsed ${backend.length} categories out of shared.py — the parser is wrong, not the code`);
}

// ---- nothing is lost, nothing is duplicated --------------------------
const grouped = groupCategories(backend);
const flat = flattenGrouped(grouped);
eq(flat.length, backend.length, 'grouping changed the number of categories');

const seen = new Set(flat.map((c) => c.slug));
backend.forEach((c) => {
  if (!seen.has(c.slug)) failures.push(`"${c.slug}" is missing from the picker entirely`);
});
const dupes = flat.map((c) => c.slug).filter((s, i, a) => a.indexOf(s) !== i);
if (dupes.length) failures.push(`shown more than once: ${[...new Set(dupes)].join(', ')}`);

// The held categories must be grouped too — otherwise flipping the env
// flag drops three categories into "More" on a live site.
const withPending = groupCategories([...backend, ...pending]);
const strandedPending = withPending.find((g) => g.id === OTHER_GROUP.id);
if (strandedPending) {
  failures.push(
    `ungrouped once the review flag is on: ${strandedPending.items.map((c) => c.slug).join(', ')}`,
  );
}

// ---- and nothing real is parked in the catch-all ---------------------
// "More" exists so a deployed frontend older than the backend still
// offers a new category. It is a safety net, not a destination: every
// category the backend actually ships belongs in a named group.
const stranded = grouped.find((g) => g.id === OTHER_GROUP.id);
if (stranded) {
  failures.push(
    `ungrouped: ${stranded.items.map((c) => c.slug).join(', ')} — `
    + `add them to a group in ${SRC} rather than leaving them in "More"`,
  );
}

// ---- a slug is never in two groups -----------------------------------
const everySlug = CATEGORY_GROUPS.flatMap((g) => g.slugs);
const twice = everySlug.filter((s, i, a) => a.indexOf(s) !== i);
if (twice.length) failures.push(`slug listed in two groups: ${[...new Set(twice)].join(', ')}`);

// ---- group order is the module's, not the API's ----------------------
const wantOrder = CATEGORY_GROUPS.map((g) => g.id).filter((id) => grouped.some((x) => x.id === id));
const gotOrder = grouped.map((g) => g.id);
eq(gotOrder.join('>'), wantOrder.join('>'), 'groups came out in the wrong order');

// Shuffle the input: the output order must not move.
const shuffled = [...backend].reverse();
eq(
  flattenGrouped(groupCategories(shuffled)).map((c) => c.slug).join(','),
  flat.map((c) => c.slug).join(','),
  'the picker order follows the API response instead of the module',
);

// ---- empty groups are dropped ----------------------------------------
const oneOnly = groupCategories([{ slug: 'cleaning-services', label: 'Cleaning' }]);
eq(oneOnly.length, 1, 'empty groups were rendered');
eq(oneOnly[0].id, 'home-property', 'the single category landed in the wrong group');

// ---- an unknown slug survives ----------------------------------------
// The failure this prevents: backend ships `drone-services`, the
// deployed frontend has never heard of it, and it silently disappears.
const withNew = groupCategories([...backend, { slug: 'drone-services', label: 'Drone Services' }]);
const more = withNew.find((g) => g.id === OTHER_GROUP.id);
if (!more || !more.items.some((c) => c.slug === 'drone-services')) {
  failures.push('a category the frontend has never seen vanished from the picker');
} else {
  eq(withNew[withNew.length - 1].id, OTHER_GROUP.id, '"More" is not last');
}

// ---- the label mirror has not drifted --------------------------------
// `lib/categories.js` warns in its own header that it must be kept in
// sync with the backend, and it had already drifted: `shops-products`
// was added to shared.py on 19 Aug and never mirrored, so
// labelForCategory() returned the raw slug. Nothing threw. Assert it
// instead of trusting the warning.
const catsSrc = readFileSync('frontend/src/lib/categories.js', 'utf8');
const labelsBlock = catsSrc.slice(
  catsSrc.indexOf('CATEGORY_LABELS = {'),
  catsSrc.indexOf('LEGACY_CATEGORY_MIGRATION'),
);
const mirrored = new Set([...labelsBlock.matchAll(/'([a-z0-9-]+)':/g)].map(([, k]) => k));
[...backend, ...pending].forEach((c) => {
  if (!mirrored.has(c.slug)) {
    failures.push(`"${c.slug}" is in shared.py but missing from CATEGORY_LABELS — labelForCategory() will render the raw slug`);
  }
});

// ---- the disclaimer set has not drifted -------------------------------
// This mirror carries legal weight rather than cosmetic weight: if the
// frontend set loses a slug, the listing silently stops saying we are a
// directory and not a money service. Nothing errors and nothing looks
// wrong, which is exactly why it is asserted.
const backendDisc = new Set(
  [...py.slice(py.indexOf('CATEGORIES_WITH_DISCLAIMER = {'), py.indexOf('CATEGORIES_WITH_DISCLAIMER = {') + 300)
    .matchAll(/"([a-z0-9-]+)"/g)].map(([, x]) => x),
);
const frontDisc = new Set(
  [...catsSrc.slice(catsSrc.indexOf('CATEGORIES_WITH_DISCLAIMER = new Set('), catsSrc.indexOf('CATEGORIES_WITH_DISCLAIMER = new Set(') + 200)
    .matchAll(/'([a-z0-9-]+)'/g)].map(([, x]) => x),
);
console.log(`  disclaimer categories — backend: [${[...backendDisc]}], frontend: [${[...frontDisc]}]`);
if (!backendDisc.size) failures.push('could not parse CATEGORIES_WITH_DISCLAIMER from shared.py');
[...backendDisc].forEach((slug) => {
  if (!frontDisc.has(slug)) {
    failures.push(`"${slug}" needs a directory disclaimer per the backend, but the frontend set omits it — the listing renders without it`);
  }
});
[...frontDisc].forEach((slug) => {
  if (!backendDisc.has(slug)) failures.push(`the frontend disclaims "${slug}" and the backend does not`);
});

// ---- labels go through i18n ------------------------------------------
const translated = groupCategories(backend, (k, d) => (k === 'categoryGroups.homeProperty' ? 'בית ונכס' : d));
eq(translated[0].label, 'בית ונכס', 'group labels do not go through t()');

// CATEGORY labels too, not just the group headings. Without this a
// Hebrew visitor picks English category names out of Hebrew groups.
const heCats = groupCategories(backend, (k, d) => (k === 'categoryLabels.cleaning-services' ? 'שירותי ניקיון' : d));
const cleaning = flattenGrouped(heCats).find((c) => c.slug === 'cleaning-services');
eq(cleaning.label, 'שירותי ניקיון', 'category labels do not go through t()');
// …and the API's label survives when the locale has no key for it.
const unknown = flattenGrouped(groupCategories([{ slug: 'drone-services', label: 'Drone Services' }], (_k, d) => d));
eq(unknown[0].label, 'Drone Services', 'a category with no locale key lost its name');

// Every category the backend ships must HAVE a Hebrew label — an
// English name inside a Hebrew picker is the exact complaint this is
// answering, and a missing key fails silently to the English fallback.
const heSrc = readFileSync('frontend/src/locales/he.js', 'utf8');
const heBlock = heSrc.slice(heSrc.indexOf('categoryLabels: {'), heSrc.indexOf('categoryGroups: {'));
[...backend, ...pending].forEach((c) => {
  if (!heBlock.includes(`'${c.slug}':`)) {
    failures.push(`"${c.slug}" has no Hebrew label in he.js — it renders in English on the Hebrew site`);
  }
});
eq(
  groupCategories(backend)[0].label,
  CATEGORY_GROUPS[0].labelDefault,
  'the English default is not used when t is absent',
);

console.log(`  ${grouped.length} groups, ${flat.length} categories, none stranded`);
grouped.forEach((g) => console.log(`    ${g.label}: ${g.items.map((c) => c.slug).join(', ')}`));

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('\nall checks passed');

#!/usr/bin/env node
/**
 * Locale checks that run without a browser, a server or a login.
 *
 * WHY THIS EXISTS. Three separate locale defects shipped in one week and
 * every one of them was found by a person, not by a check:
 *
 *   1. Ten `requests.*` keys were in en.js and not in he.js, so Hebrew
 *      readers got English with no error anywhere — `t(key, 'default')`
 *      renders the default silently and reports nothing.
 *   2. `requests.status_open` was in NEITHER catalogue while `open` is the
 *      default status, so the most common pill on the dashboard rendered
 *      the raw enum, uppercased, as "OPEN" — in Hebrew too. A parity check
 *      cannot see this: both files agree, and both are wrong.
 *   3. `{{n}}` was used where i18next only pluralises off `{{count}}`,
 *      giving "1 chats opened about this" and, in Hebrew, "חודשה 1 פעמים".
 *
 * So there are four checks, not one. Check 2 is the one parity misses by
 * construction, and it is the reason this file is not just a key diff.
 *
 * Hebrew legitimately carries `_two` keys that English does not — the dual
 * ("שעתיים", not "2 שעות"). Those are not a parity failure and are counted
 * separately.
 *
 *   node scripts/test-i18n-parity.mjs
 *
 * Exit 0 = clean. Exit 1 = at least one hard failure.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'frontend', 'src');

// i18next v4 plural suffixes. `_two` is the one Hebrew uses and English
// does not, which is why a raw key diff reports false positives without it.
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];
const stripPlural = (key) => {
  for (const s of PLURAL_SUFFIXES) if (key.endsWith(s)) return key.slice(0, -s.length);
  return key;
};
const isPlural = (key) => key !== stripPlural(key);

// ---------------------------------------------------------------------------
// Load both catalogues
// ---------------------------------------------------------------------------

const load = async (lang) => {
  const mod = await import(pathToFileURL(join(SRC, 'locales', `${lang}.js`)).href);
  const cat = mod.default;
  return cat.translation || cat;
};

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? flatten(v, `${prefix}${k}.`)
      : [[`${prefix}${k}`, v]],
  );

const en = Object.fromEntries(flatten(await load('en')));
const he = Object.fromEntries(flatten(await load('he')));

// ---------------------------------------------------------------------------
// Collect every t() call in the app
// ---------------------------------------------------------------------------

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'locales' ? [] : walk(p);
    return /\.(js|jsx)$/.test(name) ? [p] : [];
  });

const files = walk(SRC);

// `t('a.b')`, `t('a.b', 'default')`, `t('a.b', { count })`
const STATIC_CALL = /\bt\(\s*'([A-Za-z0-9_.]+)'/g;
// `t(`a.b_${expr}`)` — the prefix is knowable, the whole key is not.
const DYNAMIC_CALL = /\bt\(\s*`([A-Za-z0-9_.]*)\$\{/g;
// Whether that same call passes a `count`, which is what selects a plural.
const COUNT_ARG = /\bt\(\s*'([A-Za-z0-9_.]+)'[^)]*\bcount\s*[:,}]/g;

const usedStatic = new Map();   // key -> [file...]
const usedWithCount = new Set();
const dynamicPrefixes = new Map(); // prefix -> [file...]

// Comments discuss keys that do not exist on purpose. OnboardingProvider
// explains, in prose, that `t('tips.tip.share')` would resolve to
// tips -> tip -> share and fail — scanning that as a real call site
// reported the example as a defect.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

for (const file of files) {
  const body = stripComments(readFileSync(file, 'utf8'));
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
  for (const m of body.matchAll(STATIC_CALL)) {
    if (!usedStatic.has(m[1])) usedStatic.set(m[1], []);
    usedStatic.get(m[1]).push(rel);
  }
  for (const m of body.matchAll(COUNT_ARG)) usedWithCount.add(m[1]);
  for (const m of body.matchAll(DYNAMIC_CALL)) {
    if (!m[1]) continue;
    if (!dynamicPrefixes.has(m[1])) dynamicPrefixes.set(m[1], []);
    dynamicPrefixes.get(m[1]).push(rel);
  }
}

// A key "exists" if it is present outright or as any plural variant.
const variants = (cat) => {
  const set = new Set(Object.keys(cat));
  for (const k of Object.keys(cat)) if (isPlural(k)) set.add(stripPlural(k));
  return set;
};
const enKeys = variants(en);
const heKeys = variants(he);

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

const failures = [];
const report = (label, rows, { hard = true, show = (r) => r } = {}) => {
  if (!rows.length) {
    console.log(`  PASS  ${label}`);
    return;
  }
  console.log(`  ${hard ? 'FAIL' : 'note'}  ${label} (${rows.length})`);
  for (const r of rows.slice(0, 25)) console.log(`          ${show(r)}`);
  if (rows.length > 25) console.log(`          … and ${rows.length - 25} more`);
  if (hard) failures.push(label);
};

console.log('\ni18n checks\n');
console.log(`  en.js: ${Object.keys(en).length} keys   he.js: ${Object.keys(he).length} keys\n`);

// 1. Every English key has a Hebrew counterpart.
report(
  'every en.js key exists in he.js',
  [...enKeys].filter((k) => !heKeys.has(k)).sort(),
);

// 2. Hebrew-only keys, excluding the dual, which English has no use for.
report(
  'no stray he.js keys (dual `_two` forms excluded)',
  [...heKeys].filter((k) => !enKeys.has(k) && !he[`${k}_two`] && !k.endsWith('_two')).sort(),
);

// 3. THE ONE PARITY CANNOT SEE. A key used in the app but present in
//    neither catalogue renders its inline English default to every reader,
//    or the raw key when there is no default.
report(
  'every t() key in the app exists in en.js',
  [...usedStatic.keys()]
    .filter((k) => !enKeys.has(k))
    .sort()
    .map((k) => ({ k, where: usedStatic.get(k)[0] })),
  { show: (r) => `${r.k}   ${r.where}` },
);

// 4. A key called with `count` must actually carry a plural set, or the
//    count is interpolated into a single fixed string: "1 chats opened".
//
//    RATCHET, NOT A SWEEP. 25 keys were already in this state when the
//    check was written, mostly on admin and bulk-edit surfaces. Fixing
//    them all in one go is a 25-string change to screens this work never
//    touched; failing on them forever would make the check something
//    people learn to ignore. So the known set is listed and the gate is
//    "no NEW ones" — the number can only go down. Delete a line when you
//    fix it; the check fails if a listed key is no longer a problem, so
//    the list cannot rot.
const KNOWN_UNPLURALISED = new Set([
  'admin.bulkDeleteTitle', 'admin.listingsCount', 'admin.markBookedDescBulk',
  'admin.selectedCount', 'admin.usersCount', 'admin.usersSuppressed',
  'auth.verifyPending.resendIn', 'blocks.count', 'bulk.addedPhotos',
  'bulk.addedPhotosPerProp', 'bulk.photosPropertiesSelected', 'bulk.revertLast',
  'bulk.saveAndApply', 'bulk.selectedCount', 'bulk.selectedPropertiesHint',
  'bulk.totalCount', 'bulk.updatedCount', 'bulk.visibleCount',
  'common.nearbyShortHop', 'common.nearbyTotal', 'common.nearbyWalking',
  'property.typeWithBeds', 'services.reviewsCount', 'stays.bedroomsPlusChip',
  'stays.showCount',
]);

const unpluralised = [...usedWithCount]
  .filter((k) => {
    const enHas = PLURAL_SUFFIXES.some((s) => en[k + s]);
    const heHas = PLURAL_SUFFIXES.some((s) => he[k + s]);
    // English needs no split for some strings ("renewed {{count}}x"),
    // but Hebrew almost always does. Flag only when NEITHER has one.
    return !enHas && !heHas;
  })
  .sort();

report(
  'no NEW t(key, { count }) without a plural set',
  unpluralised.filter((k) => !KNOWN_UNPLURALISED.has(k)),
);
report(
  'KNOWN_UNPLURALISED has no entries that are already fixed',
  [...KNOWN_UNPLURALISED].filter((k) => !unpluralised.includes(k)).sort(),
);
if (unpluralised.length) {
  console.log(`  note  ${unpluralised.length} known unpluralised keys remain (see KNOWN_UNPLURALISED)`);
}

// Informational: dynamic keys, where the suffix comes from a variable.
// Mechanically unresolvable — printed so a missing member is at least
// visible. `requests.status_` having found/expired/closed but not `open`
// is what shipped "OPEN" to the dashboard.
if (dynamicPrefixes.size) {
  console.log('\n  dynamic t() keys — the suffix is a variable, so no check can');
  console.log('  resolve them. Members currently defined:\n');
  for (const [prefix, where] of [...dynamicPrefixes].sort()) {
    const members = Object.keys(en)
      .filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('.'))
      .map((k) => k.slice(prefix.length));
    const missingInHe = members.filter((m) => !heKeys.has(prefix + m));
    console.log(`    ${prefix}\${…}   ${where[0]}`);
    console.log(`      en: ${members.length ? members.join(', ') : '(none)'}`);
    if (missingInHe.length) console.log(`      MISSING IN HE: ${missingInHe.join(', ')}`);
  }
}

console.log();
if (failures.length) {
  console.log(`FAILED: ${failures.length} check(s)\n`);
  process.exit(1);
}
console.log('all i18n checks passed\n');

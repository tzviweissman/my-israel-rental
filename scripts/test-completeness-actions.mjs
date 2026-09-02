#!/usr/bin/env node
/**
 * Every item on the business checklist opens a form that can actually
 * close it.
 *
 * WHY. `BusinessCompleteness` lists what a business page is missing and
 * wires each item to "the thing that fixes it". "Add a logo" was wired to
 * the details form — which had no logo field. Nothing else in the app
 * had one either. So the API accepted `logo_url`, the checklist demanded
 * it, the public page rendered it, and no owner could set it: every
 * business stalled at 75% with an item that could not be done, and two
 * owners sent videos of themselves re-saving the form looking for it.
 *
 * A promise the UI makes ("click here to add X") has to land on a
 * control for X. This reads both sides and fails when they disagree.
 *
 *   node scripts/test-completeness-actions.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'frontend', 'src', p), 'utf8');

const checklist = src('components/dashboard/BusinessCompleteness.jsx');
const details = src('components/dashboard/BusinessDetailsForm.jsx');
const tab = src('components/dashboard/MyBusinessesTab.jsx');

// Which prop each checklist item calls when clicked.
const items = [...checklist.matchAll(/key:\s*'([a-z]+)'[\s\S]*?action:\s*(\w+)/g)]
  .map((m) => ({ key: m[1], action: m[2] }));

// Where each action prop is wired to, in the tab that renders the list.
const wiring = {};
for (const m of tab.matchAll(/(onEditDetails|onOpenListings)=\{\(\)\s*=>\s*(\w+)\(/g)) wiring[m[1]] = m[2];

// What each destination can actually set. A field counts only if a
// control for it exists in the form's MARKUP — a state key alone means
// nothing to the person clicking.
const canSet = {
  setDetailsBiz: {
    logo: /data-testid="biz-details-logo-input"/.test(details),
    description: /data-testid=\{`biz-details-\$\{key\}`\}[\s\S]*?field\('description'/.test(details)
      || /field\('description'/.test(details),
    areas: /<ServiceAreaPicker/.test(details),
  },
  setOpenBiz: {
    // The listings tab is where photos are added to a service; the
    // checklist points there for the photo item.
    photo: true,
  },
};

let failed = 0;
console.log('\nbusiness checklist → each item opens a form that can close it\n');
if (items.length < 4) {
  console.log(`  FAIL  expected at least 4 checklist items, parsed ${items.length} — the regex no longer matches BusinessCompleteness.jsx`);
  failed += 1;
}
for (const { key, action } of items) {
  const target = wiring[action];
  const ok = !!canSet[target]?.[key];
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} "${key}" → ${action} → ${target || '(unwired)'}${ok ? '' : ' — that form has no control for this item'}`);
  if (!ok) failed += 1;
}
console.log();
if (failed) {
  console.log(`${failed} dead end(s)`);
  process.exit(1);
}
console.log('all checklist items are reachable');

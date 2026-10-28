#!/usr/bin/env node
/**
 * The references gate (Tzvi, 28 Oct 2026, after Bake away's first three opening
 * ideas were made and paid for from one saved folder only: "did you look through
 * all our inspo sources before you came up with these ideas", then "how can we
 * make sure you never skip them before future builds"). check-concept already
 * asked for Mobbin and 21st, but only at publish, long after the ideas were
 * chosen. This runs BEFORE any idea is shown or any credit is spent.
 *
 * A build folder must hold REFERENCES.md with one line per source:
 *
 *   - awwwards-food-2026-10-18: what was taken from it (picture paths), or why nothing fits
 *   ... one line for EVERY source in docs/inspo/README.md's table and every
 *       folder in docs/inspo (a new source added there is required at once)
 *   - inspo: the Inspo searches run and the screens kept (slugs)
 *   - mobbin: the searches and the kept sections (mobbin.com links)
 *   - 21st: the searches and the kept components (21st.dev links)
 *   - fingerprints: which looks and effects are taken by other sites
 *
 * Each line says something real (at least 25 characters after the name).
 *
 *   node scripts/check-references.mjs <build-folder>     exit 1 with what is missing
 *
 * check-concept.mjs runs it too, so publish-page refuses a new page without it.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const INSPO = path.join(ROOT, 'docs', 'inspo');

export function sources() {
  const names = new Set();
  const index = fs.readFileSync(path.join(INSPO, 'README.md'), 'utf8');
  for (const row of index.split('\n').filter((l) => /^\|\s*\d/.test(l))) {
    const links = [...row.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1].replace(/\/README\.md$/, '').replace(/\/$/, ''));
    if (links.length) links.forEach((l) => names.add(/ui-videos\/notes$/.test(l) ? 'ui-videos-notes' : path.basename(l).replace(/\.md$/, '')));
    else if (/effects-library/.test(row)) names.add('effects-library');
  }
  for (const d of fs.readdirSync(INSPO, { withFileTypes: true })) if (d.isDirectory()) names.add(d.name);
  return [...names];
}

export function checkReferences(dir) {
  const file = path.join(dir, 'REFERENCES.md');
  if (!fs.existsSync(file)) return ['no REFERENCES.md in the build folder (see scripts/check-references.mjs)'];
  const s = fs.readFileSync(file, 'utf8');
  const line = (name) => {
    const m = new RegExp(`^\\s*[-*]\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.*)$`, 'im').exec(s);
    return m ? m[1].trim() : null;
  };
  const problems = [];
  for (const name of [...sources(), 'inspo', 'mobbin', '21st', 'fingerprints']) {
    const v = line(name);
    if (v === null) problems.push(`${name}: no line (every source is read before any idea, rule 3c.1)`);
    else if (v.length < 25) problems.push(`${name}: say what was taken from it or why nothing fits`);
  }
  if (line('mobbin') && !/mobbin\.com\//i.test(line('mobbin'))) problems.push('mobbin: name the kept sections with their mobbin.com links');
  if (line('21st') && !/21st\.dev\//i.test(line('21st'))) problems.push('21st: name the kept components with their 21st.dev links');
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: node scripts/check-references.mjs <build-folder>'); process.exit(2); }
  const dir = fs.existsSync(arg) ? arg : path.join(ROOT, 'scrollcraft', 'builds', arg);
  const p = checkReferences(dir);
  if (p.length) { console.error(`REFERENCES not done for ${path.basename(dir)}:\n- ${p.join('\n- ')}`); process.exit(1); }
  console.log(`references done for ${path.basename(dir)}: all ${sources().length} saved sources, Inspo, Mobbin and 21st`);
}

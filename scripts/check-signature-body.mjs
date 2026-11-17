#!/usr/bin/env node
/**
 * A signature body, not only a signature opening (Tzvi, 17 Nov 2026: "they dont have any uniqueness to them other
 * than the hero"; rules 3ad.1). In the Fable 5.2 vs Opus 5.5 test the winning car-parts site was built round the
 * business's own job (a car whose parts open and label, a part finder) and the other had "pretty standard
 * sections"; Kyle Skelly's expedition site got its "how high we go" section from the expeditions' own heights.
 *
 * CONCEPT.md has a "## Body" part with at least two lines
 *   - signature: #<id> | <what the visitor does or sees> | from: <the business's own data or main task it is shaped by>
 * and each id is a section of index.html after the opening, never the same id twice.
 *   MISSING  no "## Body", or fewer than two signature lines
 *   SHAPE    a line without the three parts
 *   NOID     the id is not on the home page, or it is the opening
 *
 *   node scripts/check-signature-body.mjs <build-folder>      exit 1 on any problem
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const x = process.argv[2];
if (!x) { console.error('usage: node scripts/check-signature-body.mjs <build-folder>'); process.exit(2); }
const dir = fs.existsSync(path.join(x, 'index.html')) ? path.resolve(x) : path.join(ROOT, 'scrollcraft', 'builds', x);
const concept = path.join(dir, 'CONCEPT.md'), home = path.join(dir, 'index.html');
const out = [];
if (!fs.existsSync(home)) out.push(`MISSING  no index.html in ${dir}`);
const text = fs.existsSync(concept) ? fs.readFileSync(concept, 'utf8') : '';
const body = (/^## Body\b[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text) || [])[1];
const lines = (body || '').split(/\r?\n/).filter((l) => /^\s*-\s*signature:/i.test(l));
if (!body) out.push('MISSING  CONCEPT.md has no "## Body" part (3ad.1: the sections after the opening that only this business could have)');
else if (lines.length < 2) out.push(`MISSING  ${lines.length} signature line(s) in CONCEPT.md "## Body"; at least two`);
const html = fs.existsSync(home) ? fs.readFileSync(home, 'utf8') : '';
// the opening: the first section-like element after the header
const firstId = (/<(?:section|div|main)[^>]*\bid="([^"]+)"/.exec(html.replace(/<header[\s\S]*?<\/header>/i, '')) || [])[1];
const seen = new Set();
for (const l of lines) {
  const parts = l.replace(/^\s*-\s*signature:\s*/i, '').split('|').map((s) => s.trim());
  const id = (/^#([\w-]+)$/.exec(parts[0] || '') || [])[1];
  if (!id || parts.length < 3 || !/^from:\s*\S/i.test(parts[2]) || !parts[1]) { out.push(`SHAPE    "${l.trim()}" (want: - signature: #id | what the visitor does or sees | from: <their data or task>)`); continue; }
  if (seen.has(id)) out.push(`SHAPE    #${id} is listed twice`);
  seen.add(id);
  if (!new RegExp(`\\bid="${id}"`).test(html)) out.push(`NOID     #${id} is not on the home page`);
  else if (id === firstId) out.push(`NOID     #${id} is the opening; the signature body comes after it`);
}
if (out.length) { console.log(out.join('\n')); process.exit(1); }
console.log(`${path.basename(dir)}: ${lines.length} signature sections after the opening`);

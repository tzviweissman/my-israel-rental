#!/usr/bin/env node
/**
 * The build was put beside the best of its kind before review (rules 3ag.6, Tzvi 19 Nov 2026). Passes when the build
 * folder has compare.jpg (scripts/compare-sheet.mjs) and REFERENCES.md has a "## Compared" part with at least three
 * "- " lines, each a difference that made ours look worse and what was changed ("... -> ..." or "changed:").
 *
 *   node scripts/check-compared.mjs <build folder>      exit 1 on a fault
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/check-compared.mjs <build folder>'); process.exit(2); }
const why = [];
if (!existsSync(join(dir, 'compare.jpg'))) why.push('NOSHEET: no compare.jpg; run node scripts/compare-sheet.mjs <build> <picture 1> <picture 2>');
const ref = existsSync(join(dir, 'REFERENCES.md')) ? readFileSync(join(dir, 'REFERENCES.md'), 'utf8') : '';
const part = (/^## Compared\b[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(ref) || [])[1];
if (part === undefined) why.push('NOPART: REFERENCES.md has no "## Compared" part');
else {
  const lines = part.split(/\r?\n/).filter((l) => /^- /.test(l));
  if (lines.length < 3) why.push(`SHORT: "## Compared" has ${lines.length} difference line(s); name at least three`);
  const bare = lines.filter((l) => !/->|→|changed:/i.test(l));
  if (bare.length) why.push(`NOFIX: ${bare.length} line(s) name a difference but not what was changed ("... -> ..."): ${bare[0].slice(0, 80)}`);
}
if (why.length) { console.log(`COMPARED  ${dir}\n  ${why.join('\n  ')}`); process.exit(1); }
console.log(`${dir}: compared`);

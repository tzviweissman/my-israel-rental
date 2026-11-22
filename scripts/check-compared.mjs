#!/usr/bin/env node
/**
 * The build was put beside the best of its kind before review (rules 3ag.6, Tzvi 19 Nov 2026). Passes when the build
 * folder has compare.jpg (scripts/compare-sheet.mjs) and REFERENCES.md has a "## Compared" part with at least three
 * "- " lines, each a difference that made ours look worse and what was changed ("... -> ..." or "changed:").
 *
 * Since 20 Nov 2026 (rules 3ah.5, 3ah.7) also: a "## Why they are a 5" part in REFERENCES.md with at least five "- "
 * lines (what the references do and how this site does it, "... -> ..."), and a "- showpiece:" line in CONCEPT.md
 * naming its reference ("from:").
 *
 * Since 22 Nov 2026 (rules 3al.4) the "- motion:" line has at least three numbers with a unit (s, ms, px or %).
 *
 *   node scripts/check-compared.mjs <build folder>      exit 1 on a fault
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { newerRules } from './rule-dates.mjs';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

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
const five = (/^## Why they are a 5\b[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(ref) || [])[1];
const fl = five === undefined ? [] : five.split(/\r?\n/).filter((l) => /^- /.test(l));
if (five === undefined) why.push('NOFIVE: REFERENCES.md has no "## Why they are a 5" part (rules 3ah.7): what the two best sites of the category do, and how this one does it');
else if (fl.length < 5) why.push(`NOFIVE: "## Why they are a 5" has ${fl.length} line(s); name at least five (3ah.7)`);
else if (fl.some((l) => !/->|→/.test(l))) why.push('NOFIVE: each "## Why they are a 5" line says how this site does it ("... -> ...")');
const concept = existsSync(join(dir, 'CONCEPT.md')) ? readFileSync(join(dir, 'CONCEPT.md'), 'utf8') : '';
const sp = /^- showpiece:\s*(.+)$/m.exec(concept);
if (!sp) why.push('SHOWPIECE: CONCEPT.md has no "- showpiece: <what the visitor does> (from: <reference>)" line (3ah.5)');
else if (!/from:/i.test(sp[1])) why.push('SHOWPIECE: the showpiece line names no reference ("from: <the top site it adapts>")');
// at least one live, shipped site of the category among the references (rules 3ag.6, 20 Nov 2026: both Pinterest
// references were concept mockups and scored 4 and 3.5 when judged beside real award winners)
if (!/https?:\/\/(?!(www\.)?(pinterest|pin\.it|dribbble|behance))[^\s)]+/i.test((part || '') + (five || '')))
  why.push('LIVE: "## Compared" or "## Why they are a 5" names no live site of the category (its address); a Pinterest or Dribbble design alone is a concept, not a site');
// three decorations at most beyond the photos, grounds and type (rules 3ai)
const tr = /^- treatments:\s*(.+)$/m.exec(concept);
if (!tr) why.push('TREATMENTS: CONCEPT.md has no "- treatments: <one>; <two>; <three>" line (3ai: three decorations at most)');
else if (tr[1].split(';').filter((x) => x.trim()).length > 3 && !/Tzvi OK/i.test(tr[1])) why.push(`TREATMENTS: ${tr[1].split(';').length} decorations; three at most, or "(Tzvi OK, <date>)" on the line (3ai)`);
// motion planned where it helps (rules 3e.16c, 21 Nov 2026)
const mo = /^- motion:\s*(\S.*)$/m.exec(concept);
if (!mo) why.push('MOTION: CONCEPT.md has no "- motion:" line naming the five moments (opening in order, cards in turn, chooser swap, sheet grow, Add pop; 3e.16c)');
// written with numbers, so the same motion comes back every time (rules 3al.4, 22 Nov 2026); a site made before is spared
else if ((mo[1].match(/\d+(?:\.\d+)?\s?(?:ms|s|px|%)(?![a-z])/gi) || []).length < 3) {
  let newer = new Set();
  try { newer = newerRules(ROOT, dir); } catch { /* no git: hold the build to it */ }
  if (!newer.has('R3al.4')) why.push('MOTION: the "- motion:" line has fewer than three numbers with a unit ("over 1.2 s", "120 ms apart", "rise 24 px", "scale from 96%"); give each moment its duration, distance or scale and stagger (3al.4)');
}
if (why.length) { console.log(`COMPARED  ${dir}\n  ${why.join('\n  ')}`); process.exit(1); }
console.log(`${dir}: compared`);

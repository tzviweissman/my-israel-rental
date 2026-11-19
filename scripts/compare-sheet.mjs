#!/usr/bin/env node
/**
 * Our home page beside two of the best sites of its kind, in one picture (rules 3ag.6; Tzvi, 19 Nov 2026: "compare
 * her site to our inspo ... see why ours doesnt look as good"). Cakes by Tova passed every check and still looked worse
 * than real bakeries; only putting them side by side showed why. Made before the independent review.
 *
 *   node scripts/compare-sheet.mjs <build folder> <picture 1> <picture 2>
 *
 * The pictures are screenshots of the two reference sites (saved from Pinterest, Awwwards or Inspo, and named in
 * REFERENCES.md). Our side is the build's screens.jpg (scripts/screen-strip.mjs makes it). Writes <build>/compare.jpg,
 * all three at one height. Needs ffmpeg on PATH. Then write REFERENCES.md "## Compared" (scripts/check-compared.mjs).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const [dir, a, b] = process.argv.slice(2);
if (!b) { console.error('usage: node scripts/compare-sheet.mjs <build folder> <picture 1> <picture 2>'); process.exit(2); }
const ours = join(dir, 'screens.jpg');
for (const f of [ours, a, b]) if (!existsSync(f)) { console.error(`missing ${f}${f === ours ? ' (run scripts/screen-strip.mjs first)' : ''}`); process.exit(2); }
const H = 1400;
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', ours, '-i', a, '-i', b, '-filter_complex',
  `[0]scale=-2:${H}[o];[1]scale=-2:${H}[x];[2]scale=-2:${H}[y];[o][x][y]hstack=3`, '-q:v', '3', join(dir, 'compare.jpg')]);
console.log(`wrote ${join(dir, 'compare.jpg')}: ours at the left. Look at it, then write REFERENCES.md "## Compared".`);

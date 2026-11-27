#!/usr/bin/env node
/**
 * The three first screens are three real choices, each finished enough to judge (rules 3aj.20 and 3aj.21; Tzvi,
 * 27 Nov 2026: "Do all 4 and rebuild the three screens"). Boxed Israel's first three screens shared one photo, one
 * blue and one words-left, box-right layout, so both judges read them as three quiet versions of one page; and the
 * strongest idea was judged from a grey box with a sentence in it.
 *
 * Each of gen/board/first-a.html, first-b.html and first-c.html declares what it is made of:
 *   <meta name="first-screen" content="layout=split; ground=white and blue; photo=p03 re-lit; type=giant script word; event=handover">
 * five keys: layout (split, centred, full-bleed, stage...), ground, photo (which picture and how cut), type (the scale
 * move: giant word, huge centred line...) and event (the motion kind of IDEAS.md). It fails when:
 *   APART        two screens share more than two of the five (each pair must differ on at least three);
 *   UNDECLARED   a screen has no first-screen meta or misses a key;
 *   PLACEHOLDER  a screen still holds a stand-in where a picture or clip will go: a data-placeholder attribute,
 *                a plain one-colour SVG picture, or the words "to be made" (3aj.20: show a still of the key frame);
 *   SAMEPHOTO    all three screens show the same main picture file (the first <img> or background of each).
 *
 *   node scripts/check-three-apart.mjs <build-folder>      exit 1 with what is wrong
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/check-three-apart.mjs <build-folder>'); process.exit(2); }
const board = path.join(dir, 'gen', 'board');
const KEYS = ['layout', 'ground', 'photo', 'type', 'event'];
const problems = [];
const screens = [];
for (const x of ['a', 'b', 'c']) {
  const f = path.join(board, `first-${x}.html`);
  if (!fs.existsSync(f)) { problems.push(`UNDECLARED  first-${x}.html: missing (three first screens, 3aj.2)`); continue; }
  const html = fs.readFileSync(f, 'utf8');
  const meta = (/<meta\s+name=["']first-screen["']\s+content=["']([^"']+)["']/i.exec(html) || [])[1] || '';
  const d = Object.fromEntries(meta.split(';').map((kv) => kv.split('=').map((s) => s.trim().toLowerCase())).filter((p) => p.length === 2 && p[0]));
  const miss = KEYS.filter((k) => !d[k]);
  if (miss.length) problems.push(`UNDECLARED  first-${x}.html: <meta name="first-screen"> lacks ${miss.join(', ')} (3aj.20)`);
  if (/data-placeholder/i.test(html) || /to be made/i.test(html) || /data:image\/svg\+xml[^"')]*<rect[^>]*\/>\s*<\/svg>/i.test(decodeURIComponent(html.replace(/%(?![0-9A-F]{2})/gi, '%25'))))
    problems.push(`PLACEHOLDER first-${x}.html: a stand-in is still on the screen; show a still of the key frame, never grey or a caption (3aj.21)`);
  const main = (/<img[^>]+src=["']([^"']+)["']/i.exec(html.replace(/<header[\s\S]*?<\/header>/i, '')) || [])[1] || '';
  screens.push({ x, d, main: path.basename(main) });
}
for (let i = 0; i < screens.length; i++) for (let j = i + 1; j < screens.length; j++) {
  const a = screens[i], b = screens[j];
  const same = KEYS.filter((k) => a.d[k] && a.d[k] === b.d[k]);
  if (same.length > 2) problems.push(`APART       ${a.x.toUpperCase()} and ${b.x.toUpperCase()} share ${same.length} of five (${same.join(', ')}); each pair differs on at least three (3aj.20)`);
}
if (screens.length === 3 && screens.every((s) => s.main && s.main === screens[0].main)) problems.push(`SAMEPHOTO   all three screens lead with ${screens[0].main} (3aj.20)`);
if (problems.length) { console.log(`THREE APART  ${dir}\n  ${problems.join('\n  ')}`); process.exit(1); }
console.log(`three first screens apart and finished: ${screens.map((s) => `${s.x.toUpperCase()} ${s.d.layout}/${s.d.event}`).join(', ')}`);

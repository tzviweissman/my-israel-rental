#!/usr/bin/env node
/**
 * The ideas gate (Tzvi, 29 Oct 2026, on Krysp's first four opening ideas: "all your food wow moments
 * are too similar ... did you look at our inspo sources before showing ideas", then "make sure that
 * you dont keep skipping looking through the inspo sources"). check-references.mjs only asked that
 * REFERENCES.md exist; a helper wrote it, and the ideas were then made from three of its pictures,
 * two of them the same kind of event as earlier sites (pieces arriving to fill the board, as
 * noa-levi and michal-balloons; crumbs dropping, as chicken-munch and american-crust).
 *
 * So the ideas themselves are checked, BEFORE they are shown or any credit is spent. The build holds
 * IDEAS.md, one block per idea:
 *
 *   ## E. The blueprint
 *   - motion: blueprint, her photo turns into a numbered technical drawing      (a kind, then what it is)
 *   - sources: docs/inspo/awwwards-2026-10-18/usav-4-photo-to-map.webp, docs/inspo/.../acme-1-1-line-drawing-cutaway.webp
 *   - steps: 1 ... 2 ... 3 ...
 *
 * and fails when:
 *   - there are fewer than three ideas, or none headed "Own" (from the business's own words or world);
 *   - an idea's motion kind is one scrollcraft/motions.json says another site already uses;
 *   - an idea cites fewer than two saved pictures, from fewer than two saved sources, a picture that
 *     does not exist, or one REFERENCES.md does not name (so ideas come from the reading, not beside it);
 *   - REFERENCES.md names a picture that does not exist in docs/inspo (an invented reading);
 *   - an idea has fewer than three steps;
 *   - a "Chosen:" line names an idea whose kind motions.json does not yet list for this build.
 * It runs check-references.mjs too.
 *
 *   node scripts/check-ideas.mjs <build-folder>      exit 1 with what is wrong
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkReferences } from './check-references.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const INSPO = path.join(ROOT, 'docs', 'inspo');
const PIC = /[\w./-]+\.(?:webp|png|jpe?g)/gi;

const allPictures = () => {
  const out = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(webp|png|jpe?g)$/i.test(e.name)) out.set(e.name.toLowerCase(), path.relative(INSPO, p).split(path.sep)[0]);
    }
  };
  walk(INSPO);
  return out;
};

export function checkIdeas(dir) {
  const slug = path.basename(dir);
  const problems = checkReferences(dir).map((p) => `References: ${p}`);
  const file = path.join(dir, 'IDEAS.md');
  if (!fs.existsSync(file)) return [...problems, 'no IDEAS.md in the build folder (see scripts/check-ideas.mjs)'];
  const pics = allPictures();
  const refs = fs.existsSync(path.join(dir, 'REFERENCES.md')) ? fs.readFileSync(path.join(dir, 'REFERENCES.md'), 'utf8') : '';
  for (const p of new Set((refs.match(PIC) || []).filter((x) => path.basename(x).includes('-')))) { // saved pictures are named name-n-what; the owner's pNN.jpg are not
    if (!pics.has(path.basename(p).toLowerCase())) problems.push(`REFERENCES.md names ${p}, which is not in docs/inspo`);
  }
  const motions = JSON.parse(fs.readFileSync(path.join(ROOT, 'scrollcraft', 'motions.json'), 'utf8'));
  const text = fs.readFileSync(file, 'utf8');
  const blocks = text.split(/^## /m).slice(1).filter((b) => !/^Chosen\b/i.test(b));
  if (blocks.length < 3) problems.push(`only ${blocks.length} ideas; show at least three`);
  if (!blocks.some((b) => /^Own\b/i.test(b) || /^[A-Z]\.\s*Own\b/i.test(b))) problems.push('no idea headed "Own" (from the business\'s own words or world, rule 3q)');
  const kinds = {};
  for (const b of blocks) {
    const name = b.split('\n')[0].trim();
    const field = (k) => (new RegExp(`^\\s*-\\s*${k}\\s*:\\s*(.*)$`, 'im').exec(b) || [])[1]?.trim() || '';
    const motion = field('motion');
    const kind = motion.split(/[,(]/)[0].trim().toLowerCase();
    kinds[name] = kind;
    if (!kind) problems.push(`${name}: no "- motion:" line`);
    else if (motions[kind]) {
      const others = motions[kind].used_by.filter((s) => s !== slug);
      if (others.length) problems.push(`${name}: "${kind}" (${motions[kind].what}) is already used by ${others.join(', ')}`);
    } else if (motion.length < kind.length + 15) problems.push(`${name}: a new kind "${kind}" needs a few words saying what happens`);
    const cited = field('sources').match(PIC) || [];
    const folders = new Set();
    for (const c of cited) {
      const base = path.basename(c).toLowerCase();
      if (!pics.has(base)) problems.push(`${name}: ${c} is not in docs/inspo`);
      else folders.add(pics.get(base));
      if (!refs.toLowerCase().includes(base)) problems.push(`${name}: ${path.basename(c)} is not named in REFERENCES.md`);
    }
    if (cited.length < 2 || folders.size < 2) problems.push(`${name}: cite at least two saved pictures from two different saved sources`);
    if ((field('steps').match(/\b\d+[.)]?\s/g) || []).length < 3) problems.push(`${name}: write its steps (at least three, numbered)`);
  }
  const chosen = (/^## Chosen\s*:?\s*(.+)$/im.exec(text) || [])[1];
  if (chosen) {
    const name = Object.keys(kinds).find((n) => n.toLowerCase().startsWith(chosen.trim().toLowerCase().slice(0, 2)));
    const k = name && kinds[name];
    if (k && !(motions[k]?.used_by || []).includes(slug)) problems.push(`chosen ${name}: add "${k}" with "${slug}" to scrollcraft/motions.json so the next site cannot repeat it`);
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: node scripts/check-ideas.mjs <build-folder>'); process.exit(2); }
  const dir = fs.existsSync(arg) ? arg : path.join(ROOT, 'scrollcraft', 'builds', arg);
  const p = checkIdeas(dir);
  if (p.length) { console.error(`IDEAS not ready for ${path.basename(dir)}:\n- ${p.join('\n- ')}`); process.exit(1); }
  console.log(`ideas ready for ${path.basename(dir)}: each from two saved sources, none a kind another site uses`);
}

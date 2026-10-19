#!/usr/bin/env node
/**
 * The concept gate (Tzvi, 19 Oct 2026: "we need originality like this in our
 * pages, you need to use our inspo sources better, why are you making bland
 * websites and not following our rules"). Rules alone did not stop bland
 * pages: the builder read them and graded its own work as passing. This makes
 * the steps that produce originality a file the publish step checks.
 *
 * A build folder must hold CONCEPT.md with:
 *
 *   ## Ideas
 *   - three or more opening ideas, each citing an effect from our inspo
 *     library by its picture, e.g. (docs/inspo/awwwards-food-2026-10-18/crav-burgers-2-burger-inside-title.webp);
 *     every cited picture must exist
 *   - one idea from the business's OWN words or world, marked "Own:"
 *     (The Whipped Cup: "your cup, your cloud" became a walk on the clouds)
 *   ## Chosen
 *   which idea and why, in a few lines
 *   ## Wow gate
 *   the five answers of page rules 3n, numbered 1 to 5
 *   ## Not alike
 *   the line printed by scripts/check-fingerprints.mjs for this build
 *
 *   node scripts/check-concept.mjs <build-folder>     exit 1 with what is missing
 *
 * scripts/publish-page.mjs runs this for a page that is not live yet.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

export function checkConcept(dir) {
  const file = path.join(dir, 'CONCEPT.md');
  if (!fs.existsSync(file)) return ['no CONCEPT.md in the build folder (see scripts/check-concept.mjs for what it holds)'];
  const s = fs.readFileSync(file, 'utf8');
  const part = (h) => { const m = new RegExp(`^##\\s*${h}\\s*$([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, 'im').exec(s); return m ? m[1].trim() : ''; };
  const problems = [];
  const ideas = part('Ideas');
  const refs = [...ideas.matchAll(/docs\/inspo\/[^\s)]+\.(?:webp|png|jpe?g)/gi)].map((m) => m[0]);
  const missing = refs.filter((r) => !fs.existsSync(path.join(ROOT, r)));
  const uniqueRefs = new Set(refs.filter((r) => !missing.includes(r)));
  if (uniqueRefs.size < 3) problems.push(`Ideas: ${uniqueRefs.size} inspo pictures cited that exist (needs 3 or more, each idea from a real saved effect)`);
  if (missing.length) problems.push(`Ideas: these cited pictures do not exist: ${missing.join(', ')}`);
  if (!/^\s*[-*]\s*Own:/im.test(ideas)) problems.push('Ideas: no idea from the business\'s own words or world (a line starting "- Own:")');
  if (part('Chosen').length < 40) problems.push('Chosen: say which idea and why');
  const gate = part('Wow gate');
  const answers = [1, 2, 3, 4, 5].filter((n) => new RegExp(`^\\s*${n}[.)]\\s*\\S{3,}`, 'm').test(gate));
  if (answers.length < 5) problems.push(`Wow gate: ${answers.length} of the 5 answers (page rules 3n)`);
  if (!/different from all \d+ other pages/.test(part('Not alike'))) problems.push('Not alike: paste the passing line from scripts/check-fingerprints.mjs');
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: node scripts/check-concept.mjs <build-folder>'); process.exit(2); }
  const dir = fs.existsSync(arg) ? arg : path.join(ROOT, 'scrollcraft', 'builds', arg);
  const p = checkConcept(dir);
  if (p.length) { console.error(`CONCEPT not ready for ${path.basename(dir)}:\n- ${p.join('\n- ')}`); process.exit(1); }
  console.log(`concept ready for ${path.basename(dir)}`);
}

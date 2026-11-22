#!/usr/bin/env node
/*
 * Every rule a site's RULES.md answers must be in the rules list of the SAME commit (Tzvi, 16 Nov 2026).
 * A session pushed RS Modest's site to main with "R3ac.1 pass" in its RULES.md while the commit adding R3ac.1 to
 * docs/rules-checklist.md stayed on its branch. Its own pre-commit passed (its checkout had the rule), and from then on
 * every publish of that site was refused with "R3ac.1: not in docs/rules-checklist.md".
 *
 *   node scripts/check-push-rules.mjs [commit] [base]   default HEAD; exit 1 when a RULES.md cites a rule the list lacks
 *   With a base, only the RULES.md files changed in base..commit (a push never fails for a site it did not touch).
 *
 * .githooks/pre-push runs it on whatever is pushed to main.
 */
import { execFileSync } from 'child_process';

const ref = process.argv[2] || 'HEAD';
const base = process.argv[3];
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const list = new Set([...git('show', `${ref}:docs/rules-checklist.md`).matchAll(/^(?:- )?(R[0-9][0-9a-z]*\.[0-9]+)\s*(?:\||->)/gm)].map((m) => m[1]));
const problems = [];
const files = base ? git('diff', '--name-only', base, ref, '--', 'scrollcraft/builds') : git('ls-tree', '-r', '--name-only', ref, 'scrollcraft/builds');
for (const f of files.split('\n').filter((f) => /^scrollcraft\/builds\/[^/]+\/RULES\.md$/.test(f))) {
  // same id pattern as check-rules.mjs
  const cited = new Set([...git('show', `${ref}:${f}`).matchAll(/^[-*\s]*(R[0-9][0-9a-z]*\.[0-9]+)\b/gm)].map((m) => m[1]));
  const missing = [...cited].filter((id) => !list.has(id));
  if (missing.length) problems.push(`${f} answers ${missing.join(', ')}, not in docs/rules-checklist.md of this commit`);
}
for (const p of problems) console.log('MISSING RULE ' + p);
if (problems.length) console.log('Push the commit that adds the rule (docs/rules-checklist.md and its other homes) together with the sites that answer it.');
else console.log(`every rule the sites answer is in the rules list (${ref})`);
process.exit(problems.length ? 1 : 0);

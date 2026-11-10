#!/usr/bin/env node
/**
 * Every rule has its home, in both rulebooks (Tzvi, 10 Nov 2026: "i want to keep the rules clean to use up less
 * credits and to make sure everything is followed"). The skill's short file had stopped at 1 Nov: sections 3u and
 * 3w to 3z were in the full rulebook and the checklist but nowhere a build reads.
 *
 * Page rules (docs/page-generation-rules.md, docs/rules-checklist.md, the skill's reference/rules-digest.md):
 *   - every "## <id>." section of the full rulebook is a section of the short file, or is named on its
 *     "Full rulebook only" line
 *   - every section a checklist line comes from (its third column: 3z.1, 0b.10a, 3) exists in the full rulebook
 *   - every section SKILL.md points to (§3g.13) is a section of the short file
 * Ad rules (docs/static-ad-rules.md, docs/ad-rules-checklist.md):
 *   - every section of the rules is numbered ("## 16. ..."), except the opening and Sources
 *   - every ad step names at least one section it comes from, and every section it names exists
 *
 *   node scripts/check-rule-homes.mjs     exit 1 and list each rule without a home
 * Run by the commit check whenever one of these files is staged.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const heads = (t) => new Set([...t.matchAll(/^## ([0-9][0-9a-z]*)\./gm)].map((m) => m[1]));
const top = (id) => (/^([0-9]+[a-z]*)/.exec(id) || [])[1];
const bad = [];

// page rules
const SKILL = '.claude/skills/build-business-page';
const full = heads(read('docs/page-generation-rules.md'));
const digestText = read(`${SKILL}/reference/rules-digest.md`);
const digest = heads(digestText);
const onlyFull = new Set(((/^Full rulebook only[^:]*:(.*)$/m.exec(digestText) || [])[1] || '').match(/[0-9][0-9a-z]*/g) || []);
for (const id of full) if (!digest.has(id) && !onlyFull.has(id)) bad.push(`page rules ${id}: in the full rulebook, missing from ${SKILL}/reference/rules-digest.md (add a short section, or name it on its "Full rulebook only" line)`);
for (const l of read('docs/rules-checklist.md').split('\n')) {
  const m = /^(R[0-9][0-9a-z]*\.[0-9]+)\s*\|[^|]*\|([^|]*)\|/.exec(l);
  if (!m) continue;
  const ids = [...m[2].replace(/-[0-9]+/g, '').matchAll(/\b([0-9]+[a-z]*)(?:\.[0-9a-z]+)*\b/g)].map((x) => x[1]);  // "3v.8-16" is a range
  if (!ids.length) bad.push(`${m[1]}: names no section of the page rules it comes from`);
  for (const id of ids) if (!full.has(id)) bad.push(`${m[1]}: comes from section ${id}, which docs/page-generation-rules.md does not have`);
  // the builder reads a blueprint step, then opens its section in the short file: it must be there (or named as full-rulebook only)
  for (const id of ids) if (full.has(id) && !digest.has(id) && !onlyFull.has(id)) bad.push(`${m[1]}: its section ${id} is not in rules-digest.md, so a build cannot find it`);
}
for (const m of read(`${SKILL}/SKILL.md`).matchAll(/§([0-9]+[a-z]*)/g)) {
  if (!digest.has(m[1])) bad.push(`SKILL.md points to §${m[1]}, which rules-digest.md does not have`);
}

// ad rules
const adText = read('docs/static-ad-rules.md');
const adHeads = heads(adText);
for (const m of adText.matchAll(/^## (.+)$/gm)) {
  if (!/^[0-9]/.test(m[1]) && !/^Sources\b/.test(m[1])) bad.push(`static-ad-rules "## ${m[1]}": give it a section number, so its steps can point to it`);
}
for (const l of read('docs/ad-rules-checklist.md').split('\n')) {
  const m = /^(A[0-9][0-9a-z]*\.[0-9]+)\s*\|[^|]*\|([^|]*)\|/.exec(l);
  if (!m) continue;
  // dates ("Tzvi 10 Nov") and named outside files ("pro-references 4", "voice.md") are sources, not sections
  const src = m[2].replace(/page rules\s+\S+/g, '').replace(/\b(Tzvi|ad maker)\s+[0-9]+\s+[A-Z][a-z]+\b/g, '').replace(/\b[\w-]+(\.md)?\s+[0-9]+\b/g, (s) => (/^(static-ad-rules)\b/.test(s) ? s : ''))
    .replace(/,\s*[0-9]+\s+[A-Z][a-z]+\b/g, '');
  const ids = [...src.matchAll(/(?:^|[\s,])([0-9]+[a-z]*)(?:\.[0-9a-z]+)*(?=[\s,]|$)/g)].map((x) => top(x[1]));
  if (!ids.length) bad.push(`${m[1]}: names no section of static-ad-rules.md it comes from`);
  for (const id of ids) if (!adHeads.has(id)) bad.push(`${m[1]}: comes from section ${id}, which static-ad-rules.md does not have`);
}

if (bad.length) {
  console.log(`Rules without a home (${bad.length}):\n  ${bad.join('\n  ')}`);
  process.exit(1);
}
console.log('rule homes: every page and ad rule has its section');

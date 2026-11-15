// A contents list at the top of each long rule file (Tzvi, 15 Nov 2026).
// Claude may preview only the first ~100 lines of a long file, so each one
// opens with its "## " sections and the line each starts on, for a Read offset.
//
//   node scripts/contents.mjs           rewrite the lists
//   node scripts/contents.mjs --check   fail if a list is out of date (pre-commit)
//
// docs/ad-rules-checklist.md is left out: staging it needs check-ad-designs with
// the local servers up. The skill's full-rules.md gets its list from
// check-rule-copies.mjs --sync, which copies docs/page-generation-rules.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FILES = [
  'docs/page-generation-rules.md',
  'docs/rules-checklist.md',
  'docs/static-ad-rules.md',
  '.claude/skills/build-business-page/reference/rules-digest.md',
  '.claude/skills/build-business-page/reference/design-rules.md',
];
const START = '<!-- contents: made by scripts/contents.mjs, do not edit by hand -->', END = '<!-- /contents -->';

export function withContents(text) {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  let lines = text.split(/\r?\n/);
  const s = lines.indexOf(START), e = lines.indexOf(END);
  if (s !== -1 && e > s) lines.splice(s, e - s + 2); // the block and the blank line after it
  let fence = false;
  const heads = lines.map((l, i) => {
    if (/^\s*```/.test(l)) fence = !fence;
    return !fence && /^## /.test(l) ? i : -1;
  }).filter((i) => i >= 0);
  const at = 2; // after the title line and its blank line
  const size = heads.length + 4; // START, intro, the list, END, blank
  const block = [START, `Sections (line each starts on; read with that offset):`,
    ...heads.map((i) => `- ${i + 1 + size}: ${lines[i].slice(3).trim()}`), END, ''];
  lines.splice(at, 0, ...block);
  return lines.join(nl);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const f of FILES) {
    const p = path.join(ROOT, f), old = fs.readFileSync(p, 'utf8'), next = withContents(old);
    if (next === old) continue;
    if (check) stale.push(f); else { fs.writeFileSync(p, next); console.log(`contents written: ${f}`); }
  }
  if (stale.length) { console.log(`contents list out of date in ${stale.join(', ')}. Run: node scripts/contents.mjs`); process.exit(1); }
}

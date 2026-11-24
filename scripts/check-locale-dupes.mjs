/**
 * A copy name written twice in the same section of en.js or he.js: the later one silently replaces the
 * earlier, so one screen shows another screen's words with no error (24 Nov 2026: the sign-up's new
 * wizard.findTitle "Find your business" turned the Google box's "Find your business on Google" into... the
 * other way round). Run by the commit check whenever a locale file is committed.
 *
 *   node scripts/check-locale-dupes.mjs [file ...]   (default: both locale files)
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { parse } = createRequire(path.join(root, 'frontend', 'package.json'))('@babel/parser');
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : ['frontend/src/locales/en.js', 'frontend/src/locales/he.js'];

const dupes = [];
for (const f of files) {
  const src = readFileSync(path.resolve(root, f), 'utf8');
  const ast = parse(src, { sourceType: 'module' });
  const walk = (node, trail) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ObjectExpression') {
      const seen = new Map();
      for (const p of node.properties) {
        if (p.type !== 'ObjectProperty') continue;
        const k = p.key.name ?? p.key.value;
        if (seen.has(k)) dupes.push(`${f}:${p.loc.start.line} ${[...trail, k].join('.')} (first at line ${seen.get(k)})`);
        else seen.set(k, p.loc.start.line);
        walk(p.value, [...trail, k]);
      }
      return;
    }
    for (const v of Object.values(node)) if (v && typeof v === 'object' && v !== node.loc) walk(v, trail);
  };
  walk(ast.program, []);
}
if (dupes.length) {
  console.error(`Copy names written twice (the later silently wins):\n  ${dupes.join('\n  ')}`);
  process.exit(1);
}
console.log(`no repeated copy names in ${files.length} file(s)`);

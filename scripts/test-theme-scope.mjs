#!/usr/bin/env node
/**
 * Experimental themes stay on the preview page.
 *
 * WHY. A trial palette written on `:root` reached the live home page for the
 * ten minutes it was deployed; a visitor saw the real site go pink while a
 * colour was being judged on a page nobody links to. Tzvi's rule since:
 * a theme under test is scoped under `body.theme-preview`, which only
 * /home-preview sets.
 *
 * This reads every `theme-*.css` except the approved site theme and fails
 * on any rule whose selector is not inside that scope. Static, no build.
 *
 *   node scripts/test-theme-scope.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../frontend/src/styles/', import.meta.url);
const APPROVED = new Set(['theme-flow.css']); // the live palette, global on purpose

const files = readdirSync(dir).filter((f) => /^theme-.*\.css$/.test(f) && !APPROVED.has(f));
let failed = 0;
for (const f of files) {
  const css = readFileSync(join(dir.pathname.replace(/^\/([A-Za-z]:)/, '$1'), f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/(?:^|})\s*([^{}]+?)\s*\{/g)].map((m) => m[1].trim()).filter(Boolean);
  const escaped = selectors.flatMap((s) => s.split(',').map((x) => x.trim())).filter((s) => !s.startsWith('body.theme-preview'));
  if (escaped.length) {
    failed += 1;
    console.log(`  FAIL ${f}: ${escaped.length} rule(s) outside body.theme-preview`);
    escaped.slice(0, 5).forEach((s) => console.log(`         ${s}`));
  } else {
    console.log(`  ok   ${f}: ${selectors.length} rules, all scoped to the preview page`);
  }
}
if (!files.length) console.log('  ok   no experimental theme files');
console.log(failed ? '\ntheme scope: FAIL\n' : '\ntheme scope: all experimental themes are preview-only\n');
process.exit(failed ? 1 : 0);

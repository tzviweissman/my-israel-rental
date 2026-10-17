#!/usr/bin/env node
/**
 * Every hand-built business page (frontend/public/pages/<slug>/*.html):
 * each inline <script> must parse. One that does not stops the whole page
 * from running, and a page built around a film shows a dark screen
 * (The Brown Box, 17 Oct 2026: the publish step rewrote `function url(i)`
 * as if it were a picture path). Run before any push that touches a page,
 * and by publish-page.mjs itself after it writes a page.
 *
 *   node scripts/check-pages-scripts.mjs        exits 1 on any broken script
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const PAGES = path.join(ROOT, 'frontend', 'public', 'pages');

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'assets' ? [] : htmlFiles(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

let bad = 0;
let count = 0;
for (const file of htmlFiles(PAGES)) {
  const html = fs.readFileSync(file, 'utf8');
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const [, attrs, code] = m;
    if (/json/i.test(attrs) || !code.trim()) continue;
    count += 1;
    try {
      if (/module/i.test(attrs)) new vm.SourceTextModule(code); // eslint-disable-line no-new
      else new vm.Script(code, { filename: file }); // eslint-disable-line no-new
    } catch (e) {
      if (e instanceof TypeError && /SourceTextModule/.test(String(e))) continue; // older node: skip modules
      bad += 1;
      const line = html.slice(0, m.index).split('\n').length;
      console.error(`BROKEN ${path.relative(ROOT, file)} (script starting line ${line}): ${e.message}`);
    }
  }
}
console.log(`${count} page scripts checked, ${bad} broken`);
process.exit(bad ? 1 : 0);

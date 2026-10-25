#!/usr/bin/env node
/**
 * Reads a published page's finished files (frontend/public/pages/<slug>/) and fails on any address that will not
 * load on the live site (Tzvi, 25 Oct 2026, after two live breaks on Blazin' Boards in one day: "i feel like weve
 * been having a lot of publishing issues"). Every other check runs on the build BEFORE publish-page rewrites the
 * addresses, so a rewrite mistake reached the live site twice: srcset left relative (the board went blank) and a
 * script-built src="' + url + '" prefixed with /pages/<slug>/ (every card photo broke).
 *
 *   node scripts/check-published.mjs <slug>
 *
 * Fails on: an address of this site (/pages/<slug>/...) whose file does not exist; one with script pieces glued
 * into it (' + or ${); and a relative assets/ path left in an attribute, srcset or url(), which resolves under
 * /business/ on the live site. publish-page.mjs runs it after writing, before anything is committed.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const slug = process.argv[2];
const OUT = path.join(ROOT, 'frontend', 'public', 'pages', slug || '');
if (!slug || !fs.existsSync(OUT)) { console.error('usage: node scripts/check-published.mjs <slug>  (a folder in frontend/public/pages)'); process.exit(2); }

const BASE = `/pages/${slug}/`;
const problems = [];
const files = fs.readdirSync(OUT, { recursive: true }).map(String).filter((f) => /\.(html|css|js)$/i.test(f));
for (const f of files) {
  const text = fs.readFileSync(path.join(OUT, f), 'utf8');
  const urls = [];
  for (const m of text.matchAll(/\s(?:src|href|poster)="([^"]*)"/g)) urls.push(m[1]);
  for (const m of text.matchAll(/\s(?:srcset|imagesrcset)="([^"]*)"/g)) for (const part of m[1].split(',')) urls.push(part.trim().split(/\s+/)[0]);
  for (const m of text.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)) urls.push(m[2]);
  for (const m of text.matchAll(/(['"])(\/pages\/[^'"\s]+)\1/g)) urls.push(m[2]);
  for (const u of urls) {
    if (u.startsWith(BASE)) {
      if (/'\s*\+|\$\{/.test(u)) { problems.push(`${f}: a script-built address was prefixed with ${BASE}: ${u.slice(0, 90)}`); continue; }
      const file = decodeURIComponent(u.slice(BASE.length).split(/[?#]/)[0]);
      if (file && !/\/$/.test(file) && !fs.existsSync(path.join(OUT, file))) problems.push(`${f}: ${u.split('?')[0]} is not in the published folder`);
    } else if (/^(?:\.\/)?assets\//.test(u)) {
      problems.push(`${f}: "${u}" was left relative; on the live site it loads from /business/ and breaks`);
    }
  }
}
const uniq = [...new Set(problems)];
for (const p of uniq) console.log(p);
if (uniq.length) { console.error(`\n${uniq.length} address problem(s) in the published ${slug}: fix publish-page's rewrite or the page, then publish again.`); process.exit(1); }
console.log(`published ${slug}: every address of its own resolves (${files.length} files)`);

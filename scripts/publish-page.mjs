#!/usr/bin/env node
/**
 * Publish a hand-built business page (scrollcraft/builds/<folder>) so the
 * live site shows it AT THE BUSINESS'S OWN ADDRESS, /business/<slug>, in
 * place of the standard listing page (Tzvi, 7 Oct 2026, for Blazin' Boards).
 *
 *   node scripts/publish-page.mjs <build-folder> <business-slug>
 *   e.g. node scripts/publish-page.mjs blazin-boards blazin-boards
 *
 * What it does:
 *   1. Copies the page's own files (*.html, *.css, *.js, assets/) into
 *      frontend/public/pages/<slug>/. Working files stay behind: lab/, src/,
 *      gen/, screenshots/, BRIEF.md, options and test pages.
 *   2. Rewrites relative links in the HTML ("assets/x.jpg", "order.html",
 *      url(assets/...)) to /pages/<slug>/..., because the page is SERVED at
 *      /business/<slug>, where a relative path would resolve under
 *      /business/. Anchors (#order), absolute and external links are left.
 *   3. Adds the slug to frontend/public/pages/pages.json, the one list both the
 *      server (frontend/server.js) and the browser app (BusinessPage.jsx)
 *      read to know which businesses have a hand-built page.
 *
 * CRA copies public/ into the build, so the files ship with the next
 * frontend deploy. Unpublish: delete frontend/public/pages/<slug>/ and remove
 * the slug from pages.json.
 */
import fs from 'node:fs';
import path from 'node:path';

const [folder, slug] = process.argv.slice(2);
if (!folder || !slug || !/^[a-z0-9-]{2,60}$/.test(slug)) {
  console.error('usage: node scripts/publish-page.mjs <build-folder> <business-slug>');
  process.exit(1);
}
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'scrollcraft', 'builds', folder);
const OUT = path.join(ROOT, 'frontend', 'public', 'pages', slug);
const BASE = `/pages/${slug}/`;
// Static files are cached for a year by serve.json, so each publish stamps
// its links: a republished page never runs with last month's CSS.
const STAMP = Date.now().toString(36);
const withStamp = (u) => (/\.html(?:[?#]|$)/i.test(u) ? u : `${u}${u.includes('?') ? '&' : '?'}v=${STAMP}`);
const SKIP_HTML = /^(options|buttons|before|test)[\w-]*\.html$/i;

if (!fs.existsSync(path.join(SRC, 'index.html'))) {
  console.error(`no index.html in ${SRC}`);
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const relative = (u) => u && !/^(?:[a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(u);
function rewrite(html) {
  return html
    // A link back to the page itself goes to the business's address.
    .replace(/(\shref=")(?:\.\/)?index\.html(#[^"]*)?"/g, (m, a, h) => `${a}/business/${slug}${h || ''}"`)
    .replace(/(\s(?:src|href|poster)=")([^"]+)"/g, (m, a, u) => (relative(u) ? `${a}${BASE}${withStamp(u)}"` : m))
    .replace(/url\((['"]?)([^)'"]+)\1\)/g, (m, q, u) => (relative(u) ? `url(${q}${BASE}${withStamp(u)}${q})` : m));
}

let files = 0;
for (const name of fs.readdirSync(SRC)) {
  const from = path.join(SRC, name);
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    if (name !== 'assets') continue;
    fs.cpSync(from, path.join(OUT, name), { recursive: true });
    files += fs.readdirSync(from).length;
  } else if (/\.html$/i.test(name) && !SKIP_HTML.test(name)) {
    fs.writeFileSync(path.join(OUT, name), rewrite(fs.readFileSync(from, 'utf8')));
    files += 1;
  } else if (/\.(css|js)$/i.test(name)) {
    fs.copyFileSync(from, path.join(OUT, name));
    files += 1;
  }
}

const listFile = path.join(ROOT, 'frontend', 'public', 'pages', 'pages.json');
let list = [];
try { list = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch { /* first page */ }
if (!list.includes(slug)) list.push(slug);
fs.writeFileSync(listFile, `${JSON.stringify(list.sort(), null, 2)}\n`);
console.log(`published ${folder} as /business/${slug} (${files} files in frontend/public/pages/${slug}); pages: ${list.join(', ')}`);

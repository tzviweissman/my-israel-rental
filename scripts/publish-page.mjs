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
 *   3. Marks what the owner may edit in the dashboard (text, photos) with
 *      data-mir-key, keyed by a hash of the original content, so a republish
 *      of unchanged content keeps their edits (routes/marketplace/page_edits.py).
 *   4. Adds the slug to frontend/public/pages/pages.json, the one list both the
 *      server (frontend/server.js) and the browser app (BusinessPage.jsx)
 *      read to know which businesses have a hand-built page.
 *
 * CRA copies public/ into the build, so the files ship with the next
 * frontend deploy. Unpublish: delete frontend/public/pages/<slug>/ and remove
 * the slug from pages.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

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

// A page going live for the first time needs its concept sheet (Tzvi, 19 Oct
// 2026: bland pages were shipped although the rules said otherwise). Pages
// already live republish as before.
{
  const live = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend', 'public', 'pages', 'pages.json'), 'utf8')); } catch { return []; } })();
  if (!live.includes(slug)) {
    const { checkConcept } = await import('./check-concept.mjs');
    const problems = checkConcept(SRC);
    if (problems.length) {
      console.error(`Not published: ${slug} is a new page and its concept is not ready.\n- ${problems.join('\n- ')}`);
      process.exit(1);
    }
    // and it must not come out like a live page: fonts, colours, design and
    // effects (rules 3p; Tzvi, 20 Oct 2026: "why do you keep making everything so similar")
    const { spawnSync } = await import('node:child_process');
    const fp = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-fingerprints.mjs'), SRC], { encoding: 'utf8' });
    if (fp.status !== 0) {
      console.error(`Not published: ${slug} is too like a live page.\n${fp.stdout}${fp.stderr}`);
      process.exit(1);
    }
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// %23 is an escaped # (a fragment inside an inline SVG data URL, Bun Intended 9 Oct 2026).
const relative = (u) => u && !/^(?:[a-z][a-z0-9+.-]*:|\/|#|%23|\?)/i.test(u);
// The site's own pages (a hand-built page can be a small website, Tzvi
// 12 Oct 2026): a link to "kitchen.html" anywhere, attribute or script
// string, becomes the clean /business/<slug>/kitchen that server.js answers.
const PAGES = fs.readdirSync(SRC).filter((n) => /\.html$/i.test(n) && n !== 'index.html' && !SKIP_HTML.test(n)).map((n) => n.replace(/\.html$/i, ''));
function rewrite(html) {
  for (const name of PAGES) {
    const re = new RegExp(`(["'])(?:\\./)?${name.replace(/-/g, '\\-')}\\.html(?=[?#"'])`, 'g');
    html = html.replace(re, `$1/business/${slug}/${name}`);
  }
  return html
    // A link back to the page itself goes to the business's address.
    .replace(/(\shref=")(?:\.\/)?index\.html(#[^"]*)?"/g, (m, a, h) => `${a}/business/${slug}${h || ''}"`)
    .replace(/(\s(?:src|href|poster)=")([^"]+)"/g, (m, a, u) => (relative(u) ? `${a}${BASE}${withStamp(u)}"` : m))
    // Only a real file path (it has an extension): a script's own
    // `function url(i)` matched this once and broke The Brown Box's film
    // (17 Oct 2026).
    .replace(/url\((['"]?)([^)'"]+)\1\)/g, (m, q, u) => (relative(u) && /\.\w{2,5}(?:[?#]|$)/.test(u) ? `url(${q}${BASE}${withStamp(u)}${q})` : m))
    // Addresses the page's own script builds, e.g. scrubber(el, 'assets/pot.mp4')
    // (La Cholent, 9 Oct 2026): relative strings broke at /business/<slug>.
    .replace(/(['"])(?:\.\/)?(assets\/[^'"\s]*)\1/g, (m, q, u) => `${q}${BASE}${/\.\w{2,5}$/.test(u) ? withStamp(u) : u}${q}`);
}

// What an owner may edit (Tzvi, 9 Oct 2026: edit like Claude Design).
// Text: the outermost element that holds text directly and only inline
// formatting inside it (so its content can be replaced as a whole, and
// frontend/server.js can find its end with one non-greedy match: it never
// contains its own tag). Photos: every <img>. Each gets data-mir-key, a hash
// of what it shows plus its occurrence, inserted into the original source
// without re-serialising the page.
const parse5 = createRequire(path.join(ROOT, 'frontend', 'package.json'))('parse5');
const INLINE = new Set(['span', 'b', 'strong', 'i', 'em', 'u', 'small', 'br', 'sup', 'sub', 'a', 'svg', 'path', 'circle', 'use', 'g']);
const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'a', 'button', 'span', 'small', 'strong', 'em', 'b',
  'label', 'figcaption', 'blockquote', 'dt', 'dd', 'td', 'th', 'div', 'summary', 'cite', 'q']);
const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'video', 'select', 'option', 'textarea', 'head']);
function textOf(n) { return n.nodeName === '#text' ? n.value : (n.childNodes || []).map(textOf).join(''); }
function hasTag(n, tag) { return (n.childNodes || []).some((c) => c.nodeName === tag || hasTag(c, tag)); }
function inlineOnly(n) { return (n.childNodes || []).every((c) => c.nodeName === '#text' || c.nodeName === '#comment' || (INLINE.has(c.nodeName) && inlineOnly(c))); }
function markEditable(html) {
  const doc = parse5.parse(html, { sourceCodeLocationInfo: true });
  const inserts = [];
  const seen = new Map();
  const key = (p, basis) => {
    const h = crypto.createHash('sha1').update(basis).digest('hex').slice(0, 8);
    const n = seen.get(p + h) || 0;
    seen.set(p + h, n + 1);
    return `${p}-${h}-${n}`;
  };
  const attr = (n, a) => (n.attrs || []).find((x) => x.name === a);
  // Text the page's own script writes (a running total, a chosen flavour)
  // is not the owner's to edit: the script would overwrite it.
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');
  const scripted = (n) => {
    const id = attr(n, 'id')?.value;
    return Boolean(attr(n, 'aria-live')) || Boolean(id && (scripts.includes(`'#${id}'`) || scripts.includes(`"#${id}"`) || scripts.includes(`('${id}')`) || scripts.includes(`("${id}")`)));
  };
  const walk = (n) => {
    if (SKIP.has(n.nodeName) || attr(n, 'data-mir-skip')) return;
    const loc = n.sourceCodeLocation;
    if (n.nodeName === 'img' && loc?.startTag && !attr(n, 'data-mir-key') && !scripted(n)) {
      inserts.push([loc.startTag.endOffset - (html[loc.startTag.endOffset - 2] === '/' ? 2 : 1), ` data-mir-key="${key('i', (attr(n, 'src')?.value || '') + (attr(n, 'alt')?.value || ''))}"`]);
      return;
    }
    const direct = (n.childNodes || []).some((c) => c.nodeName === '#text' && c.value.trim());
    const text = textOf(n).replace(/\s+/g, ' ').trim();
    if (TEXT_TAGS.has(n.nodeName) && direct && text && !scripted(n) && inlineOnly(n) && !hasTag(n, n.nodeName) && loc?.startTag && loc.endTag) {
      inserts.push([loc.startTag.endOffset - 1, ` data-mir-key="${key('t', n.nodeName + '|' + text)}"`]);
      return;
    }
    (n.childNodes || []).forEach(walk);
    if (n.content) (n.content.childNodes || []).forEach(walk);
  };
  walk(doc);
  inserts.sort((x, y) => y[0] - x[0]);
  let out = html;
  for (const [at, s] of inserts) out = out.slice(0, at) + s + out.slice(at);
  return { html: out, count: inserts.length };
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
    const marked = markEditable(fs.readFileSync(from, 'utf8'));
    fs.writeFileSync(path.join(OUT, name), rewrite(marked.html));
    console.log(`  ${name}: ${marked.count} editable`);
    files += 1;
  } else if (/\.(css|js)$/i.test(name) || name === 'prices.json') {
    // prices.json: which listing each price on the page comes from, so
    // frontend/server.js can show the price set in the dashboard.
    fs.copyFileSync(from, path.join(OUT, name));
    files += 1;
  }
}

// The site's pages, for the dashboard editor's page switcher (PageEditor.jsx).
// Home, then the content pages, then an order flow (book*) in its own order.
// An order flow's pages in step order (KasherMyBnb's book*, Blazin' Boards' order*).
const STEP = ['book', 'book-details', 'book-review', 'book-sent', 'order', 'order-when', 'order-details', 'order-done'];
const rank = (n) => (STEP.includes(n) ? 100 + STEP.indexOf(n) : /^(book|order)/.test(n) ? 200 : 0);
const ORDERED = [...PAGES].sort((x, y) => (rank(x) - rank(y)) || x.localeCompare(y));
const site = ['index', ...ORDERED].map((name) => {
  const html = fs.readFileSync(path.join(SRC, `${name}.html`), 'utf8');
  const title = ((/<title>([^<]*)<\/title>/i.exec(html) || [])[1] || name).split(' · ')[0].trim();
  return { page: name, title: name === 'index' ? 'Home' : title };
});
fs.writeFileSync(path.join(OUT, 'site.json'), `${JSON.stringify(site, null, 2)}\n`);

const listFile = path.join(ROOT, 'frontend', 'public', 'pages', 'pages.json');
let list = [];
try { list = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch { /* first page */ }
if (!list.includes(slug)) list.push(slug);
fs.writeFileSync(listFile, `${JSON.stringify(list.sort(), null, 2)}\n`);
console.log(`published ${folder} as /business/${slug} (${files} files in frontend/public/pages/${slug}); pages: ${list.join(', ')}`);

// Every script on every published page must still parse after the
// rewriting above: one that does not stops the page and leaves a film-led
// page dark (The Brown Box, 17 Oct 2026). Fails the publish loudly.
{
  const { spawnSync } = await import('node:child_process');
  const check = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-pages-scripts.mjs')], { stdio: 'inherit' });
  if (check.status !== 0) {
    console.error('\nA page script is broken after publishing. Fix it before pushing: the page would show a blank or dark screen.');
    process.exit(1);
  }
}

// A page on the business pages list gets its preview clip re-recorded from
// what was just published, so the tile always shows the page as it is now
// (Tzvi, 18 Oct 2026: "the gift boutiques preview on business pages doesnt
// match their actual page"). Served from the build folder on a local port.
// Skip with --no-preview (check-showcase-previews.mjs then fails until the
// clip is made).
{
  let listed = false;
  try { listed = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend', 'public', 'showcase', 'showcase.json'), 'utf8')).some((x) => x.slug === slug); } catch { /* no list */ }
  if (listed && !process.argv.includes('--no-preview')) {
    const http = await import('node:http');
    const { spawn } = await import('node:child_process');
    const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(SRC, rel);
      if (!file.startsWith(SRC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${server.address().port}/`;
    console.log(`\n${slug} is on the business pages list: re-recording its preview from ${url}`);
    const code = await new Promise((r) => spawn(process.execPath, [path.join(ROOT, 'scripts', 'showcase-preview.mjs'), slug, url],
      { cwd: path.join(ROOT, 'frontend'), stdio: 'inherit' }).on('exit', r));
    server.close();
    if (code !== 0) { console.error('The preview clip could not be re-recorded; run scripts/showcase-preview.mjs before pushing.'); process.exit(1); }
  }
}

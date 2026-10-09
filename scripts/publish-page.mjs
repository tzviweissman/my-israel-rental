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

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// %23 is an escaped # (a fragment inside an inline SVG data URL, Bun Intended 9 Oct 2026).
const relative = (u) => u && !/^(?:[a-z][a-z0-9+.-]*:|\/|#|%23|\?)/i.test(u);
function rewrite(html) {
  return html
    // A link back to the page itself goes to the business's address.
    .replace(/(\shref=")(?:\.\/)?index\.html(#[^"]*)?"/g, (m, a, h) => `${a}/business/${slug}${h || ''}"`)
    .replace(/(\s(?:src|href|poster)=")([^"]+)"/g, (m, a, u) => (relative(u) ? `${a}${BASE}${withStamp(u)}"` : m))
    .replace(/url\((['"]?)([^)'"]+)\1\)/g, (m, q, u) => (relative(u) ? `url(${q}${BASE}${withStamp(u)}${q})` : m))
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

const listFile = path.join(ROOT, 'frontend', 'public', 'pages', 'pages.json');
let list = [];
try { list = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch { /* first page */ }
if (!list.includes(slug)) list.push(slug);
fs.writeFileSync(listFile, `${JSON.stringify(list.sort(), null, 2)}\n`);
console.log(`published ${folder} as /business/${slug} (${files} files in frontend/public/pages/${slug}); pages: ${list.join(', ')}`);

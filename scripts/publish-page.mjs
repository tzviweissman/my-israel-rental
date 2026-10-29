#!/usr/bin/env node
/**
 * Publish a hand-built business page (scrollcraft/builds/<folder>) so the
 * live site shows it AT THE BUSINESS'S OWN ADDRESS, /business/<slug>, in
 * place of the standard listing page (Tzvi, 7 Oct 2026, for Blazin' Boards).
 *
 *   node scripts/publish-page.mjs <build-folder> <business-slug> [--check]
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

const [folder, slug] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!folder || !slug || !/^[a-z0-9-]{2,60}$/.test(slug)) {
  console.error('usage: node scripts/publish-page.mjs <build-folder> <business-slug>');
  process.exit(1);
}
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'scrollcraft', 'builds', folder);
// The local servers below answer byte ranges, as a real host does: without them a film cannot seek, so a film the
// page scrubs from the scroll stayed on its first frame in every check and in the business pages clip (Michal
// Balloons, 25 Oct 2026)
function sendFile(req, res, file, type) {
  const size = fs.statSync(file).size, m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (!m || (!m[1] && !m[2])) { res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' }); fs.createReadStream(file).pipe(res); return; }
  const start = m[1] ? +m[1] : Math.max(0, size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
  if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); res.end(); return; }
  res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes' });
  fs.createReadStream(file, { start, end }).pipe(res);
}
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

// Every rule is checked on EVERY publish, new page or republish, and every problem is listed at once
// (Tzvi, 24 Oct 2026: "the rules get skipped a lot"; that day three first publishes stopped one problem
// at a time, ten minutes apart, on rules added after the sites were built). Republishes used to skip
// all of this, so a rule broken by a later change went live unseen.
// A rule added after the site was first published is the exception (Tzvi, 29 Oct 2026: "new rules
// shouldnt affect already made sites"): its check is not run until the site's RULES.md answers it.
//   --check   run everything, list every problem, publish nothing (use it before asking to publish)
// The concept sheet (Tzvi, 19 Oct 2026: bland pages shipped although the rules said otherwise) and the
// look-alike check (rules 3p: "why do you keep making everything so similar") stay for new pages only:
// a live page was compared when it first went up, and comparing it with itself would fail.
const CHECK_ONLY = process.argv.includes('--check');
{
  const live = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend', 'public', 'pages', 'pages.json'), 'utf8')); } catch { return []; } })();
  const isNew = !live.includes(slug);
  const { spawnSync, spawn } = await import('node:child_process');
  const problems = [];
  if (isNew) {
    const { checkConcept } = await import('./check-concept.mjs');
    const c = checkConcept(SRC);
    if (c.length) problems.push(`concept not ready (new page):\n- ${c.join('\n- ')}`);
    const fp = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-fingerprints.mjs'), SRC], { encoding: 'utf8' });
    if (fp.status !== 0) problems.push(`too like a live page:\n${fp.stdout}${fp.stderr}`);
  }
  // every line of the rules checklist answered in RULES.md, and answered after the last change
  const rules = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-rules.mjs'), SRC], { encoding: 'utf8' });
  // a new site is reviewed by someone who did not build it (rules 3a, 27 Oct 2026; check-build.mjs says how)
  const review = path.join(SRC, 'review.md');
  if (isNew && !(fs.existsSync(review) && /^Verdict:\s*PASS\b/m.test(fs.readFileSync(review, 'utf8'))))
    problems.push('no independent review: review.md with "Verdict: PASS" from a Sonnet subagent that did not build the site (docs/page-review-checklist.md)');
  if (rules.status !== 0) problems.push(`rules not all answered (check-rules):\n${rules.stdout.split('\n').filter((l) => /FAIL|problem/.test(l)).join('\n')}`);
  // and every page of it fits the screen, with no photo blown up past its size (rules 3c.12,
  // 3p.6; Tzvi, 20 Oct 2026: "make sure the rules will prevent this in the future"), has no
  // glitches (3s: check-site) and switches smoothly (3s: check-motion); all three run, all reported
  const http = await import('node:http');
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '').replace(new RegExp('^pages/' + slug + '/'), '') || 'index.html'; // the page's own published address (/pages/<slug>/..., The Gift Boutique's fallback photos) is served from the build
    const file = path.join(SRC, rel);
    if (!file.startsWith(SRC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    sendFile(req, res, file, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const pages = fs.readdirSync(SRC).filter((f) => f.endsWith('.html') && !SKIP_HTML.test(f)).map((f) => base + f);
  const run = (script) => new Promise((r) => { let out = ''; const c = spawn(process.execPath, [path.join(ROOT, 'scripts', script), ...pages], { cwd: ROOT });
    c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; }); c.on('exit', (code) => r({ code, out })); });
  // one after another (check-motion times frames, so it must not share the machine), never stopping early
  const results = [];
  // A failure that is only a timing measure (SMOOTH frame rate, a FLASH on two quick taps) is run once more before it
  // counts: on a computer running several sessions' browsers these tripped on pages that pass alone (25 Oct 2026).
  const onlyTiming = (out) => { const bad = out.split('\n').filter((l) => /^[A-Z]{4,}\s/.test(l)); return bad.length > 0 && bad.every((l) => /^(SMOOTH|FLASH|HEAVY|BUSY)\s/.test(l)); };
  // A check that belongs to a checklist rule added after this site was first published is not run (Tzvi, 29 Oct
  // 2026: "new rules shouldnt affect already made sites"; scripts/rule-dates.mjs). A new check gets its own script
  // and its rule id here, so it can be told apart from the rules the site was made under.
  const { newerRules } = await import('./rule-dates.mjs');
  const newer = newerRules(ROOT, SRC);
  for (const [script, why, rule] of [['check-fits.mjs', 'does not fit the screen'], ['check-site.mjs', 'has glitches'], ['check-motion.mjs', 'does not switch smoothly'],
    // smooth on a slowed phone, and repeated labels keep one place (Tzvi, 26-27 Oct 2026; rules 3s.27)
    ['check-speed.mjs', 'is not smooth on a phone'], ['check-overlap.mjs', 'has words on words', 'R3s.26'], ['check-opening-scroll.mjs', 'has an opening scroll that is not smooth or too short', 'R3h.20'], ['check-same-place.mjs', 'moves a repeated label', 'R3s.27'], ['check-one-scroll.mjs', 'holds the scroll too much', 'R3h.21'],
    // on a phone the opening photo is seen, not covered by words and shades (Tzvi, 28 Oct 2026; rules 5b.3)
    ['check-photo-clear.mjs', 'covers its opening photo on a phone', 'R5b.3'],
    // from Tzvi's seven videos (29 Oct 2026): no blank screen in the scroll, the order form arrives filled in
    ['check-blank.mjs', 'shows a blank screen', 'R3s.28'], ['check-prefill.mjs', 'has an order form that is not filled in', 'R3k.10']]) {
    if (rule && newer.has(rule)) { console.log(`${script}: not run, rule ${rule} was added after this site was made`); continue; }
    let r = await run(script);
    if (r.code !== 0 && onlyTiming(r.out)) { console.log(`${script}: only a timing measure failed, running it once more`); r = await run(script); }
    results.push({ why, ...r });
  }
  server.close();
  for (const r of results) if (r.code !== 0) problems.push(`${r.why}:\n${r.out.split('\n').filter((l) => l.trim() && !/: checked$|^\S+: \d+ choices tapped/.test(l)).join('\n')}`);
  if (problems.length) {
    console.error(`Not published: ${slug} has ${problems.length} kind(s) of problem. Fix them all, then run again.\n\n${problems.join('\n\n')}`);
    process.exit(1);
  }
  if (CHECK_ONLY) { console.log(`${slug}: every check passes (concept${isNew ? ', look-alike, review' : ''}, rules, fits, site, motion, speed, same place); nothing published (--check)`); process.exit(0); }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// %23 is an escaped # (a fragment inside an inline SVG data URL, Bun Intended 9 Oct 2026).
// A value starting with ' or ${ is a script building the attribute (src="' + url + '"), not a path: prefixing it
// pointed every Blazin' Boards card photo at /pages/... (25 Oct 2026).
const relative = (u) => u && !/^(?:[a-z][a-z0-9+.-]*:|\/|#|%23|\?|'|\$\{)/i.test(u);
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
    // srcset and a preload's imagesrcset hold several addresses ("a.webp 1000w, b.webp 1510w"): each one is
    // rewritten. Left relative, they pointed at /business/assets/ and Blazin' Boards' board vanished (25 Oct 2026).
    .replace(/(\s(?:srcset|imagesrcset)=")([^"]+)"/g, (m, a, list) => `${a}${list.split(',').map((part) => {
      const [u, ...rest] = part.trim().split(/\s+/);
      return [relative(u) ? `${BASE}${withStamp(u)}` : u, ...rest].join(' ');
    }).join(', ')}"`)
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

// The finished files, as the live site will serve them: every address of this site must load (25 Oct 2026: two
// rewrite mistakes broke Blazin' Boards' pictures live, because every other check ran before the rewrite).
{
  const { spawnSync } = await import('node:child_process');
  const c = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-published.mjs'), slug], { cwd: ROOT, encoding: 'utf8' });
  process.stdout.write(c.stdout || '');
  if (c.status !== 0) { console.error(c.stderr || ''); console.error(`Not published: ${slug}'s finished files have broken addresses (above). frontend/public/pages/${slug} was written but not recorded, so the commit check refuses it until this is fixed.`); process.exit(1); }
}

const listFile = path.join(ROOT, 'frontend', 'public', 'pages', 'pages.json');
let list = [];
try { list = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch { /* first page */ }
if (!list.includes(slug)) list.push(slug);
fs.writeFileSync(listFile, `${JSON.stringify(list.sort(), null, 2)}\n`);
// the commit check refuses a live page that differs from what this script wrote (hand edits go to the build)
const { recordPublished } = await import('./live-hash.mjs');
recordPublished(ROOT, slug, folder, OUT);
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
  // Every published site appears on /showcase and the home page strip, added here the first time it is published
  // (Tzvi, 24 Oct 2026: "when we publish i want it to automatically add it to the business page section", after
  // American Crust and RS Modest went live but were missing from the gallery). The card's words come from the
  // build: an optional scrollcraft/builds/<folder>/showcase.json ({ name, line, line_he, logo or mark }) wins;
  // otherwise the name is og:site_name or the title before " · ", the line is the meta description's first
  // sentence, and the logo is the build's assets/logo* file (else a letter mark). line_he, when missing, shows
  // the English line until it is added. The clip is then recorded below, as for any listed page.
  if (!listed && !process.argv.includes('--no-preview')) {
    const SHOW = path.join(ROOT, 'frontend', 'public', 'showcase');
    const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
    const meta = (re) => ((html.match(re) || [])[1] || '').replace(/&#x27;|&#39;|&rsquo;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
    let card = {};
    try { card = JSON.parse(fs.readFileSync(path.join(SRC, 'showcase.json'), 'utf8')); } catch { /* derive it */ }
    const name = card.name || meta(/<meta property="og:site_name" content="([^"]+)"/) || meta(/<title>([^<]+)/).split(/\s[·|–-]\s|,\s|\.\s/)[0].trim();
    let line = card.line || meta(/<meta name="description" content="([^"]+)"/).split(/(?<=[.!?])\s/)[0].replace(/\.$/, '');
    if (line.length > 72) line = `${line.slice(0, 70).replace(/[ ,;:]+\S*$/, '')}`;
    const entry = { slug, name, line };
    if (card.line_he) entry.line_he = card.line_he;
    else {
      // the Hebrew line, written by Claude the same way the listings are translated (backend/scripts/he_line.py;
      // Tzvi, 25 Oct 2026). Needs backend/.env (its key); without it the card shows the English line.
      const { spawnSync } = await import('node:child_process');
      const py = [path.join(ROOT, 'backend', '.venv', 'Scripts', 'python.exe'), path.join(ROOT, 'backend', '.venv', 'bin', 'python')].find((f) => fs.existsSync(f)) || 'python';
      const he = spawnSync(py, [path.join(ROOT, 'backend', 'scripts', 'he_line.py'), line], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
      if (he.status === 0 && he.stdout.trim()) entry.line_he = he.stdout.trim();
    }
    const logo = card.logo ? path.join(SRC, card.logo) : ['logo.webp', 'logo.png', 'logo.jpg', 'logo-192.png', 'logo-crop.png', 'mark.webp', 'mark.png'].map((f) => path.join(SRC, 'assets', f)).find((f) => fs.existsSync(f));
    if (logo && !card.mark) {
      const { spawnSync } = await import('node:child_process');
      const out = path.join(SHOW, `${slug}-logo.webp`);
      const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', logo, '-vf', 'scale=96:96:force_original_aspect_ratio=decrease,pad=96:96:(ow-iw)/2:(oh-ih)/2:color=0x00000000', out]);
      if (r.status === 0) entry.logo = `${slug}-logo.webp`;
    }
    if (!entry.logo) Object.assign(entry, { logo: null, mark: card.mark || name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(), ...(card.markColor ? { markColor: card.markColor, markInk: card.markInk } : {}) });
    // its business id: /businesses matches it to the business's own listing (that listing is then not repeated
    // under the business pages, and a search shows the page only when the listing matches)
    try {
      const r = await fetch(`https://myisraelrental.com/api/marketplace/business/${slug}`);
      const b = r.ok ? await r.json() : null;
      if (b && (b.business || b).id) entry.business_id = (b.business || b).id;
    } catch { /* offline: the card still shows, its listing just also shows below */ }
    entry.v = '0'; entry.page = '';
    const listFile = path.join(SHOW, 'showcase.json');
    let list = []; try { list = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch { /* new list */ }
    list.push(entry);
    fs.writeFileSync(listFile, `[\n${list.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n]\n`);
    console.log(`\nadded ${slug} to /showcase: "${name}", "${line}"${entry.logo ? `, logo ${entry.logo}` : `, mark ${entry.mark}`}${entry.line_he ? `, Hebrew "${entry.line_he}"` : ' (no Hebrew line yet: add line_he to frontend/public/showcase/showcase.json)'}`);
    listed = true;
  }
  if (listed && !process.argv.includes('--no-preview')) {
    const http = await import('node:http');
    const { spawn } = await import('node:child_process');
    const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '').replace(new RegExp('^pages/' + slug + '/'), '') || 'index.html'; // the page's own published address (/pages/<slug>/..., The Gift Boutique's fallback photos) is served from the build
      const file = path.join(SRC, rel);
      if (!file.startsWith(SRC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      sendFile(req, res, file, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
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

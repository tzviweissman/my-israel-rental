/**
 * The production server for the built frontend.
 *
 * It replaces `npx serve -s build`, and does exactly what that did, plus
 * one thing that could not be done with a static server at all.
 *
 * THE PROBLEM
 *
 * The front end is a static CRA bundle. react-helmet writes its meta tags
 * in the BROWSER, and no link-preview crawler runs JavaScript — WhatsApp,
 * Facebook, Telegram and the rest fetch the URL and read the HTML as
 * served. So every business page handed back the same index.html: same
 * title, same logo, business name absent. Every business on the site
 * shared one generic preview card.
 *
 * Short links (/p/{slug}) already avoided this, because they are a
 * redirect through the backend and the backend can tell a crawler from a
 * person. The raw /business/{slug} URL has no such hop — and it is the URL
 * owners actually paste, because it is the one in their address bar.
 *
 * WHY A SERVER AND NOT A CONFIG
 *
 * The decision needs the User-Agent, and a static host cannot branch on
 * it. `serve.json` can redirect by path only; a blanket redirect of
 * /business/* to the backend would have to send people back again, and
 * back is the same path — a loop. So the branch lives here, in the
 * smallest amount of server that can make it.
 *
 * SAFETY
 *
 * Everything about the human path is unchanged: same static files, same
 * SPA fallback, same headers and redirects from serve.json, which is
 * loaded rather than reimplemented. The crawler branch is additive and
 * fails open — any error, timeout, or non-200 from the backend falls
 * through to the normal static response. A generic preview card is a
 * disappointment; a page that will not load is an outage, and this must
 * never be able to cause the second one while trying to fix the first.
 */
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const handler = require('serve-handler');
const { slugFromHost } = require('./businessHost');

const BUILD = path.join(__dirname, 'build');
const PORT = Number(process.env.PORT) || 3000;

// Where to ask for a business's preview metadata. Overridable so a staging
// front end talks to its own backend rather than production's.
const API_ORIGIN = (
  process.env.OG_API_ORIGIN
  || process.env.REACT_APP_BACKEND_URL
  || 'https://my-israel-rental-production.up.railway.app'
).replace(/\/+$/, '');

// A crawler must never be left waiting: WhatsApp gives a preview fetch a
// short budget and shows the generic card if it expires. Better to fall
// through to the static file quickly than to hold the connection.
const OG_TIMEOUT_MS = Number(process.env.OG_TIMEOUT_MS) || 2500;

/* Kept deliberately in step with `_PREVIEW_BOTS` in
   backend/routes/short_links.py. It is duplicated because the two run in
   different languages on different services, not because either is the
   copy — a bot missing from this list gets the old generic card, which is
   the behaviour that existed before this file, so drift degrades rather
   than breaks. */
const PREVIEW_BOTS = [
  'facebookexternalhit',   // Facebook, and WhatsApp link previews
  'whatsapp',
  'twitterbot',
  'telegrambot',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'skypeuripreview',
  'pinterestbot',
];

const isPreviewBot = (req) => {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  return PREVIEW_BOTS.some((bot) => ua.includes(bot));
};

/* Search engines and AI assistants (Tzvi, 18 Oct 2026). None of them can
   be relied on to run the app, and ChatGPT, Claude and Perplexity never do:
   each read the standard page as "You need to enable JavaScript". For an
   UPGRADED business or rental (the paid page upgrade, or a designed page)
   they get the page's own content as plain HTML with schema.org data, from
   backend routes/seo.py; anything else, or any failure, falls through to
   what they always got. Free pages are deliberately left as they were. */
const SEARCH_BOTS = [
  'googlebot', 'google-inspectiontool', 'bingbot', 'applebot', 'duckduckbot', 'yandex',
  'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-user', 'claude-searchbot',
  'anthropic-ai', 'perplexitybot', 'perplexity-user', 'ccbot', 'amazonbot',
  'meta-externalagent', 'mistralai-user', 'cohere-ai', 'youbot',
];

const isSearchBot = (req) => {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  return SEARCH_BOTS.some((bot) => ua.includes(bot));
};

const PROPERTY_PATH = /^\/property\/([A-Za-z0-9-]{8,64})\/?$/;

/** GET from the backend with the same short budget as a preview card. */
async function fetchApi(apiPath, req, accept = 'text/html') {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), OG_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_ORIGIN}${apiPath}`, {
      signal: control.signal,
      // The crawler's own user agent, so the visit is not counted as a view.
      headers: { accept, 'user-agent': (req && req.headers['user-agent']) || 'MyIsraelRental-seo' },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const langOf = (req) => (/[?&]lng=he/.test(req.url || '') ? 'he' : 'en');

/* The schema.org block for a hand-built page, added to its head. Those
   pages are plain HTML already; this is what lets Google and AI read the
   business as a business (hours, area, prices, reviews). Cached ten minutes
   per slug so a visitor never waits on it twice. */
const jsonLdCache = new Map();
async function handBuiltJsonLd(slug) {
  const hit = jsonLdCache.get(slug);
  // A miss is retried after a minute, a hit kept for ten.
  if (hit && Date.now() - hit.at < (hit.value ? 10 * 60 * 1000 : 60 * 1000)) return hit.value;
  const text = await fetchApi(`/api/seo/business/${encodeURIComponent(slug)}/jsonld`, null, 'application/json');
  let value = null;
  try {
    const blocks = text ? JSON.parse(text) : null;
    if (Array.isArray(blocks) && blocks.length) {
      value = blocks.map((b) => `<script type="application/ld+json">${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`).join('');
    }
  } catch { /* none */ }
  jsonLdCache.set(slug, { at: Date.now(), value });
  return value;
}

/* /sitemap.xml: the fixed pages in public/sitemap.xml, every hand-built
   page, and every upgraded business and rental from the backend, each with
   its Hebrew address beside it. Falls back to the static file. */
let sitemapCache = null;
async function sitemapXml() {
  if (sitemapCache && Date.now() - sitemapCache.at < 30 * 60 * 1000) return sitemapCache.value;
  const base = fs.readFileSync(path.join(BUILD, 'sitemap.xml'), 'utf8');
  const origin = `https://${PUBLIC_SITE_HOST}`;
  // A hand-built page is one language (its own <html lang>), so it has no
  // Hebrew twin; ?lng=he would only be a duplicate of the same page.
  const entries = [...HAND_BUILT].map((slug) => ({ url: `${origin}/business/${slug}`, single: true }));
  const text = await fetchApi('/api/seo/sitemap-entries', null, 'application/json');
  try {
    for (const e of (text && JSON.parse(text).entries) || []) {
      if (!entries.some((x) => x.url === e.url)) entries.push(e);
    }
  } catch { /* the fixed and hand-built pages still go out */ }
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const urls = entries.map((e) => {
    if (e.single) return `<url><loc>${esc(e.url)}</loc></url>`;
    const he = `${e.url}?lng=he`;
    const alts = `<xhtml:link rel="alternate" hreflang="en" href="${esc(e.url)}"/>`
      + `<xhtml:link rel="alternate" hreflang="he" href="${esc(he)}"/>`;
    const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(e.lastmod || '') ? `<lastmod>${e.lastmod}</lastmod>` : '';
    return `<url><loc>${esc(e.url)}</loc>${lastmod}${alts}</url><url><loc>${esc(he)}</loc>${lastmod}${alts}</url>`;
  }).join('\n');
  let value = base.replace(/<urlset([^>]*)>/, (m, attrs) => (
    /xmlns:xhtml/.test(attrs) ? m : `<urlset${attrs} xmlns:xhtml="http://www.w3.org/1999/xhtml">`
  ));
  value = value.replace(/<\/urlset>\s*$/, `${urls}\n</urlset>\n`);
  sitemapCache = { at: Date.now(), value };
  return value;
}

/* The paths worth answering for. /business/{slug} is the whole reason this
   exists — it is what an owner shares. Anchored and single-segment on
   purpose: /business/abc/photos is not a page, and matching it loosely
   would send a crawler a card for a URL that does not exist. */
const BUSINESS_PATH = /^\/business\/([^/]+)\/?$/;

/** The slug a request is asking about, or null. */
function businessSlug(req) {
  let pathname;
  try {
    ({ pathname } = new URL(req.url, 'http://localhost'));
  } catch {
    return null;
  }
  const m = BUSINESS_PATH.exec(pathname);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]);
  // A slug is a URL segment, not a path. Anything else is not ours to
  // forward to the backend.
  return /^[A-Za-z0-9._-]{1,120}$/.test(slug) ? slug : null;
}

/* ─────────────────────────────────────────────────────────────────────
   BUSINESS SUBDOMAINS

   blazinboards.myisraelrental.com is the same page as
   /business/blazinboards. The rules for reading a Host header live in
   ./businessHost.js.

   A business host serves exactly ONE page, its root, and the build's own
   files (scripts, images, the favicon). Every other path 302s to the same
   path on the main site. That is the mapping, applied consistently:

     * a signed-in session lives in the main site's storage, which a
       different origin cannot read, so /dashboard or /chat on a business
       host would only ever show a signed-out copy of the site;
     * Google sign-in is authorised for the main site's origin, not for
       every subdomain;
     * a link inside the business page to one of its services
       (/businesses/123) is still a working link, it just opens on the
       main site, where the rest of the site is.

   The browser app applies the same rule to navigation that never reaches
   this server (App.js, HostAwareRoutes).

   Read from PUBLIC_SITE_HOST, not hardcoded: staging runs on another host,
   and a second, shorter domain may follow. */
const PUBLIC_SITE_HOST = (process.env.PUBLIC_SITE_HOST || 'myisraelrental.com')
  .trim().toLowerCase().replace(/\.$/, '');

function pathnameOf(req) {
  try {
    return new URL(req.url, 'http://localhost').pathname;
  } catch {
    return null;
  }
}

/** A real file in the build, which a business host must still serve. */
function isBuildFile(pathname) {
  if (!pathname || pathname === '/') return false;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  const full = path.join(BUILD, path.normalize(decoded));
  // Never outside the build directory, whatever the path says.
  if (!full.startsWith(BUILD + path.sep)) return false;
  try {
    return fs.statSync(full).isFile();
  } catch {
    return false;
  }
}

/** The backend's preview HTML, or null if it cannot be had quickly. */
async function fetchPreview(slug) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), OG_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${API_ORIGIN}/api/og/business/${encodeURIComponent(slug)}`,
      { signal: control.signal, headers: { accept: 'text/html' } },
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;   // fail open — the caller serves the static file instead
  } finally {
    clearTimeout(timer);
  }
}

// serve.json is the source of truth for headers and redirects and is
// COPIED INTO THE BUILD by CRA. Loading it keeps this file from becoming a
// second, silently diverging copy of the caching rules.
function serveConfig() {
  const file = path.join(BUILD, 'serve.json');
  let base = {};
  try {
    base = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // Missing or unparseable: serve the files anyway. Losing a
    // Cache-Control header is not a reason to fail to serve the site.
    console.warn('[server] no usable build/serve.json — serving without it');
  }
  return {
    ...base,
    public: BUILD,
    // What `serve -s` did: any unmatched path is the SPA's entry point, so
    // deep links like /business/levi-home-care reach the router.
    rewrites: [{ source: '**', destination: '/index.html' }],
  };
}

const CONFIG = serveConfig();

/* A BUSINESS'S OWN DOMAIN (backend routes/marketplace/custom_domains.py).
   www.mybakery.co.il is added to this service on Railway and answers like
   <slug>.myisraelrental.com: the business page at "/", everything else on
   the main site. Which business is asked of the backend and remembered for
   a few minutes. Only for hosts that are not ours: the apex, its
   subdomains, Railway's own hosts and local addresses never ask. Fails
   closed to "not a business" (the normal site), never an error. */
const DOMAIN_TTL_MS = 5 * 60 * 1000;
const DOMAIN_MISS_TTL_MS = 60 * 1000;
const domainCache = new Map();

function isOwnHost(h) {
  return !h || h === PUBLIC_SITE_HOST || h.endsWith(`.${PUBLIC_SITE_HOST}`)
    || h.endsWith('.railway.app') || h.endsWith('.railway.internal') || h === 'localhost'
    || /^[\d.]+$/.test(h) || h.startsWith('[') || !h.includes('.');
}

async function customDomainSlug(rawHost) {
  const h = String(rawHost || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  if (isOwnHost(h)) return null;
  const hit = domainCache.get(h);
  if (hit && Date.now() - hit.at < (hit.slug ? DOMAIN_TTL_MS : DOMAIN_MISS_TTL_MS)) return hit.slug;
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), 2000);
  let slug = null;
  try {
    const res = await fetch(`${API_TARGET}/api/marketplace/domains/${encodeURIComponent(h)}`, { signal: control.signal });
    if (res.ok) {
      const body = await res.json();
      if (typeof body.slug === 'string' && /^[a-z0-9-]{1,80}$/.test(body.slug)) slug = body.slug;
    }
  } catch { /* not a business: the normal site */ } finally {
    clearTimeout(timer);
  }
  if (domainCache.size > 5000) domainCache.clear();
  domainCache.set(h, { slug, at: Date.now() });
  return slug;
}

/* The app's index.html, telling the browser which business this host is
   (src/utils/businessHost.js reads window.__BIZ_HOST_SLUG): unlike a
   subdomain, a custom host does not say it in its name. */
let indexHtml = null;
function indexFor(slug) {
  if (indexHtml === null) indexHtml = fs.readFileSync(path.join(BUILD, 'index.html'), 'utf8');
  return indexHtml.replace('<head>', `<head><script>window.__BIZ_HOST_SLUG=${JSON.stringify(slug)}</script>`);
}

// Businesses with a hand-built page (scripts/publish-page.mjs writes the list).
const HAND_BUILT_FILE = /^\/pages\/([a-z0-9-]{2,60})\/([a-z0-9-]{1,40})\.html$/;
const HAND_BUILT = (() => {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(BUILD, 'pages', 'pages.json'), 'utf8'));
    return new Set(Array.isArray(list) ? list.filter((s) => /^[a-z0-9-]{2,60}$/.test(s)) : []);
  } catch {
    return new Set();
  }
})();
/* ─────────────────────────────────────────────────────────────────────
   Owner edits on a hand-built page (Tzvi, 9 Oct 2026: edit it like Claude
   Design). publish-page.mjs marks what may be edited with data-mir-key; the
   owner's saved edits (backend routes/marketplace/page_edits.py) are applied
   HERE, to the HTML, so a visitor never sees the old version first. Fails
   open: no answer from the API in time means the page as designed.
   ───────────────────────────────────────────────────────────────────── */
// Short: an owner who saves and opens their page sees the change (and
// ?fresh skips it entirely, which the editor's "View live" uses).
const EDITS_TTL_MS = 5000;
const editsCache = new Map();
async function pageEdits(slug, fresh) {
  const hit = editsCache.get(slug);
  // ?fresh (the editor, "View live") skips the cache, but never more than
  // once a second per page, so it cannot be used to hammer the API.
  if (hit && Date.now() - hit.at < (fresh ? 1000 : EDITS_TTL_MS)) return hit.data;
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), 1500);
  try {
    const res = await fetch(`${API_ORIGIN}/api/marketplace/business/${encodeURIComponent(slug)}/page-edits`, { signal: control.signal });
    const data = res.ok ? await res.json() : null;
    editsCache.set(slug, { at: Date.now(), data });
    return data;
  } catch {
    return hit ? hit.data : null;
  } finally {
    clearTimeout(timer);
  }
}
const KEY_OK = /^[ti]-[0-9a-z]{4,12}-\d{1,3}$/;
const escAttr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function styleRules(style) {
  const css = { d: [], m: [] };
  for (const [key, devs] of Object.entries(style || {})) {
    if (!KEY_OK.test(key)) continue;
    for (const dev of ['d', 'm']) {
      const v = devs && devs[dev];
      if (!v) continue;
      const decl = [];
      if (Number.isFinite(v.x) || Number.isFinite(v.y)) decl.push(`translate:${Number(v.x) || 0}px ${Number(v.y) || 0}px`);
      if (Number.isFinite(v.s) && v.s !== 1) decl.push(`scale:${v.s}`);
      if (v.a) decl.push(`text-align:${{ l: 'left', c: 'center', r: 'right' }[v.a] || 'inherit'}`);
      if (v.h) decl.push('display:none');
      if (decl.length) css[dev].push(`[data-mir-key="${key}"]{${decl.map((d) => `${d} !important`).join(';')}}`);
    }
  }
  // Laptop edits hold everywhere a phone edit does not override.
  return `${css.d.join('')}@media (max-width:767px){${css.m.join('')}}`;
}
const escText = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// public/pages/mir-editor.js shows the same in the editor (boundText there).
function boundText(inner, bind, live, he) {
  if (bind === 'hours') return live && live.hours ? escText(live.hours) : inner;
  const m = /^price:(.{1,200})$/.exec(bind);
  if (!m || !live) return inner;
  let out = inner;
  const p = Number(live.prices && live.prices[m[1]]);
  if (Number.isFinite(p) && p >= 0) {
    const fmt = Number.isInteger(p) ? String(p) : p.toFixed(2);
    let done = false;
    out = out.replace(/(^|>)([^<]*?)(\d+(?:[.,]\d+)?)/, (x, a, b) => { done = true; return `${a}${b}${fmt}`; });
    if (!done) out = `${out} ₪${fmt}`;
  }
  if (live.soldOut && live.soldOut[m[1]]) out += he ? ' · אזל' : ' · Sold out';
  return out;
}
function applyEdits(html, edits, editor, live) {
  let out = html;
  if (edits) {
    for (const [key, val] of Object.entries(edits.text || {})) {
      if (!KEY_OK.test(key)) continue;
      // The backend keeps only plain inline formatting; the marked element
      // never contains its own tag, so its end is the first close tag.
      const re = new RegExp(`(<([a-z0-9]+)\\b[^>]*\\sdata-mir-key="${key}"[^>]*>)[\\s\\S]*?(</\\2>)`, 'i');
      out = out.replace(re, (m, open, tag, close) => `${open}${val}${close}`);
    }
    for (const [key, url] of Object.entries(edits.img || {})) {
      if (!KEY_OK.test(key) || !/^https:\/\//.test(url)) continue;
      const re = new RegExp(`<img\\b[^>]*\\sdata-mir-key="${key}"[^>]*>`, 'i');
      out = out.replace(re, (tag) => tag
        .replace(/\s(?:srcset|sizes)="[^"]*"/gi, '')
        .replace(/\ssrc="[^"]*"/i, ` src="${escAttr(url)}"`));
    }
    // Words tied to the dashboard (Tzvi, 28 Oct 2026: set once, every page shows it): "hours" is the opening hours as
    // set there, "price:<name>" puts that product's or service's price where the number was, "Sold out" while it is.
    for (const [key, bind] of Object.entries(edits.bind || {})) {
      if (!KEY_OK.test(key) || typeof bind !== 'string') continue;
      const re = new RegExp(`(<([a-z0-9]+)\\b[^>]*\\sdata-mir-key="${key}"[^>]*>)([\\s\\S]*?)(</\\2>)`, 'i');
      out = out.replace(re, (m, open, tag, inner, close) => `${open}${boundText(inner, bind, live, /<html[^>]*\slang="he"/i.test(html))}${close}`);
    }
    // The other language of a two-language page (data-en / data-he on the element), plain text.
    for (const [key, val] of Object.entries(edits.alt || {})) {
      if (!KEY_OK.test(key) || typeof val !== 'string') continue;
      const re = new RegExp(`<[a-z0-9]+\\b[^>]*\\sdata-mir-key="${key}"[^>]*>`, 'i');
      out = out.replace(re, (tag) => tag.replace(/\s(data-(?:en|he))="[^"]*"/i, (m, attr) => ` ${attr}="${escAttr(val)}"`));
    }
    const css = styleRules(edits.style);
    if (!css.endsWith('{}') || css.length > 26) out = out.replace(/<\/head>/i, `<style id="mir-edits">${css}</style></head>`);
  }
  // Cards and lines added, removed or reordered (public/pages/mir-items.js), run before the page's own scripts: just
  // before the first script after the last editable element, so a scroll reveal or a button there sees the copies too.
  if (editor || (edits && edits.items && Object.keys(edits.items).length)) {
    const json = JSON.stringify(editor ? {} : edits.items).replace(/</g, '\\u003c');
    const tag = `<script id="mir-items-data" type="application/json">${json}</script><script src="/pages/mir-items.js?v=${EDITOR_STAMP}"></script>`;
    const last = out.lastIndexOf('data-mir-key=');
    const at = last < 0 ? -1 : out.slice(last).search(/<script\b/i);
    out = at < 0 ? out.replace(/<\/body>/i, `${tag}</body>`) : out.slice(0, last + at) + tag + out.slice(last + at);
  }
  if (editor) {
    // The dashboard's editor (src/pages/PageEditor.jsx) frames the page with
    // ?mir-edit=1; it gets the edits as data and the editing script.
    const data = JSON.stringify(edits || {}).replace(/</g, '\\u003c');
    out = out.replace(/<\/body>/i, `<script id="mir-edits-data" type="application/json">${data}</script><script src="/pages/mir-editor.js?v=${EDITOR_STAMP}"></script></body>`);
  }
  return out;
}
/* Prices from the business's own listings. pages/<slug>/prices.json says
   which listing each price on the page shows ({"Personal Training": {"was":
   60, "sym": "₪"}}); when the listing's price differs, "₪60" (or "60 NIS")
   in the page's text becomes the new price. Not inside its scripts, and not
   when two items show the same number, where it cannot tell which is which. */
function applyPrices(html, slug, live) {
  if (!live) return html;
  let map;
  try { map = JSON.parse(fs.readFileSync(path.join(BUILD, 'pages', slug, 'prices.json'), 'utf8')); } catch { return html; }
  const shown = {};
  for (const v of Object.values(map)) shown[`${v.sym}${v.was}`] = (shown[`${v.sym}${v.was}`] || 0) + 1;
  const swaps = [];
  for (const [name, v] of Object.entries(map)) {
    const now = Number(live[name]);
    if (!Number.isFinite(now) || now < 0 || now === v.was || shown[`${v.sym}${v.was}`] > 1) continue;
    const fmt = Number.isInteger(now) ? String(now) : now.toFixed(2);
    const sym = String(v.sym).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    swaps.push([new RegExp(`(${sym}\\s?)${v.was}(?![\\d.,])`, 'g'), `$1${fmt}`]);
    if (v.sym === '₪') swaps.push([new RegExp(`(?<![\\d.,])${v.was}(\\s?NIS)`, 'g'), `${fmt}$1`]);
  }
  if (!swaps.length) return html;
  return html.split(/(<script\b[\s\S]*?<\/script>)/i).map((part) => {
    if (/^<script\b/i.test(part)) return part;
    return swaps.reduce((s, [re, to]) => s.replace(re, to), part);
  }).join('');
}
const EDITOR_STAMP = Date.now().toString(36);
async function sendHandBuilt(req, res, slug, file) {
  const raw = fs.readFileSync(path.join(BUILD, 'pages', slug, file), 'utf8');
  const editor = /[?&]mir-edit=1(?:&|$)/.test(req.url || '');
  const data = await pageEdits(slug, editor || /[?&]fresh(?:=|&|$)/.test(req.url || ''));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  const live = data && { hours: data.hours, prices: data.prices, soldOut: Object.fromEntries((data.products || []).filter((p) => !p.in_stock).map((p) => [p.name, true])) };
  let html = applyPrices(applyEdits(raw, data && data.edits, editor, live), slug, data && data.prices);
  // The business's notice (dashboard, "Notice at the top"; the API sends it only between its dates), on every page of
  // the site, in a corner where no design's own bar sits; closed for the visit with its button.
  if (data && data.notice && data.notice.text && !/id="mir-notice"/.test(html)) {
    html = html.replace(/<\/body>/i, `<div id="mir-notice" role="note" dir="auto"><span>${escText(data.notice.text)}</span><button type="button" aria-label="Close">&times;</button></div>` +
      '<style>#mir-notice{position:fixed;z-index:2147483000;inset-inline-start:16px;bottom:calc(16px + env(safe-area-inset-bottom));max-width:min(520px,calc(100vw - 32px));display:flex;gap:8px;align-items:center;padding:10px 8px 10px 18px;border-radius:14px;background:#111827;color:#fff;font:600 15px/1.35 system-ui,sans-serif;box-shadow:0 12px 32px -12px rgba(0,0,0,.55)}#mir-notice button{all:unset;cursor:pointer;min-width:36px;min-height:36px;display:grid;place-items:center;border-radius:10px;font-size:22px;line-height:1}#mir-notice button:hover{background:rgba(255,255,255,.14)}#mir-notice button:focus-visible{outline:2px solid #24AFEB}</style>' +
      `<script>(function(){var n=document.getElementById('mir-notice'),k='mir-notice:'+${JSON.stringify(data.notice.text).replace(/</g, '\\u003c')};try{if(sessionStorage.getItem(k)){n.remove();return}}catch(e){}n.querySelector('button').onclick=function(){n.remove();try{sessionStorage.setItem(k,1)}catch(e){}}})()</script></body>`);
  }
  if (file === 'index.html' && !/application\/ld\+json/i.test(html)) {
    const ld = await handBuiltJsonLd(slug);
    if (ld) html = html.replace(/<\/head>/i, `${ld}</head>`);
  }
  // The same prices for the page's own script (an order total), as data.
  if (data && data.prices && Object.keys(data.prices).length) {
    const json = JSON.stringify(data.prices).replace(/</g, '\\u003c');
    html = html.replace(/<\/head>/i, `<script id="mir-live-prices" type="application/json">${json}</script></head>`);
  }
  // A page with a catalogue ([data-mir-catalog]) shows the business's own
  // products as they are now: added, removed, repriced, out of stock. The
  // page keeps its typed-in list for when this data is missing.
  if (data && Array.isArray(data.products) && data.products.length && /data-mir-catalog/.test(html)) {
    const json = JSON.stringify(data.products).replace(/</g, '\\u003c');
    html = html.replace(/<\/body>/i, `<script id="mir-live-products" type="application/json">${json}</script><script src="/pages/mir-catalog.js?v=${EDITOR_STAMP}"></script></body>`);
  }
  // A visit, counted for the owner's sales summary (backend page_edits.py designed_site_visit): the browser's
  // visitor id, so one visitor counts once a day; never in the editor or the owner's "View live" (?fresh).
  if (!editor && !/[?&]fresh(?:=|&|$)/.test(req.url || '')) {
    html = html.replace(/<\/body>/i, `<script>(function(){try{var k='mir_vid',v=localStorage.getItem(k);if(!v){v=window.crypto&&crypto.randomUUID?crypto.randomUUID():'r'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(k,v)}fetch('/api/marketplace/business/${slug}/visit',{method:'POST',headers:{'X-Visitor-Id':v},keepalive:true}).catch(function(){})}catch(e){}})()</script></body>`);
  }
  // A page with a gallery ([data-mir-gallery]) shows the photos its owner
  // added in the dashboard, laid out in the page's own style
  // (public/pages/mir-gallery.js). With none, the gallery stays hidden.
  if (data && Array.isArray(data.gallery) && data.gallery.length && /data-mir-gallery/.test(html)) {
    const json = JSON.stringify(data.gallery).replace(/</g, '\\u003c');
    html = html.replace(/<\/body>/i, `<script id="mir-live-gallery" type="application/json">${json}</script><script src="/pages/mir-gallery.js?v=${EDITOR_STAMP}"></script></body>`);
  }
  // And its questions ([data-mir-faq], public/pages/mir-faq.js), added by the
  // owner through "Ask for a change". With none, the section stays hidden.
  if (data && Array.isArray(data.faq) && data.faq.length && /data-mir-faq/.test(html)) {
    const json = JSON.stringify(data.faq).replace(/</g, '\\u003c');
    html = html.replace(/<\/body>/i, `<script id="mir-live-faq" type="application/json">${json}</script><script src="/pages/mir-faq.js?v=${EDITOR_STAMP}"></script></body>`);
  }
  res.end(html);
}


/* ─────────────────────────────────────────────────────────────────────
   SAME-ORIGIN API PROXY

   WHY. The page is served from myisraelrental.com and the API lives on
   my-israel-rental-production.up.railway.app, so every write the app
   makes is a CROSS-ORIGIN POST preceded by a CORS preflight.

   On 1 Sep 2026 someone tried thirteen times to create a business
   account and could not. The logs show, from her IP, thirteen successful
   OPTIONS to /api/auth/register, six successful GETs — and not one POST,
   ever, to any path. Her network passed reads and passed preflights and
   dropped the writes. That is the signature of filtering software
   between the phone and us, and a cross-origin POST to an unfamiliar
   *.up.railway.app hostname is exactly what such software objects to.

   We cannot fix her network. We can stop needing it to cooperate: if the
   API answers on the same origin as the page, there is no cross-origin
   request, no preflight, and nothing for a filter to single out. It is
   also one fewer round trip on every write, and it removes CORS
   configuration as a class of outage.

   XFF IS THE DANGEROUS PART OF THIS FILE. `utils/rate_limit._client_key`
   reads x-forwarded-for and takes the first entry; Railway already sets
   it, so the header arriving here names the real caller. If this proxy
   dropped it, every visitor would reach the backend wearing THIS
   service's IP — and /auth/register allows 5 per IP per 10 minutes, so
   the sixth signup anywhere on the site would start failing for
   everybody. The header is forwarded, with our hop appended.

   IT STREAMS. No buffering in either direction, so contract downloads
   and uploads behave as they do today rather than being read into this
   process's memory.

   IT FAILS AS A GATEWAY, NEVER AS A CRASH. Any transport error answers
   502 with a JSON body shaped like the backend's own errors, so the
   client's `detail` handling keeps working.
   ──────────────────────────────────────────────────────────────────── */

// Where API calls are forwarded. Defaults to the public backend, which is
// exactly where the browser sends them today — so the first deploy of
// this changes the ROUTE and nothing else. Point it at Railway's private
// network later to drop the public hop; that is a variable, not a patch.
const API_TARGET = (process.env.API_PROXY_TARGET || API_ORIGIN).replace(/\/+$/, '');

// Long enough for the slowest real endpoint. The LLM-backed routes
// (translation, CSV mapping, the goods composer's vision draft) take tens
// of seconds, and a proxy timeout shorter than the work it is proxying
// turns a slow success into a failure that looks like an outage.
const PROXY_TIMEOUT_MS = Number(process.env.API_PROXY_TIMEOUT_MS) || 120000;

// Defined per RFC 7230 §6.1: meaningful to ONE connection, never to be
// passed along. Forwarding `connection` or `transfer-encoding` to the
// upstream produces responses the client cannot parse.
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

const stripHopByHop = (headers) => {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) out[k] = v;
  }
  return out;
};

function proxyApi(req, res) {
  let target;
  try {
    target = new URL(API_TARGET + req.url);
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: 'Bad gateway' }));
    return;
  }

  const headers = stripHopByHop(req.headers);
  // The upstream must be addressed by ITS host, not ours, or Railway
  // routes the request back to this service and the two bounce.
  headers.host = target.host;

  // Append rather than replace: the first entry is the real client, which
  // is what the backend's rate limiter keys on.
  const priorFor = req.headers['x-forwarded-for'];
  const socketIp = req.socket.remoteAddress || '';
  headers['x-forwarded-for'] = priorFor ? `${priorFor}, ${socketIp}` : socketIp;
  headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || 'https';
  headers['x-forwarded-host'] = req.headers['x-forwarded-host'] || req.headers.host || '';

  const transport = target.protocol === 'http:' ? http : https;
  const upstream = transport.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'http:' ? 80 : 443),
      method: req.method,
      path: target.pathname + target.search,
      headers,
    },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, stripHopByHop(upRes.headers));
      upRes.pipe(res);
    },
  );

  upstream.setTimeout(PROXY_TIMEOUT_MS, () => upstream.destroy(new Error('upstream timeout')));

  upstream.on('error', (err) => {
    console.warn(`[server] api proxy ${req.method} ${req.url}: ${err.message}`);
    if (res.headersSent) { res.destroy(); return; }
    res.writeHead(502, { 'Content-Type': 'application/json' });
    // Shaped like the backend's own errors so the client renders it
    // rather than falling through to a generic message. Almost always this
    // is the backend restarting for an update. (Until 18 Oct 2026 a volume
    // stopped Railway overlapping the old and new copies; the volume is gone,
    // so a gap should now be rare.) Say so, so people wait and retry.
    res.end(JSON.stringify({ detail: 'The site is updating. Please try again in a minute.' }));
  });

  // If the client hangs up mid-request, stop talking to the upstream.
  req.on('aborted', () => upstream.destroy());
  req.pipe(upstream);
}

// The same four headers `public/serve.json` declares, kept here as well
// because serve.json only covers the static path.
//
// WHY BOTH. serve.json is read by `handler(req, res, CONFIG)`, the LAST
// line of the request handler below. Two branches return before reaching
// it — the /api proxy and the link-preview bot branch — so declaring the
// headers only in serve.json covered one response path out of three. The
// bot branch was the sharper miss: it serves HTML assembled from
// business-supplied content, on our own origin, and was doing it with no
// nosniff and no X-Frame-Options.
//
// setHeader (not writeHead) so it survives all three: Node merges
// previously-set headers into whatever writeHead passes, and serve-handler
// does not duplicate a header that is already present.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
};

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

  // Before anything else: the SPA fallback rewrites every unmatched path
  // to index.html, so an /api request that reached it would be answered
  // with the HTML page and a 200 — the worst possible failure, because
  // the client would try to parse a document as JSON.
  if (req.url === '/api' || req.url.startsWith('/api/')) {
    proxyApi(req, res);
    return;
  }


  // After the proxy, deliberately: /api on a business host is still the
  // API, never a redirect.
  const customSlug = slugFromHost(req.headers.host, PUBLIC_SITE_HOST) ? null : await customDomainSlug(req.headers.host);
  const hostSlug = slugFromHost(req.headers.host, PUBLIC_SITE_HOST) || customSlug;
  const pathname = pathnameOf(req);
  // /page/<slug> on a business host is one of its extra pages (the app
  // routes it), not a path of the main site.
  if (hostSlug && pathname !== '/' && !isBuildFile(pathname) && !/^\/page\/[a-z0-9-]{1,40}\/?$/.test(pathname)) {
    res.writeHead(302, {
      Location: `https://${PUBLIC_SITE_HOST}${req.url}`,
      'Cache-Control': 'no-cache',
    });
    res.end();
    return;
  }

  // The card a crawler gets. On a business host the slug comes from the
  // HOST, since the path there is just "/"; without this every subdomain
  // link pasted into WhatsApp got the generic card, which is the one bug
  // this file exists to prevent. Same fetchPreview, same fail-open.
  let slug = null;
  if (isPreviewBot(req)) slug = hostSlug && pathname === '/' ? hostSlug : businessSlug(req);
  if (slug) {
    const html = await fetchPreview(slug);
    if (html) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      });
      res.end(html);
      return;
    }
    // Fell through on purpose. The crawler gets what it would have got
    // before this file existed.
  }
  // Search engines' ownership files (Google Search Console's googleXXXX.html,
  // 18 Oct 2026) must be answered at exactly that address. serve-handler's
  // clean URLs 301 any .html to the bare path, which then gets the app.
  const ownership = /^\/(google[a-z0-9]{6,40}\.html|BingSiteAuth\.xml)$/.exec(pathname || '');
  if (ownership && fs.existsSync(path.join(BUILD, ownership[1]))) {
    res.writeHead(200, {
      'Content-Type': ownership[1].endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(fs.readFileSync(path.join(BUILD, ownership[1])));
    return;
  }
  if (pathname === '/sitemap.xml') {
    try {
      const xml = await sitemapXml();
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=1800' });
      res.end(xml);
      return;
    } catch { /* the static file */ }
  }
  // IndexNow's proof key (backend routes/seo.py): change alerts to Bing and
  // the other IndexNow engines are only accepted with it on this host.
  if (pathname === '/indexnow-key.txt') {
    const key = await fetchApi('/api/seo/indexnow-key.txt', null, 'text/plain');
    if (key) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      res.end(key);
      return;
    }
  }
  if (pathname === '/llms.txt') {
    // The hand-built pages too: the backend cannot see pages.json.
    const extra = encodeURIComponent([...HAND_BUILT].join(','));
    const text = await fetchApi(`/api/seo/llms.txt?extra=${extra}`, null, 'text/plain');
    if (text) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=1800' });
      res.end(text);
      return;
    }
  }
  // Search engines and AI assistants: an upgraded page's content as HTML.
  // Hand-built pages are skipped here, they are plain HTML already.
  if (isSearchBot(req)) {
    const bizSlug = hostSlug && pathname === '/' ? hostSlug : businessSlug(req);
    const propMatch = PROPERTY_PATH.exec(pathname || '');
    let apiPath = null;
    if (bizSlug && !HAND_BUILT.has(bizSlug)) apiPath = `/api/seo/business/${encodeURIComponent(bizSlug)}`;
    else if (propMatch) apiPath = `/api/seo/property/${encodeURIComponent(propMatch[1])}`;
    const html = apiPath && await fetchApi(`${apiPath}?lng=${langOf(req)}`, req);
    if (html) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' });
      res.end(html);
      return;
    }
  }
  // A hand-built page in place of the standard listing (Tzvi, 7 Oct 2026):
  // /business/<slug>, or the root of <slug>.myisraelrental.com, answers with
  // build/pages/<slug>/index.html when the slug is in build/pages/pages.json. Link
  // previews were answered above, so a pasted link still gets the business's
  // card. Published by scripts/publish-page.mjs; BusinessPage.jsx reloads
  // into this for navigation that never reaches the server.
  // The page's other HTML files (an order page) are answered directly too:
  // serve.json's catch-all rewrite would otherwise turn /pages/x/order.html
  // into the app's "page not found".
  const pageFile = HAND_BUILT_FILE.exec(pathname || '');
  if (pageFile && HAND_BUILT.has(pageFile[1])) {
    try {
      await sendHandBuilt(req, res, pageFile[1], `${pageFile[2]}.html`);
      return;
    } catch { /* not there: fall through to the normal handler */ }
  }
  // A hand-built page can be a small website (Tzvi, 12 Oct 2026): its other
  // pages live at /business/<slug>/<page> (or /<page> on the business's own
  // host), each its build's <page>.html. publish-page.mjs writes links that way.
  const sub = /^\/business\/([a-z0-9-]{2,60})\/([a-z0-9-]{1,40})\/?$/.exec(pathname || '')
    || (hostSlug ? /^\/()([a-z0-9-]{1,40})\/?$/.exec(pathname || '') : null);
  const subSlug = sub && (sub[1] || hostSlug);
  if (sub && HAND_BUILT.has(subSlug) && sub[2] !== 'index'
    && fs.existsSync(path.join(BUILD, 'pages', subSlug, `${sub[2]}.html`))) {
    try {
      await sendHandBuilt(req, res, subSlug, `${sub[2]}.html`);
      return;
    } catch { /* fall through */ }
  }
  const built = hostSlug && pathname === '/' ? hostSlug : businessSlug(req);
  if (built && HAND_BUILT.has(built)) {
    try {
      await sendHandBuilt(req, res, built, 'index.html');
      return;
    } catch {
      // Listed but missing from the build: the standard page, never an error.
    }
  }
  if (customSlug && (pathname === '/' || /^\/page\/[a-z0-9-]{1,40}\/?$/.test(pathname))) {
    try {
      const html = indexFor(customSlug);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(html);
      return;
    } catch { /* fall through to the normal file */ }
  }
  return handler(req, res, CONFIG);
});

server.listen(PORT, () => {
  console.log(`[server] serving ${BUILD} on :${PORT}`);
  console.log(`[server] link previews via ${API_ORIGIN}`);
});

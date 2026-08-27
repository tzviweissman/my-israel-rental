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
const fs = require('node:fs');
const path = require('node:path');
const handler = require('serve-handler');

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

const server = http.createServer(async (req, res) => {
  const slug = isPreviewBot(req) ? businessSlug(req) : null;
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
  return handler(req, res, CONFIG);
});

server.listen(PORT, () => {
  console.log(`[server] serving ${BUILD} on :${PORT}`);
  console.log(`[server] link previews via ${API_ORIGIN}`);
});

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
    // rather than falling through to a generic message.
    res.end(JSON.stringify({ detail: 'Could not reach the server. Please try again.' }));
  });

  // If the client hangs up mid-request, stop talking to the upstream.
  req.on('aborted', () => upstream.destroy());
  req.pipe(upstream);
}

const server = http.createServer(async (req, res) => {
  // Before anything else: the SPA fallback rewrites every unmatched path
  // to index.html, so an /api request that reached it would be answered
  // with the HTML page and a 200 — the worst possible failure, because
  // the client would try to parse a document as JSON.
  if (req.url === '/api' || req.url.startsWith('/api/')) {
    proxyApi(req, res);
    return;
  }


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

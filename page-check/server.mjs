// The page-check service: decides whether an owner's chosen version of their
// page may go live (page builder v3, plan step 8, Tzvi 6 Oct 2026).
//
// The API hands it a job when an owner publishes a version
// (backend/utils/page_check_client.py). It renders that version through its
// preview link in every view with the same checks as the local effects gate
// (check-core.mjs), then posts the verdict back; a pass puts the version
// live, a fail keeps the page that was live.
//
// Its own Railway service, reached on the private network. Env:
//   PAGE_CHECK_SECRET  shared with the API, both ways; never logged
//   SITE_URL           where the pages are (https://myisraelrental.com)
//   API_URL            the API base, ending /api
//   PORT               set by Railway
//
//   POST /check  {business_id, slug, version_id, token}  -> 202, queued
//   GET  /health                                         -> {ok, queued, running}
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { chromium } from 'playwright';

import { absoluteContrast, checkPage } from './check-core.mjs';

const SECRET = process.env.PAGE_CHECK_SECRET || '';
const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');
const API = (process.env.API_URL || '').replace(/\/$/, '');
const PORT = Number(process.env.PORT || 8080);
const JOB_LIMIT_MS = 8 * 60 * 1000;
if (!SECRET || !SITE || !API) {
  console.error('page-check: PAGE_CHECK_SECRET, SITE_URL and API_URL are all required');
  process.exit(1);
}

const secretOk = (given) => {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
};

// What a job may contain: ids and a slug as the API mints them, and the
// token as page_versions.new_preview_token makes it. Anything else is refused,
// since these go into URLs.
const JOB = {
  business_id: /^[A-Za-z0-9_-]{1,64}$/,
  slug: /^[a-z0-9-]{1,80}$|^[A-Za-z0-9_-]{1,64}$/,
  version_id: /^[a-f0-9]{32}$/,
  token: /^[A-Za-z0-9_-]{20,100}$/,
};
const validJob = (j) => j && Object.entries(JOB).every(([k, re]) => typeof j[k] === 'string' && re.test(j[k]));

// One check at a time: each opens seven browser views, and two at once on a
// small service would make both slow enough to time out.
const queue = [];
let running = null;
let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) browser = await chromium.launch();
  return browser;
}

async function verdict(job, passed, failures) {
  const url = `${API}/marketplace/businesses/${job.business_id}/page-versions/${job.version_id}/check`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Page-Check-Secret': SECRET },
      body: JSON.stringify({ passed, failures: failures.slice(0, 60).map((f) => String(f).slice(0, 300)) }),
    });
    console.log(`page-check: version ${job.version_id} ${passed ? 'passed' : `failed (${failures.length})`}, API ${r.status}`);
  } catch (e) {
    console.log(`page-check: could not report version ${job.version_id}: ${e.name}`);
  }
}

async function run(job) {
  const q = `pv=${encodeURIComponent(job.token)}`;
  const res = await fetch(`${API}/marketplace/business/${encodeURIComponent(job.slug)}?${q}`);
  const biz = res.ok ? await res.json() : null;
  if (!biz || !biz.page_v3 || !biz.design_brief) {
    return verdict(job, false, ['The preview link did not open this version (expired, or the page is switched off)']);
  }
  const b = await getBrowser();
  const { fails } = await checkPage(b, {
    label: 'page',
    brief: biz.design_brief,
    urlFor: (lang) => `${SITE}/business/${encodeURIComponent(job.slug)}?${q}&lng=${lang}`,
    contrastRule: absoluteContrast,
  });
  return verdict(job, fails.length === 0, fails);
}

async function drain() {
  if (running || !queue.length) return;
  running = queue.shift();
  const job = running;
  try {
    await Promise.race([
      run(job),
      new Promise((_, no) => setTimeout(() => no(new Error('timeout')), JOB_LIMIT_MS)),
    ]);
  } catch (e) {
    // A check that could not finish says so; it never counts as a pass.
    await verdict(job, false, [`The check could not finish (${e.message === 'timeout' ? 'took over 8 minutes' : e.name})`]);
    if (browser) { await browser.close().catch(() => {}); browser = null; }
  } finally {
    running = null;
    drain();
  }
}

const server = http.createServer((req, res) => {
  const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, queued: queue.length, running: Boolean(running) });
  if (req.method !== 'POST' || req.url !== '/check') return send(404, { error: 'not found' });
  if (!secretOk(req.headers['x-page-check-secret'])) return send(403, { error: 'forbidden' });
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 4096) req.destroy(); });
  req.on('end', () => {
    let job = null;
    try { job = JSON.parse(raw); } catch { /* refused below */ }
    if (!validJob(job)) return send(400, { error: 'bad job' });
    if (queue.length >= 20) return send(503, { error: 'busy' });
    queue.push({ business_id: job.business_id, slug: job.slug, version_id: job.version_id, token: job.token });
    send(202, { queued: queue.length });
    drain();
    return undefined;
  });
  return undefined;
});
server.listen(PORT, () => console.log(`page-check: listening on ${PORT}`));

// The quality gate (docs/page-builder-design-rules.md part 9; v3 build
// prompt section 7). Renders a business page in a headless browser at
// 1440x900 and 390x844, in English and Hebrew, plus 360x800 with reduced
// motion, and runs the must-pass checks. Any failure blocks the v3 page
// from visitors: with --submit the result is recorded on the business
// (POST /marketplace/businesses/{id}/page-check), and the API shows a v3
// page to visitors only once a pass is recorded for the brief on the
// record now. An admin sees the page before, which is how this renders it.
//
// Works on any business page, v2 or v3, so it can say why a v2 page
// would fail. Not here: the 1-5 design scores (an AI review: no AI calls
// yet, Tzvi 5 Oct 2026).
//
//   Needs: local API on :8001 (DEV_AUTOLOGIN=1), dev server on :3210,
//          backend/.venv with Tesseract for the flyer check
//   Run:   node scripts/check-page.mjs <slug> [--submit]
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const SLUG = argv.find((a) => !a.startsWith('--')) || 'rp-exp';
const SUBMIT = argv.includes('--submit');
const WEB = 'http://localhost:3210';
const API = 'http://localhost:8001/api';
const OUT = 'screenshots/page-check';
const MAX_FILM = 4 * 1024 * 1024;
mkdirSync(OUT, { recursive: true });

const { token } = await (await fetch(`${API}/auth/dev-login?role=admin`)).json();
if (!token) throw new Error('no admin session: is DEV_AUTOLOGIN=1 on a local database?');
const auth = { Authorization: `Bearer ${token}` };
const biz = await (await fetch(`${API}/marketplace/business/${SLUG}`, { headers: auth })).json();
if (!biz.id) throw new Error(`no business "${SLUG}"`);

// Every price on the record, wherever it sits (listings, tiers, products).
const prices = new Set();
(function walk(v, key = '') {
  if (Array.isArray(v)) v.forEach((x) => walk(x, key));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
  else if (typeof v === 'number' && /price/i.test(key) && v > 0) prices.add(v);
}(biz));
const ownWords = [biz.description, biz.description_he].filter(Boolean).join('\n').toLowerCase();

// A cropped picture is fine; a cropped flyer never is (rule 4). Ask the
// same flyer check the brief uses, once per picture.
const verdicts = new Map();
const py = ['backend/.venv/Scripts/python.exe', 'backend/.venv/bin/python'].find(existsSync);
function kindsOf(urls) {
  const todo = [...new Set(urls)].filter((u) => !verdicts.has(u));
  if (todo.length) {
    const out = execFileSync(py.replace('backend/', ''), ['-m', 'utils.flyer_check', ...todo], { cwd: 'backend', encoding: 'utf8' });
    out.trim().split('\n').filter(Boolean).forEach((line) => { const v = JSON.parse(line); verdicts.set(v.url, v.kind); });
  }
  return urls.map((u) => verdicts.get(u) || 'unknown');
}

async function measure(page, facts) {
  return page.evaluate(async ({ facts }) => {
    const ignored = (el) => !!el.closest('[data-gate-ignore]');
    const shown = (el) => {
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !el.closest('[aria-hidden="true"]');
    };
    const rgba = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const fold = innerHeight;
    const hero = document.querySelector('[data-testid="pv3-hero"]');

    // Pictures in the first screen that are cropped to fit (cover), with
    // their own shape against the box's.
    const natural = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = () => ok(null); i.src = src; });
    const cropped = [];
    for (const el of document.querySelectorAll('img, [style*="background"], div, section')) {
      if (ignored(el) || !shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top >= fold || r.bottom <= 0 || r.width < 160 || r.height < 160) continue;
      const cs = getComputedStyle(el);
      let src = null;
      if (el.tagName === 'IMG' && cs.objectFit === 'cover') src = el.currentSrc || el.src;
      else if (el.tagName !== 'IMG' && cs.backgroundSize === 'cover' && /url\(/.test(cs.backgroundImage)) src = cs.backgroundImage.match(/url\("?([^")]+)"?\)/)[1];
      if (!src || src.startsWith('data:')) continue;
      const n = await natural(src);
      if (!n) continue;
      const off = Math.abs(r.width / r.height - n[0] / n[1]) / (n[0] / n[1]);
      if (off > 0.05) cropped.push({ src, inHero: !!(hero && hero.contains(el)) || r.top < fold * 0.6 });
    }

    const h1 = [...document.querySelectorAll('h1')].find((h) => shown(h) && !ignored(h));

    // Filled buttons in the first screen: an opaque fill that is not the
    // surface behind it. The site's own bar and floating tabs are not the page's.
    const surface = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const c = rgba(getComputedStyle(p).backgroundColor); if (c.length && (c[3] ?? 1) > 0.9) return c.slice(0, 3).join(); } return '255,255,255'; };
    const filled = [...document.querySelectorAll('button, a, [role="button"]')].filter((el) => {
      if (ignored(el) || !shown(el) || el.closest('nav, header')) return false;
      for (let p = el; p; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return false;
      const r = el.getBoundingClientRect();
      if (r.top >= fold || r.bottom <= 0) return false;
      const c = rgba(getComputedStyle(el).backgroundColor);
      return c.length >= 3 && (c[3] ?? 1) >= 0.9 && c.slice(0, 3).join() !== surface(el);
    }).map((el) => (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40));

    // Visible text, for repeats, placeholders and prices.
    const texts = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      const el = walk.currentNode.parentElement;
      if (!el || !walk.currentNode.textContent.trim() || ignored(el) || !shown(el)) continue;
      texts.push({ text: walk.currentNode.textContent, top: el.getBoundingClientRect().top });
    }
    const counts = Object.fromEntries(facts.map((f) => [f, {
      page: texts.filter((x) => x.text.includes(f)).length,
      fold: texts.filter((x) => x.text.includes(f) && x.top < fold).length,
    }]));
    const all = texts.map((x) => x.text).join('\n');
    const placeholder = (all.match(/\b(coming soon|lorem|ipsum|undefined|NaN|TODO|TBD)\b/i) || [])[0] || null;
    const shownPrices = [...all.matchAll(/₪\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?₪/g)].map((m) => Number((m[1] || m[2]).replace(/,/g, '')));

    const empty = [...document.querySelectorAll('section')].filter((s) => !ignored(s) && shown(s)
      && !s.innerText.trim() && !s.querySelector('img, video, svg, canvas, iframe')).map((s) => s.dataset.testid || s.className || 'section');

    const words = [...document.querySelectorAll('[data-testid="pv3-tagline"], .pv3-biglist-items li, .pv3-steps-list li > span:last-child')]
      .filter((el) => !ignored(el)).map((el) => el.innerText.trim());

    const video = hero && hero.querySelector('video');
    const faded = texts.filter((x) => x.top < fold).length
      ? [...document.querySelectorAll('h1, h2, p, li, a, button')].filter((el) => !ignored(el) && el.getBoundingClientRect().top < fold
        && el.innerText.trim() && Number(getComputedStyle(el).opacity) === 0).length
      : 0;

    return {
      tier: hero ? hero.dataset.tier : null,
      cropped,
      h1: h1 ? { size: parseFloat(getComputedStyle(h1).fontSize), text: h1.innerText.slice(0, 40) } : null,
      filled,
      counts,
      placeholder,
      shownPrices,
      empty,
      words,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      video: video ? {
        src: video.currentSrc || video.src, poster: !!video.getAttribute('poster'), paused: video.paused,
        control: !!hero.querySelector('[data-testid="pv3-film-toggle"]'),
      } : null,
      faded,
      dir: document.documentElement.dir,
    };
  }, { facts });
}

// Every focusable thing shows where focus is (rules part 9, item 8).
async function focusRing(page) {
  const bare = new Set();
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el.closest('[data-gate-ignore]')) return null;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
      return ring ? null : (el.dataset.testid || `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`);
    });
    if (r) bare.add(r);
  }
  return [...bare];
}

const axe = existsSync('frontend/node_modules/axe-core/axe.min.js') ? 'frontend/node_modules/axe-core/axe.min.js' : null;
const failures = new Set();
const fail = (msg) => failures.add(msg);
const b = await chromium.launch();
const renders = [[1440, 900, 'en'], [1440, 900, 'he'], [390, 844, 'en'], [390, 844, 'he'], [360, 800, 'en', true], [360, 800, 'he', true]];
for (const [w, h, lang, still] of renders) {
  const tag = `${lang}-${w}${still ? '-reduced-motion' : ''}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: still ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((t) => sessionStorage.setItem('token', t), token);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${WEB}/business/${SLUG}?lng=${lang}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // The admin's own notes (the gate notice) are not part of the page.
  await page.addStyleTag({ content: '[data-gate-ignore] { display: none !important; }' });
  await page.waitForTimeout(800);
  const facts = [biz.kosher_certification?.body, lang === 'he' ? 'חדש ב-MyIsraelRental' : 'New on MyIsraelRental'].filter(Boolean);
  const m = await measure(page, facts);

  if (!m.tier) fail(`${tag}: no hero with media (tier 1, 2 or 3)`);
  const flyers = kindsOf(m.cropped.map((c) => c.src));
  m.cropped.forEach((c, i) => {
    if (flyers[i] === 'flyer') fail(`${tag}: a flyer is cropped${c.inHero ? ' as the hero' : ''} (${c.src.split('/').pop().slice(0, 40)})`);
  });
  const need = w >= 1024 ? 96 : 56;
  if (!m.h1) fail(`${tag}: no headline`);
  else if (m.h1.size < need) fail(`${tag}: the headline is ${m.h1.size}px; needs ${need}px`);
  if (m.filled.length !== 1) fail(`${tag}: ${m.filled.length} filled buttons above the fold (${m.filled.join(' | ') || 'none'}); exactly one`);
  for (const [f, c] of Object.entries(m.counts)) {
    if (c.page > 2) fail(`${tag}: "${f}" appears ${c.page} times; at most twice`);
    if (c.fold > 1) fail(`${tag}: "${f}" appears ${c.fold} times above the fold; at most once`);
  }
  if (m.empty.length) fail(`${tag}: empty section ${m.empty.join(', ')}`);
  if (m.placeholder) fail(`${tag}: placeholder text "${m.placeholder}"`);
  if (w <= 390 && m.overflow) fail(`${tag}: scrolls sideways`);
  [...new Set(m.shownPrices)].filter((p) => !prices.has(p)).forEach((p) => fail(`${tag}: price ₪${p} is not a price on the record`));
  m.words.filter((x) => !ownWords.includes(x.toLowerCase())).forEach((x) => fail(`${tag}: "${x.slice(0, 40)}" is not in their own words`));
  if (m.video) {
    if (!m.video.poster) fail(`${tag}: the hero film has no poster`);
    if (!m.video.control) fail(`${tag}: the hero film has no pause control`);
    if (still && !m.video.paused) fail(`${tag}: the hero film plays under reduced motion`);
    const res = await fetch(m.video.src, { method: 'HEAD' });
    const size = Number(res.headers.get('content-length') || 0) || (await (await fetch(m.video.src)).arrayBuffer()).byteLength;
    if (size > MAX_FILM) fail(`${tag}: the hero film is ${(size / 1048576).toFixed(1)}MB; 4MB at most`);
  }
  if (still && m.faded) fail(`${tag}: ${m.faded} items in the first screen wait at opacity 0`);
  if (lang === 'he' && m.dir !== 'rtl') fail(`${tag}: not right to left`);
  if (errors.length) fail(`${tag}: page errors: ${errors.join(' | ').slice(0, 120)}`);

  if (axe) {
    await page.addScriptTag({ path: axe });
    const v = await page.evaluate(async () => (await window.axe.run({ exclude: [['[data-gate-ignore]']] }, { runOnly: ['color-contrast'] })).violations);
    v.flatMap((x) => x.nodes).slice(0, 6).forEach((n) => fail(`${tag}: contrast ${n.any[0]?.data?.contrastRatio}:1 at ${n.target.join(' ').slice(0, 60)}`));
  } else fail('axe-core is not installed: contrast was not checked');
  if (!still) (await focusRing(page)).slice(0, 6).forEach((x) => fail(`${tag}: no visible focus on ${x}`));

  if (!still) await page.screenshot({ path: `${OUT}/${SLUG}-${tag}.png` });
  console.log(`${tag}: tier ${m.tier || '-'} | h1 ${m.h1?.size}px | filled ${m.filled.length} | cropped ${m.cropped.length} (${flyers.join(',') || '-'})`);
  await ctx.close();
}
await b.close();

const report = {
  slug: SLUG, passed: failures.size === 0, failures: [...failures],
  checked_at: new Date().toISOString(), brief_at: biz.page_check?.brief_at || null,
};
writeFileSync(`${OUT}/${SLUG}.json`, JSON.stringify(report, null, 2));
console.log(report.passed ? '\nPASSED: every must-pass check' : `\nFAILED (${failures.size}):\n${report.failures.join('\n')}`);

if (SUBMIT) {
  if (!report.brief_at) console.log('\nNot a v3 page: nothing to record.');
  else {
    const res = await fetch(`${API}/marketplace/businesses/${biz.id}/page-check`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief_at: report.brief_at, passed: report.passed, failures: report.failures.slice(0, 60), checked_at: report.checked_at }),
    });
    const body = await res.json();
    console.log(res.ok ? `\nRecorded. Visitors ${body.live ? 'now see' : 'still do not see'} the v3 page.` : `\nNot recorded: ${body.detail}`);
  }
}
process.exitCode = report.passed ? 0 : 1;

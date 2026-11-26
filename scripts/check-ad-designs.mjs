#!/usr/bin/env node
/**
 * Draws every ad design, in every shape and language, and measures the `auto` lines of the ad blueprint
 * (docs/ad-rules-checklist.md): text size, nothing cut off, story safe areas, the QR, one price, copy rules.
 * Every word drawn on the picture is recorded as it is drawn, so a rule cannot pass by being read from the code.
 *
 * Needs the local API on :8001 (DEV_AUTOLOGIN=1). Starts its own frontend on a free port that never reloads,
 * so other sessions' edits cannot break the run; --port 3210 uses a server already running. The words come from
 * scripts/fixtures, so this spends no API credit. Local dev business: any the owner has.
 *
 *   node scripts/check-ad-designs.mjs [--only behind,chat] [--pictures <folder>] [--port 3210] [--panel]
 *   --panel skips the moving-ad videos (minutes, not 40+); use it only when the change touches the options panel, not the
 *   drawing of any design or the moving ads. A --panel run never counts as a full pass for the commit check.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeMeasured } from './ad-measured.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const only = arg('--only') ? new Set(arg('--only').split(',')) : null;
const pictures = arg('--pictures');
const panel = process.argv.includes('--panel');
// A line as it goes, with the seconds since the start (23 Nov 2026): a run that sticks used to print nothing until
// it failed, and finding where took three runs. --quiet leaves only the section lines.
const t0 = Date.now();
const progress = (msg) => { if (!process.argv.includes('--quiet')) console.log(`  [${Math.round((Date.now() - t0) / 1000)}s] ${msg}`); };
const SITE = `http://localhost:${arg('--port') || await ownServer()}`;
// A private dev server (19 Nov 2026: edits by other sessions reloaded the shared :3210 mid-run and failed it twice).
async function ownServer() {
  const net = await import('node:net');
  const { spawn, execSync } = await import('node:child_process');
  const port = await new Promise((ok) => { const s = net.createServer().listen(0, () => { const q = s.address().port; s.close(() => ok(q)); }); });
  const child = spawn('npm --prefix frontend start', { cwd: ROOT, shell: true, stdio: 'ignore',
    env: { ...process.env, PORT: String(port), BROWSER: 'none', NO_RELOAD: '1' } });
  child.unref();
  process.on('exit', () => { try { execSync(process.platform === 'win32' ? `taskkill /pid ${child.pid} /T /F` : `kill -- -${child.pid}`, { stdio: 'ignore' }); } catch {} });
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(1));
  console.log(`Starting a private frontend on :${port} ...`);
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    if (child.exitCode !== null) { console.error('The private frontend stopped while starting.'); process.exit(1); }
    try { if ((await fetch(`http://localhost:${port}/`)).ok) return port; } catch {}
  }
  console.error('The private frontend did not start in 5 minutes.'); process.exit(1);
}
if (pictures) fs.mkdirSync(pictures, { recursive: true });
const fixture = (l) => JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'fixtures', `ad-maker-${l}.json`), 'utf8'));
const MIN_TEXT = 30;
const SAFE_TOP = 220;
const SAFE_BOTTOM = 230;
const MONEY = /[$₪€£]\s?\d[\d,.]*/g;

const b = await chromium.launch();
const errors = [];
let p;
// A fresh browser per area: each signs in as a different local test account.
async function freshPage() {
  p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  p.setDefaultTimeout(120000);
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.addInitScript(RECORD);
}
// Every word and picture drawn on a canvas that is on the page (the small gallery previews are not on the page).
const RECORD = () => {
  window.__drawn = [];
  const P = CanvasRenderingContext2D.prototype;
  const fill = P.fillText;
  P.fillText = function (s, x, y, ...r) {
    if (this.canvas.isConnected) {
      const m = this.getTransform();
      const tm = this.measureText(s);
      const w = tm.width;
      const al = this.textAlign;
      const fromRight = al === 'right' || (al === 'start' && this.direction === 'rtl') || (al === 'end' && this.direction === 'ltr');
      const start = al === 'center' ? x - w / 2 : (fromRight ? x - w : x);
      const a = m.transformPoint(new DOMPoint(start, y));
      const c = m.transformPoint(new DOMPoint(start + w, y));
      window.__drawn.push({ on: this.canvas, t: String(s), size: parseFloat(/([0-9.]+)px/.exec(this.font)[1]) * Math.hypot(m.a, m.b), top: a.y - tm.actualBoundingBoxAscent * Math.hypot(m.a, m.b), x0: Math.min(a.x, c.x), x1: Math.max(a.x, c.x), y: a.y, W: this.canvas.width, H: this.canvas.height });
    }
    return fill.call(this, s, x, y, ...r);
  };
  // Setting a canvas's width starts a new drawing: only the last one counts, so a late redraw of the design
  // before cannot be blamed on this one.
  const width = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
    get() { return width.get.call(this); },
    set(v) { if (this.isConnected) window.__drawn = window.__drawn.filter((d) => d.on !== this); width.set.call(this, v); },
  });
  const image = P.drawImage;
  P.drawImage = function (img, ...r) {
    // The test logo (A4.6): where it lands, so words under it fail.
    if (this.canvas.isConnected && img instanceof HTMLImageElement && /ad-test-logo/.test(img.src) && r.length >= 4) {
      const [x, y, w, h] = r.length >= 8 ? r.slice(4) : r;
      const m = this.getTransform();
      const a = m.transformPoint(new DOMPoint(x, y));
      const c = m.transformPoint(new DOMPoint(x + w, y + h));
      window.__drawn.push({ on: this.canvas, logo: [Math.min(a.x, c.x), Math.min(a.y, c.y), Math.max(a.x, c.x), Math.max(a.y, c.y)], H: this.canvas.height });
    }
    // A holiday prop (the ad maker's "My design, decorated"): where it lands, so words under it fail.
    if (this.canvas.isConnected && img instanceof HTMLImageElement && /\/ad-scenes\/decor\//.test(img.src) && r.length >= 4) {
      const [x, y, w, h] = r.length >= 8 ? r.slice(4) : r;
      const m = this.getTransform();
      const pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => m.transformPoint(new DOMPoint(px, py)));
      const xs = pts.map((q) => q.x);
      const ys = pts.map((q) => q.y);
      window.__drawn.push({ on: this.canvas, prop: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], W: this.canvas.width, H: this.canvas.height });
    }
    if (this.canvas.isConnected && img instanceof HTMLCanvasElement && r.length >= 4) window.__drawn.push({ on: this.canvas, qr: Math.min(r[2], r[3]) * Math.hypot(this.getTransform().a, this.getTransform().b), H: this.canvas.height });
    return image.call(this, img, ...r);
  };
};
await freshPage();
let lang = 'en';
// The longest name a link can carry, so a design that cuts it fails here.
const LONG_NAME = 'the-very-long-business-name';
await p.route('**/api/ads/make', (r) => { const f = fixture(lang); r.fulfill({ json: { ...f, link: { ...f.link, path: `/p/${LONG_NAME}` } } }); });
await p.route('**/api/ads/cutouts', (r) => r.fulfill({ json: { items: fixture('en').cutouts } }));
await p.route('**/api/ads/shots**', (r) => r.fulfill({ json: { shots: fixture('en').shots, left_today: 5 } }));
await p.route('**/api/ads/saved**', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: { ads: [] } }) : r.fulfill({ json: { id: 'x' } })));
// Every owner's business gets a logo (A4.6): a real wide one, M and N Jewelry's oval.
const TEST_LOGO = path.join(ROOT, 'docs', 'ads', 'gen', 'mn-jewelry-infinity-status', 'logo-medal.png');
await p.route('**/ad-test-logo.png', (r) => r.fulfill({ body: fs.readFileSync(TEST_LOGO), contentType: 'image/png' }));
await p.route('**/api/marketplace/businesses', async (r) => {
  const res = await r.fetch();
  const j = await res.json();
  (Array.isArray(j) ? j : j.businesses || []).forEach((x) => { x.logo_url = `${SITE}/ad-test-logo.png`; });
  r.fulfill({ response: res, json: j });
});

const fails = [];
// A WhatsApp chat shows a 1080x1920 picture as rows 250 to 1670 only, until someone taps it (rule A8.10, measured on
// Tzvi's phone 25 Nov 2026). Designs made before that rule keep A8.4, so a word outside the band is REPORTED here, not
// failed: the list shows which designs get cut in a chat (Tzvi, 26 Nov 2026: "Add all three").
const CHAT_TOP = 250, CHAT_BOTTOM = 1670;
const chatCut = [];
function measure(where, all0, H, wanted) {
  // a redraw of the shape before can land late: only what was drawn at this shape's height counts
  const drawn = all0.filter((d) => d.H === H);
  const story = H === 1920;
  if (!drawn.length) fails.push(`${where}: shapes: nothing drawn at this shape`);
  const words = drawn.filter((d) => d.t !== undefined && d.t.trim());
  const out = [];
  for (const d of words) {
    if (d.size < MIN_TEXT - 0.5) out.push(`text-size: "${d.t.slice(0, 28)}" is ${Math.round(d.size)}px`);
    if (d.x0 < -1 || d.x1 > d.W + 1 || d.y < 0 || d.y > d.H) out.push(`text-inside: "${d.t.slice(0, 28)}" runs off the picture`);
    if (story && (d.top < SAFE_TOP - 1 || d.y > d.H - SAFE_BOTTOM + 1)) out.push(`story-safe: "${d.t.slice(0, 28)}" at y ${Math.round(d.y)}`);
    if (story && (d.top < CHAT_TOP - 1 || d.y > CHAT_BOTTOM + 1)) chatCut.push(`${where}: "${d.t.slice(0, 28)}" at y ${Math.round(d.top)} to ${Math.round(d.y)}`);
    if (/[–—]/.test(d.t)) out.push(`words: long dash in "${d.t.slice(0, 28)}"`);
  }
  const all = words.map((d) => d.t).join(' ');
  const prices = new Set((all.match(MONEY) || []).map((x) => x.replace(/\s/g, '')));
  if (wanted.price && prices.size > 1) out.push(`price: ${[...prices].join(' and ')} on one ad`);
  if (wanted.link && !/myisraelrental\.com/.test(all)) out.push('link: no short link printed');
  if (wanted.path && !all.replace(/\s/g, '').includes(`myisraelrental.com/p/${wanted.path}`)) out.push(`link: /p/${wanted.path} not printed whole`);
  if (wanted.logo) {
    const lg = drawn.filter((d) => d.logo).map((d) => d.logo).pop();
    if (!lg) out.push('logo: the business logo is not on the ad');
    else {
      if (lg[3] - lg[1] < 54) out.push(`logo: ${Math.round(lg[3] - lg[1])}px high, too small to read`);
      if (lg[0] < -1 || lg[2] > drawn[0].W + 1 || lg[1] < 0 || lg[3] > H) out.push('logo: runs off the picture');
      if (story && (lg[1] < SAFE_TOP - 1 || lg[3] > H - SAFE_BOTTOM + 1)) out.push(`story-safe: the logo at y ${Math.round(lg[1])}`);
      if (story && (lg[1] < CHAT_TOP - 1 || lg[3] > CHAT_BOTTOM + 1)) chatCut.push(`${where}: the logo at y ${Math.round(lg[1])} to ${Math.round(lg[3])}`);
      for (const d of words) if (d.x0 < lg[2] && d.x1 > lg[0] && d.top < lg[3] && d.y > lg[1]) out.push(`logo: covers "${d.t.slice(0, 28)}"`);
    }
  }
  const qr = drawn.filter((d) => d.qr).map((d) => d.qr);
  if (wanted.link && qr.length && Math.max(...qr) < 149.5) out.push(`qr: ${Math.round(Math.max(...qr))}px`);
  for (const m of [...new Set(out)]) fails.push(`${where}: ${m}`);
}
const drawOf = async (fn) => {
  await p.evaluate(() => { window.__drawn = []; });
  await fn();
  // redraw settles when nothing new is drawn for a moment
  let last = -1;
  for (let i = 0; i < 40; i += 1) {
    await p.waitForTimeout(300);
    const n = await p.evaluate(() => window.__drawn.length);
    if (n === last && n > 0) break;
    last = n;
  }
  return p.evaluate(() => window.__drawn.map(({ on, ...d }) => d));
};

// A click on a gallery, shape or language button that does not land is tried again before the run fails (18 Nov 2026:
// one stuck click on "calling" waited two minutes and failed a 44-minute run; the next run passed untouched).
// The maker's options sit in four tabs, and the picture's downloads in a drop-down, since 23 Nov 2026: open the
// tab (and the menu) a control lives in before using it, as an owner would.
const MENU_ITEMS = { 'ad-share': 'download', 'ad-all-shapes': 'download', 'ad-copy': 'download', 'ad-save-new': 'save' };
async function open(sel) {
  const id = (sel.match(/data-testid="?([\w-]+)/) || [])[1];
  if (MENU_ITEMS[id] && !(await p.locator(sel).count())) {
    await p.locator('[data-testid="ad-tab-share"]').click();
    await p.locator(`[data-testid="ad-menu-${MENU_ITEMS[id]}"]`).click();
    return;
  }
  await p.evaluate((q) => {
    const panel = document.querySelector(q)?.closest('[role=tabpanel]');
    if (!panel || !panel.classList.contains('hidden')) return;
    const k = panel.dataset.testid === 'ad-extras' ? 'extras' : panel.dataset.testid.replace('ad-panel-', '');
    document.querySelector(`[data-testid=ad-tab-${k}]`).click();
  }, sel);
  await p.waitForTimeout(150);
}

async function tap(sel) {
  await open(sel);
  for (let i = 1; ; i += 1) {
    try { await p.locator(sel).click({ timeout: 40000 }); return; } catch (e) {
      if (i === 3) throw e;
      console.log(`retrying a stuck click on ${sel} (${i})`);
      await p.locator(sel).scrollIntoViewIfNeeded().catch(() => {});
      await p.waitForTimeout(1500);
    }
  }
}

// --- the owners' ad maker
await p.goto(`${SITE}/dashboard?tab=advertising&as=owner`, { timeout: 180000 });
await p.locator('[data-testid="ad-gallery"]').waitFor();
let count = 0;
for (const l of ['en', 'he']) {
  lang = l;
  await tap(`[data-testid="ad-${l}"]`);
  await p.waitForFunction(() => document.querySelector('[data-testid="ad-g-behind"] img'));
  await p.waitForTimeout(2500);
  const keys = await p.locator('[data-testid="ad-gallery"] button').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-g-', '')));
  if (l === 'en') console.log(`ad maker: ${keys.length} designs`);
  for (const k of keys) {
    if (only && !only.has(k)) continue;
    progress(`ad maker ${l} ${k}`);
    for (const f of (k === 'native' ? ['story'] : ['square', 'feed', 'story'])) {
      const drawn = await drawOf(async () => {
        await tap(`[data-testid="ad-${f}"]`);
        await tap(`[data-testid="ad-g-${k}"]`);
      });
      measure(`maker ${k} ${f} ${l}`, drawn, { square: 1080, feed: 1350, story: 1920 }[f], { price: k !== 'items', link: true, path: LONG_NAME, logo: true }); // Side by side: each item above its own price (rules 9b.3)
      count += 1;
      if (pictures) {
        const d = await p.locator('[data-testid="ad-preview"]').evaluate((c) => c.toDataURL('image/jpeg', 0.8));
        fs.writeFileSync(path.join(pictures, `maker-${k}-${f}-${l}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
      }
    }
  }
}

// A holiday on the owner's own design (Tzvi, 24 Nov 2026): "My design, decorated" puts props around every design,
// and no prop may sit on a word or the logo. Measured from what is drawn, not from the ad maker's own placement.
{
  await tap('[data-testid="ad-chanukah"]');
  await p.waitForTimeout(2500);
  const keys = await p.locator('[data-testid="ad-gallery"] button').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-g-', '')));
  let decorated = 0;
  let tried = 0;
  for (const k of keys) {
    if ((only && !only.has(k)) || k === 'fullphoto') continue;
    progress(`holiday ${k}`);
    for (const f of (k === 'native' ? ['story'] : ['feed', 'story'])) {
      const drawn = await drawOf(async () => { await tap(`[data-testid="ad-${f}"]`); await tap(`[data-testid="ad-g-${k}"]`); });
      tried += 1;
      const props = drawn.filter((d) => d.prop);
      if (props.length) decorated += 1;
      // The props' pictures are cut-outs in a turned square: their outer eighth is mostly see-through.
      const inner = (q) => { const dx = (q[2] - q[0]) * 0.12; const dy = (q[3] - q[1]) * 0.12; return [q[0] + dx, q[1] + dy, q[2] - dx, q[3] - dy]; };
      const hit = (a, c) => a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3];
      for (const d of props) {
        const q = inner(d.prop);
        const word = drawn.find((w) => w.t && w.t.trim() && hit(q, [w.x0, w.top, w.x1, w.y]));
        if (word) fails.push(`holiday ${k} ${f}: a prop covers "${word.t}"`);
        if (drawn.some((w) => w.logo && hit(q, w.logo))) fails.push(`holiday ${k} ${f}: a prop covers the logo`);
      }
    }
  }
  console.log(`holiday: ${decorated} of ${tried} ads decorated`);
  if (decorated < tried * 0.6) fails.push(`holiday: only ${decorated} of ${tried} ads got any props`);
  await tap('[data-testid="ad-noholiday"]');
  await p.waitForTimeout(1500);
}

// A logo whose letters cannot read (A4.6, 18 Nov 2026): the test logo is M and N's oval medal, letters 3% of its
// height (L.A. Cholent's badge is 5%), so the owner is told to upload a version that is just the name.
if (!(await p.locator('[data-testid="ad-logo-unclear"]').count())) fails.push('logo: a medal logo with tiny letters was drawn with no note to the owner');

// A headline about one product brings that product's picture with it.
{
  await p.click('[data-testid="ad-g-clean"]');
  await open('[data-testid="ad-idea-1"]');
  await p.click('[data-testid="ad-idea-1"]');
  await p.waitForTimeout(600);
  const shown = await p.locator('[data-testid^="ad-product-"][aria-pressed="true"]').first().innerText();
  if (!/Jerky/.test(shown)) fails.push(`headline item: tapping a headline about the Jerky Board left "${shown}" in the picture`);
  await p.click('[data-testid="ad-idea-0"]');
}

// The pros' touches (docs/inspo/ad-videos-2026-11-07): a deal shows only with its end date, the headline can sit on strips.
{
  await p.click('[data-testid="ad-g-clean"]');
  await open('[data-testid="ad-deal"]');
  await p.fill('[data-testid="ad-deal"]', 'Buy 2, get 1 free');
  await p.waitForTimeout(800);
  let seen = await p.evaluate(() => window.__drawn.some((d) => /Buy 2, get 1 free/.test(d.t || '')));
  if (seen) fails.push('deal: shown without an end date');
  const end = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  await p.fill('[data-testid="ad-deal-until"]', end);
  await p.waitForTimeout(800);
  seen = await p.evaluate(() => window.__drawn.some((d) => /Buy 2, get 1 free/.test(d.t || '')));
  if (!seen) fails.push('deal: not on the ad with an end date');
  await p.fill('[data-testid="ad-deal"]', '');
  if (!(await p.locator('[data-testid="ad-strips"]').count())) fails.push('strips: no choice on the plain design');
  else {
    const before = await p.locator('[data-testid="ad-preview"]').evaluate((c) => c.toDataURL());
    await p.check('[data-testid="ad-strips"]');
    await p.waitForTimeout(800);
    if (before === await p.locator('[data-testid="ad-preview"]').evaluate((c) => c.toDataURL())) fails.push('strips: the headline did not change');
    await p.uncheck('[data-testid="ad-strips"]');
  }
}

// A dragged piece snaps to the middle of the ad, with a line to show it.
{
  await tap('[data-testid="ad-feed"]');
  await p.locator('[data-testid="ad-g-behind"]').click();
  await p.waitForTimeout(700);
  const piece = p.locator('[data-testid="ad-piece-qr"]');
  await piece.scrollIntoViewIfNeeded();
  const c = await p.locator('[data-testid="ad-preview"]').boundingBox();
  const r = await piece.boundingBox();
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await p.mouse.down();
  await p.mouse.move(c.x + c.width / 2 + 4, c.y + c.height / 2 + 4, { steps: 4 });
  await p.waitForTimeout(300);
  const guide = await p.locator('[data-testid="ad-guide-x"]').count();
  await p.mouse.up();
  await p.waitForTimeout(300);
  const after = await piece.boundingBox();
  const off = Math.abs(after.x + after.width / 2 - (c.x + c.width / 2));
  if (!guide || off > 1) fails.push(`snap: ${off.toFixed(1)}px off the middle, guide line ${guide ? 'shown' : 'missing'}`);
  if (await p.locator('[data-testid="ad-guide-x"]').count()) fails.push('snap: the guide line stayed after letting go');
  await p.locator('[data-testid="ad-reset-moves"]').click();
}

// The colour typed is the colour on the ad, dark or light (Tzvi, 6 Nov 2026), with words that still read.
{
  await tap('[data-testid="ad-story"]');
  const pickable = await p.locator('[data-testid="ad-gallery"] button').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-g-', '')));
  for (const k of pickable) {
    if (only && !only.has(k)) continue;
    progress(`colour ${k}`);
    await tap(`[data-testid="ad-g-${k}"]`);
    await p.waitForTimeout(350);
    if (!(await p.locator('[data-testid="ad-colour-custom-hex"]').count())) continue;
    await open('[data-testid="ad-colour-custom-hex"]');
    for (const [hex, rgb] of [['#FFE9A8', [255, 233, 168]], ['#7A1FA2', [122, 31, 162]]]) {
      const drawn = await drawOf(async () => { await p.locator('[data-testid="ad-colour-custom-hex"]').fill(hex); });
      const seen = await p.locator('[data-testid="ad-preview"]').evaluate((c) => {
        const x = c.getContext('2d');
        const n = {};
        const d = x.getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < d.length; i += 4 * 97) { const q = `${d[i]},${d[i + 1]},${d[i + 2]}`; n[q] = (n[q] || 0) + 1; }
        return n[Object.keys(n).sort((a, b) => n[b] - n[a])[0]] / (d.length / (4 * 97)) >= 0 ? Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 12) : [];
      });
      if (!seen.includes(rgb.join())) fails.push(`colour ${k}: ${hex} is not on the ad (commonest: ${seen.slice(0, 3).join(' | ')})`);
      measure(`colour ${k} ${hex}`, drawn, 1920, { price: false, link: false });
    }
    await p.locator('[data-testid="ad-colour-own"]').click().catch(() => {});
  }
}

// One business's gallery does not read as one ad repeated (A9g.10): count the ground colours of its previews.
const grounds = await p.locator('[data-testid="ad-gallery"] img').evaluateAll((ims) => ims.map((im) => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0, 8, 8);
  const d = x.getImageData(1, 1, 1, 1).data;
  return [d[0], d[1], d[2]].map((v) => Math.round(v / 32)).join();
}));
const commonest = Math.max(...Object.values(grounds.reduce((m, g) => ({ ...m, [g]: (m[g] || 0) + 1 }), {})));
console.log(`gallery: ${new Set(grounds).size} ground colours across ${grounds.length} designs, at most ${commonest} the same`);
if (new Set(grounds).size < 6 || commonest > grounds.length * 0.4) fails.push(`variety: ${new Set(grounds).size} ground colours, ${commonest} of ${grounds.length} the same`);

// Every design can be rearranged, and no drag breaks the rules: the code and link pulled hard into a corner and shrunk.
const pullTo = async (name, tx, ty) => {
  const piece = p.locator(`[data-testid="ad-piece-${name}"]`);
  await piece.scrollIntoViewIfNeeded();
  const r = await piece.boundingBox();
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await p.mouse.down();
  await p.mouse.move(tx, ty, { steps: 3 });
  await p.mouse.up();
};
const dragKeys = await p.locator('[data-testid="ad-gallery"] button').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-g-', '')));
for (const k of dragKeys) {
  if (only && !only.has(k)) continue;
  progress(`drag ${k}`);
  await tap('[data-testid="ad-story"]');
  await tap(`[data-testid="ad-g-${k}"]`);
  await p.waitForTimeout(700);
  const names = await p.locator('[data-testid^="ad-piece-"]').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-piece-', '')));
  if (!names.includes('qr') || !names.includes('link')) fails.push(`drag ${k}: the code or link cannot be moved (${names})`);
  if (!names.some((n) => ['words', 'word', 'product'].includes(n))) fails.push(`drag ${k}: nothing else can be moved (${names})`);
  const box = await p.locator('[data-testid="ad-preview"]').boundingBox();
  const drawn = await drawOf(async () => {
    await pullTo('qr', box.x - 300, box.y - 300);
    await p.waitForTimeout(250);
    await pullTo('link', box.x + box.width + 300, box.y + box.height + 300);
    await p.waitForTimeout(250);
    await p.locator('[data-testid="ad-piece-qr"]').click();
    const handle = p.locator('[data-testid="ad-size-qr"]');
    const h = await handle.boundingBox();
    await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await p.mouse.down();
    await p.mouse.move(h.x - 900, h.y - 900, { steps: 3 });
    await p.mouse.up();
  });
  measure(`drag ${k} story`, drawn, 1920, { price: false, link: true });
  if (pictures) {
    const d = await p.locator('[data-testid="ad-preview"]').evaluate((c) => c.toDataURL('image/jpeg', 0.8));
    fs.writeFileSync(path.join(pictures, `drag-${k}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
  }
  await p.locator('[data-testid="ad-reset-moves"]').click();
  count += 1;
}

// The picture that leaves is drawn at double size (A8.9): read the width from the file a person gets.
await p.evaluate(() => { navigator.canShare = () => false; });
await p.locator('[data-testid="ad-g-behind"]').click();
await open('[data-testid="ad-share"]');
const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('[data-testid="ad-share"]').click()]);
const jpg = fs.readFileSync(await dl.path());
let at = 2;
while (at < jpg.length && !(jpg[at + 1] >= 0xC0 && jpg[at + 1] <= 0xC2)) at += 2 + jpg.readUInt16BE(at + 2);
const sharpW = jpg.readUInt16BE(at + 7);
if (sharpW !== 2160) fails.push(`sharp: the downloaded picture is ${sharpW} wide, not 2160`);

// Moving ads (A10): the real button makes a real file, on every design. Looked at frame by frame against the still.
const MOVING = async (qrBox) => {
  const v = document.querySelector('[data-testid="ad-video-preview"]');
  const still = document.querySelector('[data-testid="ad-preview"]');
  v.pause();
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const x = c.getContext('2d', { willReadFrequently: true });
  const read = (src) => { x.drawImage(src, 0, 0, 64, 64); return x.getImageData(0, 0, 64, 64).data; };
  const at = async (t) => {
    await new Promise((r) => { v.onseeked = r; v.currentTime = t; });
    return read(v);
  };
  // The biggest difference in one 1/64 square matters as well as the mean: a small QR code moving barely shifts the mean.
  const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) n += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return n / (a.length / 4) / 3; };
  const region = (a, b) => {
    let n = 0; let m = 0;
    const X0 = Math.floor(qrBox[0] * 64); const X1 = Math.ceil(qrBox[2] * 64); const Y0 = Math.floor(qrBox[1] * 64); const Y1 = Math.ceil(qrBox[3] * 64);
    for (let y = Y0; y < Y1; y += 1) for (let i = X0; i < X1; i += 1) { const o = (y * 64 + i) * 4; n += Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2]); m += 3; }
    return n / Math.max(m, 1);
  };
  const dur = v.duration;
  const last = await at(dur - 0.05);
  const first = await at(0);
  const middle = await at(0.5);
  const settled = await at(4.75);
  const qrEarly = await at(3.1);
  // the first frame shows more than a flat ground: squares that differ from the corner's colour
  let busy = 0;
  for (let i = 0; i < first.length; i += 4) if (Math.abs(first[i] - first[0]) + Math.abs(first[i + 1] - first[1]) + Math.abs(first[i + 2] - first[2]) > 30) busy += 1;
  // When the last frame and the still differ, both are kept as pictures so the difference can be seen, not guessed.
  const end = diff(last, read(still));
  let pics = null;
  if (end > 3) {
    const big = (src) => { const b = document.createElement('canvas'); b.width = 540; b.height = Math.round(540 * still.height / still.width); b.getContext('2d').drawImage(src, 0, 0, b.width, b.height); return b.toDataURL('image/png'); };
    await new Promise((r) => { v.onseeked = r; v.currentTime = dur - 0.05; });
    pics = { last: big(v), still: big(still) };
  }
  return { pics, dur, w: v.videoWidth, h: v.videoHeight, end, busy: busy / 4096, moved: diff(middle, last), hold: diff(settled, last), qr: region(qrEarly, last), canvasW: still.width, canvasH: still.height };
};
// In real Chrome, its own window: the moving ads need H.264, which the test browser does not have. Skipped with --panel.
if (!panel) {
  const chrome = await chromium.launch({ channel: 'chrome' });
  const main = p;
  const movingPage = await (await chrome.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  p = movingPage;
  p.setDefaultTimeout(120000);
  p.on('pageerror', (e) => errors.push(String(e)));
  lang = 'en';
  await p.route('**/api/ads/make', (r) => { const f = fixture('en'); r.fulfill({ json: { ...f, link: { ...f.link, path: `/p/${LONG_NAME}` } } }); });
  await p.route('**/api/ads/cutouts', (r) => r.fulfill({ json: { items: fixture('en').cutouts } }));
  await p.route('**/api/ads/shots**', (r) => r.fulfill({ json: { shots: fixture('en').shots, left_today: 5 } }));
  await p.route('**/api/ads/saved**', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: { ads: [] } }) : r.fulfill({ json: { id: 'x' } })));
  // The maker lives on the Advertising page since 6 Nov 2026.
  await p.goto(`${SITE}/dashboard?tab=advertising&as=owner`, { timeout: 180000 });
  await p.locator('[data-testid="ad-gallery"]').waitFor();
  await tap('[data-testid="ad-en"]');
  await p.waitForFunction(() => document.querySelector('[data-testid="ad-g-behind"] img'));
  await p.waitForTimeout(2500);
  await p.evaluate(() => { navigator.canShare = () => false; });
  const allKeys = await p.locator('[data-testid="ad-gallery"] button').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-g-', '')));
  const clips = allKeys.filter((k) => !only || only.has(k)).map((k) => [k, k === 'native' ? 'story' : 'square']);
  // Every shape on the first design; the rest in one shape, because each clip takes seconds.
  clips.push(['behind', 'feed'], ['behind', 'story']);
  for (const [k, f] of clips) {
    progress(`moving ${k} ${f}`);
    if (f !== 'story' || k === 'native') await tap(`[data-testid="ad-${f}"]`);
    else await tap('[data-testid="ad-story"]');
    await tap(`[data-testid="ad-g-${k}"]`);
    await p.waitForTimeout(900);
    await tap('[data-testid="ad-video"]');
    // Each frame is drawn in full: about half a minute a video on this machine.
    await p.locator('[data-testid="ad-video-preview"]').waitFor({ timeout: 300000 }).catch(() => { throw new Error(`moving ${k} ${f}: no video after 5 minutes`); });
    await p.waitForFunction(() => document.querySelector('[data-testid="ad-video-preview"]').readyState >= 2);
    const qrBox = await p.evaluate(() => {
      const c = document.querySelector('[data-testid="ad-preview"]').getBoundingClientRect();
      const q = document.querySelector('[data-testid="ad-piece-qr"]').getBoundingClientRect();
      return [(q.left - c.left) / c.width, (q.top - c.top) / c.height, (q.right - c.left) / c.width, (q.bottom - c.top) / c.height];
    });
    const m = await p.evaluate(MOVING, qrBox);
    const where = `moving ${k} ${f}`;
    if (m.w !== m.canvasW || m.h !== m.canvasH) fails.push(`${where}: ${m.w}x${m.h}, the still is ${m.canvasW}x${m.canvasH}`);
    if (m.dur < 6 || m.dur > 7) fails.push(`${where}: ${m.dur.toFixed(1)} seconds`);
    if (m.end > 3) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-moving-'));
      for (const [n, u] of Object.entries(m.pics || {})) fs.writeFileSync(path.join(dir, `${k}-${f}-${n}.png`), Buffer.from(u.split(',')[1], 'base64'));
      fails.push(`${where}: the last frame is not the still (off by ${m.end.toFixed(1)}; both pictures in ${dir})`);
    }
    if (m.busy < 0.04) fails.push(`${where}: the first frame is an empty ground (${(m.busy * 100).toFixed(0)}% has anything on it)`);
    if (m.moved < 0.4) fails.push(`${where}: it hardly moves (${m.moved.toFixed(2)})`);
    if (m.hold > 3) fails.push(`${where}: still moving after 4.75 seconds (${m.hold.toFixed(1)})`);
    if (m.qr > 6) fails.push(`${where}: the QR code is not still from 3.1 seconds (${m.qr.toFixed(1)})`);
    if (process.env.AD_VIDEO_LOG) console.log(where, JSON.stringify(m));
    if (pictures) {
      await open('[data-testid="ad-video"]');
      const [got] = await Promise.all([p.waitForEvent('download'), p.locator('[data-testid="ad-video"]').click()]);
      fs.copyFileSync(await got.path(), path.join(pictures, `${k}-${f}.mp4`));
    }
    await p.locator('[data-testid="ad-video-close"]').click();
  }
  console.log(`moving ads: ${clips.length} videos made and looked at`);
  await chrome.close();
  p = main;
}

// The Advertising page has the whole maker on it, with nothing to click first.
await p.keyboard.press('Escape');
await p.goto(`${SITE}/dashboard?tab=advertising&as=owner`, { timeout: 180000 });
await p.locator('[data-testid="ad-gallery"]').waitFor();
await p.locator('[data-testid="ad-piece-qr"]').waitFor();
await p.locator('[data-testid="advertising-url"]').waitFor();
if (await p.locator('[role="dialog"]').count()) fails.push('advertising page: the maker should be on the page, not in a pop-up');
// The preview stays in view while the options are scrolled (Tzvi, 5 Nov 2026).
// To a point inside the options, measured once the page has settled: scrolling relative to a page still loading
// above the maker overshot the end of the options on some runs (9 Nov 2026) and failed a preview that holds.
await p.waitForTimeout(1500);
await p.evaluate(async () => {
  const c = document.querySelector('[data-testid="ad-preview-column"]');
  const box = c.parentElement.getBoundingClientRect();
  const top = box.top + scrollY;
  window.scrollTo(0, top + Math.max(0, Math.min(300, box.height - c.offsetHeight - 120)));
  await new Promise((r) => { setTimeout(r, 400); });
});
const held = await p.locator('[data-testid="ad-preview"]').evaluate((c) => { const r = c.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight ? '' : `top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)} of ${innerHeight}, scrolled ${Math.round(scrollY)}`; });
if (held) fails.push(`advertising page: the preview left the screen while scrolling the options (${held})`);

// --- the Super Admin Ads area (its own words, in the dashboard's language)
await freshPage();
// The same maker for the site: its facts and pictures from the API (words:false costs nothing), test words on top.
await p.route('**/api/ads/make', async (r) => {
  const body = r.request().postDataJSON();
  const real = await (await r.fetch({ postData: JSON.stringify({ ...body, words: false }) })).json();
  const { photos, items, faqs, from_price, logo, cutouts, ...words } = fixture(body.lang);
  r.fulfill({ json: { ...words, ...real, reviews: [] } });
});
await p.route('**/api/ads/saved**', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: { ads: [] } }) : r.fulfill({ json: { id: 'x' } })));
await p.goto(`${SITE}/admin?as=admin`, { timeout: 180000 });
await p.getByRole('button', { name: /^(Ads|מודעות)$/ }).first().click();
await p.locator('[data-testid="ad-studio-gallery"]').waitFor();
const studio = await p.locator('[data-testid="ad-studio-gallery"] button').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-studio-new-', '')));
console.log(`super admin: ${studio.length} designs`);
await p.locator('[data-testid="ad-gallery"]').waitFor();
if (await p.locator('[role="dialog"]').count()) fails.push('site maker: should be on the page, not in a pop-up');
for (const l of ['en', 'he']) {
  await tap(`[data-testid="ad-${l}"]`);
  await p.waitForFunction(() => document.querySelector('[data-testid="ad-g-behind"] img'));
  await p.waitForTimeout(2500);
  const keys = await p.locator('[data-testid="ad-gallery"] button').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-g-', '')));
  if (l === 'en') console.log(`site maker: ${keys.length} designs`);
  for (const k of keys) {
    if (only && !only.has(k)) continue;
    progress(`site maker ${l} ${k}`);
    for (const f of (k === 'native' ? ['story'] : ['square', 'feed', 'story'])) {
      const drawn = await drawOf(async () => {
        await tap(`[data-testid="ad-${f}"]`);
        await tap(`[data-testid="ad-g-${k}"]`);
      });
      measure(`site ${k} ${f} ${l}`, drawn, { square: 1080, feed: 1350, story: 1920 }[f], { price: false, link: true });
      if (/[$₪€£]/.test(drawn.map((d) => d.t || '').join(' '))) fails.push(`site ${k} ${f} ${l}: price: the site has no price`);
      count += 1;
      if (pictures) {
        const d = await p.locator('[data-testid="ad-preview"]').evaluate((c) => c.toDataURL('image/jpeg', 0.8));
        fs.writeFileSync(path.join(pictures, `site-${k}-${f}-${l}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
      }
    }
  }
}

for (const k of studio) {
  if (only && !only.has(k)) continue;
  for (const f of ['post', 'status']) {
    const drawn = await drawOf(async () => {
      await p.locator(`[data-testid="ad-studio-shape-${f}"]`).click();
      await p.locator(`[data-testid="ad-studio-new-${k}"]`).click();
    });
    measure(`admin ${k} ${f}`, drawn, f === 'status' ? 1920 : 1350, { price: false, link: true });
    count += 1;
  }
}
// A request still being answered when the browser closes threw "Request context disposed" and failed a passing run.
await p.unrouteAll({ behavior: 'ignoreErrors' });
await b.close();
if (errors.length) fails.push(`page errors: ${[...new Set(errors)].join(' | ')}`);
console.log(`drew ${count} ads`);
// reported, never failed (A8.10 spares designs made before 25 Nov 2026); also saved for reading after a long run
const chatList = [...new Set(chatCut)];
fs.writeFileSync(path.join(os.tmpdir(), 'ad-designs-chat-cut.txt'), chatList.join('\n'));
if (chatList.length) console.log(`cut in a WhatsApp chat (rows ${CHAT_TOP} to ${CHAT_BOTTOM} show), ${chatList.length} line(s), not a failure:\n  ${chatList.slice(0, 40).join('\n  ')}${chatList.length > 40 ? `\n  ... all in ${path.join(os.tmpdir(), 'ad-designs-chat-cut.txt')}` : ''}`);
else console.log('every story design shows whole in a WhatsApp chat');
if (fails.length) {
  console.error(`${fails.length} problem(s):\n${fails.join('\n')}`);
  process.exit(1);
}
console.log('every design passes the measured rules');
if (!only && !panel) writeMeasured(ROOT); // the commit check reads this: changed drawing code must be measured again

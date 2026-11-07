#!/usr/bin/env node
/**
 * Draws every ad design, in every shape and language, and measures the `auto` lines of the ad blueprint
 * (docs/ad-rules-checklist.md): text size, nothing cut off, story safe areas, the QR, one price, copy rules.
 * Every word drawn on the picture is recorded as it is drawn, so a rule cannot pass by being read from the code.
 *
 * Needs the local servers: frontend on :3210 and the API on :8001 (DEV_AUTOLOGIN=1). The words come from
 * scripts/fixtures, so this spends no API credit. Local dev business: any the owner has.
 *
 *   node scripts/check-ad-designs.mjs [--only behind,chat] [--pictures <folder>] [--port 3210]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { writeMeasured } from './ad-measured.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const only = arg('--only') ? new Set(arg('--only').split(',')) : null;
const pictures = arg('--pictures');
const SITE = `http://localhost:${arg('--port') || 3210}`;
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
await p.route('**/api/ads/saved**', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: { ads: [] } }) : r.fulfill({ json: { id: 'x' } })));

const fails = [];
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
    if (/[–—]/.test(d.t)) out.push(`words: long dash in "${d.t.slice(0, 28)}"`);
  }
  const all = words.map((d) => d.t).join(' ');
  const prices = new Set((all.match(MONEY) || []).map((x) => x.replace(/\s/g, '')));
  if (wanted.price && prices.size > 1) out.push(`price: ${[...prices].join(' and ')} on one ad`);
  if (wanted.link && !/myisraelrental\.com/.test(all)) out.push('link: no short link printed');
  if (wanted.path && !all.replace(/\s/g, '').includes(`myisraelrental.com/p/${wanted.path}`)) out.push(`link: /p/${wanted.path} not printed whole`);
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

// --- the owners' ad maker
await p.goto(`${SITE}/dashboard?tab=advertising&as=owner`, { timeout: 180000 });
await p.locator('[data-testid="ad-gallery"]').waitFor();
let count = 0;
for (const l of ['en', 'he']) {
  lang = l;
  await p.locator(`[data-testid="ad-${l}"]`).click();
  await p.waitForFunction(() => document.querySelector('[data-testid="ad-g-behind"] img'));
  await p.waitForTimeout(2500);
  const keys = await p.locator('[data-testid="ad-gallery"] button').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-g-', '')));
  if (l === 'en') console.log(`ad maker: ${keys.length} designs`);
  for (const k of keys) {
    if (only && !only.has(k)) continue;
    for (const f of (k === 'native' ? ['story'] : ['square', 'feed', 'story'])) {
      const drawn = await drawOf(async () => {
        await p.locator(`[data-testid="ad-${f}"]`).click();
        await p.locator(`[data-testid="ad-g-${k}"]`).click();
      });
      measure(`maker ${k} ${f} ${l}`, drawn, { square: 1080, feed: 1350, story: 1920 }[f], { price: k !== 'items', link: true, path: LONG_NAME }); // Side by side: each item above its own price (rules 9b.3)
      count += 1;
      if (pictures) {
        const d = await p.locator('[data-testid="ad-preview"]').evaluate((c) => c.toDataURL('image/jpeg', 0.8));
        fs.writeFileSync(path.join(pictures, `maker-${k}-${f}-${l}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
      }
    }
  }
}

// A headline about one product brings that product's picture with it.
{
  await p.click('[data-testid="ad-g-clean"]');
  await p.click('[data-testid="ad-idea-1"]');
  await p.waitForTimeout(600);
  const shown = await p.locator('[data-testid^="ad-product-"][aria-pressed="true"]').first().innerText();
  if (!/Jerky/.test(shown)) fails.push(`headline item: tapping a headline about the Jerky Board left "${shown}" in the picture`);
  await p.click('[data-testid="ad-idea-0"]');
}

// The pros' touches (docs/inspo/ad-videos-2026-11-07): a deal shows only with its end date, the headline can sit on strips.
{
  await p.click('[data-testid="ad-g-clean"]');
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
  await p.locator('[data-testid="ad-feed"]').click();
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
  await p.locator('[data-testid="ad-story"]').click();
  const pickable = await p.locator('[data-testid="ad-gallery"] button').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-g-', '')));
  for (const k of pickable) {
    await p.locator(`[data-testid="ad-g-${k}"]`).click();
    await p.waitForTimeout(350);
    if (!(await p.locator('[data-testid="ad-colour-custom-hex"]').count())) continue;
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
  await p.locator('[data-testid="ad-story"]').click();
  await p.locator(`[data-testid="ad-g-${k}"]`).click();
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
  return { dur, w: v.videoWidth, h: v.videoHeight, end: diff(last, read(still)), busy: busy / 4096, moved: diff(middle, last), hold: diff(settled, last), qr: region(qrEarly, last), canvasW: still.width, canvasH: still.height };
};
// In real Chrome, its own window: the moving ads need H.264, which the test browser does not have.
{
  const chrome = await chromium.launch({ channel: 'chrome' });
  const main = p;
  const movingPage = await (await chrome.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  p = movingPage;
  p.setDefaultTimeout(120000);
  p.on('pageerror', (e) => errors.push(String(e)));
  lang = 'en';
  await p.route('**/api/ads/make', (r) => { const f = fixture('en'); r.fulfill({ json: { ...f, link: { ...f.link, path: `/p/${LONG_NAME}` } } }); });
  await p.route('**/api/ads/cutouts', (r) => r.fulfill({ json: { items: fixture('en').cutouts } }));
  await p.route('**/api/ads/saved**', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: { ads: [] } }) : r.fulfill({ json: { id: 'x' } })));
  await p.goto(`${SITE}/dashboard?tab=my-businesses&as=owner`, { timeout: 180000 });
  await p.locator('[data-testid^="business-make-ad-"]').first().click();
  await p.locator('[data-testid="ad-gallery"]').waitFor();
  await p.locator('[data-testid="ad-en"]').click();
  await p.waitForFunction(() => document.querySelector('[data-testid="ad-g-behind"] img'));
  await p.waitForTimeout(2500);
  await p.evaluate(() => { navigator.canShare = () => false; });
  const allKeys = await p.locator('[data-testid="ad-gallery"] button').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-g-', '')));
  const clips = allKeys.filter((k) => !only || only.has(k)).map((k) => [k, k === 'native' ? 'story' : 'square']);
  // Every shape on the first design; the rest in one shape, because each clip takes seconds.
  clips.push(['behind', 'feed'], ['behind', 'story']);
  for (const [k, f] of clips) {
    if (f !== 'story' || k === 'native') await p.locator(`[data-testid="ad-${f}"]`).click();
    else await p.locator('[data-testid="ad-story"]').click();
    await p.locator(`[data-testid="ad-g-${k}"]`).click();
    await p.waitForTimeout(900);
    await p.locator('[data-testid="ad-video"]').click();
    await p.locator('[data-testid="ad-video-preview"]').waitFor();
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
    if (m.end > 3) fails.push(`${where}: the last frame is not the still (off by ${m.end.toFixed(1)})`);
    if (m.busy < 0.04) fails.push(`${where}: the first frame is an empty ground (${(m.busy * 100).toFixed(0)}% has anything on it)`);
    if (m.moved < 0.4) fails.push(`${where}: it hardly moves (${m.moved.toFixed(2)})`);
    if (m.hold > 3) fails.push(`${where}: still moving after 4.75 seconds (${m.hold.toFixed(1)})`);
    if (m.qr > 6) fails.push(`${where}: the QR code is not still from 3.1 seconds (${m.qr.toFixed(1)})`);
    if (process.env.AD_VIDEO_LOG) console.log(where, JSON.stringify(m));
    if (pictures) {
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
await p.evaluate(async () => {
  const c = document.querySelector('[data-testid="ad-preview-column"]');
  window.scrollBy(0, c.getBoundingClientRect().top + 300);
  await new Promise((r) => { setTimeout(r, 200); });
});
const held = await p.locator('[data-testid="ad-preview"]').evaluate((c) => { const r = c.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
if (!held) fails.push('advertising page: the preview left the screen while scrolling the options');

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
  await p.locator(`[data-testid="ad-${l}"]`).click();
  await p.waitForFunction(() => document.querySelector('[data-testid="ad-g-behind"] img'));
  await p.waitForTimeout(2500);
  const keys = await p.locator('[data-testid="ad-gallery"] button').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-g-', '')));
  if (l === 'en') console.log(`site maker: ${keys.length} designs`);
  for (const k of keys) {
    if (only && !only.has(k)) continue;
    for (const f of (k === 'native' ? ['story'] : ['square', 'feed', 'story'])) {
      const drawn = await drawOf(async () => {
        await p.locator(`[data-testid="ad-${f}"]`).click();
        await p.locator(`[data-testid="ad-g-${k}"]`).click();
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
await b.close();
if (errors.length) fails.push(`page errors: ${[...new Set(errors)].join(' | ')}`);
console.log(`drew ${count} ads`);
if (fails.length) {
  console.error(`${fails.length} problem(s):\n${fails.join('\n')}`);
  process.exit(1);
}
console.log('every design passes the measured rules');
if (!only) writeMeasured(ROOT); // the commit check reads this: changed drawing code must be measured again

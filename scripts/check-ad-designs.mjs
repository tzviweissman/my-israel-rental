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
await p.route('**/api/ads/make', (r) => r.fulfill({ json: fixture(lang) }));
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
await p.goto(`${SITE}/dashboard?tab=my-businesses&as=owner`, { timeout: 180000 });
await p.locator('[data-testid^="business-make-ad-"]').first().click();
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
      measure(`maker ${k} ${f} ${l}`, drawn, { square: 1080, feed: 1350, story: 1920 }[f], { price: k !== 'items', link: true }); // Side by side: each item above its own price (rules 9b.3)
      count += 1;
      if (pictures) {
        const d = await p.locator('[data-testid="ad-preview"]').evaluate((c) => c.toDataURL('image/jpeg', 0.8));
        fs.writeFileSync(path.join(pictures, `maker-${k}-${f}-${l}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
      }
    }
  }
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

// --- the Super Admin Ads area (its own words, in the dashboard's language)
await freshPage();
await p.goto(`${SITE}/admin?as=admin`, { timeout: 180000 });
await p.getByRole('button', { name: /^(Ads|מודעות)$/ }).first().click();
await p.locator('[data-testid="ad-studio-gallery"]').waitFor();
const studio = await p.locator('[data-testid="ad-studio-gallery"] button').evaluateAll((x) => x.map((e) => e.dataset.testid.replace('ad-studio-new-', '')));
console.log(`super admin: ${studio.length} designs`);
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

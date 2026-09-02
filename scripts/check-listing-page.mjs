#!/usr/bin/env node
/**
 * The public listing page, as an owner and as a visitor.
 *
 * Three things one owner reported on the same afternoon, checked for
 * real in a browser:
 *
 *   1. The business logo shows on the listing's provider card. It read
 *      only the provider AVATAR - a second image on a second profile most
 *      owners never set - so a fresh logo left a grey circle.
 *   2. A portrait flyer gets a portrait hero. The box was fixed 16:9, so
 *      a tall flyer sat small between two blurred bars.
 *   3. The owner has a way to the hours/areas/logo form from their own
 *      listing page, and it opens the form on arrival.
 *
 * Local stack (build on :3000, API on :8001). Creates a throwaway
 * provider, business and listing; uploads two small PNGs to Cloudinary.
 *
 *   node scripts/check-listing-page.mjs
 */
import { chromium } from 'playwright';
import { deflateSync } from 'node:zlib';
import { mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const API = (process.env.API_ORIGIN || 'http://localhost:8001') + '/api';
const OUT = join(ROOT, 'screenshots', 'listing-page');
mkdirSync(OUT, { recursive: true });

const stamp = Date.now().toString(36);
const results = [];
const ok = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond });
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' — ' + detail}`);
};
const json = async (r) => { try { return await r.json(); } catch { return null; } };

/** A solid-colour PNG of the given size, built by hand so no fixture file is needed. */
function png(width, height, rgb = [200, 60, 60]) {
  const crc = (buf) => {
    let c, crcTable = png._t || (png._t = [...Array(256)].map((_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
    let v = 0xffffffff; for (const b of buf) v = crcTable[(v ^ b) & 0xff] ^ (v >>> 8); return (v ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill(rgb).flat())]);
  const raw = Buffer.concat(Array(height).fill(row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// --- account, business with a logo, listing with a portrait flyer ---------
const reg = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: `listingcheck-${stamp}@example.com`, password: `Pw-${stamp}-ok1`, name: 'Listing Check', role: 'provider' }) });
const { token, user } = (await json(reg)) || {};
ok('provider account created', reg.status === 200 && !!token, `status ${reg.status}`);
if (!token) process.exit(1);
const auth = { Authorization: `Bearer ${token}` };

const upload = async (name, buf) => {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'image/png' }), name);
  const r = await fetch(`${API}/upload`, { method: 'POST', headers: auth, body: fd });
  const d = await json(r);
  return d?.url;
};
const logoUrl = await upload('logo.png', png(64, 64, [30, 95, 140]));
const flyerUrl = await upload('flyer.png', png(60, 100, [201, 162, 39]));   // portrait, 3:5
ok('two images uploaded', !!logoUrl && !!flyerUrl, `${logoUrl} ${flyerUrl}`);

const mk = await fetch(`${API}/marketplace/businesses`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
  body: JSON.stringify({ name: `Listing Check ${stamp}` }) });
const biz = await json(mk);
ok('business created', mk.status === 200 && biz?.id);
const pl = await fetch(`${API}/marketplace/businesses/${biz.id}`, { method: 'PATCH', headers: { ...auth, 'content-type': 'application/json' },
  body: JSON.stringify({ logo_url: logoUrl, hours: 'Sun-Thu 9-17' }) });
ok('logo saved on the business', pl.status === 200 && (await json(pl))?.logo_url === logoUrl);

const gigRes = await fetch(`${API}/marketplace/gigs`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
  body: JSON.stringify({
    title: `TEST_listing_check_${stamp}`, category: 'home-services-repair', description: 'listing page check',
    gig_type: 'deliverable', tiers: [{ name: 'Basic', price: 100, currency: 'ILS' }],
    booking_mode: 'whatsapp', whatsapp: '+972501234567', area: 'Tel Aviv',
    gallery: [flyerUrl], business_id: biz.id,
  }) });
const gig = await json(gigRes);
ok('listing created with a portrait flyer', gigRes.status === 200 && gig?.id, `status ${gigRes.status} ${JSON.stringify(gig).slice(0, 120)}`);

const detail = await json(await fetch(`${API}/marketplace/gigs/${gig.id}`));
ok('API: provider block carries the business logo', detail?.provider?.logo_url === logoUrl, JSON.stringify(detail?.provider || {}).slice(0, 160));

// --- the page --------------------------------------------------------------
const browser = await chromium.launch();

// As a visitor
{
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${APP}/businesses/${gig.id}?lng=en`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const pic = await page.locator('[data-testid="gig-provider-picture"]').getAttribute('style');
  ok('visitor: provider card shows the business logo', !!pic && pic.includes(logoUrl), pic || '(no style)');
  const box = await page.locator('[data-testid="gig-cover"]').boundingBox();
  ok('visitor: the hero took the flyer\'s portrait shape', box && box.height > box.width, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'no box');
  ok('visitor: no owner-only edit link', await page.locator('[data-testid="gig-edit-business-details"]').count() === 0);
  ok('visitor: no page errors', errors.length === 0, errors[0]);
  await page.screenshot({ path: `${OUT}/visitor.png` });
  await page.context().close();
}

// As the owner
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((t) => { try { sessionStorage.setItem('token', t); } catch { /* */ } }, token);
  const page = await ctx.newPage();
  await page.goto(`${APP}/businesses/${gig.id}?lng=en`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const link = page.locator('[data-testid="gig-edit-business-details"]');
  ok('owner: "Edit hours, areas & logo" is on the listing', await link.count() === 1);
  await page.screenshot({ path: `${OUT}/owner-listing.png` });
  await link.click();
  await page.waitForTimeout(2500);
  const form = page.locator('[data-testid="business-details-form"]');
  ok('owner: it opens the Business details form directly', await form.count() === 1, page.url());
  const hours = await page.locator('[data-testid="biz-details-hours"]').inputValue().catch(() => null);
  ok('owner: the hours field is there with the saved hours', hours === 'Sun-Thu 9-17', hours || '(none)');
  ok('owner: the deep-link param was consumed', !page.url().includes('details='), page.url());
  await page.screenshot({ path: `${OUT}/owner-form.png` });

  // The public business page has the same way in.
  await page.goto(`${APP}/business/${biz.slug || biz.id}?lng=en`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  ok('owner: the public business page offers the same edit button', await page.locator('[data-testid="business-owner-edit"]').count() === 1);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed; screenshots in ${OUT}\n`);
process.exit(failed ? 1 : 0);

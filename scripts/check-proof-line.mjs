// Part A check (23 Sep 2026): the rating and credentials beside the main
// button reach NEW pages with no setup, and a credential that is not true
// never appears.
//
// Creates a fresh account, business, service and property through the local
// API (the normal paths anyone uses), then opens the three pages.
//   Needs: local API on :8001 and the dev server on :3210.
//   Run:   node scripts/check-proof-line.mjs
import { chromium } from 'playwright';

const API = 'http://localhost:8001/api';
const WEB = 'http://localhost:3210';
const j = async (method, path, body, token) => {
  const r = await fetch(`${API}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${path} ${r.status} ${await r.text()}`);
  return r.json();
};

const stamp = Date.now();
const reg = await j('POST', '/auth/register', { email: `proof-${stamp}@example.com`, password: `Pw-${stamp}-ok`, name: 'Proof Check', role: 'owner' });
const tok = reg.token;
// A plumber, so a hechsher must NOT show; no founding year, not verified.
const biz = await j('POST', '/marketplace/businesses', { name: `Proof check ${stamp}` }, tok);
await j('PATCH', `/marketplace/businesses/${biz.id}`, { kosher_certification: { body: 'Some Rabbanut' } }, tok);
const gig = await j('POST', '/marketplace/gigs', {
  title: 'Proof check plumbing', description: 'Plumbing repairs.', category: 'home-services-repair', area: 'Jerusalem',
  gig_type: 'deliverable', booking_mode: 'in_platform', business_id: biz.id,
  gallery: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
  tiers: [{ name: 'Visit', price: 200, currency: 'ILS', images: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'] }],
}, tok);
const prop = await j('POST', '/properties', { title: 'Proof check flat', rental_type: 'long-term', property_type: 'apartment', area: 'Jerusalem', monthly_price: 5000, starting_date: '2026-10-01' }, tok);
const slug = (await j('GET', `/marketplace/business/${biz.id}`)).slug;

const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
const texts = async (sel) => page.$$eval(sel, (els) => els.map((e) => e.innerText));

// Business page: joined today -> "New on MyIsraelRental" beside the button,
// nothing else (no reviews, no founding year, not verified, not food).
await page.goto(`${WEB}/business/${slug}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const bizLine = (await texts('[data-testid=business-proof-header]')).join(' ');
expect(/New on MyIsraelRental/.test(bizLine), `business: expected "New on MyIsraelRental" beside the button, got "${bizLine}"`);
for (const id of ['rating', 'verified', 'years', 'kosher']) {
  expect(!(await page.$(`[data-testid=business-proof-header-${id}]`)), `business: "${id}" shown but not true`);
}

// Service page: same business facts, no rating yet.
await page.goto(`${WEB}/services/gig/${gig.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
expect(!!(await page.$('[data-testid=gig-proof-new]')), 'service: "New on MyIsraelRental" missing beside the button');
for (const id of ['rating', 'verified', 'years', 'kosher']) {
  expect(!(await page.$(`[data-testid=gig-proof-${id}]`)), `service: "${id}" shown but not true`);
}

// Founding year set -> years replace "new"; still no kosher on a plumber.
await j('PATCH', `/marketplace/businesses/${biz.id}`, { founded_year: new Date().getFullYear() - 7 }, tok);
await page.goto(`${WEB}/services/gig/${gig.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const years = (await texts('[data-testid=gig-proof-years]')).join(' ');
expect(/7 years in business/.test(years), `service: expected "7 years in business", got "${years}"`);
expect(!(await page.$('[data-testid=gig-proof-kosher]')), 'service: kosher shown on a non-food business');

// Property page: no property reviews and no lister credential exist, so nothing.
await page.goto(`${WEB}/property/${prop.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
expect(!!(await page.$('[data-testid=confirm-booking-button]')), 'property: booking button not found (page did not render?)');
expect(!(await page.$('[data-testid=property-proof]')), 'property: a proof line appeared with nothing true to show');

await b.close();
if (failures.length) { console.error('FAIL\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('PASS  new business, service and property get the proof line with no setup; untrue credentials never show');

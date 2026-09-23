// The paid page upgrade (23 Sep 2026): upgraded features appear only when
// the one check (backend utils/page_upgrade) is true, on all three page
// types, and switching it off returns each page to standard plus part A.
//
// Creates a fresh owner, business, service and property through the local
// API, then flips the switch as an admin.
//   Needs: local API on :8001, dev server on :3210, backend/tests/.env.test
//   Run:   node scripts/check-page-upgrade.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const API = 'http://localhost:8001/api';
const WEB = 'http://localhost:3210';
const env = Object.fromEntries(readFileSync('backend/tests/.env.test', 'utf8').split(/\r?\n/)
  .filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const j = async (method, path, body, token) => {
  const r = await fetch(`${API}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${path} ${r.status} ${await r.text()}`);
  return r.json();
};

const admin = (await j('POST', '/auth/login', { email: env.TEST_ADMIN_EMAIL, password: env.TEST_ADMIN_PASSWORD })).token;
const stamp = Date.now();
const reg = await j('POST', '/auth/register', { email: `upg-${stamp}@example.com`, password: `Pw-${stamp}-ok`, name: 'Upgrade Check', role: 'owner' });
const tok = reg.token;
const uid = reg.user.id;
const biz = await j('POST', '/marketplace/businesses', { name: `Upgrade check ${stamp}` }, tok);
const img = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
const gig = await j('POST', '/marketplace/gigs', {
  title: 'Upgrade check cleaning', description: 'Home cleaning.', category: 'cleaning-services', area: 'Jerusalem',
  gig_type: 'deliverable', booking_mode: 'in_platform', business_id: biz.id, gallery: [img],
  tiers: [{ name: 'Basic', price: 150, currency: 'ILS', images: [img] }],
}, tok);
const prop = await j('POST', '/properties', { title: 'Upgrade check flat', rental_type: 'long-term', property_type: 'apartment', area: 'Jerusalem', monthly_price: 5000, starting_date: '2026-10-01', images: [img] }, tok);
const slug = (await j('GET', `/marketplace/business/${biz.id}`)).slug;

const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };
const b = await chromium.launch();
let page;
const has = async (sel) => !!(await page.$(sel));
const visit = async (path) => { await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); };

// A fresh browser each phase: the property payload is cacheable for 60 s
// (public, max-age=60), so a real visitor sees a switch within a minute,
// and a reused test browser would see the previous phase.
const look = async (on) => {
  page = await (await b.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  const word = on ? 'missing' : 'shown';
  await visit(`/business/${slug}`);
  expect((await has('[data-testid=business-clarity]')) === on, `business: upgrade panel ${word}`);
  expect(await has('[data-testid=business-message-sticky]'), 'business: the sticky Message bar must stay for everyone');
  await visit(`/services/gig/${gig.id}`);
  expect((await has('[data-testid=gig-clarity]')) === on, `service: upgrade panel ${word}`);
  await visit(`/property/${prop.id}`);
  expect((await has('[data-testid=property-clarity]')) === on, `property: upgrade panel ${word}`);
  expect((await has('[data-testid=property-sticky-bar]')) === on, `property: phone sticky bar ${word}`);
};

await look(false);                                            // default: standard
await j('PUT', `/admin/users/${uid}/page-upgrade`, { on: true }, admin);
await look(true);                                             // upgraded
await j('PUT', `/admin/users/${uid}/page-upgrade`, { on: false }, admin);
await look(false);                                            // back to standard

await b.close();
if (failures.length) { console.error('FAIL\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('PASS  upgraded features appear only with the upgrade on, on all three pages; off returns them to standard');

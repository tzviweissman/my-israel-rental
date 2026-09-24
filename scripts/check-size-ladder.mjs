// The size ladder (docs/page-generation-rules.md §9), in a browser.
//
// Makes a shop with one store listing of four measured boards, puts a
// ladder on its page, then checks that scrolling steps through the sizes
// smallest to largest, that the ruler is drawn at the same scale as the
// boards, that reduced motion shows every size at once, and that it works
// in Hebrew and on a phone. Screenshots at fixed points in the scroll go
// to screenshots/ladder-*.png.
//   Needs: local API on :8001, dev server on :3210
//   Run:   node scripts/check-size-ladder.mjs
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

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
const tok = (await j('POST', '/auth/register', { email: `ladder-${stamp}@example.com`, password: `Pw-${stamp}-ok`, name: 'Ladder Check', role: 'owner' })).token;
const biz = await j('POST', '/marketplace/businesses', { name: `Board House ${stamp}` }, tok);
const img = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
const BOARDS = [['Large', 520, 37, 57], ['Small', 180, 15, 20], ['Medium', 320, 25, 35], ['Party', 780, 45, 70]];
const gig = await j('POST', '/marketplace/gigs', {
  title: 'Charcuterie boards', description: 'Meat boards for Shabbat and simchas.', category: 'shops-products', area: 'Jerusalem',
  gig_type: 'store', booking_mode: 'in_platform', business_id: biz.id, gallery: [img],
  products: BOARDS.map(([name, price, w, l]) => ({ name, price, currency: 'ILS', images: [img], width_cm: w, length_cm: l })),
}, tok);
await j('PATCH', `/marketplace/businesses/${biz.id}`, { page: { theme: {}, blocks: [
  { id: 'hero', type: 'hero', variant: 'band', props: { image: 'cover', title: 'Charcuterie boards in Jerusalem', lede: 'Order by Thursday.' } },
  { id: 'catalog', type: 'services', variant: 'grid', props: { source: 'all' } },
  { id: 'sizes', type: 'sizes', variant: 'ladder', props: { listing: gig.id, heading: 'Boards from 15 to 70 cm' } },
  { id: 'contact', type: 'contact', variant: 'stack', props: {} },
] } }, tok);
const slug = (await j('GET', `/marketplace/business/${biz.id}`)).slug;

const failures = [];
const expect = (c, m) => { if (!c) failures.push(m); };
await mkdir('screenshots', { recursive: true });
const b = await chromium.launch();

for (const [lang, width, reduced] of [['en', 1280, false], ['en', 375, false], ['he', 375, false], ['he', 1280, false], ['en', 1280, true]]) {
  const ctx = await b.newContext({ viewport: { width, height: width < 768 ? 812 : 856 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(`${WEB}/business/${slug}?lng=${lang}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const sec = page.locator('[data-testid="pg-sizes-sizes"]');
  await sec.waitFor({ timeout: 15000 });
  const tag = `${lang}-${width}${reduced ? '-still' : ''}`;
  const names = await page.locator('[data-testid="pg-sizes-item"]').evaluateAll((els) => els.map((e) => e.querySelector('span span').textContent));
  expect(names.join(',') === 'Small,Medium,Large,Party', `${tag}: not smallest to largest (${names})`);
  if (reduced) {
    expect(await sec.getAttribute('data-active') === '3', `${tag}: reduced motion should show every size at once`);
    await sec.screenshot({ path: `screenshots/ladder-${tag}.png` });
  } else {
    const box = await sec.boundingBox();
    const top = await page.evaluate(() => window.scrollY) + box.y;
    const seen = [];
    for (const f of [0.05, 0.3, 0.55, 0.85]) {
      await page.evaluate((y) => window.scrollTo(0, y), top + (box.height - (width < 768 ? 812 : 856)) * f);
      await page.waitForTimeout(500);
      seen.push(await sec.getAttribute('data-active'));
      await page.screenshot({ path: `screenshots/ladder-${tag}-${Math.round(f * 100)}.png` });
    }
    expect(seen.join('') === '0123', `${tag}: scrolling showed sizes ${seen.join(',')}, expected 0,1,2,3`);
    // The ruler and the boards share one scale: 10 cm on the ruler is 10/15 of the smallest board's width.
    const ratio = await page.evaluate(() => {
      const ruler = document.querySelector('[data-testid="pg-sizes-ruler"]').getBoundingClientRect().width;
      const smallest = document.querySelector('[data-testid="pg-sizes-stage"] > div').getBoundingClientRect().width;
      return ruler / smallest;
    });
    expect(Math.abs(ratio - 10 / 15) < 0.02, `${tag}: ruler is not at the boards' scale (${ratio.toFixed(3)})`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(!overflow, `${tag}: the page scrolls sideways`);
    // On a phone, the order button is above the page's sticky Message bar, not behind it.
    const covered = width >= 768 ? false : await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="pg-sizes-order"]').getBoundingClientRect();
      const bar = document.querySelector('[data-testid="business-message-sticky"]');
      const top = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().top : window.innerHeight;
      return btn.bottom > top;
    });
    expect(!covered, `${tag}: the order button is hidden behind the sticky bar`);
  }
  await ctx.close();
}

await b.close();
if (failures.length) { console.error('FAIL\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('PASS  size ladder: smallest to largest, steps with the scroll, ruler to scale, still with reduced motion, EN/HE, 375/1280');

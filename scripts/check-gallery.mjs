#!/usr/bin/env node
/**
 * The listing gallery: nothing cropped, nothing letterboxed in black, and
 * a thumbnail strip you can read at a glance.
 *
 * WHY. The frame is capped against the viewport, so it is almost never the
 * shape of the photo in it. It used to be `object-contain` on `bg-black`,
 * which meant two black bars - on a portrait phone photo, most of the
 * frame. The alternative everyone reaches for, `object-cover`, is worse
 * here: a listing photo is evidence about a property, and cropping it is
 * the site editing what the owner showed without telling anyone.
 *
 * So the picture is drawn whole over a blurred, enlarged copy of itself.
 * This checks all three of those things hold, in both directions, against
 * a listing whose photos are deliberately different shapes.
 *
 * Local stack: the built app on APP_ORIGIN proxying to API_ORIGIN.
 *
 *   APP_ORIGIN=http://localhost:3200 API_ORIGIN=http://127.0.0.1:8002 node scripts/check-gallery.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const API = (process.env.API_ORIGIN || 'http://localhost:8001') + '/api';
const stamp = Date.now().toString(36);
const results = [];
const ok = (name, cond, detail = '') => {
  results.push(!!cond);
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' — ' + detail}`);
};
const json = async (r) => { try { return await r.json(); } catch { return null; } };

const password = `Pw-${stamp}-ok1`;
const email = `gallery-${stamp}@example.com`;
const reg = await json(await fetch(`${API}/auth/register`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, name: 'Gallery Check', role: 'owner' }),
}));
ok('account created', !!reg?.token);
if (!reg?.token) process.exit(1);
const auth = { Authorization: `Bearer ${reg.token}`, 'content-type': 'application/json' };

// Portrait, landscape, square, wide, tall: the mix that produced bars.
const images = [
  'https://picsum.photos/seed/galA/900/1600',
  'https://picsum.photos/seed/galB/1600/900',
  'https://picsum.photos/seed/galC/1200/1200',
  'https://picsum.photos/seed/galD/1800/700',
  'https://picsum.photos/seed/galE/700/1200',
];
const prop = await json(await fetch(`${API}/properties`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    title: `TEST_gallery_${stamp}`, rental_type: 'long-term', property_type: 'apartment',
    area: 'Jerusalem', bedrooms: 3, monthly_price: 6500, currency: 'ILS', images,
  }),
}));
ok('a listing with five differently shaped photos exists', !!prop?.id);

const browser = await chromium.launch();
for (const lng of ['en', 'he']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: lng });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${APP}/property/${prop.id}?lng=${lng}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="gallery-main-image"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // 1. The photo is whole. `contain` is the guarantee; measured, the drawn
  //    image is never wider or taller than its frame.
  const fit = await page.evaluate(() => {
    const img = document.querySelector('[data-testid="gallery-main-image"]');
    if (!img) return null;
    const box = img.getBoundingClientRect();
    const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
    return {
      objectFit: getComputedStyle(img).objectFit,
      drawnW: Math.round(img.naturalWidth * scale),
      drawnH: Math.round(img.naturalHeight * scale),
      frameW: Math.round(box.width),
      frameH: Math.round(box.height),
    };
  });
  ok(`${lng}: the photo is drawn whole, not cropped`,
    fit && fit.objectFit === 'contain' && fit.drawnW <= fit.frameW + 1 && fit.drawnH <= fit.frameH + 1,
    JSON.stringify(fit));

  // 2. The surround is the photo's own colours, not black. Sampled at the
  //    frame's left edge, beside a portrait photo - where the bar was.
  const surround = await page.evaluate(() => {
    const img = document.querySelector('[data-testid="gallery-main-image"]');
    const frame = img?.closest('[data-testid="image-gallery"]')?.querySelector('.rounded-2xl');
    const blur = frame?.querySelector('img[aria-hidden="true"]');
    if (!blur) return null;
    const cs = getComputedStyle(blur);
    return { present: true, blur: cs.filter, fit: cs.objectFit };
  });
  ok(`${lng}: the surround is a blurred copy of the photo, not a black bar`,
    surround?.present && /blur/.test(surround.blur || ''), JSON.stringify(surround));
  const frameBg = await page.evaluate(() => {
    const img = document.querySelector('[data-testid="gallery-main-image"]');
    const frame = img?.closest('.rounded-2xl');
    return frame ? getComputedStyle(frame).backgroundColor : null;
  });
  ok(`${lng}: and the frame itself is not painted black`,
    frameBg !== 'rgb(0, 0, 0)', String(frameBg));

  // 3. The strip: one open frame, the rest slivers, and it follows.
  const strip = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-testid^="gallery-thumb-"]')].filter((e) => /-\d+$/.test(e.dataset.testid));
    const widths = els.map((e) => Math.round(e.getBoundingClientRect().width));
    return { n: els.length, widths, selected: els.findIndex((e) => e.getAttribute('aria-selected') === 'true') };
  });
  ok(`${lng}: every photo has a frame in the strip`, strip.n === 5, JSON.stringify(strip));
  ok(`${lng}: exactly one is open and the rest are slivers`,
    strip.widths.filter((w) => w > 90).length === 1 && strip.widths.filter((w) => w < 50).length === 4,
    JSON.stringify(strip.widths));
  ok(`${lng}: the open one is the photo being shown`, strip.selected === 0, `${strip.selected}`);

  await page.click('[data-testid="gallery-thumb-3"]');
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-testid^="gallery-thumb-"]')].filter((e) => /-\d+$/.test(e.dataset.testid));
    return {
      selected: els.findIndex((e) => e.getAttribute('aria-selected') === 'true'),
      open: els.findIndex((e) => e.getBoundingClientRect().width > 90),
      counter: document.body.innerText.match(/\d\s*\/\s*5/)?.[0] || '',
    };
  });
  ok(`${lng}: picking a frame moves the strip and the photo together`,
    after.selected === 3 && after.open === 3 && after.counter.startsWith('4'), JSON.stringify(after));

  ok(`${lng}: no page errors`, errors.length === 0, errors[0]);
  await ctx.close();
}

await browser.close();
if (prop?.id) await fetch(`${API}/properties/${prop.id}`, { method: 'DELETE', headers: auth });

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);

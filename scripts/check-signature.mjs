#!/usr/bin/env node
/**
 * Signing a contract: the pen has to leave a mark, and a blank one must
 * never be accepted.
 *
 * WHY THIS EXISTS. `penColor` was set to `var(--brand-primary)`. A canvas
 * 2D context cannot resolve a CSS custom property: the assignment is
 * rejected, so `fillStyle` keeps whatever it held - and after the pad's own
 * `clear()` that value is `rgba(0,0,0,0)`. Every stroke was therefore
 * painted in transparent ink. Nothing appeared, on any browser, for anyone.
 *
 * The second-order danger is worse than the first. `isEmpty()` answers
 * "were any strokes recorded", not "is there anything on the canvas", so
 * the two came apart: the pad reported a signature, the PNG was blank, and
 * the page would have posted an empty image as a binding signature on a
 * rental agreement. So this checks for INK, by reading the pixels, rather
 * than for the pad's opinion of itself.
 *
 * REAL MOUSE EVENTS, and that is not incidental. Synthetic PointerEvents
 * dispatched from page script do not drive signature_pad at all, so a check
 * written that way reports zero pixels whether the feature works or not -
 * it would have "failed" identically before and after the fix, which is the
 * same as not testing it.
 *
 * Local stack: the app on APP_ORIGIN proxying to API_ORIGIN.
 *
 *   APP_ORIGIN=http://localhost:3210 API_ORIGIN=http://127.0.0.1:8001 node scripts/check-signature.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const API = (process.env.API_ORIGIN || 'http://localhost:8001') + '/api';
const stamp = Date.now().toString(36);
const results = [];
const ok = (name, cond, detail = '') => {
  results.push(!!cond);
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' - ' + detail}`);
};
const json = async (r) => { try { return await r.json(); } catch { return null; } };

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
  + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
  + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n'
  + 'trailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');

/** A sublease with a contract on it, and the link the signer is sent. */
async function freshLink(tag) {
  const reg = await json(await fetch(`${API}/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: `sig-${tag}-${stamp}@example.com`, password: `Pw-${stamp}-ok1`,
      name: 'Signature Check', role: 'owner',
    }),
  }));
  const bearer = { Authorization: `Bearer ${reg.token}` };
  const sub = await json(await fetch(`${API}/subleases`, {
    method: 'POST', headers: { ...bearer, 'content-type': 'application/json' },
    body: JSON.stringify({
      title: `TEST_sig_${tag}_${stamp}`,
      description: 'A room for the summer, described at some length.',
      area: 'Jerusalem', price: 4200, price_type: 'monthly',
      available_from: '2026-10-01', available_to: '2027-01-31',
    }),
  }));
  const form = new FormData();
  form.append('file', new Blob([PDF], { type: 'application/pdf' }), 'agreement.pdf');
  const up = await json(await fetch(`${API}/subleases/${sub.id}/contract`, {
    method: 'POST', headers: bearer, body: form,
  }));
  return { token: up.sign_token, contractId: up.id, bearer };
}

const inkOn = (page) => page.evaluate(() => {
  const c = document.querySelector('[data-testid="signature-canvas"]');
  if (!c) return -1;
  const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 0) n += 1;
  return n;
});

/** Draw with the real mouse, the way a person does. */
async function scribble(page) {
  const box = await page.locator('[data-testid="signature-canvas"]').boundingBox();
  await page.mouse.move(box.x + 40, box.y + box.height * 0.6);
  await page.mouse.down();
  for (let i = 0; i < 24; i += 1) {
    await page.mouse.move(
      box.x + 40 + i * (box.width - 90) / 24,
      box.y + box.height * 0.5 + Math.sin(i / 3) * (box.height * 0.22),
    );
  }
  await page.mouse.up();
  return box;
}

const browser = await chromium.launch();

for (const lng of ['en', 'he']) {
  const link = await freshLink(lng);
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 }, locale: lng });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${APP}/sign/${link.token}?lng=${lng}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="signature-canvas"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);

  // The pen must be a resolved colour. A CSS variable here is the bug.
  const pen = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="signature-canvas"]');
    return { fill: c.getContext('2d').fillStyle, stroke: c.getContext('2d').strokeStyle };
  });
  ok(`${lng}: the pen has a real colour, not a CSS variable`,
    /^#|^rgb/.test(pen.fill) && pen.fill !== 'rgba(0, 0, 0, 0)', JSON.stringify(pen));

  // The drawing buffer must match the box it is drawn in, or the ink lands
  // somewhere other than the pen.
  const size = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="signature-canvas"]');
    const r = c.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    return {
      buffer: [c.width, c.height],
      css: [Math.round(r.width), Math.round(r.height)],
      expected: [Math.round(r.width * ratio), Math.round(r.height * ratio)],
    };
  });
  ok(`${lng}: the canvas grid matches the canvas box`,
    size.buffer[0] === size.expected[0] && size.buffer[1] === size.expected[1],
    JSON.stringify(size));

  ok(`${lng}: an untouched pad has no ink`, (await inkOn(page)) === 0);

  const box = await scribble(page);
  const painted = await inkOn(page);
  ok(`${lng}: drawing on it actually leaves a mark`, painted > 200, `${painted} pixels`);

  // And the mark is where the hand was, not offset from it. The stroke was
  // drawn across the middle band only.
  const bounds = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="signature-canvas"]');
    const { width, height } = c;
    const px = c.getContext('2d').getImageData(0, 0, width, height).data;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (px[(y * width + x) * 4 + 3] > 0) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    return { minX, maxX, minY, maxY, width, height };
  });
  ok(`${lng}: and the ink lands under the pen rather than offset from it`,
    bounds.minX >= 20 && bounds.maxX <= bounds.width - 20
    && bounds.minY > bounds.height * 0.1 && bounds.maxY < bounds.height * 0.9,
    JSON.stringify(bounds));

  // Clearing means clearing.
  await page.locator('button', { hasText: /.*/ }).first();
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => x.className.includes('hover:text-red-500'));
    if (b) b.click();
  });
  await page.waitForTimeout(400);
  ok(`${lng}: clearing wipes it`, (await inkOn(page)) === 0);

  // A blank pad must be refused, whatever the pad thinks of itself.
  await page.fill('[data-testid="signer-name-input"]', 'Rivka Adler');
  await page.click('[data-testid="confirm-sign-btn"]');
  await page.waitForTimeout(1500);
  const afterBlank = await json(await fetch(`${API}/contracts/sign/${link.token}`));
  ok(`${lng}: a blank pad is refused rather than signed`, afterBlank?.signed === false,
    JSON.stringify({ signed: afterBlank?.signed }));

  // And a real one goes through, with ink in the stored image.
  await scribble(page);
  await page.click('[data-testid="confirm-sign-btn"]');
  await page.waitForTimeout(2500);
  const after = await json(await fetch(`${API}/contracts/sign/${link.token}`));
  ok(`${lng}: signing works`, after?.signed === true, JSON.stringify({ signed: after?.signed }));
  const sig = (after?.signatures || [])[0];
  ok(`${lng}: the stored signature is a real image, not an empty one`,
    !!sig && typeof sig.signature_data === 'string'
    && sig.signature_data.startsWith('data:image/png;base64,')
    // A blank 576x160 PNG compresses to a few hundred bytes; a drawn one
    // does not. This is the assertion that a transparent pen defeats.
    && sig.signature_data.length > 3000,
    `${sig ? sig.signature_data.length : 0} chars`);
  ok(`${lng}: signed by the name that was typed`, sig?.signer_name === 'Rivka Adler', sig?.signer_name);
  ok(`${lng}: no page errors`, errors.length === 0, errors[0]);

  await fetch(`${API}/contracts/${link.contractId}`, { method: 'DELETE', headers: link.bearer });
  await ctx.close();
  if (box) { /* keep the linter happy about the unused box */ }
}

await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);

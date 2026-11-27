#!/usr/bin/env node
/**
 * Two or three versions of one screen, side by side, for the judges to rank before one is chosen (rules 3aj.18,
 * Tzvi, 27 Nov 2026: "Do 1 and 2"). Clean Plus changed one thing at a time and judged after each, so a layout choice
 * undid the photo fix it was meant to show (daylight room, then a white wash: "washed out and flat").
 *
 *   node scripts/variants-sheet.mjs <out.jpg> <url A> <url B> [url C] [--size 1440x900] [--at "<selector>"]
 *
 * Each version is its own page (gen/board/v-a.html ...) or the same page with a query the page reads (?v=b). Each is
 * taken once its arrival has finished, at the selector's section if --at is given (the top of the page otherwise),
 * and laid out left to right labelled A, B, C. Then: node scripts/judges.mjs --brief-variants, two fresh judges.
 */
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const take = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const [W, H] = take('--size', '1440x900').split('x').map(Number); const at = take('--at', '');
const [out, ...urls] = argv;
if (!out || urls.length < 2 || urls.length > 3) { console.error('usage: node scripts/variants-sheet.mjs <out.jpg> <url A> <url B> [url C] [--size 1440x900] [--at "<selector>"]'); process.exit(2); }
for (const u of urls) if (/^https?:/i.test(u)) { try { await fetch(u, { signal: AbortSignal.timeout(8000) }); } catch { console.error(`${u} does not answer: start the preview server first (node scripts/serve-builds.mjs 8991)`); process.exit(2); } }
const b = await chromium.launch();
const shots = [];
for (const u of urls) {
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto(u, { waitUntil: 'load', timeout: 60000 });
  if (at) { await p.locator(at).first().scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, 1)); }
  await p.waitForTimeout(1200);
  await p.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming?.().endTime)).map((a) => a.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 8000)),
  ])).catch(() => {});
  shots.push((await p.screenshot({ type: 'jpeg', quality: 80 })).toString('base64'));
}
const tw = 720, th = Math.round(tw * H / W);
const sheet = await b.newPage({ viewport: { width: shots.length * (tw + 16) + 16, height: th + 64 } });
await sheet.setContent(`<body style="margin:0;padding:8px;background:#111;display:flex;gap:16px">${shots.map((s, i) =>
  `<div><b style="display:block;font:700 22px sans-serif;color:#fff;margin:4px 0 10px">${'ABC'[i]}</b><img src="data:image/jpeg;base64,${s}" style="width:${tw}px;height:${th}px;display:block"></div>`).join('')}</body>`);
await sheet.screenshot({ path: out, type: 'jpeg', quality: 85 });
await b.close();
console.log(`${out}: versions ${'ABC'.slice(0, shots.length).split('').join(', ')} side by side. Then judges.mjs --brief-variants.`);

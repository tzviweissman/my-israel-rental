#!/usr/bin/env node
/**
 * The finished first screen's light beside the references' (rules 3aj.14, Tzvi, 27 Nov 2026: "Do 1 and 2"). A photo
 * can pass on its own and fail once the words and their shade sit on it: Clean Plus's daylight room measured bright,
 * then a white falloff under the headline made the screen "washed out and flat" and light stayed at 3.
 *
 *   node scripts/check-screen-light.mjs <url> <reference picture> [more references] [--size 1440x900]
 *
 * Takes the first screen once its arrival has finished, and the top of each reference picture at the same shape, and
 * measures each on the 0 to 100 scale: brightness (mean) and depth (the spread of brightness, its standard deviation).
 * Fails when ours is more than 8 darker than the dimmest reference (DIM) or its spread is under 0.75 of the flattest
 * reference's (FLAT, the washed-out case). Exit 1 on either. Prints every number, so a board can show them.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const si = argv.indexOf('--size'); const [W, H] = (si >= 0 ? argv.splice(si, 2)[1] : '1440x900').split('x').map(Number);
const [url, ...refs] = argv;
if (!url || !refs.length) { console.error('usage: node scripts/check-screen-light.mjs <url> <reference picture> [more] [--size 1440x900]'); process.exit(2); }
for (const r of refs) if (!fs.existsSync(r)) { console.error(`missing ${r}`); process.exit(2); }
if (/^https?:/i.test(url)) { try { await fetch(url, { signal: AbortSignal.timeout(8000) }); } catch { console.error(`${url} does not answer: start the preview server first (node scripts/serve-builds.mjs 8991)`); process.exit(2); } }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto(url, { waitUntil: 'load', timeout: 60000 });
await p.waitForTimeout(1200);
await p.evaluate(() => Promise.race([
  Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming?.().endTime)).map((a) => a.finished.catch(() => {}))),
  new Promise((r) => setTimeout(r, 8000)),
])).catch(() => {});
const ours = (await p.screenshot({ type: 'png' })).toString('base64');
const pics = [['ours', ours], ...refs.map((r) => [path.basename(r), fs.readFileSync(r).toString('base64')])];
const m = await b.newPage();
const stats = await m.evaluate(async ({ pics, W, H }) => Promise.all(pics.map(([name, b64]) => new Promise((ok) => {
  const im = new Image();
  im.onload = () => {
    const c = document.createElement('canvas'); c.width = 360; c.height = Math.round(360 * H / W);
    const sh = Math.min(im.naturalHeight, im.naturalWidth * H / W); // the top of a tall page, at the screen's shape
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, im.naturalWidth, sh, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { const y = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 2.55; s += y; s2 += y * y; n++; }
    const mean = s / n; ok({ name, mean: Math.round(mean * 10) / 10, spread: Math.round(Math.sqrt(s2 / n - mean * mean) * 10) / 10 });
  };
  im.src = 'data:image/png;base64,' + b64;
}))), { pics, W, H });
await b.close();
const [o, ...r] = stats;
for (const s of stats) console.log(`${s.name.padEnd(28)} brightness ${s.mean}  depth ${s.spread}`);
const dimRef = Math.min(...r.map((x) => x.mean)), flatRef = Math.min(...r.map((x) => x.spread));
const bad = [];
if (o.mean < dimRef - 8) bad.push(`DIM   the first screen is ${Math.round(dimRef - o.mean)} darker than the dimmest reference: re-light the photo or lift what sits on it`);
if (o.spread < flatRef * 0.75) bad.push(`FLAT  the first screen's depth is ${o.spread}, under 0.75 of the flattest reference's ${flatRef}: a wash or shade has flattened the photo; keep its shadows, put the words on a quiet part or their own panel`);
for (const x of bad) console.log(x);
console.log(bad.length ? `screen light: ${bad.length} problem(s) (rules 3aj.14)` : 'screen light: as bright and as deep as the references');
process.exit(bad.length ? 1 : 0);

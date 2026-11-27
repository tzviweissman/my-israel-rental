#!/usr/bin/env node
/**
 * Watch a website the way a visitor does, and measure what moves (Tzvi, 27 Nov 2026: "take a closer look at these
 * sites ... how they show the opening screen and what happens throughout the screen if things follow along", then
 * "make a video watching skill"). For each site, at 1280x800:
 *   <name>/run.webm      a video: 8 s of the opening untouched, the mouse drawing a slow circle, then a slow wheel
 *                        scroll to the bottom
 *   <name>-opening.jpg   the opening, two frames a second for 8 s, each stamped with its time
 *   <name>-mouse.jpg     the mouse circle: does anything follow the pointer?
 *   <name>-scroll.jpg    the scroll, one frame a second
 *   <name>/motion.json   every big element's place, opacity, scale and mask at each scroll step
 *   summary.json         per site, measured against the page's own movement: what FOLLOWS (stays on screen while the
 *                        page moves: pinned, sticky, fixed), what moves at its OWN SPEED (parallax), what slides
 *                        SIDEWAYS, FADES, GROWS or UNMASKS as you scroll
 * Works on smooth-scroll sites (Lenis and the like): the page's movement is read from where most elements went, not
 * from scrollY. A "FULL-SCREEN" follower is a layer (a pinned film, a background, a curtain or grain); look at the
 * scroll sheet to tell which. For a single moment's movement, run scripts/video-frames.mjs on run.webm with --burst.
 *
 *   node scripts/watch-site.mjs <outdir> <url> [more urls]
 *   node scripts/watch-site.mjs <outdir> --list <file of "name url" lines>
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [outArg, ...rest] = process.argv.slice(2);
if (!outArg || !rest.length) { console.error('usage: node scripts/watch-site.mjs <outdir> <url> [more] | --list <file>'); process.exit(2); }
const outDir = path.resolve(outArg);
const nameOf = (u) => { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).replace(/\W+/g, '-').replace(/-+$/, ''); };
const sites = rest[0] === '--list'
  ? fs.readFileSync(rest[1], 'utf8').trim().split(/\r?\n/).map((l) => l.trim().split(/\s+/))
  : rest.map((u) => [nameOf(u), u]);
fs.mkdirSync(outDir, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 mir-check';

// in the page: the big boxes, media, headings and fixed or sticky things on screen now
const SAMPLE = () => {
  if (!window.__mk) { window.__mk = new Map(); window.__n = 0; }
  const out = [], vw = innerWidth, vh = innerHeight;
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 30 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const s = getComputedStyle(el), tag = el.tagName;
    const media = /^(IMG|VIDEO|CANVAS|SVG|PICTURE)$/.test(tag), head = /^H[1-3]$/.test(tag), pos = s.position;
    if (!(media || head || r.width * r.height > 0.03 * vw * vh || pos === 'fixed' || pos === 'sticky')) continue;
    if (!window.__mk.has(el)) window.__mk.set(el, ++window.__n);
    out.push({ id: window.__mk.get(el), tag, pos, cls: (typeof el.className === 'string' ? el.className : '').slice(0, 40),
      txt: (head ? el.textContent : (el.alt || el.getAttribute('aria-label') || '')).trim().replace(/\s+/g, ' ').slice(0, 50),
      t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height),
      op: +s.opacity, tf: s.transform === 'none' ? null : s.transform, clip: s.clipPath !== 'none' ? s.clipPath.slice(0, 40) : '' });
  }
  return { y: scrollY, els: out };
};

const label = (e) => `${e.tag.toLowerCase()}${e.cls ? '.' + e.cls.split(' ')[0] : ''}${e.txt ? ' "' + e.txt.slice(0, 30) + '"' : ''}`;
const scaleOf = (tf) => { const m = tf && tf.match(/matrix\(([^)]+)\)/); if (!m) return 1; const v = m[1].split(',').map(Number); return Math.hypot(v[0], v[1]); };
export function analyse(j) {
  const S = (j.samples || []).slice(1);   // the first sample is the opening, before the mouse and the scroll
  const track = new Map();
  let scrolled = 0, steps = 0;
  for (let i = 1; i < S.length; i++) {
    const prev = new Map(S[i - 1].els.map((e) => [e.id, e]));
    // the page's own move this step: the commonest top change of elements seen in both samples
    const d = {};
    for (const e of S[i].els) { const p = prev.get(e.id); if (p && p.pos !== 'fixed') { const k = Math.round((e.t - p.t) / 10) * 10; d[k] = (d[k] || 0) + 1; } }
    const shift = +(Object.entries(d).sort((a, b) => b[1] - a[1])[0] || [0])[0];
    if (shift > -40) continue;   // the page did not move this step
    scrolled += -shift; steps++;
    for (const e of S[i].els) { const p = prev.get(e.id); if (!p) continue;
      if (!track.has(e.id)) track.set(e.id, []);
      track.get(e.id).push({ shift, dt: e.t - p.t, dl: e.l - p.l, dop: e.op - p.op, dsc: scaleOf(e.tf) - scaleOf(p.tf), dclip: e.clip !== p.clip, e }); }
  }
  const res = { follows: [], ownSpeed: [], sideways: [], fades: [], grows: [], unmask: [] };
  for (const t of track.values()) {
    const e = t[t.length - 1].e;
    if (e.op < 0.1) continue;   // invisible
    const layer = (e.pos === 'fixed' || e.pos === 'absolute') && e.w >= 1200 && e.h >= 760;
    const bar = e.t < 110 && e.h < 140;   // the menu bar
    const still = t.filter((x) => Math.abs(x.dt) < 12).length;
    if (still >= 3 && !bar && e.w * e.h > 0.04 * 1280 * 800) res.follows.push(`${layer ? 'FULL-SCREEN ' : ''}${label(e)} (${e.pos}, stays ${still} of ${t.length} steps, ${e.w}x${e.h})`);
    const odd = t.filter((x) => Math.abs(x.dt) >= 12).map((x) => x.dt / x.shift).filter((r) => (r > 0.15 && r < 0.85) || r > 1.15);
    if (odd.length >= 3) res.ownSpeed.push(`${label(e)} (moves ${(odd.reduce((a, b) => a + b, 0) / odd.length).toFixed(2)}x the scroll)`);
    if (t.filter((x) => Math.abs(x.dl) > 30).length >= 2) res.sideways.push(`${label(e)} (${t.reduce((a, x) => a + x.dl, 0)} px sideways)`);
    if (t.some((x) => Math.abs(x.dop) > 0.15)) res.fades.push(label(e));
    if (t.filter((x) => Math.abs(x.dsc) > 0.03).length >= 2) res.grows.push(`${label(e)} (scale ${scaleOf(t[0].e.tf).toFixed(2)} to ${scaleOf(e.tf).toFixed(2)})`);
    if (t.filter((x) => x.dclip).length >= 2) res.unmask.push(label(e));
  }
  const fixed = [...new Set(S.flatMap((s) => s.els.filter((e) => e.pos === 'fixed' && !(e.t < 110 && e.h < 140)).map(label)))];
  return { url: j.url, scrolledPx: scrolled, steps, fixedBig: fixed.slice(0, 6), ...Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.slice(0, 8)])),
    counts: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.length])) };
}

const FONTS = 'C:/Windows/Fonts';   // ffmpeg runs from here so drawtext finds arial.ttf without a fontconfig file
const stamp = "drawtext=fontfile=arial.ttf:text='%{pts\\:hms}':x=8:y=8:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=4";
function sheets(name, dir, marks) {
  const v = path.join(dir, 'run.webm'); if (!fs.existsSync(v)) return;
  const m = Object.fromEntries(marks.map(([t, s]) => [s.split(' after')[0], +t]));
  const t0 = m.loaded ?? 0, tm = m['mouse circle done'] ?? t0 + 10, te = m['scroll done'] ?? tm + 30;
  const part = (from, len, fps, cols, file) => { const n = Math.max(1, Math.ceil(len * fps));
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(from), '-t', String(len), '-i', v, '-vf', `fps=${fps},${stamp},scale=400:-2,tile=${cols}x${Math.ceil(n / cols)}:padding=6:color=0x1e1e1e`, '-frames:v', '1', path.join(outDir, file)], { cwd: fs.existsSync(FONTS) ? FONTS : dir }); };
  part(t0, 8, 2, 4, `${name}-opening.jpg`);
  part(t0 + 8, Math.max(1, tm - t0 - 8), 2, 5, `${name}-mouse.jpg`);
  part(tm, Math.min(60, Math.max(2, te - tm)), 1, 5, `${name}-scroll.jpg`);
}

const summary = {};
async function one(b, [name, url]) {
  const dir = path.join(outDir, name); fs.mkdirSync(dir, { recursive: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, userAgent: UA, recordVideo: { dir, size: { width: 1280, height: 800 } } });
  const p = await ctx.newPage();
  const log = { name, url, marks: [] }, t0 = Date.now(), samples = [];
  const mark = (m) => log.marks.push([((Date.now() - t0) / 1000).toFixed(1), m]);
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    mark('loaded');
    await p.waitForTimeout(8000);
    mark('opening done');
    samples.push(await p.evaluate(SAMPLE));
    // accept a cookie bar so it does not cover the scroll
    await p.evaluate(() => { for (const el of document.querySelectorAll('button, a')) { if (/^(accept|accept all|agree|ok|got it|allow all|i agree|accept cookies)$/i.test(el.textContent.trim())) { el.click(); break; } } }).catch(() => {});
    for (let a = 0; a <= 40; a++) { await p.mouse.move(640 + 300 * Math.cos(a / 40 * 2 * Math.PI), 400 + 200 * Math.sin(a / 40 * 2 * Math.PI)); await p.waitForTimeout(40); }
    mark('mouse circle done');
    await p.mouse.move(640, 400);
    let same = 0, last = '';
    for (let i = 0; i < 70; i++) {
      for (let k = 0; k < 4; k++) { await p.mouse.wheel(0, 100); await p.waitForTimeout(90); }
      await p.waitForTimeout(250);
      const s = await p.evaluate(SAMPLE);
      samples.push(s);
      const sig = s.y + ':' + s.els.slice(0, 12).map((e) => e.t).join(',');
      if (sig === last) { if (++same >= 3) break; } else same = 0;
      last = sig;
    }
    mark(`scroll done after ${samples.length - 1} steps`);
  } catch (e) { log.error = e.message.slice(0, 120); }
  log.samples = samples;
  await ctx.close();
  const vid = fs.readdirSync(dir).find((f) => f.endsWith('.webm') && f !== 'run.webm');
  if (vid) fs.renameSync(path.join(dir, vid), path.join(dir, 'run.webm'));
  fs.writeFileSync(path.join(dir, 'motion.json'), JSON.stringify(log));
  sheets(name, dir, log.marks);
  summary[name] = analyse(log);
  const c = summary[name].counts;
  console.log(`${name}: ${log.error || 'ok'}, ${Math.max(0, samples.length - 1)} scroll steps; follows ${c.follows}, own speed ${c.ownSpeed}, sideways ${c.sideways}, fades ${c.fades}, grows ${c.grows}, unmasks ${c.unmask}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const q = [...sites];
  await Promise.all([0, 1, 2].map(async () => { while (q.length) await one(b, q.shift()); }));
  await b.close();
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
  console.log('summary:', path.join(outDir, 'summary.json'));
}

#!/usr/bin/env node
/**
 * Is a generated clip physically continuous? (Tzvi, 1 Nov 2026, on Krysp's snap: "the bend and the snap dont look
 * natural ... is there a way to control the video creation better so we dont keep having these small issues like random
 * crumbs disappearing".) Every clip is measured here before it goes into a film, not only looked at.
 *
 *   node scripts/check-clip.mjs <clip.mp4> [more clips] [--from 1.9] [--to 6.5] [--cut 3.0]
 *
 * Reads the clip at 24 fps, 320x180 (ffmpeg on PATH, no packages). Fails (exit 1) with:
 *   JUMP    one frame changes far more than the frames around it: a snap over in a frame, a smear, a hard cut, a
 *           pop. The key moment of a film must take at least several frames (Krysp's first snap broke in one).
 *   RUSH    a quarter second or more where the whole picture lurches: the model sliding or redrawing the product
 *           (Krysp's first snap drew chocolate over the plain half that way)
 *   BLANK   a frame with almost nothing in it (plain ground only): Krysp's tilt went peach for 0.7 s.
 *   VANISH  on a plain ground, a small piece (a crumb, a grain, a flake) is there and then gone, away from the frame's
 *           edge and away from the product, without moving off: pieces never fade or vanish in the air (rule 3o.1).
 *   APPEAR  the same in reverse: a piece that turns up in the open, not from the product or an edge.
 * --from/--to measure only part of a clip (the part a film uses); --cut marks an intended join (time in the clip)
 * that JUMP ignores, and VANISH and APPEAR within half a second of it (a dissolve takes the whole scene with it). VANISH and APPEAR need a plain, light ground (taken from the frame's border); on a busy photo or
 * a dark ground they are skipped and say so.
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2), clips = [], opt = { from: 0, to: Infinity, cut: [] };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--from') opt.from = +args[++i];
  else if (args[i] === '--to') opt.to = +args[++i];
  else if (args[i] === '--cut') opt.cut.push(+args[++i]);
  else clips.push(args[i]);
}
if (!clips.length) { console.error('usage: node scripts/check-clip.mjs <clip.mp4> [--from s] [--to s] [--cut s]'); process.exit(2); }

const W = 320, H = 180, FPS = 24, N = W * H;
let bad = 0;
for (const clip of clips) {
  const ff = ['-v', 'error', '-ss', String(opt.from)];
  if (Number.isFinite(opt.to)) ff.push('-t', String(opt.to - opt.from));
  ff.push('-i', clip, '-vf', `fps=${FPS},scale=${W}:${H}:flags=area,format=rgb24`, '-f', 'rawvideo', '-');
  const r = spawnSync('ffmpeg', ff, { maxBuffer: 1 << 30 });
  if (r.status !== 0) { console.log(`FAIL  ${clip}: ffmpeg could not read it`); bad++; continue; }
  const buf = r.stdout, F = Math.floor(buf.length / (N * 3));
  const t = (i) => (opt.from + i / FPS).toFixed(2);
  const px = (f, k) => f * N * 3 + k * 3;
  const problems = [];

  // ground: the median colour of the frame's border
  const ground = (f) => {
    const cs = [[], [], []];
    for (let x = 0; x < W; x += 4) for (const y of [0, H - 1]) { const o = px(f, y * W + x); for (let c = 0; c < 3; c++) cs[c].push(buf[o + c]); }
    for (let y = 0; y < H; y += 4) for (const x of [0, W - 1]) { const o = px(f, y * W + x); for (let c = 0; c < 3; c++) cs[c].push(buf[o + c]); }
    return cs.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
  };
  const gray = (f, k) => { const o = px(f, k); return 0.299 * buf[o] + 0.587 * buf[o + 1] + 0.114 * buf[o + 2]; };

  // JUMP: frame-to-frame change against the change around it
  const d = [];
  for (let f = 0; f + 1 < F; f++) { let s = 0; for (let k = 0; k < N; k += 3) s += Math.abs(gray(f, k) - gray(f + 1, k)); d.push(s / (N / 3)); }
  const sorted = [...d].sort((p, q) => p - q), med = sorted[sorted.length >> 1] || 0;
  d.forEach((v, f) => {
    const around = d.slice(Math.max(0, f - 6), f).concat(d.slice(f + 1, f + 7)).sort((p, q) => p - q);
    const local = around[around.length >> 1] || med;
    const atCut = opt.cut.some((c) => Math.abs(c - (opt.from + (f + 1) / FPS)) < 1.5 / FPS);
    if (!atCut && v > 8 && v > 4 * Math.max(local, 1)) problems.push(`JUMP    ${t(f)} to ${t(f + 1)} s: the picture changes ${v.toFixed(0)} in one frame, ${(v / Math.max(local, 1)).toFixed(0)}x the frames around it`);
  });

  // RUSH: a quarter second or more where everything lurches (Krysp's first snap slid chocolate over the plain half at
  // 15 to 21 a frame; the good films measured, even a camera going round, stay under 7)
  let rushFrom = -1;
  for (let f = 0; f <= d.length; f++) {
    const fast = f < d.length && d[f] > 10;
    if (fast && rushFrom < 0) rushFrom = f;
    if (!fast && rushFrom >= 0) { if (f - rushFrom >= 6) problems.push(`RUSH    ${t(rushFrom)} to ${t(f)} s: the whole picture lurches (over 10 a frame for ${f - rushFrom} frames; smooth films stay under 7)`); rushFrom = -1; }
  }

  // BLANK: almost nothing but ground
  let blankFrom = -1;
  for (let f = 0; f <= F; f++) {
    let fg = 0;
    if (f < F) { const g = ground(f); for (let k = 0; k < N; k += 2) { const o = px(f, k); if (Math.abs(buf[o] - g[0]) + Math.abs(buf[o + 1] - g[1]) + Math.abs(buf[o + 2] - g[2]) > 60) fg++; } }
    const blank = f < F && fg / (N / 2) < 0.04;
    if (blank && blankFrom < 0) blankFrom = f;
    if (!blank && blankFrom >= 0) { if (f - blankFrom >= 3) problems.push(`BLANK   ${t(blankFrom)} to ${t(f)} s: under 4% of the frame is anything but ground`); blankFrom = -1; }
  }

  // VANISH / APPEAR: small pieces on a plain ground
  const plain = (() => { let even = 0, n = 0; for (let f = 0; f < F; f += 12) { const g = ground(f); let close = 0, m = 0;
    for (let x = 0; x < W; x += 4) for (const y of [0, H - 1]) { const o = px(f, y * W + x); m++; if (Math.abs(buf[o] - g[0]) + Math.abs(buf[o + 1] - g[1]) + Math.abs(buf[o + 2] - g[2]) < 45) close++; }
    n++; if (close / m > 0.8 && 0.299 * g[0] + 0.587 * g[1] + 0.114 * g[2] > 70) even++; } return even / n > 0.6; })();
  // ponytail: a dark ground is skipped (dim glows flicker like pieces: American Crust's oven); look at those by eye
  if (!plain) problems.push('note    the ground is not plain and light, so VANISH and APPEAR were not checked: watch the pieces by eye');
  else {
    const pieces = [];   // per frame: [{x, y, a}] small components, plus the mask of big ones (the product)
    for (let f = 0; f < F; f++) {
      const g = ground(f), m = new Uint8Array(N), lab = new Int32Array(N);
      for (let k = 0; k < N; k++) { const o = px(f, k); m[k] = Math.abs(buf[o] - g[0]) + Math.abs(buf[o + 1] - g[1]) + Math.abs(buf[o + 2] - g[2]) > 70 ? 1 : 0; }
      const small = [], big = new Uint8Array(N); let id = 0;
      for (let k = 0; k < N; k++) if (m[k] && !lab[k]) {
        id++; const st = [k], cells = []; lab[k] = id;
        while (st.length) { const c = st.pop(); cells.push(c); const x = c % W, y = (c / W) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const nk = ny * W + nx; if (m[nk] && !lab[nk]) { lab[nk] = id; st.push(nk); } } }
        if (cells.length >= 3 && cells.length <= 250) { let sx = 0, sy = 0; for (const c of cells) { sx += c % W; sy += (c / W) | 0; } small.push({ x: sx / cells.length, y: sy / cells.length, a: cells.length }); }
        else if (cells.length > 250) for (const c of cells) big[c] = 1;
      }
      pieces.push({ small, big });
    }
    const nearBig = (f, p, r) => { const { big } = pieces[f]; for (let y = Math.max(0, Math.round(p.y - r)); y <= Math.min(H - 1, Math.round(p.y + r)); y++) for (let x = Math.max(0, Math.round(p.x - r)); x <= Math.min(W - 1, Math.round(p.x + r)); x++) if (big[y * W + x]) return true; return false; };
    const edge = (p) => p.x < 12 || p.y < 12 || p.x > W - 13 || p.y > H - 13;
    const has = (f, p, r) => f >= 0 && f < F && pieces[f].small.some((q) => Math.hypot(q.x - p.x, q.y - p.y) <= r);
    const seen = new Set();
    for (let f = 2; f + 3 < F; f++) for (const p of pieces[f].small) {
      if (p.a < 8 || edge(p)) continue;
      // seen steadily for three frames before, gone for three after: noise on a textured ground flickers for less
      // there in f and f-1, gone in f+1 and f+2, not by the product, not by an edge: vanished
      if (has(f - 1, p, 6) && has(f - 2, p, 9) && !has(f + 1, p, 10) && !has(f + 2, p, 14) && !has(f + 3, p, 18) && !nearBig(f + 1, p, 5)) {
        if (opt.cut.some((c) => Math.abs(c - (opt.from + f / FPS)) < 0.5)) continue;
        const key = `v${Math.round(p.x / 20)},${Math.round(p.y / 20)},${Math.round(f / 6)}`; if (!seen.has(key)) { seen.add(key); problems.push(`VANISH  ${t(f)} s: a piece at ${Math.round(p.x / W * 100)}% across, ${Math.round(p.y / H * 100)}% down is gone the next frame, in the open`); }
      }
      if (has(f + 1, p, 6) && has(f + 2, p, 9) && !has(f - 1, p, 10) && f >= 3 && !has(f - 2, p, 14) && !has(f - 3, p, 18) && !nearBig(f - 1, p, 5)) {
        if (opt.cut.some((c) => Math.abs(c - (opt.from + f / FPS)) < 0.5)) continue;
        const key = `a${Math.round(p.x / 20)},${Math.round(p.y / 20)},${Math.round(f / 6)}`; if (!seen.has(key)) { seen.add(key); problems.push(`APPEAR  ${t(f)} s: a piece at ${Math.round(p.x / W * 100)}% across, ${Math.round(p.y / H * 100)}% down turns up in the open, not from the product or an edge`); }
      }
    }
  }
  const real = problems.filter((p) => !p.startsWith('note'));
  console.log(`${real.length ? 'FAIL' : 'pass'}  ${clip} (${(F / FPS).toFixed(1)} s measured)`);
  for (const p of problems) console.log('        ' + p);
  if (real.length) bad++;
}
process.exit(bad ? 1 : 0);

#!/usr/bin/env node
/**
 * Watch a video by its pictures, not only its words (Tzvi, 27 Nov 2026: "make a video watching skill ... so we watch
 * videos better and learn more from them"; the video-notes skill says when to use it). From a local video file:
 *
 *   cuts.jpg      one frame at every cut (a scene change), each stamped with its time: the whole edit on one sheet
 *   cuts.txt      the cut times, the number of shots and the average shot length (an ad's pace, measured)
 *   beats.md      each shot's time beside the words spoken then (with --subs <file.vtt>), so what is said and what is
 *                 shown line up
 *   burst-<t>.jpg with --burst 12.5,40: twelve frames a twelfth of a second apart from each time, one row, to read a
 *                 movement (an animation, a transition, a scroll effect) that a single frame cannot settle
 *   every-<n>s.jpg with --every 2: a frame every n seconds (for a video with few cuts, a screen recording)
 *
 *   node scripts/video-frames.mjs <video> <outdir> [--subs file.vtt] [--burst t1,t2] [--every n] [--scene 0.3] [--from s] [--to s]
 *
 * Get the file with yt-dlp (`yt-dlp -f "bv*[height<=720]+ba/b[height<=720]" -o v.mp4 <url>`) after asking the user;
 * it goes in the scratchpad, never the repo. A cut is a frame whose scene score is over 0.3 (lower it for slow
 * dissolves, raise it for busy footage).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [video, outArg] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!video || !outArg) { console.error('usage: node scripts/video-frames.mjs <video> <outdir> [--subs f.vtt] [--burst t1,t2] [--every n] [--scene 0.3] [--from s] [--to s]'); process.exit(2); }
const src = path.resolve(video), out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
const FONTS = 'C:/Windows/Fonts';   // ffmpeg runs from here so drawtext finds arial.ttf without a fontconfig file
const stamp = "drawtext=fontfile=arial.ttf:text='%{pts\\:hms}':x=8:y=8:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=4";
const ff = (a) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...a], { cwd: fs.existsSync(FONTS) ? FONTS : out, encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status) throw new Error(r.stderr.split('\n').slice(-3).join(' ')); return r; };
const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], { encoding: 'utf8' });
const dur = parseFloat(probe.stdout) || 0;
const from = +opt('from', 0), to = +opt('to', dur);
const range = ['-ss', String(from), '-to', String(to)];
const cols = 5, w = 384;
const sheet = (n) => `scale=${w}:-2,tile=${cols}x${Math.max(1, Math.ceil(n / cols))}:padding=6:color=0x1e1e1e`;

// 1. the cuts: scene changes, times read from showinfo
const scene = +opt('scene', 0.3);
const r = spawnSync('ffmpeg', ['-v', 'info', ...range, '-i', src, '-vf', `select='eq(n\\,0)+gt(scene\\,${scene})',showinfo`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
const times = [...r.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => +m[1] + from);
const shots = times.map((t, i) => [t, (times[i + 1] ?? to) - t]);
const avg = shots.length ? (to - from) / shots.length : 0;
fs.writeFileSync(path.join(out, 'cuts.txt'), `${shots.length} shots in ${(to - from).toFixed(1)} s, ${avg.toFixed(2)} s a shot on average (scene > ${scene})\n`
  + shots.map(([t, d]) => `${t.toFixed(2)}\t${d.toFixed(2)} s`).join('\n') + '\n');
// one sheet of every cut (at most 60; past that, every other one)
const keep = times.length > 60 ? times.filter((_, i) => i % Math.ceil(times.length / 60) === 0) : times;
if (keep.length) ff([...range, '-i', src, '-vf', `select='eq(n\\,0)+gt(scene\\,${scene})',${stamp},${sheet(keep.length)}`, '-fps_mode', 'passthrough', '-frames:v', '1', path.join(out, 'cuts.jpg')]);
console.log(`cuts: ${shots.length} shots, ${avg.toFixed(2)} s on average -> ${path.join(out, 'cuts.jpg')}`);

// 2. a frame every n seconds
const every = opt('every');
if (every) { const n = Math.ceil((to - from) / +every); ff([...range, '-i', src, '-vf', `fps=1/${every},${stamp},${sheet(Math.min(n, 60))}`, '-frames:v', '1', path.join(out, `every-${every}s.jpg`)]); console.log(`every ${every} s -> every-${every}s.jpg`); }

// 3. bursts: 12 frames at 12 a second from each time, in one row
for (const t of (opt('burst', '') || '').split(',').filter(Boolean)) {
  ff(['-ss', String(t), '-t', '1', '-i', src, '-vf', `fps=12,${stamp.replace("%{pts\\:hms}", `%{eif\\:${t}*1000+t*1000\\:d} ms`)},scale=320:-2,tile=6x2:padding=4:color=0x1e1e1e`, '-frames:v', '1', path.join(out, `burst-${t}.jpg`)]);
  console.log(`burst at ${t} s -> burst-${t}.jpg`);
}

// 4. beats: each shot beside the words spoken during it
const subs = opt('subs');
if (subs) {
  const cues = [];
  const toS = (s) => { const p = s.replace(',', '.').split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
  for (const block of fs.readFileSync(subs, 'utf8').split(/\r?\n\r?\n/)) {
    const m = block.match(/([\d:.,]+)\s+-->\s+([\d:.,]+)[^\n]*\n([\s\S]*)/); if (!m) continue;
    const text = m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); if (text) cues.push([toS(m[1]), toS(m[2]), text]);
  }
  const lines = ['| time | shot | said during it |', '|---|---|---|'];
  for (const [t, d] of shots) {
    const said = [...new Set(cues.filter(([a, b]) => b > t && a < t + d).map((c) => c[2]))].join(' ').replace(/\b(\w+(?: \w+){2,6}) \1\b/g, '$1');
    lines.push(`| ${new Date(t * 1000).toISOString().slice(14, 19)} | ${d.toFixed(1)} s | ${said.slice(0, 400)} |`);
  }
  fs.writeFileSync(path.join(out, 'beats.md'), lines.join('\n') + '\n');
  console.log(`beats -> ${path.join(out, 'beats.md')}`);
}

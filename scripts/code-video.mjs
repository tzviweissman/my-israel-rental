#!/usr/bin/env node
/**
 * A video made in code, with no paid generation (Tzvi, 6 Nov 2026, from Tyler Mommsen's video). A film is an HTML page
 * with window.seek(seconds): this draws it frame by frame, so nothing depends on how fast the machine is, and joins the
 * frames. The method and the brief are in docs/code-video.md.
 *
 *   node scripts/code-video.mjs scroll <url> <dir> [--frames 90] [--screens 1.4]   a real page scrolled, as stills
 *   node scripts/code-video.mjs render <film.html> <out.mp4> --w 1080 --h 1920 --dur 20 [--fps 30] [--query a=b] [--audio x.wav]
 *   node scripts/code-video.mjs sheet <out.mp4> <sheet.jpg> [--every 0.5]          a frame every half second, to critique
 *
 * ponytail: the scroll stills come from real Chrome (the bundled browser has no H.264, and scroll films need it).
 * Frames go to ffmpeg one at a time, so a long film is slow; fine for the 15 to 30 seconds these are.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const [, , cmd, a, b, ...rest] = process.argv;
const opt = (name, fallback) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : fallback; };
const fail = (m) => { console.error(m); process.exit(1); };

async function scroll(url, dir) {
  const frames = Number(opt('frames', 90)), screens = Number(opt('screens', 1.4));
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(4000);
  for (let i = 0; i < frames; i += 1) {
    const t = i / (frames - 1), eased = t * t * (3 - 2 * t);
    await page.evaluate((y) => window.scrollTo(0, y), eased * screens * 844);
    await page.waitForTimeout(160);
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 });
  }
  await browser.close();
  console.log(`${frames} stills in ${dir}`);
}

async function render(film, out) {
  const w = Number(opt('w', 1080)), h = Number(opt('h', 1920)), fps = Number(opt('fps', 30)), dur = Number(opt('dur')), audio = opt('audio');
  if (!dur) fail('--dur is needed');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${pathToFileURL(path.resolve(film)).href}?${opt('query', '')}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => typeof window.seek === 'function');
  const args = ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    ...(audio ? ['-i', audio, '-c:a', 'aac', '-b:a', '160k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out];
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(dur * fps);
  for (let i = 0; i < total; i += 1) {
    await page.evaluate((t) => window.seek(t), i / fps);
    const shot = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(shot)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  console.log(`${out}: ${total} frames, ${w}x${h}, ${fps} fps`);
}

function sheet(video, out) {
  const every = Number(opt('every', 0.5));
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', `fps=1/${every},scale=216:-2,tile=10x5`, '-frames:v', '1', out], { stdio: 'inherit' });
  if (r.status) fail('sheet failed');
  console.log(out);
}

if (cmd === 'scroll') await scroll(a, b);
else if (cmd === 'render') await render(a, b);
else if (cmd === 'sheet') sheet(a, b);
else fail('scroll, render or sheet: see the top of this file');

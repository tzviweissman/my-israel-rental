// A preview video for the owner: scroll top to bottom at a reading pace.
//   Run from the project folder (it uses that project's Playwright):
//   node ~/.claude/skills/build-business-page/scripts/record.mjs <url> <width> <height> <out.mp4> [seconds] [speedup]
//   e.g. ... record.mjs http://localhost:4503/ 390 844 preview-phone.mp4 40 1.8
// Playwright records at whatever pace the machine manages, so heavy pages run
// slow; [speedup] (default 1.8) brings the result back to about [seconds].
// Needs ffmpeg on PATH for the mp4 (a phone plays it; WhatsApp takes ~10 MB).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const [url, w, h, out] = [process.argv[2], Number(process.argv[3] || 390), Number(process.argv[4] || 844), process.argv[5] || 'preview.mp4'];
const secs = Number(process.argv[6] || 40), speed = Number(process.argv[7] || 1.8);
const dir = mkdtempSync(join(tmpdir(), 'rec-'));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, recordVideo: { dir, size: { width: w, height: h } } });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(2500);
const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const steps = secs * 8;
for (let i = 1; i <= steps; i++) {
  const t = i / steps, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  await p.evaluate((y) => scrollTo(0, y), Math.round(max * (0.15 * t + 0.85 * e)));
  await p.waitForTimeout(1000 / 8);
}
await p.waitForTimeout(2500);
await ctx.close(); await b.close();
const webm = join(dir, readdirSync(dir).find((f) => f.endsWith('.webm')));
const scale = w < 600 ? `,scale=${w * 2}:-2:flags=lanczos` : '';
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '1.2', '-i', webm, '-vf', `setpts=PTS/${speed},fps=30${scale}`,
  '-c:v', 'libx264', '-crf', '21', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]);
rmSync(dir, { recursive: true, force: true });
console.log('wrote', out);

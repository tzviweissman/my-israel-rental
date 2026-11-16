// Draws ad.html frame by frame (window.render(t)) and writes the MP4 for status and the looping GIF for chats.
//   node docs/ads/gen/la-cholent-moving/record.mjs [plain|chanukah] [t,t,... to save only those frames as PNGs]
// Free: no generation. Then: backend/.venv/Scripts/python scripts/check-moving-ad.py docs/ads/<name>.mp4
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '../../../..');
const { chromium } = createRequire(path.join(ROOT, 'scripts', 'x.js'))('playwright');
const v = process.argv[2] || 'plain';
const only = process.argv[3];
const name = v === 'chanukah' ? 'la-cholent-chanukah-moving' : 'la-cholent-moving';
const FPS = 30, LEN = 8;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lacrec-'));
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1080, height: 1920 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(`file:///${path.join(HERE, 'ad.html').split(path.sep).join('/')}?v=${v}`);
await p.evaluate(() => document.fonts.ready);
await p.waitForFunction(() => [...document.images].every((i) => !i.getAttribute('src') || (i.complete && i.naturalWidth)));
await p.waitForTimeout(500);
const times = only ? only.split(',').map(Number) : [...Array(LEN * FPS).keys()].map((i) => i / FPS);
for (const [i, t] of times.entries()) {
  await p.evaluate((x) => window.render(x), t);
  await p.locator('#ad').screenshot({ path: path.join(tmp, `${String(i).padStart(4, '0')}.png`) });
}
await b.close();
if (errs.length) { console.error(errs); process.exit(1); }
if (only) { console.log(`frames in ${tmp}`); process.exit(0); }
const out = path.join(ROOT, 'docs', 'ads', name);
const src = ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(tmp, '%04d.png')];
execFileSync('ffmpeg', [...src, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}.mp4`]);
execFileSync('ffmpeg', [...src, '-vf', 'fps=15,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=sierra2_4a', '-loop', '0', `${out}.gif`]);
fs.copyFileSync(path.join(tmp, `${String(times.length - 1).padStart(4, '0')}.png`), `${out}-last.png`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${out}.mp4, .gif and -last.png`);

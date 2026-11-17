// Draws a hand-made moving ad's page frame by frame (window.render(t)) and writes the MP4 for status and the GIF for chats.
//   node scripts/record-moving-ad.mjs <docs/ads/gen/<folder>> <out name> [query, e.g. v=chanukah] [t,t,... frames only]
// Free: no generation. Then: backend/.venv/Scripts/python scripts/check-moving-ad.py docs/ads/<name>.mp4
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const HERE = path.resolve(process.argv[2]);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { chromium } = createRequire(path.join(ROOT, 'scripts', 'x.js'))('playwright');
const q = process.argv[4] || '';
const only = process.argv[5];
const name = process.argv[3];
const FPS = 30, LEN = 8;
// Plan first, then build (Tzvi 17 Nov 2026): the MyIsraelRental ad's first cut was drawn before its blueprint's
// stages 1 to 4 were answered and did not match the plan. A folder named _something is a kit test, not an ad.
const AD = path.basename(HERE);
const INREPO = HERE.toLowerCase().startsWith(path.join(ROOT, 'docs', 'ads', 'gen').toLowerCase());
if (INREPO && !AD.startsWith('_')) {
  const bp = path.join(ROOT, 'docs', 'ads', 'blueprints', `${AD}.md`);
  if (!fs.existsSync(bp)) { console.error(`no blueprint: node scripts/ad-blueprint.mjs ${AD}, answered through stage 4, before anything is recorded`); process.exit(1); }
  try { execFileSync('node', [path.join(ROOT, 'scripts', 'ad-blueprint.mjs'), '--check', AD, '4'], { stdio: 'pipe' }); }
  catch (e) { console.error(`${AD}: answer the blueprint through stage 4 before recording, even test frames:
${String(e.stderr || e.stdout).trim()}`); process.exit(1); }
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lacrec-'));
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1080, height: 1920 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(`file:///${path.join(HERE, 'ad.html').split(path.sep).join('/')}?${q}`);
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
const out = INREPO ? path.join(ROOT, 'docs', 'ads', name) : path.join(HERE, name);  // a --test try-out keeps its video beside it
const src = ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(tmp, '%04d.png')];
execFileSync('ffmpeg', [...src, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}.mp4`]);
execFileSync('ffmpeg', [...src, '-vf', 'fps=15,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=sierra2_4a', '-loop', '0', `${out}.gif`]);
fs.copyFileSync(path.join(tmp, `${String(times.length - 1).padStart(4, '0')}.png`), `${out}-last.png`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${out}.mp4, .gif and -last.png`);

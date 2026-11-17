// Starts a hand-made moving ad from the kit (A10.9, Tzvi 16 Nov 2026), so an ad is only its idea:
//   node scripts/new-moving-ad.mjs <ad name> <business slug>     docs/ads/gen/<name>/ with ad.html, logo, QR, name and link
//   node scripts/new-moving-ad.mjs <ad name> <business slug> --tap   tap to switch: flavours or varieties (kit tap.html)
//   node scripts/new-moving-ad.mjs <ad name> <business slug> --test  a try-out outside the repo (<temp>/mir-ad-tests/), never committed
//   node scripts/new-moving-ad.mjs --clip <ad name> <clip.mp4>    a generated clip as frames under the words (A10.10)
// Reads the business from the public API (no sign-in, nothing written there). Free: no generation.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const GEN = path.join(ROOT, 'docs', 'ads', 'gen');
const PY = path.join(ROOT, 'backend', '.venv', 'Scripts', 'python');
const args = process.argv.slice(2);
const die = (m) => { console.error(m); process.exit(1); };

if (args[0] === '--clip') {
  const [, name, clip] = args;
  const dir = path.join(GEN, name || '');
  if (!name || !clip || !fs.existsSync(path.join(dir, 'ad.html'))) die('usage: node scripts/new-moving-ad.mjs --clip <ad name> <clip.mp4>');
  fs.rmSync(path.join(dir, 'clip'), { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'clip'));
  // filled to the ad's shape, never shrunk onto a coloured band (A3.9); 30 a second as the recorder draws
  execFileSync('ffmpeg', ['-v', 'error', '-i', clip, '-vf', 'fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-q:v', '3', path.join(dir, 'clip', '%04d.jpg')]);
  const n = fs.readdirSync(path.join(dir, 'clip')).length;
  const f = path.join(dir, 'ad.html');
  const html = fs.readFileSync(f, 'utf8');
  if (!/const CLIP_FRAMES = \d+;/.test(html)) die(`${f} has no "const CLIP_FRAMES = N;" line to set`);
  // played in 6.0 s whatever the clip's length, so the 8 s ad holds still for 2 (Chicken Munch's 6.6 s clip left 1.4, 17 Nov 2026)
  let out = html.replace(/const CLIP_FRAMES = \d+;/, `const CLIP_FRAMES = ${n};`);
  if (/const CLIP_FPS = [^;]+;/.test(out)) out = out.replace(/const CLIP_FPS = [^;]+;/, `const CLIP_FPS = ${(n / 6).toFixed(3)};`);
  else console.warn('no "const CLIP_FPS = N;" line: the clip plays at 30 a second; pass fps: CLIP_FPS to K.clip so it ends at 6.0 s');
  fs.writeFileSync(f, out);
  console.log(`${n} clip frames in docs/ads/gen/${name}/clip/ (${(n / 30).toFixed(1)} s), played in 6.0 s; the ad holds the last one for 2 s`);
  process.exit(0);
}

const [name, slug] = args;
// --test: the page and the kit go to <temp>/mir-ad-tests/, so a try-out never lands in docs/ads (17 Nov 2026: _taptest
// sat untracked in the repo); record-moving-ad.mjs then writes its video beside the page
const TEST = args.includes('--test');
if (!/^[a-z0-9-]+$/.test(name || '') || !/^[a-z0-9-]+$/.test(slug || '')) die('usage: node scripts/new-moving-ad.mjs <ad name> <business slug>');
const TESTS = path.join(os.tmpdir(), 'mir-ad-tests');
if (TEST) fs.cpSync(path.join(GEN, '_kit'), path.join(TESTS, '_kit'), { recursive: true });
const dir = path.join(TEST ? TESTS : GEN, name);
if (fs.existsSync(dir)) die(`${dir} already exists`);

const r = await fetch(`https://myisraelrental.com/api/marketplace/business/${slug}`);
if (!r.ok) die(`no business "${slug}" (${r.status})`);
const b = await r.json();
fs.mkdirSync(dir, { recursive: true });

const link = `myisraelrental.com/p/${slug}`;
execFileSync(PY, ['-c', 'import sys,qrcode; qrcode.make(sys.argv[1], border=1).save(sys.argv[2])', `https://${link}`, path.join(dir, 'qr.png')]);
let logo = null;
if (b.logo_url) {
  const l = await fetch(b.logo_url.replace('/f_auto,q_auto/', '/f_png/'));
  if (l.ok) { fs.writeFileSync(path.join(dir, 'logo.png'), Buffer.from(await l.arrayBuffer())); logo = 'logo.png'; }
  // a whole flyer as the listing's logo reads as nothing at 130px (Chicken Munch, 17 Nov 2026): cut the mark out first
  const [w, h] = execFileSync(PY, ['-c', 'import sys;from PIL import Image;print(*Image.open(sys.argv[1]).size)', path.join(dir, 'logo.png')]).toString().trim().split(' ').map(Number);
  if (logo && (w > 800 || h > 800)) console.warn(`WARNING logo.png is ${w}x${h}: probably a flyer or a photo, not a mark. Look at it; cut their wordmark or mark out as logo-mark.png and set window.AD.logo (A4.6).`);
}
const cap = (s) => String(s).replace(/(^|[-_ ])(\w)/g, (_, a, c) => (a ? ' ' : '') + c.toUpperCase());
const where = [b.categories?.[0] && cap(b.categories[0]), b.areas?.[0] && cap(b.areas[0])].filter(Boolean).join(' · ');
// their first sentence only if it fits one line at the foot's size; a sentence cut off mid-phrase reads worse than none
const s1 = (b.description || '').split(/(?<=[.!?])\s/)[0].replace(/[.]$/, '').trim();
const first = s1.length <= 44 ? s1 : '';
const config = { name: b.name, lines: [where, first].filter(Boolean), link, logo };
// --tap: the tap-to-switch template (Lay's, motion t02), for flavours or varieties, never sizes
const tap = args.includes('--tap');
const html = fs.readFileSync(path.join(GEN, '_kit', tap ? 'tap.html' : 'ad.html'), 'utf8')
  .replaceAll('{{AD}}', name).replaceAll('{{NAME}}', b.name.replace(/[<>&]/g, ''))
  .replace('{{CONFIG}}', JSON.stringify(config));
fs.writeFileSync(path.join(dir, 'ad.html'), html);
console.log(`wrote ${TEST ? dir : `docs/ads/gen/${name}`}/ (ad.html, qr.png${logo ? ', logo.png' : ', no logo on their listing'})
foot: ${[b.name, ...config.lines, link].join(' / ')}  (check the wording, then edit window.AD)
next: node scripts/ad-blueprint.mjs ${name}; sketch and score the last frame (A10.7) before the idea is built`);

// Starts a hand-made moving ad from the kit (A10.9, Tzvi 16 Nov 2026), so an ad is only its idea:
//   node scripts/new-moving-ad.mjs <ad name> <business slug>     docs/ads/gen/<name>/ with ad.html, logo, QR, name and link
//   node scripts/new-moving-ad.mjs --clip <ad name> <clip.mp4>    a generated clip as frames under the words (A10.10)
// Reads the business from the public API (no sign-in, nothing written there). Free: no generation.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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
  fs.writeFileSync(f, html.replace(/const CLIP_FRAMES = \d+;/, `const CLIP_FRAMES = ${n};`));
  console.log(`${n} clip frames in docs/ads/gen/${name}/clip/ (${(n / 30).toFixed(1)} s); the ad holds the last one after that`);
  process.exit(0);
}

const [name, slug] = args;
if (!/^[a-z0-9-]+$/.test(name || '') || !/^[a-z0-9-]+$/.test(slug || '')) die('usage: node scripts/new-moving-ad.mjs <ad name> <business slug>');
const dir = path.join(GEN, name);
if (fs.existsSync(dir)) die(`docs/ads/gen/${name} already exists`);

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
}
const cap = (s) => String(s).replace(/(^|[-_ ])(\w)/g, (_, a, c) => (a ? ' ' : '') + c.toUpperCase());
const where = [b.categories?.[0] && cap(b.categories[0]), b.areas?.[0] && cap(b.areas[0])].filter(Boolean).join(' · ');
// their first sentence only if it fits one line at the foot's size; a sentence cut off mid-phrase reads worse than none
const s1 = (b.description || '').split(/(?<=[.!?])\s/)[0].replace(/[.]$/, '').trim();
const first = s1.length <= 44 ? s1 : '';
const config = { name: b.name, lines: [where, first].filter(Boolean), link, logo };
const html = fs.readFileSync(path.join(GEN, '_kit', 'ad.html'), 'utf8')
  .replaceAll('{{AD}}', name).replaceAll('{{NAME}}', b.name.replace(/[<>&]/g, ''))
  .replace('{{CONFIG}}', JSON.stringify(config));
fs.writeFileSync(path.join(dir, 'ad.html'), html);
console.log(`wrote docs/ads/gen/${name}/ (ad.html, qr.png${logo ? ', logo.png' : ', no logo on their listing'})
foot: ${[b.name, ...config.lines, link].join(' / ')}  (check the wording, then edit window.AD)
next: node scripts/ad-blueprint.mjs ${name}; sketch and score the last frame (A10.7) before the idea is built`);

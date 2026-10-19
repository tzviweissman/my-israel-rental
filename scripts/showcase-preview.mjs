// The preview clip and still for a hand-built page on /showcase.
//
//   node scripts/showcase-preview.mjs <slug> [url]
//
// Records the page at laptop size with the skill's record.mjs (frame by
// frame, so it never stutters), keeps a short scroll through its top, and
// writes frontend/public/showcase/<slug>.mp4 (960 wide, no sound, small
// enough to autoplay in a grid) and <slug>.webp (the first frame, shown
// before the clip plays and for reduced motion). Then add the business to
// frontend/public/showcase/showcase.json. url defaults to the live page.
// Run from frontend/ (record.mjs uses that folder's Playwright).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const [slug, url = `https://myisraelrental.com/business/${slug}`] = process.argv.slice(2);
if (!slug) { console.error('usage: node scripts/showcase-preview.mjs <slug> [url]'); process.exit(1); }
const OUT = resolve(process.cwd().replace(/[\\/]frontend$/, ''), 'frontend/public/showcase');
const tmp = mkdtempSync(join(tmpdir(), 'show-'));
const raw = join(tmp, 'raw.mp4');
execFileSync('node', [join(homedir(), '.claude/skills/build-business-page/scripts/record.mjs'), url, '1440', '900', raw, '14', '24'], { stdio: 'inherit' });
// The first 10 s, 640 px, 20 fps: ~120 KB, so it plays as soon as it is seen.
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-t', '10', '-vf', 'scale=640:-2,fps=20', '-an', '-c:v', 'libx264',
  '-crf', '32', '-preset', 'veryslow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(OUT, `${slug}.mp4`)]);
// The still comes from 2.3 s in, not the first frame: record.mjs holds the
// opening for 2.5 s, and an opening that builds in (Chicken Munch's letters
// rise and the bowl drops) is only a dark frame at 0 s (19 Oct 2026).
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '2.3', '-i', raw, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '80', join(OUT, `${slug}.webp`)]);
rmSync(tmp, { recursive: true, force: true });
// Note which version of the page this clip shows (a hash of the published
// page) and bump v so browsers fetch the new clip. check-showcase-previews.mjs
// fails when a page has changed since its clip was made (Tzvi, 18 Oct 2026:
// The Gift Boutique's tile showed an older version of its page).
const ROOTDIR = resolve(OUT, '..', '..', '..');
const pageFile = join(ROOTDIR, 'frontend', 'public', 'pages', slug, 'index.html');
const listFile = join(OUT, 'showcase.json');
if (existsSync(pageFile) && existsSync(listFile)) {
  const list = JSON.parse(readFileSync(listFile, 'utf8'));
  const item = list.find((x) => x.slug === slug);
  if (item) {
    item.page = createHash('sha1').update(readFileSync(pageFile)).digest('hex').slice(0, 12);
    item.v = String((Number(item.v) || 0) + 1);
    writeFileSync(listFile, `[\n${list.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n]\n`);
  }
}
console.log(`wrote frontend/public/showcase/${slug}.mp4 and .webp`);

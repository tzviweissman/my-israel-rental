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
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const [slug, url = `https://myisraelrental.com/business/${slug}`] = process.argv.slice(2);
if (!slug) { console.error('usage: node scripts/showcase-preview.mjs <slug> [url]'); process.exit(1); }
const OUT = resolve(process.cwd().replace(/[\\/]frontend$/, ''), 'frontend/public/showcase');
const tmp = mkdtempSync(join(tmpdir(), 'show-'));
const raw = join(tmp, 'raw.mp4');
execFileSync('node', [join(homedir(), '.claude/skills/build-business-page/scripts/record.mjs'), url, '1440', '900', raw, '14', '24'], { stdio: 'inherit' });
// The first ~12 s: the opening and the first sections, looping cleanly.
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-t', '12', '-vf', 'scale=960:-2', '-an', '-c:v', 'libx264',
  '-crf', '30', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(OUT, `${slug}.mp4`)]);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '80', join(OUT, `${slug}.webp`)]);
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote frontend/public/showcase/${slug}.mp4 and .webp`);

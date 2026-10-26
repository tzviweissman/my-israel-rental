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
// A page that opens on a full-screen film that plays by itself (not inside a scroll-driven stage) cannot be
// recorded: Playwright's Chromium has no h264, and a paused video seeked frame by frame does not redraw, so
// the clip froze on the poster or stuttered (LS Fruit Platter, Tzvi 25 Oct 2026: "glitchy"). Its clip is
// built from the film itself instead, cropped as the page shows it, with the page's bar and words over it.
const film = await filmOpening(url, tmp);
if (film) {
  console.log(`${slug} opens on a film: building its clip from ${film.src.split('/').pop()}`);
  const [x, y, w, h] = film.rect, [px, py] = film.pos;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', film.file, '-loop', '1', '-i', film.overlay, '-filter_complex',
    `[0]fps=24,scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}:(iw-${w})*${px}:(ih-${h})*${py},tpad=stop_mode=clone:stop_duration=10[v];` +
    `color=black:s=${film.W}x${film.H}:r=24[bg];[bg][v]overlay=${x}:${y}[b];[b][1]overlay=0:0,trim=duration=14,format=yuv420p`,
    '-an', '-c:v', 'libx264', '-crf', '18', raw]);
} else {
  execFileSync('node', [join(homedir(), '.claude/skills/build-business-page/scripts/record.mjs'), url, '1440', '900', raw, '14', '24'], { stdio: 'inherit' });
}
// The first 10 s, 640 px, ~120 KB, so it plays as soon as it is seen. 20 fps for a recording; a film keeps its
// own 24 fps (24 to 20 drops every sixth frame, a visible judder).
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-t', '10', '-vf', `scale=640:-2,fps=${film ? 24 : 20}`, '-an', '-c:v', 'libx264',
  '-crf', film ? '28' : '32', '-preset', 'veryslow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(OUT, `${slug}.mp4`)]);
// The still comes from 2.3 s in, not the first frame: record.mjs holds the
// opening for 2.5 s, and an opening that builds in (Chicken Munch's letters
// rise and the bowl drops) is only a dark frame at 0 s (19 Oct 2026).
// An opening that only happens as you scroll is still empty at 2.3 s (Michal Balloons: the arch builds from an
// empty room), so its showcase.json entry names a later moment as "still_at" (seconds into the clip, 25 Oct 2026).
let stillAt = '2.3';
try { stillAt = String(JSON.parse(readFileSync(join(OUT, 'showcase.json'), 'utf8')).find((x) => x.slug === slug)?.still_at || stillAt); } catch { /* no list yet */ }
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', stillAt, '-i', raw, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '80', join(OUT, `${slug}.webp`)]);
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

// The film a page opens on, or null: a <video> covering at least 70% of the first screen, outside any sticky
// (scroll-driven) stage. Returns its file (downloaded), where it sits, its object-position, and a picture of
// the page with the film hidden, to lay over it.
async function filmOpening(pageUrl, dir) {
  const { createRequire } = await import('node:module');
  const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright');
  const W = 1280, H = 800, browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
    await page.goto(pageUrl, { waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(1500);
    const f = await page.evaluate(() => {
      const v = [...document.querySelectorAll('video')].find((e) => {
        const r = e.getBoundingClientRect();
        if (Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * Math.min(r.width, innerWidth) < innerWidth * innerHeight * 0.7) return false;
        for (let n = e; n; n = n.parentElement) if (getComputedStyle(n).position === 'sticky') return false;
        return true;
      });
      if (!v) return null;
      // the source the page would pick at this width (Chromium here plays no mp4, so currentSrc is empty)
      const s = [...v.querySelectorAll('source')].find((x) => !x.media || matchMedia(x.media).matches);
      const src = s ? s.src : v.src; if (!src) return null;
      const r = v.getBoundingClientRect(), op = getComputedStyle(v).objectPosition.split(' ').map((q) => (q.endsWith('%') ? parseFloat(q) / 100 : 0.5));
      v.dataset.filmOpening = '1';
      return { src, rect: [r.x, r.y, r.width, r.height].map(Math.round), pos: op };
    });
    if (!f) return null;
    await page.addStyleTag({ content: '[data-film-opening], [data-film-opening] ~ img { visibility: hidden !important; } html, body, main, section { background: transparent !important; }' });
    await page.waitForTimeout(400);
    const overlay = join(dir, 'overlay.png'); await page.screenshot({ path: overlay, omitBackground: true });
    const file = join(dir, 'film.mp4'); writeFileSync(file, Buffer.from(await (await fetch(f.src)).arrayBuffer()));
    return { ...f, file, overlay, W, H };
  } finally { await browser.close(); }
}

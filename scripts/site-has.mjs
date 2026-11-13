/**
 * What a built site really has, read from its files (Tzvi, 10 Nov 2026: "i want to be 100% sure nothing gets skipped").
 * The blueprint drops the rules tagged `when:<thing>` for a site that answered "<thing>: no"; this is the proof that
 * the answer is true. check-rules and the blueprint's --done and --rules fail when the answer and the files disagree.
 *
 * Only things a script can prove are here. Baskets, offers and guarantees were looked at and left out: each site
 * builds its basket differently, and offers live in the owner's words, so a scan could miss them.
 *
 *   film  any video on the site: a <video>, a scroll film (data-video, data-frames, film.js), or a video or frame
 *         file the pages use or keep in assets/. Recordings made for Tzvi in the build folder itself do not count.
 */
import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set(['lab', 'src', 'gen', 'screenshots', 'node_modules', '.git']);
const FILM = /<video\b|data-video|data-frames|film\.js|\.(mp4|webm|mov)\b|\.frames\b/i;
const VIDEO_FILE = /\.(mp4|webm|mov)$|\.frames$/i;

export const WHEN = {
  film: { ask: 'Does the site have any video: an opening or scroll film, a background video or a generated clip?', find: findFilm },
};

// '' when the site has no film, else the first file that shows one
export function findFilm(dir) {
  let hit = '';
  (function walk(d, depth) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (hit) return;
      const f = path.join(d, e.name);
      if (e.isDirectory()) {
        if (SKIP.has(e.name)) continue;
        if (VIDEO_FILE.test(e.name) && depth > 0) { hit = path.relative(dir, f); return; }
        walk(f, depth + 1);
        continue;
      }
      if (depth > 0 && VIDEO_FILE.test(e.name)) { hit = path.relative(dir, f); return; }   // assets/opening.mp4
      if (/\.(html|js|css)$/i.test(e.name) && FILM.test(fs.readFileSync(f, 'utf8'))) { hit = path.relative(dir, f); return; }
    }
  })(dir, 0);
  return hit;
}

// answers in RULES.md or BLUEPRINT.md lines like "n/a: not on this site (film: no)" that the files contradict
export function contradicted(dir, text) {
  const out = [];
  for (const [k, w] of Object.entries(WHEN)) {
    if (!new RegExp(`\\(${k}: no\\)`, 'i').test(text)) continue;
    const hit = w.find(dir);
    if (hit) out.push(`the site answered "${k}: no", but ${hit} has one: answer ${k}=yes (node scripts/blueprint.mjs --has ${k}=yes <build>) and plan its rules`);
  }
  return out;
}

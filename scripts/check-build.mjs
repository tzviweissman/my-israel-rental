#!/usr/bin/env node
/**
 * Every check on one designed site, in one command (Tzvi, 24 Oct 2026: "what can we learn from the past
 * builds to make future builds better, faster and have less errors"; builders kept forgetting one of the
 * seven separate checks, and publishing runs only four).
 *
 *   node scripts/check-build.mjs scrollcraft/builds/<folder>     (the site must be served, see below)
 *
 * Per page: check-site, check-fits, check-motion, check-speed, check-same-place, check-one-scroll, check-photo-clear, check-overlap, check-opening-scroll, check-blank, check-prefill, check-arrival, check-film-video, readable. Per site: check-concept,
 * check-fingerprints, check-rules, check-clip on gen/film/opening.mp4 if there is one, and the independent review (below). Prints one line per check and the first problems of each failure; exits 1 if any fails.
 * Pages are read from http://127.0.0.1:8990/<folder>/ (scripts/serve-builds.mjs); set CHECK_BASE to change it.
 * A site is shown to Tzvi or published only after this passes (page rules 3a).
 *
 * The independent review (Tzvi, 27 Oct 2026: "how can we get it right more often the first time"; the
 * review was a written step and was skipped): <folder>/review.md, written by a Sonnet subagent that did
 * not build the site, from docs/page-review-checklist.md, with a line "Verdict: PASS". It must be newer
 * than every page, style and script of the site, so any change after the review needs a new one.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newerRules } from './rule-dates.mjs';
import { judgeReview, feedbackProblems, proofGap } from './judges.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(ROOT, dir))) {
  console.error('usage: node scripts/check-build.mjs scrollcraft/builds/<folder>');
  process.exit(2);
}
const folder = path.basename(path.resolve(ROOT, dir));
const base = (process.env.CHECK_BASE || 'http://127.0.0.1:8990').replace(/\/$/, '');
const readable = path.join(os.homedir(), '.claude', 'skills', 'build-business-page', 'scripts', 'readable.mjs');
const pages = fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.html') && !f.startsWith('_')).sort();

try {
  const r = await fetch(`${base}/${folder}/${pages[0] || 'index.html'}`);
  if (!r.ok) throw new Error(String(r.status));
} catch (e) {
  console.error(`The site is not served at ${base}/${folder}/ (${e.message}). Start scripts/serve-builds.mjs first.`);
  process.exit(2);
}

const runs = [];
for (const p of pages) {
  const url = `${base}/${folder}/${p}`;
  for (const s of ['check-site', 'check-fits', 'check-motion', 'check-speed', 'check-same-place', 'check-one-scroll', 'check-photo-clear', 'check-overlap', 'check-opening-scroll', 'check-blank', 'check-iphone', 'check-prefill', 'check-arrival']) runs.push([`${s} ${p}`, [path.join(ROOT, 'scripts', `${s}.mjs`), url]]);
  if (fs.existsSync(readable)) runs.push([`readable ${p}`, [readable, url]]);
}
// the site-wide checks of rules 3v take every page at once (the same footer and menu on each)
const all = pages.map((p) => `${base}/${folder}/${p}`);
for (const s of ['check-footer', 'check-menu', 'check-facts', 'check-heights', 'check-film-video', 'check-film-clear', 'check-web-basics', 'check-says-offer', 'check-look', 'check-five', 'check-motion-feel', 'check-break-ui', 'check-keyboard']) runs.push([s, [path.join(ROOT, 'scripts', `${s}.mjs`), ...all]]);
// a site built from a blueprint has RULES.md written from it first (scripts/blueprint.mjs)
if (fs.existsSync(path.join(dir, 'BLUEPRINT.md'))) spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'blueprint.mjs'), '--rules', dir], { encoding: 'utf8' });
for (const s of ['check-concept', 'check-fingerprints', 'check-compared', 'check-listing-prices', 'check-rules']) runs.push([s, [path.join(ROOT, 'scripts', `${s}.mjs`), dir]]);
// rules 3aj.9: the files gen/build.py writes are changed in its source, never by hand (older sites drift from the
// starter and are spared). Run alone after the rest: it rebuilds the folder in place for a moment.
const builtCheck = !newerRules(ROOT, path.join(ROOT, dir)).has('R3aj.9');
// the opening film as the visitor sees it (Tzvi, 1 Nov 2026: crumbs vanishing, a snap over in one frame); intended hard
// cuts are listed in gen/film.sh as "# cuts: <seconds> ..." (times in gen/film/opening.mp4)
{
  const film = path.join(ROOT, dir, 'gen', 'film', 'opening.mp4'), sh = path.join(ROOT, dir, 'gen', 'film.sh');
  if (fs.existsSync(film)) {
    const cuts = ((fs.existsSync(sh) ? fs.readFileSync(sh, 'utf8') : '').match(/^#\s*cuts:\s*([\d.\s]+)$/m)?.[1] || '').trim().split(/\s+/).filter(Boolean);
    runs.push(['check-clip opening film', [path.join(ROOT, 'scripts', 'check-clip.mjs'), film, ...cuts.flatMap((c) => ['--cut', c])]]);
  }
}

// four at a time (each opens its own browser); results printed in the order above
const run1 = ([name, args]) => new Promise((done) => {
  const c = spawn(process.execPath, args, { cwd: ROOT });
  let out = '';
  c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
  c.on('close', (code) => done({ name, ok: code === 0, out }));
});
const results = new Array(runs.length);
let next = 0;
await Promise.all(Array.from({ length: Math.min(4, runs.length) }, async () => {
  while (next < runs.length) { const i = next++; results[i] = await run1(runs[i]); }
}));
if (builtCheck) results.push(await run1(['check-built', [path.join(ROOT, 'scripts', 'check-built.mjs'), dir]]));
{
  const site = path.join(ROOT, dir), review = path.join(site, 'review.md');
  const newer = newerRules(ROOT, site), twoJudges = !newer.has('R3aj.4');
  const newest = fs.readdirSync(site).filter((f) => /\.(html|css|js)$/.test(f))
    .reduce((m, f) => Math.max(m, fs.statSync(path.join(site, f)).mtimeMs), 0);
  const why = !fs.existsSync(review) ? 'no review.md'
    : !/^Verdict:\s*PASS\b/m.test(fs.readFileSync(review, 'utf8')) ? 'review.md has no "Verdict: PASS" line'
    : fs.statSync(review).mtimeMs < newest ? 'the site changed after the review'
    // rules 3ah.7: a site compared with the best of its kind (compare.jpg) is judged 4 or more before anyone sees it
    // (20 Nov 2026: real award-winning bakery sites score 4 to 4.5 with this judge; nothing scores 5)
    // rules 3aj.4 (22 Nov 2026): two judges per area, the median, corrected by Tzvi's own verdicts (scripts/judges.mjs)
    : twoJudges ? judgeReview(fs.readFileSync(review, 'utf8')).why
    : fs.existsSync(path.join(site, 'compare.jpg')) && !/^Rating:\s*(4(\.5)?|5)\s*\/\s*5\b/m.test(fs.readFileSync(review, 'utf8')) ? 'review.md has no "Rating: 4/5" or better (rules 3ah.7: a judge that did not build it rates the site beside two real top sites; fix and judge again until 4)' : '';
  const gap = why && /rated/.test(why) ? proofGap(site) : '';
  results.push({ name: 'independent review', ok: !why, out: why && `${gap ? gap + '. ' : ''}${why}. Have a Sonnet subagent that did not build the site use it at laptop and phone size against docs/page-review-checklist.md and write ${dir}/review.md; fix every FAIL, then review again.` });
}
// Tzvi's corrections kept until each is proved fixed (rules 3aj.6)
if (!newerRules(ROOT, path.join(ROOT, dir)).has('R3aj.6')) {
  const fb = feedbackProblems(path.join(ROOT, dir));
  results.push({ name: 'feedback', ok: !fb.length, out: fb.join(' | ') });
}
let failed = 0;
for (const { name, ok, out } of results) {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}`);
  if (!ok) {
    failed++;
    const lines = out.split('\n').filter((l) => l.trim() && !/: checked$|^\s*ok\b|choices tapped/.test(l));
    for (const l of lines.slice(-8)) console.log(`        ${l.trim().slice(0, 220)}`);
  }
}
console.log(failed ? `\n${failed} of ${results.length} checks failed for ${folder}. Fix them before showing or publishing.`
  : `\nall ${results.length} checks pass for ${folder}.`);
process.exit(failed ? 1 : 0);

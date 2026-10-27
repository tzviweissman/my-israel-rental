#!/usr/bin/env node
/**
 * Every check on one designed site, in one command (Tzvi, 24 Oct 2026: "what can we learn from the past
 * builds to make future builds better, faster and have less errors"; builders kept forgetting one of the
 * seven separate checks, and publishing runs only four).
 *
 *   node scripts/check-build.mjs scrollcraft/builds/<folder>     (the site must be served, see below)
 *
 * Per page: check-site, check-fits, check-motion, check-speed, check-same-place, readable. Per site: check-concept,
 * check-fingerprints, check-rules, and the independent review (below). Prints one line per check and the first problems of each failure; exits 1 if any fails.
 * Pages are read from http://127.0.0.1:8990/<folder>/ (scripts/serve-builds.mjs); set CHECK_BASE to change it.
 * A site is shown to Tzvi or published only after this passes (page rules 3a).
 *
 * The independent review (Tzvi, 27 Oct 2026: "how can we get it right more often the first time"; the
 * review was a written step and was skipped): <folder>/review.md, written by a Sonnet subagent that did
 * not build the site, from docs/page-review-checklist.md, with a line "Verdict: PASS". It must be newer
 * than every page, style and script of the site, so any change after the review needs a new one.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  for (const s of ['check-site', 'check-fits', 'check-motion', 'check-speed', 'check-same-place']) runs.push([`${s} ${p}`, [path.join(ROOT, 'scripts', `${s}.mjs`), url]]);
  if (fs.existsSync(readable)) runs.push([`readable ${p}`, [readable, url]]);
}
for (const s of ['check-concept', 'check-fingerprints', 'check-rules']) runs.push([s, [path.join(ROOT, 'scripts', `${s}.mjs`), dir]]);

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
{
  const site = path.join(ROOT, dir), review = path.join(site, 'review.md');
  const newest = fs.readdirSync(site).filter((f) => /\.(html|css|js)$/.test(f))
    .reduce((m, f) => Math.max(m, fs.statSync(path.join(site, f)).mtimeMs), 0);
  const why = !fs.existsSync(review) ? 'no review.md'
    : !/^Verdict:\s*PASS\b/m.test(fs.readFileSync(review, 'utf8')) ? 'review.md has no "Verdict: PASS" line'
    : fs.statSync(review).mtimeMs < newest ? 'the site changed after the review' : '';
  results.push({ name: 'independent review', ok: !why, out: why && `${why}. Have a Sonnet subagent that did not build the site use it at laptop and phone size against docs/page-review-checklist.md and write ${dir}/review.md; fix every FAIL, then review again.` });
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

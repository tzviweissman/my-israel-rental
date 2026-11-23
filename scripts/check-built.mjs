// Are the site's files what its build script makes? (23 Nov 2026, Clean Plus: fixes made straight in site.css and
// index.html, which gen/build.py writes from gen/own.css and gen/board.js, were one rebuild away from being lost.)
//   node scripts/check-built.mjs scrollcraft/builds/<folder>
// A site with no gen/build.py passes. Otherwise the script is run in place, every text file it changed is compared
// with what was there, and the folder is put back exactly as it was. Fails on any file that differs: make the change
// in the build's source (gen/build.py, gen/own.css, gen/*.js), then run python gen/build.py.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const dir = path.resolve(ROOT, process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(dir)) { console.error('usage: node scripts/check-built.mjs scrollcraft/builds/<folder>'); process.exit(2); }
const script = path.join(dir, 'gen', 'build.py');
if (!fs.existsSync(script)) { console.log('no gen/build.py: nothing to compare'); process.exit(0); }

const TEXT = /\.(html|css|js|mjs|json|md|txt|xml|svg|webmanifest)$/i;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(p)) : [p];
});
const before = new Map(walk(dir).filter((f) => TEXT.test(f)).map((f) => [f, fs.readFileSync(f)]));
const had = new Set(walk(dir));

const venv = ['backend/.venv/Scripts/python.exe', 'backend/.venv/bin/python'].map((p) => path.join(ROOT, p)).find((p) => fs.existsSync(p));
const run = spawnSync(venv || 'python', [script], { cwd: dir, encoding: 'utf8' });
const differ = [];
try {
  if (run.status !== 0) { console.log(`gen/build.py failed: ${(run.stderr || run.stdout || '').trim().split('\n').slice(-3).join(' | ')}`); process.exitCode = 1; }
  else {
    const norm = (b) => b.toString('utf8').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd();
    for (const [f, old] of before) {
      if (!fs.existsSync(f)) continue;
      const now = fs.readFileSync(f);
      if (!now.equals(old) && norm(now) !== norm(old)) differ.push(path.relative(dir, f).replace(/\\/g, '/'));
    }
  }
} finally {
  // put the folder back as it was, whatever happened
  for (const [f, old] of before) if (!fs.existsSync(f) || !fs.readFileSync(f).equals(old)) fs.writeFileSync(f, old);
  for (const f of walk(dir)) if (!had.has(f)) fs.rmSync(f);
}
if (differ.length) {
  console.log(`NOT BUILT: ${differ.join(', ')} differ from what gen/build.py writes. A change made straight in them is lost at the next rebuild: make it in gen/build.py, gen/own.css or gen/*.js, then run python gen/build.py.`);
  process.exitCode = 1;
} else if (!process.exitCode) console.log('every file is what gen/build.py writes');

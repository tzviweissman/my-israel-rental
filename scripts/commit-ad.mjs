// Commit one hand-made ad as soon as it is sent (A10.6, Tzvi 16 Nov 2026): its files by name, nothing else, with
// the library score line from ad-blueprint.mjs --note in the message.
//   node scripts/commit-ad.mjs <name> "<title>" ["<more paragraphs>"...]
// Takes docs/ads/<name>.* and <name>-*, docs/ads/gen/<name>/ and docs/ads/blueprints/<name>.md. Refuses while the
// blueprint is not done. Other changes in the tree, staged or not, stay out of the commit.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const [name, title, ...more] = process.argv.slice(2);
if (!name || !/^[a-z0-9-]+$/.test(name) || !title) {
  console.error('usage: node scripts/commit-ad.mjs <name> "<title>" ["<more paragraphs>"...]');
  process.exit(2);
}
const run = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
const bp = (flag) => run(process.execPath, [path.join(ROOT, 'scripts', 'ad-blueprint.mjs'), flag, name]);

const done = bp('--done');
if (done.status !== 0) { console.error(done.stderr || done.stdout); process.exit(1); }
const note = bp('--note');
if (note.status !== 0) { console.error(note.stderr); process.exit(1); }

const ads = path.join(ROOT, 'docs', 'ads');
const paths = fs.readdirSync(ads)
  .filter((f) => f.startsWith(`${name}.`) || f.startsWith(`${name}-`))
  .map((f) => `docs/ads/${f}`);
for (const p of [`docs/ads/gen/${name}`, `docs/ads/blueprints/${name}.md`]) if (fs.existsSync(path.join(ROOT, p))) paths.push(p);

// only what changed or is new under those paths, each file by name (never a whole folder: stage-files-not-folders)
const st = run('git', ['status', '--porcelain', '-uall', '--', ...paths]).stdout;
// clip/ and front/ are frames rebuilt from out/clip.mp4 (new-moving-ad.mjs --clip, a page's keyfront.py): 195 MB for
// Chicken Munch's moving ad (17 Nov 2026), so they are never committed
const files = st.split('\n').filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, ''))
  .filter((f) => !/^docs\/ads\/gen\/[^/]+\/(clip|front)\//.test(f));
if (!files.length) { console.log(`${name}: nothing new to commit`); process.exit(0); }
const big = files.filter((f) => fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).size > 40e6);
if (big.length) { console.error(`over 40 MB, left for you to decide: ${big.join(', ')}`); process.exit(1); }

const add = run('git', ['add', '-A', '--', ...files]);
if (add.status !== 0) { console.error(add.stderr); process.exit(1); }
const msg = [title, note.stdout.trim(), ...more].join('\n\n');
const c = spawnSync('git', ['commit', '-q', '-m', msg, '--', ...files], { cwd: ROOT, encoding: 'utf8', stdio: 'inherit' });
if (c.status !== 0) process.exit(c.status);
console.log(`${name}: committed ${files.length} file(s)\n${run('git', ['log', '-1', '--oneline']).stdout.trim()}`);

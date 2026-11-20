// Proves check-moving-ad.py (and so commit-ad.mjs --finish, which runs it) refuses broken moving ads (17 Nov 2026).
//   node scripts/test-moving-ad-checks.mjs
// Draws six try-outs from the kit in <temp>/mir-ad-tests/ (outside the repo), each over a real ad's last frame
// (Chicken Munch's, so the first-frame check sees a real ad, not an empty test page): a good one, one that does nothing in its
// first second, one that stalls in the middle, and one that never holds still at the end. The good one must pass and
// each broken one must fail with its own reason. Free, no generation; takes a few minutes (six recordings). The fifth shows its QR from the start and must fail (M6); the sixth keeps a box moving in its
// window.LIVING area after the words stop and must pass (M8).
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const TESTS = path.join(os.tmpdir(), 'mir-ad-tests');
fs.cpSync(path.join(ROOT, 'docs', 'ads', 'gen', '_kit'), path.join(TESTS, '_kit'), { recursive: true });
const REAL = path.join(ROOT, 'docs', 'ads', 'chicken-munch-moving-last.png');
const kit = fs.readFileSync(path.join(ROOT, 'docs', 'ads', 'gen', '_kit', 'ad.html'), 'utf8');
execFileSync(path.join(ROOT, 'backend', '.venv', 'Scripts', 'python'), ['-c',
  'import sys,qrcode; qrcode.make("https://myisraelrental.com", border=1).save(sys.argv[1])', path.join(TESTS, 'qr.png')]);

// each case replaces the kit's render(t): a box that moves for most of the ad, then holds from 6 s
const CASES = {
  good: { motion: 'K.cl(t / 6)', want: null },
  'late-start': { motion: 'K.at(t, 1.5, 4.5)', want: 'nothing happens in the first second' },
  'stalls': { motion: 't < 2 ? t / 6 : t < 4 ? 2 / 6 : K.cl(t / 6)', want: 'stalls for' },
  'no-hold': { motion: 't / 8', want: 'holds still' },
  'qr-early': { motion: 'K.cl(t / 6)', want: 'the QR code is on screen at', footAlways: true },
  // a living ending (M8): the words stop at 6 s but a box in window.LIVING moves to the very end; it must pass
  'living-end': { motion: 'K.cl(t / 6)', want: null, living: true },
};
// The six recordings run side by side (Tzvi, 18 Nov 2026: the self-test had grown to 30 minutes one after another).
// Each is its own browser and ffmpeg; RECORD_PARALLEL=1 runs them one at a time again.
const run = promisify(execFile);
const LANES = Number(process.env.RECORD_PARALLEL) || Object.keys(CASES).length;
const queue = Object.entries(CASES);
const lane = async () => {
  for (let next = queue.shift(); next; next = queue.shift()) await caseOf(...next);
};
const results = [];
async function caseOf(name, c) {
  const dir = path.join(TESTS, `_check-${name}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(TESTS, 'qr.png'), path.join(dir, 'qr.png'));
  fs.copyFileSync(REAL, path.join(dir, 'real.png'));
  const html = kit.replaceAll('{{AD}}', name).replaceAll('{{NAME}}', 'TEST')
    .replace('{{CONFIG}}', JSON.stringify({ name: 'Test', lines: ['Check test'], link: 'myisraelrental.com', logo: null }))
    .replace(/window\.render = async \(t\) => \{[\s\S]*?\n\};/, `window.render = async (t) => {
  const m = ${c.motion};
  // a real ad's last frame under it, so frame one is already an ad (A10.2); only the word's motion differs between cases
  // its own QR (881,1521 to 1018,1658) covered, so only the kit's QR is read (the qr-early case, M6)
  $('ad').style.background = 'linear-gradient(#111,#111) 860px 1500px / 180px 180px no-repeat, url(real.png) 0 0 / 1080px 1920px';
  $('word').style.transform = \`translateX(\${(m - 0.5) * 600}px)\`;
  ${c.footAlways ? '' : 'K.footIn(t);'}
  ${c.living ? `window.LIVING = [200, 700, 880, 1100];
  if (!$('liv')) $('ad').insertAdjacentHTML('beforeend', '<div id="liv" style="position:absolute;left:440px;top:800px;width:200px;height:200px;background:#c33"></div>');
  $('liv').style.transform = \`translateX(\${Math.sin(t * 3) * 180}px)\`;` : ''}
};
${c.living ? 'window.LIVING = [200, 700, 880, 1100];' : ''}`);
  fs.writeFileSync(path.join(dir, 'ad.html'), html);
  try {
    await run(process.execPath, [path.join(ROOT, 'scripts', 'record-moving-ad.mjs'), dir, name],
      { env: { ...process.env, RECORD_FPS: '15' }, maxBuffer: 1 << 24 });   // test ads at 15 a second: half the time
  } catch (e) {
    results.push({ name, ok: false, line: `BAD  ${name}: the recording failed\n${e.stderr || e.message}` });
    return;
  }
  const r = spawnSync(path.join(ROOT, 'backend', '.venv', 'Scripts', 'python'),
    [path.join(ROOT, 'scripts', 'check-moving-ad.py'), path.join(dir, `${name}.mp4`)], { encoding: 'utf8' });
  const out = r.stdout + r.stderr;
  const ok = c.want ? r.status !== 0 && out.includes(c.want) : r.status === 0;
  results.push({ name, ok, line: `${ok ? 'ok  ' : 'BAD '} ${name}: ${c.want ? `must fail with "${c.want}"` : 'must pass'}${ok ? '' : `\n${out}`}` });
}
await Promise.all(Array.from({ length: LANES }, lane));
const order = Object.keys(CASES);
results.sort((p, q) => order.indexOf(p.name) - order.indexOf(q.name)).forEach((x) => console.log(x.line));
process.exit(results.every((x) => x.ok) && results.length === order.length ? 0 : 1);

// Proves check-moving-ad.py (and so commit-ad.mjs --finish, which runs it) refuses broken moving ads (17 Nov 2026).
//   node scripts/test-moving-ad-checks.mjs
// Draws four try-outs from the kit in <temp>/mir-ad-tests/ (outside the repo), each over a real ad's last frame
// (Chicken Munch's, so the first-frame check sees a real ad, not an empty test page): a good one, one that does nothing in its
// first second, one that stalls in the middle, and one that never holds still at the end. The good one must pass and
// each broken one must fail with its own reason. Free, no generation; takes a few minutes (four recordings).
import { execFileSync, spawnSync } from 'node:child_process';
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
};
let bad = 0;
for (const [name, c] of Object.entries(CASES)) {
  const dir = path.join(TESTS, `_check-${name}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(TESTS, 'qr.png'), path.join(dir, 'qr.png'));
  fs.copyFileSync(REAL, path.join(dir, 'real.png'));
  const html = kit.replaceAll('{{AD}}', name).replaceAll('{{NAME}}', 'TEST')
    .replace('{{CONFIG}}', JSON.stringify({ name: 'Test', lines: ['Check test'], link: 'myisraelrental.com', logo: null }))
    .replace(/window\.render = async \(t\) => \{[\s\S]*?\n\};/, `window.render = async (t) => {
  const m = ${c.motion};
  // a real ad's last frame under it, so frame one is already an ad (A10.2); only the word's motion differs between cases
  $('ad').style.background = 'url(real.png) 0 0 / 1080px 1920px';
  $('word').style.transform = \`translateX(\${(m - 0.5) * 600}px)\`;
};`);
  fs.writeFileSync(path.join(dir, 'ad.html'), html);
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'record-moving-ad.mjs'), dir, name],
    { stdio: 'pipe', env: { ...process.env, RECORD_FPS: '15' } });   // test ads at 15 a second: half the time
  const r = spawnSync(path.join(ROOT, 'backend', '.venv', 'Scripts', 'python'),
    [path.join(ROOT, 'scripts', 'check-moving-ad.py'), path.join(dir, `${name}.mp4`)], { encoding: 'utf8' });
  const out = r.stdout + r.stderr;
  const ok = c.want ? r.status !== 0 && out.includes(c.want) : r.status === 0;
  console.log(`${ok ? 'ok  ' : 'BAD '} ${name}: ${c.want ? `must fail with "${c.want}"` : 'must pass'}${ok ? '' : `\n${out}`}`);
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);

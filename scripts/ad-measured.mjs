// Which ad drawing code last passed check-ad-designs in full. Kept inside .git, so each clone or worktree measures
// its own and two sessions never fight over a file. Line endings do not count.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const FILES = ['frontend/src/components/dashboard/AdMaker.jsx', 'frontend/src/components/admin/AdStudio.jsx', 'frontend/src/utils/sharpCanvas.js'];
const git = (root, args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).stdout;
const stamp = (root) => path.resolve(root, git(root, ['rev-parse', '--git-path', 'ad-measured.txt']).trim());
const hash = (texts) => crypto.createHash('sha256').update(texts.map((t) => t.replace(/\r\n/g, '\n')).join('\0')).digest('hex');

export function writeMeasured(root) {
  fs.writeFileSync(stamp(root), hash(FILES.map((f) => fs.readFileSync(path.join(root, f), 'utf8'))));
}
export function stagedIsMeasured(root) {
  const f = stamp(root);
  return fs.existsSync(f) && fs.readFileSync(f, 'utf8') === hash(FILES.map((x) => git(root, ['show', `:${x}`])));
}

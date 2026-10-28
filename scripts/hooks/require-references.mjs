#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook for Higgsfield image and video generation (Tzvi, 28 Oct 2026: "how can
 * we make sure you never skip them before future builds"). Bake away's first concept stills were paid
 * for after reading one saved folder. A rule did not stop that, so this blocks the tool call itself:
 * the build being worked on (the one changed most recently, in any worktree of this repo) must pass
 * scripts/check-references.mjs before any credit is spent on it.
 *
 * Sites published before the rule, without a REFERENCES.md, are let through (same as check-concept).
 * Exit 2 blocks the call and shows the message; exit 0 lets it run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const roots = (() => {
  try {
    return execSync('git worktree list --porcelain', { cwd: HERE, encoding: 'utf8' })
      .split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9).trim());
  } catch { return [HERE]; }
})();

const newest = (dir, depth = 2) => {
  let t = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (depth > 0 && !['node_modules', 'frames', 'src'].includes(e.name)) t = Math.max(t, newest(p, depth - 1)); }
    else t = Math.max(t, fs.statSync(p).mtimeMs);
  }
  return t;
};

let best = null;
for (const r of roots) {
  const builds = path.join(r, 'scrollcraft', 'builds');
  if (!fs.existsSync(builds)) continue;
  for (const b of fs.readdirSync(builds, { withFileTypes: true })) {
    if (!b.isDirectory()) continue;
    const dir = path.join(builds, b.name);
    const t = newest(dir);
    if (!best || t > best.t) best = { dir, root: r, t };
  }
}
if (!best) process.exit(0);

const published = (() => { try { return Object.values(JSON.parse(fs.readFileSync(path.join(best.root, 'scrollcraft', 'published.json'), 'utf8'))).map((v) => v.folder); } catch { return []; } })();
if (published.includes(path.basename(best.dir)) && !fs.existsSync(path.join(best.dir, 'REFERENCES.md'))) process.exit(0);

const { checkReferences } = await import(new URL(`file:///${path.join(best.root, 'scripts', 'check-references.mjs').replace(/\\/g, '/')}`));
const problems = checkReferences(best.dir);
if (problems.length) {
  console.error(`Blocked: no paid generation for ${path.basename(best.dir)} until every inspiration source is read (page rules 0b.4, scripts/check-references.mjs):\n- ${problems.slice(0, 8).join('\n- ')}${problems.length > 8 ? `\n- and ${problems.length - 8} more` : ''}`);
  process.exit(2);
}
process.exit(0);

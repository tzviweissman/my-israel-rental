/**
 * A new rule does not hold up a site that was already made (Tzvi, 29 Oct 2026: "new rules shouldnt affect
 * already made sites"). A site is held to a checklist rule when the rule was in docs/rules-checklist.md on the
 * day the site was first published, or when its RULES.md answers it (it took the rule on). A site never
 * published is held to every rule. check-rules and publish-page both ask here.
 *
 *   ruleAdded(root)       Map id -> ms when the id first appeared in the checklist (git history)
 *   siteMade(root, dir)   ms of the first publish of the build in dir (scrollcraft/published.json + git), or null
 *   newerRules(root, dir) Set of ids added after the site was made and not answered in its RULES.md (the rules it
 *                         is not held to; empty for a site never published)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const git = (root, args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).stdout || '';

export function ruleAdded(root) {
  const added = new Map();
  let when = 0;
  for (const l of git(root, ['log', '--reverse', '--format=@%ct', '-p', '--', 'docs/rules-checklist.md']).split(/\r?\n/)) {
    if (/^@\d/.test(l)) { when = Number(l.slice(1)) * 1000; continue; }
    const m = /^\+(R[0-9][0-9a-z]*\.[0-9]+)\s*\|/.exec(l);
    if (m && !added.has(m[1])) added.set(m[1], when);
  }
  // only the rules in the checklist now; a line not committed yet is being added now
  const now = new Map();
  for (const l of fs.readFileSync(path.join(root, 'docs', 'rules-checklist.md'), 'utf8').split(/\r?\n/)) {
    const m = /^(R[0-9][0-9a-z]*\.[0-9]+)\s*\|/.exec(l);
    if (m) now.set(m[1], added.get(m[1]) ?? Date.now());
  }
  return now;
}

export function siteMade(root, dir) {
  let published = {};
  try { published = JSON.parse(fs.readFileSync(path.join(root, 'scrollcraft', 'published.json'), 'utf8')); } catch { /* none yet */ }
  const folder = path.basename(dir);
  let made = null;
  for (const [slug, rec] of Object.entries(published)) {
    if (rec.folder !== folder) continue;
    const first = git(root, ['log', '--diff-filter=A', '--format=%ct', '--', `frontend/public/pages/${slug}/index.html`]).trim().split('\n').pop();
    if (first) made = Math.min(made ?? Infinity, Number(first) * 1000);
  }
  return made;
}

export function newerRules(root, dir) {
  const made = siteMade(root, dir);
  if (made == null) return new Set();
  let rules = '';
  try { rules = fs.readFileSync(path.join(dir, 'RULES.md'), 'utf8'); } catch { /* none yet */ }
  const answered = new Set([...rules.matchAll(/^[-*\s]*(R[0-9][0-9a-z]*\.[0-9]+)\b[\s:|-]*(pass|n\/a|fix)\b/gim)].map((m) => m[1]));
  return new Set([...ruleAdded(root)].filter(([id, t]) => t > made && !answered.has(id)).map(([id]) => id));
}

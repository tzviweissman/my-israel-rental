#!/usr/bin/env node
// Ideas gate (Tzvi, 29 Oct 2026, on Krysp: "all your food wow moments are too similar ... did you look at
// our inspo sources before showing ideas", then "make sure that you dont keep skipping looking through
// the inspo sources"). Runs before:
//   - any paid image or video generation, and
//   - any inline sketch widget whose title speaks of ideas, openings, concepts, films or sketches,
// and refuses it unless the site being built (the build folder changed most recently, in any worktree
// of the MyIsraelRental repo) passes scripts/check-ideas.mjs: IDEAS.md with each idea citing two saved
// pictures from two saved sources, all named in REFERENCES.md, and no idea repeating a kind of event
// another site uses (scrollcraft/motions.json). Sites published before the rule, with no IDEAS.md, pass.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const REPO = 'C:/Users/tzviw/Documents/my-israel-rental';
let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', async () => {
  let ev;
  try { ev = JSON.parse(input); } catch { process.exit(0); }
  const tool = ev.tool_name || '', ti = ev.tool_input || {};
  if (/show_widget$/.test(tool) && !/idea|opening|concept|film|sketch|wow/i.test(String(ti.title || ''))) process.exit(0);
  const params = typeof ti.params === 'string' ? (() => { try { return JSON.parse(ti.params); } catch { return {}; } })() : (ti.params || {});
  if (params && params.get_cost) process.exit(0);   // only asking the price

  let roots = [];
  try {
    roots = execSync('git worktree list --porcelain', { cwd: REPO, encoding: 'utf8' })
      .split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9).trim());
  } catch { roots = [REPO]; }
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
      const dir = path.join(builds, b.name), t = newest(dir);
      if (!best || t > best.t) best = { dir, root: r, t };
    }
  }
  if (!best) process.exit(0);
  const published = (() => { try { return Object.values(JSON.parse(fs.readFileSync(path.join(best.root, 'scrollcraft', 'published.json'), 'utf8'))).map((v) => v.folder); } catch { return []; } })();
  if (published.includes(path.basename(best.dir)) && !fs.existsSync(path.join(best.dir, 'IDEAS.md'))) process.exit(0);
  const script = [best.root, ...roots].map((r) => path.join(r, 'scripts', 'check-ideas.mjs')).find((p) => fs.existsSync(p));
  if (!script) process.exit(0);
  const { checkIdeas } = await import(`file:///${script.replace(/\\/g, '/')}`);
  const problems = checkIdeas(best.dir);
  if (problems.length) {
    console.error(`Blocked: no ideas shown and no paid generation for ${path.basename(best.dir)} until its ideas come from the saved sources and repeat no other site (scripts/check-ideas.mjs, page rules 0b.4):\n- ${problems.slice(0, 8).join('\n- ')}${problems.length > 8 ? `\n- and ${problems.length - 8} more` : ''}`);
    process.exit(2);
  }
  process.exit(0);
});

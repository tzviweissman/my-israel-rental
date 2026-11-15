#!/usr/bin/env node
/**
 * Which pages of a live site changed since it was last published (Tzvi, 15 Nov 2026: "only check what is
 * applicable like whatever was changed or updated"). The last commit is the last publish: the commit check
 * refuses a live page that differs from what publish-page wrote from its build.
 *
 * A page counts as changed when its own file differs from the last commit, or a file it names (style, script,
 * picture, film) does. When in doubt it counts as changed: a folder git cannot read checks every page.
 *
 *   node scripts/changed-pages.mjs <build folder>        prints the changed pages
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function changedPages(root, src, pages) {
  const rel = path.relative(root, src).split(path.sep).join('/');
  const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  const diff = git(['diff', '--name-only', 'HEAD', '--', rel]), extra = git(['ls-files', '--others', '--exclude-standard', '--', rel]);
  if (diff.status !== 0 || extra.status !== 0) return pages;
  const files = (diff.stdout + extra.stdout).split('\n').filter(Boolean).map((f) => f.slice(rel.length + 1));
  return pages.filter((p) => {
    if (files.includes(p)) return true;
    const html = fs.readFileSync(path.join(src, p), 'utf8');
    // a file the page names, by its path or its name (assets/pot.webp, site.css); ponytail: a name in a comment counts too, which only checks more
    return files.some((f) => !f.endsWith('.html') && (html.includes(f) || html.includes(path.basename(f))));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))) {
  const src = path.resolve(process.argv[2] || '.');
  const root = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: src, encoding: 'utf8' }).stdout.trim();
  const pages = fs.readdirSync(src).filter((f) => f.endsWith('.html'));
  console.log(changedPages(root, src, pages).join('\n') || '(no page changed)');
}

#!/usr/bin/env node
// Mechanical half of the dead-ends audit (.claude/skills/dead-ends/SKILL.md, Part 7).
//
// Parses the route table out of frontend/src/App.js, then resolves every
// literal `to=`, `navigate(...)` and internal `href=` target against it.
// Flags: no matching route, a bare `<Navigate to="/auth/login" />` guard
// (the pattern App.js's own ToAuth comment says was already fixed
// everywhere — a new one is a regression), and unguarded `href="#..."`
// anchors with no matching id.
//
// This is a heuristic, not a type checker: template-literal targets built
// from a variable (` `/foo/${id}` `) can't be resolved statically and are
// reported separately as "dynamic — not checked" rather than silently
// skipped, so the count of what wasn't verified stays honest.
//
// Whether a destination *contains the promised affordance* (Parts 3-4 of
// the skill) is not automatable and is not attempted here.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const APP_JS = join(ROOT, 'frontend/src/App.js');
const SRC_DIR = join(ROOT, 'frontend/src');

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'build') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.includes(extname(name))) out.push(full);
  }
  return out;
}

// --- Part 1: route table -----------------------------------------------

const appSrc = readFileSync(APP_JS, 'utf8');
const routeRe = /<Route\s+path=(["'`])((?:(?!\1).)*)\1/g;
const routes = [];
let m;
while ((m = routeRe.exec(appSrc))) routes.push(m[2]);

function routeToRegex(route) {
  const pattern = route
    .split('/')
    .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${pattern}$`);
}
const routeRegexes = routes.map((r) => ({ route: r, re: routeToRegex(r) }));

function resolves(path) {
  if (path === '*') return true;
  return routeRegexes.some(({ re }) => re.test(path));
}

console.log(`Route table: ${routes.length} routes parsed from App.js\n`);

// --- Part 2: forward link resolution ------------------------------------

const files = walk(SRC_DIR, ['.js', '.jsx']);
const findings = { missing: [], bareNavigate: [], dynamic: [], badAnchor: [] };

// A bare `<Navigate to="/auth/login" />` (or similar), as opposed to the
// `<ToAuth />` helper that appends `?redirect=`. Only meaningful inside
// App.js's own route guards, not every <Navigate> in the app (redirects to
// a fixed, non-auth destination are fine).
const bareAuthNavigateRe = /:\s*<Navigate\s+to=(["'`])\/(auth\/login|join)\1\s*\/>/g;
while ((m = bareAuthNavigateRe.exec(appSrc))) {
  const line = appSrc.slice(0, m.index).split('\n').length;
  findings.bareNavigate.push(`App.js:${line} — bare <Navigate to="/${m[2]}" />, no redirect preserved (compare ToAuth)`);
}

const literalTargetRe = /\b(?:to|href)=(["'])(\/[a-zA-Z0-9\-_/]*)\1|\bnavigate\((["'])(\/[a-zA-Z0-9\-_/]*)\3/g;
const dynamicTargetRe = /\b(?:to|href)=\{`(\/[^`]*)`\}|\bnavigate\(`(\/[^`]*)`/g;

for (const file of files) {
  const rel = file.replace(ROOT, '');
  const src = readFileSync(file, 'utf8');
  const lineOf = (idx) => src.slice(0, idx).split('\n').length;

  let mm;
  literalTargetRe.lastIndex = 0;
  while ((mm = literalTargetRe.exec(src))) {
    const target = (mm[2] || mm[4]).split('?')[0].split('#')[0];
    if (!target) continue;
    if (!resolves(target)) {
      findings.missing.push(`${rel}:${lineOf(mm.index)} — "${target}" matches no route in App.js`);
    }
  }

  dynamicTargetRe.lastIndex = 0;
  while ((mm = dynamicTargetRe.exec(src))) {
    const raw = mm[1] || mm[2];
    findings.dynamic.push(`${rel}:${lineOf(mm.index)} — \`${raw}\` (template literal, not statically resolvable)`);
  }

  // href="#foo" anchors: collect and check against ids declared anywhere in the app.
  const hashHrefRe = /href=(["'])#([a-zA-Z0-9\-_]+)\1/g;
  while ((mm = hashHrefRe.exec(src))) {
    findings.badAnchor.push({ loc: `${rel}:${lineOf(mm.index)}`, id: mm[2] });
  }
}

if (findings.badAnchor.length) {
  const allSrc = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  findings.badAnchor = findings.badAnchor
    .filter(({ id }) => !new RegExp(`id=(["'])${id}\\1`).test(allSrc))
    .map(({ loc, id }) => `${loc} — href="#${id}" has no matching id="${id}" anywhere in frontend/src`);
}

// --- Report ---------------------------------------------------------------

function section(title, items, emptyMsg) {
  console.log(`## ${title} (${items.length})`);
  if (!items.length) console.log(emptyMsg);
  else items.forEach((i) => console.log(`- ${i}`));
  console.log('');
}

section('Unresolvable literal targets', findings.missing,
  'None — every literal to=/href=/navigate() target matched a route.');
section('Bare auth <Navigate> guards (regression watch)', findings.bareNavigate,
  'None — every guard uses ToAuth or an equivalent redirect-preserving pattern.');
section('Broken #anchor targets', findings.badAnchor,
  'None found (or no #anchor links exist).');
console.log(`## Dynamic targets — not statically checked (${findings.dynamic.length})`);
console.log('Template-literal navigation targets can\'t be resolved without a JS runtime.');
console.log('Spot-check these by hand; a full list is available by re-running with DEBUG=1.\n');
if (process.env.DEBUG) findings.dynamic.forEach((i) => console.log(`- ${i}`));

const failed = findings.missing.length > 0 || findings.bareNavigate.length > 0 || findings.badAnchor.length > 0;
if (failed) {
  console.error('FAIL: unresolved targets or regressed auth guards found above.');
  process.exit(1);
}
console.log('PASS: no unresolved static targets, no bare auth-guard regressions.');

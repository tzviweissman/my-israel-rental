#!/usr/bin/env node
/**
 * Static dead-ends check: does every literal navigation target resolve to a
 * real route?
 *
 * WHY. The dead-ends audits (docs/audits/*-dead-ends.md) keep finding the
 * same mechanical bug — a `to=`/`navigate()` target that doesn't match
 * anything in App.js's route table. That part of the audit
 * (.claude/skills/dead-ends/SKILL.md, "Part 7") automates cleanly, so this
 * script does it on every run instead of waiting for the next scheduled
 * audit to notice by hand.
 *
 * This is pure static analysis (regex over source text, not a real parser)
 * — no dev server, no browser, no network. It only checks *fully literal*
 * targets (no `${...}` interpolation) against the route table; anything
 * built at runtime from a variable is skipped and listed under "dynamic,
 * not checked" rather than guessed at.
 *
 * What it does NOT do, on purpose (per the skill: this is the part that
 * stays a human-judgement pass):
 *   - whether a route's destination actually contains the promised
 *     affordance (a field, a button, a working state)
 *   - whether a guard on a resolvable route will bounce the user
 *   - orphaned backend capability (model fields / enums / endpoints with no
 *     frontend caller) — see the "possible orphan endpoints" heuristic
 *     below, which is a hint list, not a pass/fail check; it has known
 *     false positives (admin/webhook/external endpoints) and does not gate
 *     the exit code.
 *
 * Usage: node scripts/check-dead-ends.mjs
 * Exits 1 if any literal target fails to resolve against the route table.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const APP_JS = path.join(ROOT, 'frontend/src/App.js');
const FRONTEND_SRC = path.join(ROOT, 'frontend/src');
const BACKEND_ROUTES = path.join(ROOT, 'backend/routes');

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

// ── 1. Build the route table from App.js ──
const appSrc = readFileSync(APP_JS, 'utf8');
const routeRe = /<Route\s+path=["']([^"']+)["']/g;
const routes = [];
let m;
while ((m = routeRe.exec(appSrc))) routes.push(m[1]);

if (routes.length === 0) {
  console.error('No routes found in App.js — route-table regex may need updating.');
  process.exit(2);
}

// Turn a react-router path like "/property/:id" into a matcher.
function routeToRegex(routePath) {
  const escaped = routePath
    .split('/')
    .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${escaped}/?$`);
}
const routeMatchers = routes.map((r) => ({ raw: r, re: routeToRegex(r) }));

function resolves(pathname) {
  if (pathname === '') return true; // bare `#anchor` or empty stays on page
  return routeMatchers.some(({ re }) => re.test(pathname));
}

// ── 2. Collect literal navigation targets from the frontend ──
const files = walk(FRONTEND_SRC, ['.js', '.jsx']);
const findings = []; // { file, line, raw, target }
const dynamic = [];  // skipped: contains ${...} or is a variable
const externalOrSpecial = []; // http(s):, mailto:, tel:, wa.me — not app routes

// Matches: to="/x", to='/x', to={"/x"}, to={'/x'}, to={`/x`}, navigate('/x'), navigate(`/x`)
const targetRe = /\b(?:to|navigate)\s*(?:=\s*\{?|\()\s*[`'"]([^`'"]*)[`'"]/g;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let mm;
    targetRe.lastIndex = 0;
    while ((mm = targetRe.exec(line))) {
      const raw = mm[1];
      if (raw.includes('${')) { dynamic.push({ file: rel, line: i + 1, raw }); continue; }
      if (!raw.startsWith('/') && !raw.startsWith('#')) {
        if (/^(https?:|mailto:|tel:|wa\.me)/.test(raw)) externalOrSpecial.push({ file: rel, line: i + 1, raw });
        continue; // relative fragment or not a path-like target — skip
      }
      if (raw.startsWith('#')) continue; // in-page anchor, not a route
      const pathname = raw.split('?')[0].split('#')[0];
      if (!resolves(pathname)) findings.push({ file: rel, line: i + 1, raw, pathname });
    }
  }
}

// ── 3. Heuristic hint list: backend endpoints that look uncalled ──
// Not a pass/fail check — printed for human triage only (see file header).
let orphanHints = [];
try {
  const pyFiles = walk(BACKEND_ROUTES, ['.py']);
  const decoratorRe = /@\w*router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;
  const endpoints = [];
  for (const file of pyFiles) {
    const src = readFileSync(file, 'utf8');
    let dm;
    decoratorRe.lastIndex = 0;
    while ((dm = decoratorRe.exec(src))) {
      endpoints.push({ file: path.relative(ROOT, file), method: dm[1], subpath: dm[2] });
    }
  }
  const frontendSrcBlob = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const ep of endpoints) {
    // Compare the last one or two literal path segments — full prefix
    // resolution across included routers is out of scope for a regex pass.
    const segs = ep.subpath.split('/').filter((s) => s && !s.startsWith('{'));
    const needle = segs[segs.length - 1] || segs[segs.length - 2];
    if (!needle || needle.length < 4) continue; // too generic to search for
    if (!frontendSrcBlob.includes(needle)) {
      orphanHints.push(`${ep.method.toUpperCase()} ...${ep.subpath}  (${ep.file}) — "${needle}" not found anywhere in frontend/src`);
    }
  }
} catch {
  // backend/routes layout changed or python parse assumptions broke — skip, this part is a hint only
}

// ── Report ──
console.log(`Route table: ${routes.length} routes from App.js\n`);

if (findings.length) {
  console.log(`FAIL — ${findings.length} literal navigation target(s) do not resolve to any route:\n`);
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}  ${f.raw}  →  no route matches "${f.pathname}"`);
  }
  console.log('');
} else {
  console.log('OK — every literal to=/navigate() target resolves to a route in App.js.\n');
}

console.log(`Skipped (dynamic, built from a variable at runtime, not checked): ${dynamic.length}`);
console.log(`Skipped (external/mailto/tel link, not an app route): ${externalOrSpecial.length}\n`);

if (orphanHints.length) {
  console.log(`Possible orphan endpoints (heuristic, human review needed — expect false positives for admin/webhook/external routes):`);
  for (const h of orphanHints.slice(0, 50)) console.log(`  ${h}`);
  if (orphanHints.length > 50) console.log(`  ... and ${orphanHints.length - 50} more`);
  console.log('');
}

process.exit(findings.length ? 1 : 0);

/**
 * The API base resolves to a usable URL for every value of the variable.
 *
 * WHY THIS EXISTS. Moving the API to our own origin caused two production
 * incidents in one afternoon, and BOTH were caused by a check that could
 * not see the failure it was written to catch:
 *
 *   value ""   →  the build inlined the string "undefined", so calls went
 *                 to `/undefined/api/…`. The SPA fallback answered those
 *                 with index.html and a 200.
 *   value "/"  →  a caller held the raw "/" and built `//api/…`, which is
 *                 PROTOCOL-RELATIVE: the browser resolved it to the host
 *                 literally named `api`.
 *
 * The check I ran before the second one looked for a hostname in the
 * bundle and for the string "undefined/api". `//api` contains neither, so
 * it reported a pass. The lesson is in the assertions below: this resolves
 * the base the way a BROWSER would, against a real page URL, and asserts
 * on the resulting absolute URL — not on what the source looks like.
 *
 * Usage: node scripts/test-api-base.mjs
 */
import { readFileSync } from 'node:fs';

const SRC = 'frontend/src/lib/apiBase.js';
const PAGE = 'https://myisraelrental.com/join';

const failures = [];
const check = (name, cond, detail = '') => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) failures.push(name);
};

/** Evaluate apiBase.js with a given value for the env var. */
function resolveWith(value) {
  const src = readFileSync(SRC, 'utf8')
    .replace(/export const /g, 'const ')
    .replace(/export default API;?/, '')
    .replace('process.env.REACT_APP_BACKEND_URL',
      value === undefined ? 'undefined' : JSON.stringify(value));
  // eslint-disable-next-line no-new-func
  const { BACKEND_URL, API } = new Function(`${src}; return { BACKEND_URL, API };`)();
  return { BACKEND_URL, API, absolute: new URL(`${API}/properties/stats/trust`, PAGE).href };
}

console.log('\nunset spellings all mean same-origin');
for (const v of [undefined, '', ' ', '/', 'undefined', 'null']) {
  const { API, absolute } = resolveWith(v);
  const label = v === undefined ? '(absent)' : JSON.stringify(v);
  check(
    `${label} -> ${absolute}`,
    API === '/api' && absolute === 'https://myisraelrental.com/api/properties/stats/trust',
    `API=${API}`,
  );
}

console.log('\nan explicit origin is preserved, for local dev and staging');
for (const [v, host] of [
  ['http://localhost:8001', 'http://localhost:8001'],
  ['https://api.example.com', 'https://api.example.com'],
  ['https://api.example.com/', 'https://api.example.com'],
  ['https://api.example.com///', 'https://api.example.com'],
]) {
  const { absolute } = resolveWith(v);
  check(`${v} -> ${absolute}`, absolute === `${host}/api/properties/stats/trust`);
}

console.log('\nthe two shapes that actually broke production');
{
  // `//api/...` is protocol-relative: the browser treats `api` as a HOST.
  const protocolRelative = new URL('//api/properties/stats/trust', PAGE).href;
  check('a bare "/" base would have gone to another host',
    protocolRelative === 'https://api/properties/stats/trust',
    protocolRelative);
  check('but "/" now resolves to this origin',
    resolveWith('/').absolute === 'https://myisraelrental.com/api/properties/stats/trust');

  check('"undefined" no longer reaches the path',
    !resolveWith('undefined').absolute.includes('/undefined/'));
}

console.log('\nnothing outside apiBase.js may read the variable');
{
  // The real defect was twelve files each doing their own arithmetic on
  // the raw value; hardening one of them fixed one twelfth.
  const { execSync } = await import('node:child_process');
  let hits = '';
  try {
    hits = execSync(
      'git grep -l "REACT_APP_BACKEND_URL" -- frontend/src',
      { encoding: 'utf8' },
    ).trim();
  } catch { /* git grep exits 1 when nothing matches */ }
  const offenders = hits.split('\n').filter((f) => f && !f.endsWith('lib/apiBase.js'));
  check('only apiBase.js reads it', offenders.length === 0, offenders.join(', '));
}

console.log('\nevery call site agrees with the base it imported');
{
  // THE BUG THIS CATCHES. SignContract.js held
  //   const API = process.env.REACT_APP_BACKEND_URL || '/api';
  // so in production API was the bare ORIGIN and every call omitted /api.
  // `<backend>/contracts/sign/x` is a 404; `<backend>/api/contracts/sign/x`
  // is the real handler. Contract signing was broken from 2026-04-15 until
  // it was fixed by accident on 2026-09-01 — 4½ months, two contracts sent
  // and never signed, and nothing anywhere reported it.
  //
  // Two importable bases now exist and they differ by exactly `/api`:
  //   import { API }                  -> origin + '/api'  → paths must NOT start /api/
  //   import { BACKEND_URL as API }   -> bare origin      → paths MUST start /api/
  // Getting that backwards is a 404 on every call in the file, which is
  // silent until a user hits the feature.
  const { execSync } = await import('node:child_process');
  const files = execSync('git grep -l "from .*lib/apiBase" -- frontend/src', { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);

  const wrong = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const bareOrigin = /import\s*\{\s*BACKEND_URL as API\s*\}/.test(src);
    // Template-literal call sites: `${API}/something`
    for (const m of src.matchAll(/\$\{API\}(\/[A-Za-z0-9_\-/${}.]*)/g)) {
      const path = m[1];
      const startsWithApi = path.startsWith('/api/') || path === '/api';
      if (bareOrigin && !startsWithApi) wrong.push(`${f}: bare origin but path is ${path} (missing /api)`);
      if (!bareOrigin && startsWithApi) wrong.push(`${f}: API already ends /api but path is ${path} (doubled)`);
    }
  }
  check(`${files.length} importing files, every call site consistent`, wrong.length === 0, wrong.join('; '));
}

console.log('\na file that USES API must import it, not just re-export it');
{
  // THE BUG THIS CATCHES, and it reached production. App.js had
  //   export { API } from './lib/apiBase';
  // which forwards the binding to importers but creates NOTHING in
  // App.js's own scope. `${API}/auth/me` on line 166 therefore threw
  //   ReferenceError: API is not defined
  // at runtime — inside fetchCurrentUser, whose catch calls logout(). So
  // every signed-in visitor was signed out by their next page load, while
  // the build compiled with no error and the check above passed, because
  // App.js does contain the substring "from './lib/apiBase'".
  //
  // Nothing about this is specific to `API`: `export { X } from` never
  // gives you `X`. The check is per-file and mechanical.
  const { execSync } = await import('node:child_process');
  const files = execSync('git grep -l "lib/apiBase" -- frontend/src', { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean).filter((f) => !f.endsWith('lib/apiBase.js'));

  // Comments must come out first. App.js's own note reads "~100 modules
  // already import { API } from '../App'" — which satisfied the pattern
  // below and made this check pass on the exact file it was written for.
  // The control (put the re-export back, expect a failure) is what
  // surfaced that; without it this would have shipped as a green check
  // over a broken app.
  const stripComments = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  const broken = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    if (!/\$\{API\}/.test(src)) continue;                 // does not use it
    const imports = /import\s*\{[^}]*\bAPI\b[^}]*\}\s*from/.test(src)
      || /import\s*\{[^}]*BACKEND_URL as API[^}]*\}\s*from/.test(src)
      || /\b(?:const|let|var)\s+API\s*=/.test(src);
    if (!imports) broken.push(`${f}: uses the API binding with no import — a bare "export { API } from" does not bind it here`);
  }
  check(`${files.length} files touching apiBase, every user of API binds it`, broken.length === 0, broken.join('; '));
}

console.log('');
if (failures.length) {
  console.log(`${failures.length} failed`);
  process.exit(1);
}
console.log('all passed');

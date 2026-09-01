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

console.log('');
if (failures.length) {
  console.log(`${failures.length} failed`);
  process.exit(1);
}
console.log('all passed');

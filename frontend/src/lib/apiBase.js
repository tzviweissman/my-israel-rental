/**
 * Where the API is, decided ONCE.
 *
 * WHY THIS FILE EXISTS. `REACT_APP_BACKEND_URL` was read directly in
 * twelve places, each doing its own arithmetic on it — `${VAR}/api`,
 * `VAR + '/api'`, `VAR || '/api'`, and three that append `/api` at the
 * call site instead. So "what is the API base" had twelve answers, and
 * sanitising the one in App.js fixed one twelfth of the problem.
 *
 * That cost two production incidents in one afternoon, both while trying
 * to move the API to our own origin:
 *
 *   value ""   →  the build inlined the STRING "undefined", so the eleven
 *                 template-literal call sites produced `/undefined/api/…`.
 *                 The SPA fallback answered those with index.html and a
 *                 200, and the app parsed a web page as JSON.
 *   value "/"  →  App.js was hardened by then and was fine, but
 *                 `TrustLine.jsx` still held the raw "/" and built
 *                 `//api/properties/stats/trust` — protocol-relative, so
 *                 the browser went to the host literally named `api`.
 *
 * Both were live for a few minutes and both were rolled back. Neither
 * was catchable by reading App.js, which is exactly why the value now
 * lives here and nothing else reads the environment variable.
 *
 * THE CONTRACT:
 *
 *   BACKEND_URL  the origin, or '' for same-origin. Never a bare '/',
 *                because `${'/'}/api` is protocol-relative and means a
 *                different host entirely.
 *   API          BACKEND_URL + '/api'. What almost every caller wants.
 *
 * "/" , "undefined", "null", "" and absent ALL mean same-origin; anything
 * else is used verbatim, which is what local dev needs (the CRA dev
 * server has no proxy, so `.env` points at http://localhost:8001).
 */

const RAW = (process.env.REACT_APP_BACKEND_URL || '').trim();

const UNSET = new Set(['', '/', 'undefined', 'null']);

/** The API's origin. Empty string means "this origin". */
export const BACKEND_URL = UNSET.has(RAW) ? '' : RAW.replace(/\/+$/, '');

/** The API root. Same-origin builds get a root-relative '/api'. */
export const API = `${BACKEND_URL}/api`;

export default API;

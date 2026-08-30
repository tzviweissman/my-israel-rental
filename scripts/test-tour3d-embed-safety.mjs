/**
 * The 3D-tour embed URL guard.
 *
 * `isSafeEmbed` decides what may become an `<iframe src>` on a public
 * listing page, using a URL supplied by a third-party reconstruction
 * vendor. An iframe `src` is not inert — `javascript:` there runs in OUR
 * origin, against visitors who are signed in — so this is the boundary
 * between "a vendor had a bad day" and "a vendor executed script on
 * myisraelrental.com".
 *
 * The cases below are the ones that defeat the obvious implementations:
 *
 *   A `String.startsWith('https')` check passes `httpsfoo://x.io`, and —
 *   worse — a block-list of `javascript:` misses
 *   `JaVaScRiPt:`, ` javascript:` with a leading space, and the
 *   tab/newline-splitting forms that browsers strip before parsing. The
 *   URL constructor normalises all of them, which is exactly why it is
 *   used rather than string matching.
 *
 *   `data:` is refused even though modern browsers give it an opaque
 *   origin. It has been origin-inheriting in enough shipped browsers for
 *   long enough that allowing it buys nothing a vendor needs.
 *
 * Pure logic, no browser: runs in milliseconds and is the reason
 * `isSafeEmbed` lives in `utils/embedSafety.js` rather than inside the
 * JSX component, which node could not import.
 *
 * Usage: node scripts/test-tour3d-embed-safety.mjs
 */
import { isSafeEmbed } from '../frontend/src/utils/embedSafety.js';

const failures = [];
let counted = 0;

const check = (label, input, expected) => {
  counted += 1;
  let actual;
  try {
    actual = isSafeEmbed(input);
  } catch (e) {
    failures.push(`${label}: threw ${e.message} — it must return a boolean, never throw`);
    return;
  }
  if (actual !== expected) {
    failures.push(
      `${label}: isSafeEmbed(${JSON.stringify(input)}) === ${actual}, expected ${expected}`,
    );
  }
};

// ---- allowed ------------------------------------------------------------
check('plain https', 'https://lumalabs.ai/embed/abc123', true);
check('https with port', 'https://embed.example.com:8443/x', true);
check('https with query + hash', 'https://x.io/e?id=1&t=2#frag', true);
check('uppercase scheme', 'HTTPS://x.io/e', true);

// ---- refused: wrong scheme ---------------------------------------------
check('http downgrade', 'http://x.io/e', false);
check('javascript', 'javascript:alert(document.cookie)', false);
check('javascript mixed case', 'JaVaScRiPt:alert(1)', false);
check('javascript with leading space', ' javascript:alert(1)', false);
check('javascript with leading tab', '\tjavascript:alert(1)', false);
check('javascript split by newline', 'java\nscript:alert(1)', false);
check('javascript with NUL', 'java\0script:alert(1)', false);
check('data html', 'data:text/html,<script>alert(1)</script>', false);
check('data base64', 'data:text/html;base64,PHNjcmlwdD4x', false);
check('blob', 'blob:https://x.io/uuid', false);
check('filesystem', 'filesystem:https://x.io/temporary/f', false);
check('about:blank', 'about:blank', false);
check('file', 'file:///etc/passwd', false);
check('vbscript', 'vbscript:msgbox(1)', false);

// ---- refused: not a URL at all -----------------------------------------
check('relative path', '/embed/abc', false);
check('protocol-relative', '//evil.io/e', false);
check('bare host', 'lumalabs.ai/embed/abc', false);
// `https:evil` is NOT a trap for this implementation: the URL parser
// normalises it to `https://evil/`, a real https URL to a host that will
// not resolve. It cannot execute script, which is what this guard is for.
// Which HOST is acceptable is deliberately not decided here — see the
// note in embedSafety.js about CSP frame-src.
check('scheme-relative https normalises to a host', 'https:evil', true);
check('lookalike scheme', 'httpsfoo://x.io/e', false);
check('empty string', '', false);
check('whitespace only', '   ', false);

// ---- refused: not a string ---------------------------------------------
check('null', null, false);
check('undefined', undefined, false);
check('number', 12345, false);
check('object', { toString: () => 'https://x.io/e' }, false);
check('array', ['https://x.io/e'], false);
// A URL object is not a string; the caller must pass what it got from the
// API, and anything else is a bug worth failing closed on.
check('URL instance', new URL('https://x.io/e'), false);

if (failures.length) {
  console.error('FAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log(`all ${counted} embed-safety cases passed`);

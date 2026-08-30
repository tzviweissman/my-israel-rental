/**
 * Is a third-party embed URL safe to put in an iframe `src`?
 *
 * Pure, and in a plain `.js` file rather than beside the component, for
 * the same reason `components/tour/placement.js` is: it is the piece most
 * worth testing and the piece a JSX file makes untestable from node. See
 * `scripts/test-tour3d-embed-safety.mjs`, which runs every case in
 * milliseconds.
 *
 * WHAT THIS IS DEFENDING. The URL comes from a 3D reconstruction vendor
 * and is rendered on a public listing page where visitors are signed in.
 * `src` is not inert: a `javascript:` URL executes in THIS page's origin,
 * so a vendor account compromise — or a bug that lets a value be stored
 * unchecked — turns into script execution against our own users. `data:`
 * is the same problem wearing a different hat: `data:text/html,...` gets
 * a fresh origin in modern browsers but has been origin-inheriting in
 * enough of them, for long enough, that allowing it buys nothing.
 *
 * So this is an ALLOW-LIST of one scheme, not a block-list of bad ones. A
 * block-list of `javascript:` and `data:` would still admit `blob:`,
 * `filesystem:`, `about:`, and whatever the next one turns out to be.
 *
 * It deliberately does NOT check the host. Which vendor we use is a
 * config decision that changes; requiring https is true regardless of who
 * ends up doing the reconstruction. If the embed host is ever pinned, a
 * CSP `frame-src` is the place for it — enforced by the browser rather
 * than by a function the calling code could forget to call.
 */

/** @param {unknown} url @returns {boolean} */
export const isSafeEmbed = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    // The URL constructor, not a regex: it normalises the tricks that
    // defeat string matching — leading whitespace and control characters,
    // `JaVaScRiPt:`, and embedded newlines are all resolved before the
    // protocol is read.
    return new URL(url).protocol === 'https:';
  } catch {
    // Relative or malformed. A relative URL would resolve against our own
    // origin, which is not what a third-party embed should ever do.
    return false;
  }
};

export default isSafeEmbed;

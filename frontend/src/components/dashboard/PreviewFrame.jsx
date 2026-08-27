/**
 * An iframe that a React subtree is rendered INTO, for K3's live preview.
 *
 * WHY AN IFRAME AND NOT A DIV
 * ---------------------------
 * The preview has to show the page at a chosen width — a phone and a
 * desktop are different layouts, and the owner is entitled to see both.
 * Tailwind's breakpoints (and every `@media` rule in the app) answer to the
 * VIEWPORT, not to the width of the box you put them in. Sizing a `<div>`
 * to 390px inside a 1440px window gives you a desktop layout squeezed into
 * a phone-shaped hole: every column that should have collapsed stays put,
 * and the owner is shown a page no customer will ever see.
 *
 * An iframe has its own viewport. At 390px wide it IS a phone as far as
 * every media query is concerned, whatever the window around it is doing.
 * `position: fixed` lands on the frame's edges too, which is what makes the
 * business page's sticky "Message" bar appear where a customer would find
 * it rather than floating over the dashboard.
 *
 * WHY A PORTAL AND NOT A URL
 * --------------------------
 * Pointing the iframe at `/business/{slug}` would render the saved page,
 * which is the one thing this must not do: the whole point is the pending
 * edits, before they are saved. Portalling keeps the children inside the
 * parent's React tree — same i18n instance, same router, same auth context
 * — so the real page component runs unmodified with a modified prop.
 *
 * Styles are cloned from the host document rather than linked, because in
 * development CRA injects them as <style> elements that no URL exists for.
 * The MutationObserver keeps the clones current when a hot reload rewrites
 * them; without it a CSS edit updates the dashboard and leaves the preview
 * showing the previous design, which is exactly the drift this feature is
 * meant to eliminate.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// A blank same-origin document. `srcDoc` rather than `about:blank` because
// a blank iframe's document is replaced on some navigations and the mount
// node would go with it.
const BLANK = '<!doctype html><html><head></head><body></body></html>';

/** Copy every stylesheet the host page is using into the frame. */
function syncStyles(doc) {
  if (!doc || !doc.head) return;
  doc.head.querySelectorAll('[data-preview-style]').forEach((n) => n.remove());
  document.head
    .querySelectorAll('style, link[rel="stylesheet"]')
    .forEach((node) => {
      const clone = node.cloneNode(true);
      clone.setAttribute('data-preview-style', '');
      doc.head.appendChild(clone);
    });
}

/**
 * @param {number} width   the viewport width to render at, in CSS px
 * @param {number} [height] the viewport height, in CSS px. Left out, the
 *   frame takes whatever height its container has, un-scaled — so the
 *   preview behaves like a browser window of the chosen size, with one
 *   scrollbar inside it rather than a short page scrolling inside a panel
 *   that is also scrolling.
 * @param {string} dir     'ltr' | 'rtl' — set on the frame's <html>
 * @param {string} lang    language tag for the frame's <html>
 * @param {string} title   accessible name for the frame
 */
export default function PreviewFrame({
  width = 1280,
  height = null,
  dir = 'ltr',
  lang = 'en',
  title,
  className = '',
  children,
}) {
  const frameRef = useRef(null);
  const boxRef = useRef(null);
  const [mount, setMount] = useState(null);
  // 1 until measured. Scaling DOWN only: blowing a 390px layout up to fill
  // a desktop column would show the owner a page at a size nobody's screen
  // renders it at.
  const [scale, setScale] = useState(1);
  const [boxHeight, setBoxHeight] = useState(0);

  // Set up the frame's document once it exists, and again if the browser
  // replaces it. Layout effect so the styles are in place before the
  // portal's first paint, which is what keeps the preview from flashing
  // unstyled every time it opens.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    let observer = null;
    let pending = 0;

    const attach = () => {
      const doc = frame.contentDocument;
      if (!doc || !doc.body) return;

      syncStyles(doc);
      // The host page reserves room for the fixed site nav. There is no
      // nav in here — the preview is the page, not the chrome around it —
      // so the reservation would open a blank strip above the cover photo
      // and read as a design flaw the owner cannot fix.
      doc.documentElement.style.setProperty('--nav-h', '0px');
      doc.body.style.margin = '0';
      // Carries the body-level typography the app sets in index.css.
      doc.body.className = document.body.className;

      setMount(doc.body);

      // Development rewrites <style> contents in place on every hot
      // reload; a childList-only observer would never see it.
      observer = new MutationObserver(() => {
        if (pending) return;
        pending = requestAnimationFrame(() => {
          pending = 0;
          syncStyles(frame.contentDocument);
        });
      });
      observer.observe(document.head, {
        childList: true, subtree: true, characterData: true,
      });
    };

    // Both paths are needed: a same-origin srcDoc frame is often already
    // parsed by the time this effect runs, and fires no load event we
    // would still be listening for.
    if (frame.contentDocument?.readyState === 'complete') attach();
    frame.addEventListener('load', attach);

    return () => {
      frame.removeEventListener('load', attach);
      if (observer) observer.disconnect();
      if (pending) cancelAnimationFrame(pending);
      setMount(null);
    };
  }, []);

  // `dir` is what swaps the Hebrew font variables, so it has to live on the
  // frame's own <html> — the host page's dir does not reach in here.
  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    doc.documentElement.setAttribute('dir', dir);
    doc.documentElement.setAttribute('lang', lang);
  }, [dir, lang, mount]);

  // Fit the chosen viewport into whatever room the panel has.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const measure = () => {
      const available = box.clientWidth;
      setScale(available > 0 ? Math.min(1, available / width) : 1);
      setBoxHeight(box.clientHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [width]);

  // Divided by the scale so the frame ends up exactly as tall as its
  // container after being shrunk: one scrollbar, inside the preview, where
  // a browser window would put it.
  const frameHeight = height ?? Math.max(320, Math.round((boxHeight || 600) / (scale || 1)));

  return (
    <div ref={boxRef} className={className} style={{ overflow: 'hidden' }}>
      {/* Takes the SCALED size, so the surrounding layout reserves the room
          the frame actually occupies. A transformed element keeps its
          pre-transform box otherwise, and the panel would scroll sideways
          past a phone-width preview. */}
      {/* `direction: ltr` on the WRAPPER, and it is not a mistake on an app
          that must work RTL. This box is pure geometry; the preview's own
          direction lives on the frame's <html>, set above, and is not
          inherited across the boundary. Left to inherit the dashboard's
          `rtl`, the over-wide frame aligns to its container's RIGHT edge
          and overflows leftward — and `transform-origin: top left` then
          scales it toward a corner that is off-panel, so the owner's page
          is drawn half outside the preview with dead space beside it. */}
      <div style={{
        width: width * scale,
        height: frameHeight * scale,
        marginInline: 'auto',
        direction: 'ltr',
      }}>
        <iframe
          ref={frameRef}
          title={title}
          srcDoc={BLANK}
          style={{
            width,
            height: frameHeight,
            border: 0,
            display: 'block',
            transform: `scale(${scale})`,
            // Physical, and deliberately not logical: the wrapper above is
            // already sized to the scaled box and centres it. An origin
            // that flipped with `dir` would scale the frame toward an edge
            // its own box does not end at, pushing the page out of view.
            transformOrigin: 'top left',
          }}
        />
      </div>
      {mount ? createPortal(children, mount) : null}
    </div>
  );
}

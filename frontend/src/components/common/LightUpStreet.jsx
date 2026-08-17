/**
 * A dark street whose windows light up under the reader's pointer.
 *
 * Two photographs of the SAME building, one with every window unlit and
 * one with every window lit, stacked. The lit layer is revealed through a
 * soft circular mask that follows the pointer, so moving across the
 * facade turns the lights on behind it.
 *
 * WHY IT IS THE SAME BUILDING. The lit frame was produced by EDITING the
 * dark frame rather than generating a second one. Two independent
 * generations of "the same building" are never quite the same building,
 * the windows drift by a few pixels, and the effect collapses because the
 * layers do not register. Editing guarantees they do. If either image is
 * ever regenerated, they must be regenerated the same way: dark first,
 * then lit AS AN EDIT of it.
 *
 * THREE BEHAVIOURS, in order of preference:
 *   1. A pointer that can hover: the mask follows it.
 *   2. Touch, or no pointer: the mask drifts along a slow path on its
 *      own, so the effect is not desktop-only. This is the part most
 *      implementations skip.
 *   3. `prefers-reduced-motion`: the mask parks in the centre and never
 *      moves. Still lit, still legible, no motion at all.
 *
 * FAIL-SAFE. The mask position lives in CSS custom properties with
 * sensible defaults, so with no JavaScript at all the section still
 * renders as a dark street with a warm glow in the middle. JavaScript
 * only ever animates something that already looks finished.
 */
import React, { useEffect, useRef } from 'react';
import SITE_ASSETS from '../../lib/siteAssets';

const RADIUS = 'clamp(120px, 18vw, 260px)';

const LightUpStreet = ({ children, testId = 'lightup-street' }) => {
  const wrap = useRef(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;          // centre default in CSS is the final state

    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let frame = 0;
    let raf = 0;

    const set = (x, y) => {
      el.style.setProperty('--lx', `${x}%`);
      el.style.setProperty('--ly', `${y}%`);
    };

    if (canHover) {
      const onMove = (e) => {
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          const r = el.getBoundingClientRect();
          set(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
        });
      };
      // Leaving should not snap the glow away; park it back in the middle.
      const onLeave = () => set(50, 50);
      el.addEventListener('pointermove', onMove, { passive: true });
      el.addEventListener('pointerleave', onLeave);
      return () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
        if (frame) window.cancelAnimationFrame(frame);
      };
    }

    // No hover: drift along a slow Lissajous path so a phone still sees
    // the windows come on. Two different periods keep it from looking
    // like a circle repeating.
    let t = 0;
    const tick = () => {
      t += 0.006;
      set(50 + Math.sin(t) * 34, 50 + Math.sin(t * 0.73) * 26);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const mask = `radial-gradient(circle ${RADIUS} at var(--lx, 50%) var(--ly, 50%),`
    + ' rgba(0,0,0,1) 0%, rgba(0,0,0,.85) 42%, rgba(0,0,0,0) 72%)';

  return (
    <section
      ref={wrap}
      data-testid={testId}
      className="relative overflow-hidden"
      style={{ background: 'var(--brand-primary-deep)' }}
    >
      <img
        src={SITE_ASSETS['scene12-street-dark']}
        alt=""
        aria-hidden="true"
        className="w-full block select-none pointer-events-none"
        style={{ aspectRatio: '16 / 9', objectFit: 'cover', maxHeight: 520 }}
      />
      <img
        src={SITE_ASSETS['scene13-street-lit']}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full select-none pointer-events-none"
        style={{
          objectFit: 'cover',
          WebkitMaskImage: mask,
          maskImage: mask,
          transition: 'opacity .4s ease',
        }}
      />
      {children && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center pointer-events-none">
          <div className="pointer-events-auto">{children}</div>
        </div>
      )}
    </section>
  );
};

export default LightUpStreet;

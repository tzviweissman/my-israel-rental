/**
 * One step of the tour: a spotlight on a real control, and a tooltip with
 * an arrow pointing at it.
 *
 * THE SPOTLIGHT DOES NOT TOUCH THE TARGET. The dim is an SVG rectangle with
 * the target punched out of its mask, so nothing overlays the control and
 * nothing recolours it. That is the point: the owner has to recognise the
 * same control again tomorrow, and a button they only ever saw tinted
 * yellow is a button they have not been taught. The only addition is a soft
 * ring in `--brand-primary`, which the site already uses for focus.
 *
 * The overlay swallows clicks. The tour is a demonstration, not a task — it
 * never asks the owner to press the highlighted thing, and if a stray click
 * did land on it they would navigate away and lose the tour. Exit and Esc
 * are always available, so nobody is trapped.
 *
 * Placement is computed in `placement.js`, which is pure and tested in both
 * directions. Nothing here hard-codes left or right.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { computePlacement } from './placement';

const PAD = 6;          // breathing room around the target inside the cut-out
const RADIUS = 10;

const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function CoachMark({
  targetEl, title, body, index, total, onNext, onBack, onExit, isFirst, isLast,
}) {
  const { t } = useTranslation();
  const tipRef = useRef(null);
  const [rect, setRect] = useState(null);
  const [pos, setPos] = useState(null);

  const dir = typeof document !== 'undefined'
    ? (document.documentElement.getAttribute('dir') || 'ltr') : 'ltr';

  const measure = useCallback(() => {
    if (!targetEl || !tipRef.current) return;
    const r = targetEl.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setPos(computePlacement({
      target: { top: r.top, left: r.left, width: r.width, height: r.height },
      tooltip: { width: tip.width, height: tip.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      dir,
    }));
  }, [targetEl, dir]);

  // Layout effect so the first paint is already in the right place — a
  // tooltip that appears at 0,0 and jumps is worse than one that appears
  // a frame later.
  useLayoutEffect(() => { measure(); }, [measure, title, body]);

  // Reposition on anything that can move the target, throttled to a frame.
  useEffect(() => {
    let frame = 0;
    const onChange = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    window.addEventListener('orientationchange', onChange);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
      window.removeEventListener('orientationchange', onChange);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [measure]);

  // Focus into the tooltip, trapped while it is open, and Esc always exits.
  useEffect(() => {
    const node = tipRef.current;
    if (!node) return undefined;
    const focusables = () => node.querySelectorAll('button:not([disabled])');
    (focusables()[0] || node).focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onExit(); return; }
      if (e.key !== 'Tab') return;
      const list = [...focusables()];
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [onExit, index]);

  const hole = rect ? {
    x: Math.max(0, rect.left - PAD),
    y: Math.max(0, rect.top - PAD),
    w: rect.width + PAD * 2,
    h: rect.height + PAD * 2,
  } : null;

  const NextIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const motion = reducedMotion() ? 'none' : 'top .18s ease, left .18s ease';

  return (
    <div className="fixed inset-0 z-[100]" data-testid="tour-overlay">
      {/* The dim, with the target cut out of it. `pointer-events: auto` so
          the page underneath cannot be clicked by accident. */}
      <svg width="100%" height="100%" className="absolute inset-0" aria-hidden="true">
        <defs>
          <mask id="tour-hole">
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            {hole && (
              <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h}
                rx={RADIUS} ry={RADIUS} fill="#000" />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(35,32,27,.55)"
          mask="url(#tour-hole)" />
        {hole && (
          <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h}
            rx={RADIUS} ry={RADIUS} fill="none"
            stroke="var(--brand-primary)" strokeWidth="2" />
        )}
      </svg>

      <div
        ref={tipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        className="absolute w-[min(20rem,calc(100vw-2rem))] rounded-2xl border p-4 shadow-xl outline-none"
        style={{
          top: pos ? pos.top : -9999,
          left: pos ? pos.left : -9999,
          background: 'var(--surface)',
          borderColor: 'var(--brand-border)',
          transition: motion,
        }}
        data-testid="tour-tooltip"
        data-placement={pos?.placement || ''}
      >
        {/* The arrow. A rotated square tucked under the tooltip's edge, so
            it inherits the same border and background and cannot drift out
            of sync with them. */}
        {pos && (
          <span
            aria-hidden="true"
            className="absolute w-3 h-3 rotate-45"
            style={{
              background: 'var(--surface)',
              borderInlineStart: pos.placement === 'right' || pos.placement === 'bottom'
                ? '1px solid var(--brand-border)' : 'none',
              borderBlockStart: pos.placement === 'bottom' || pos.placement === 'right'
                ? '1px solid var(--brand-border)' : 'none',
              borderInlineEnd: pos.placement === 'left' || pos.placement === 'top'
                ? '1px solid var(--brand-border)' : 'none',
              borderBlockEnd: pos.placement === 'top' || pos.placement === 'left'
                ? '1px solid var(--brand-border)' : 'none',
              top: pos.arrow.top - 6,
              left: pos.arrow.left - 6,
            }}
          />
        )}

        <div className="flex items-start justify-between gap-3">
          <h2
            id="tour-title"
            className="text-base font-bold"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onExit}
            aria-label={t('tour.exit', 'End the tour')}
            className="shrink-0 p-1 rounded"
            style={{ color: 'var(--brand-muted)' }}
            data-testid="tour-exit"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--ink)' }}
          data-testid="tour-body">
          {body}
        </p>

        <div className="flex items-center justify-between gap-3 mt-4">
          {/* A count, not a bar. "3 of 8" sets an expectation of how much
              is left; a bar only shows how far along you are. */}
          <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}
            data-testid="tour-progress">
            {t('tour.progress', '{{index}} of {{total}}', { index, total })}
          </span>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold"
                style={{ color: 'var(--brand-muted)' }}
                data-testid="tour-back"
              >
                <BackIcon size={14} aria-hidden="true" />
                {t('tour.back', 'Back')}
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--brand-primary)' }}
              data-testid="tour-next"
            >
              {isLast ? t('tour.done', 'Done') : t('tour.next', 'Next')}
              {!isLast && <NextIcon size={14} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Airbnb-style peekable bottom sheet for mobile map views.
 *
 * Renders a fixed-position drawer that starts in "peek" state (~130px
 * visible from the bottom) so map users get a hint of the results
 * without leaving the map, then can drag or tap the handle to expand
 * to "full" (~90vh) for a scrollable list.
 *
 * Explicitly mobile-only — the parent should wrap this in `sm:hidden`.
 * On tablet/desktop the inline results grid handles everything so
 * there's no need for a drawer.
 *
 * Design decisions:
 *   • Two snap points (peek + full). Three-way (peek/half/full) adds
 *     UX friction — most users just want "hide" or "show" and picking
 *     the middle state accidentally is annoying on small screens.
 *   • Touch-drag with a 60px snap threshold. Anything ≥60px pulled
 *     upward from peek expands; anything ≥60px pulled down from full
 *     collapses. Prevents accidental state flips.
 *   • Rendered ABOVE the map (z-40) but below any modals (z-50) so a
 *     filters modal opened from the peek strip lays on top correctly.
 *   • Uses `env(safe-area-inset-bottom)` so the handle stays clear of
 *     the iOS home-indicator regardless of state.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown } from 'lucide-react';

const PEEK_HEIGHT = 132;   // px — shows the header + a peek strip
const FULL_HEIGHT_VH = 88;  // vh — nearly-full sheet, leaves ~12vh for the map

const PeekableResultsSheet = ({
  open = true,          // false → sheet hidden entirely (parent controls)
  count,                // number of results, shown in the header
  countLabel,           // e.g. "stays" or "services"
  peekContent,          // horizontal-scroll strip shown when collapsed
  fullContent,          // vertical list shown when expanded
  testId = 'peek-sheet',
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState('peek');   // 'peek' | 'full'
  const [dragOffset, setDragOffset] = useState(0);   // px live-drag delta
  const dragStartYRef = useRef(null);
  const dragStartStateRef = useRef('peek');

  // Compute the current translateY: base position for the state, plus
  // any active drag delta clamped to sensible bounds.
  const fullHeightPx = typeof window !== 'undefined'
    ? Math.round(window.innerHeight * (FULL_HEIGHT_VH / 100))
    : 600;
  const baseTranslate = state === 'peek' ? fullHeightPx - PEEK_HEIGHT : 0;
  const liveTranslate = Math.min(
    fullHeightPx - PEEK_HEIGHT,
    Math.max(0, baseTranslate + dragOffset),
  );

  // Handle drag on the header only — the body needs to remain
  // scrollable when in full state, so we don't want touchmove on the
  // list eating vertical scroll gestures.
  const onDragStart = (clientY) => {
    dragStartYRef.current = clientY;
    dragStartStateRef.current = state;
  };
  const onDragMove = (clientY) => {
    if (dragStartYRef.current == null) return;
    setDragOffset(clientY - dragStartYRef.current);
  };
  const onDragEnd = () => {
    if (dragStartYRef.current == null) return;
    const startState = dragStartStateRef.current;
    const delta = dragOffset;
    // 60px snap threshold — enough to feel intentional, small enough
    // that a real swipe flips the sheet without the user overshooting.
    if (startState === 'peek' && delta <= -60) setState('full');
    else if (startState === 'full' && delta >= 60) setState('peek');
    dragStartYRef.current = null;
    setDragOffset(0);
  };

  // Touch events (mobile primary path)
  const onTouchStart = (e) => onDragStart(e.touches[0].clientY);
  const onTouchMove = (e) => onDragMove(e.touches[0].clientY);
  const onTouchEnd = () => onDragEnd();

  // Mouse events — useful for desktop-emulation testing but the sheet
  // itself is only rendered under sm:hidden so real desktop users
  // never see it.
  const onMouseDown = (e) => {
    onDragStart(e.clientY);
    const move = (ev) => onDragMove(ev.clientY);
    const up = () => {
      onDragEnd();
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Reset the drag ref when the sheet is unmounted — protects against
  // a stray ref that survives an unmount/remount during navigation.
  useEffect(() => () => { dragStartYRef.current = null; }, []);

  if (!open) return null;

  return (
    <div
      className="sm:hidden fixed inset-x-0 z-40 pointer-events-none"
      style={{ bottom: 0, height: `${fullHeightPx}px` }}
      aria-hidden={false}
      data-testid={testId}
    >
      <div
        className="pointer-events-auto absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-[0_-10px_30px_-8px_rgba(15,58,58,0.28)] ring-1 ring-black/5 flex flex-col"
        style={{
          height: `${fullHeightPx}px`,
          transform: `translateY(${liveTranslate}px)`,
          // While the user is actively dragging we skip the ease so the
          // sheet tracks their finger 1:1 — snapping back to a spring
          // curve on release feels much more responsive.
          transition: dragStartYRef.current == null
            ? 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)'
            : 'none',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          touchAction: 'none',
        }}
      >
        {/* Draggable header — includes the grab handle, count, and
            chevron toggle. Making the entire header draggable (not just
            the little handle bar) matches the iOS mail / Apple Maps
            convention that most mobile users already know. */}
        <button
          type="button"
          onClick={() => setState(state === 'peek' ? 'full' : 'peek')}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          className="w-full flex-shrink-0 pt-2 pb-3 px-4 flex flex-col items-stretch cursor-grab active:cursor-grabbing focus:outline-none"
          data-testid={`${testId}-handle`}
          aria-expanded={state === 'full'}
          aria-label={state === 'peek' ? t('common.showAllResults', 'Show all results') : t('common.collapseResults', 'Collapse results')}
        >
          <div className="mx-auto w-10 h-1 rounded-full bg-gray-300 mb-2" />
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">
              {count} {countLabel}
              {state === 'peek' && (
                <span className="ms-1.5 text-gray-500 font-normal">· {t('common.swipeUpForDetails', 'swipe up for details')}</span>
              )}
            </div>
            <span className="text-gray-500">
              {state === 'peek' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </div>
        </button>

        {/* Peek strip: horizontal-scroll mini cards, shown only while
            collapsed. Hiding it entirely in `full` state avoids the
            visual awkwardness of two card rows fighting for the same
            attention. */}
        {state === 'peek' && (
          <div className="flex-1 overflow-hidden">
            {peekContent}
          </div>
        )}

        {/* Full list — takes the remaining height with its own scroll
            container so drags on cards don't trigger the sheet snap. */}
        {state === 'full' && (
          <div
            className="flex-1 overflow-y-auto overscroll-contain"
            data-testid={`${testId}-list`}
            style={{ touchAction: 'pan-y' }}
          >
            {fullContent}
          </div>
        )}
      </div>
    </div>
  );
};

export default PeekableResultsSheet;

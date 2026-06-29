/**
 * useElementHeight — observes an element's offsetHeight via ResizeObserver
 * and returns it as a number. Returns 0 until the first measurement.
 *
 * Use cases:
 *   - Stays.jsx: measures the fixed search-bar container so the page
 *     content's padding-top can match its current height exactly,
 *     instead of relying on hard-coded magic numbers per breakpoint.
 *
 * The Navigation component additionally pushes its height into a global
 * `--nav-h` CSS variable on document.documentElement, which dependent
 * components reference as `style={{ top: 'var(--nav-h)' }}` so they
 * stay flush with the nav whether it expands, shrinks (mobile scrolled
 * collapse) or its content changes (i18n labels, etc.).
 */
import { useEffect, useState } from 'react';

export default function useElementHeight(ref) {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref?.current;
    if (!el) return undefined;
    // Seed with the current height so consumers don't paint a 0-height
    // first frame before ResizeObserver fires.
    setHeight(el.offsetHeight || 0);
    // Defer state updates to the next animation frame to break the
    // "ResizeObserver loop completed with undelivered notifications"
    // warning that fires when the callback triggers a layout change
    // synchronously (e.g. setState → re-render → resize → observer
    // queues another callback before the current one returns).
    let rafId = 0;
    const ro = new ResizeObserver((entries) => {
      const target = entries[0]?.target;
      if (!target) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const next = target.offsetHeight ?? 0;
        setHeight((prev) => (prev === next ? prev : next));
      });
    });
    ro.observe(el);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [ref]);

  return height;
}

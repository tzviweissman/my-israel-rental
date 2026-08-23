import { useEffect, useRef } from 'react';

/**
 * Keep a multi-step form's answers so nothing is lost when the page goes
 * away.
 *
 * Written after a new build could have reloaded someone mid-wizard: the
 * listing wizard held everything in component state and saved nothing,
 * so a reload — a deploy, a crashed tab, a misclicked back button, a
 * phone killing a backgrounded browser — lost the lot with no warning.
 * Whether the trigger is a deploy is beside the point; the form should
 * survive any of them.
 *
 * Restores SILENTLY. A "restore your draft?" prompt asks someone to
 * make a decision about work they never chose to lose, and the honest
 * answer is always yes — so the form simply reopens where they left it.
 *
 * Files are never stored. A File cannot be serialised, and uploads have
 * already become URLs by the time they reach form state, so what is kept
 * is the URL — which still points at a real uploaded image after a
 * reload.
 */

// Drafts are a convenience, not a record. One that resurfaces weeks
// later is a confusing surprise rather than a rescue.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const keyFor = (name) => `draft:${name}`;

/** Read a saved draft, or null. Safe in private mode. */
export function readDraft(name) {
  try {
    const raw = localStorage.getItem(keyFor(name));
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!at || Date.now() - at > MAX_AGE_MS) {
      localStorage.removeItem(keyFor(name));
      return null;
    }
    return data ?? null;
  } catch {
    return null;
  }
}

/** Forget a draft — call this once the thing is actually saved. */
export function clearDraft(name) {
  try { localStorage.removeItem(keyFor(name)); } catch { /* private mode */ }
}

/**
 * Persist `value` under `name` while it changes.
 *
 * @param {string}  name    stable per wizard, e.g. 'create-gig'
 * @param {object}  value   the form state
 * @param {boolean} enabled pass false once submitted, so the final
 *                          state is not written back after clearing
 */
export function useFormDraft(name, value, enabled = true) {
  const timer = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    // Debounced: a wizard's state changes on every keystroke, and
    // writing localStorage that often is both wasteful and jank on a
    // slow phone.
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(keyFor(name), JSON.stringify({ at: Date.now(), data: value }));
      } catch {
        // Quota or private mode. A draft that cannot be saved is not
        // worth an error message — the form still works.
      }
    }, 600);
    return () => clearTimeout(timer.current);
  }, [name, value, enabled]);

  // Also save immediately if the page is being hidden or closed: the
  // debounce above would otherwise drop the last few seconds of typing,
  // which is exactly the typing someone remembers doing.
  useEffect(() => {
    if (!enabled) return undefined;
    const flush = () => {
      try {
        localStorage.setItem(keyFor(name), JSON.stringify({ at: Date.now(), data: value }));
      } catch { /* nothing useful to do here */ }
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [name, value, enabled]);
}

export default useFormDraft;

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

/**
 * Tiny stale-while-revalidate cache for authed GET endpoints.
 *
 * Behavior:
 *  - First call to a key:  network → cache → state.
 *  - Subsequent calls:     return cached data instantly, then revalidate in
 *                          the background and update state if the response
 *                          changed.
 *  - In-flight dedup:      two components asking for the same key at the
 *                          same time share a single network request.
 *  - Invalidation:         components mutate the resource (POST/DELETE/PUT),
 *                          then call `refresh()` (returned by the hook) or
 *                          the module-level `invalidateAdminCache(urlPrefix)`.
 *
 * Why a custom hook (instead of `swr` or `@tanstack/react-query`)?
 *  - Six admin endpoints, ~50 LOC of behavior. Adding a 12kB lib is overkill.
 *  - Module-level cache survives tab switches without a context provider.
 *
 * Usage:
 *   const { data: users, refresh, isValidating } = useApiSWR(
 *     `${API}/admin/users`, token, { initial: [] }
 *   );
 */

// Module-level state — survives across re-mounts.
const cache = new Map();    // key -> { data, fetchedAt }
const inFlight = new Map(); // key -> Promise (dedup concurrent fetches)
// Subscribers: each mounted hook adds a (urlPrefix, refreshFn) entry so an
// invalidation can immediately refetch the tab the user is currently on.
const refreshSubscribers = new Set(); // { url, refresh } objects

// If the cached entry is fresher than this, we skip the background fetch
// entirely — the most direct way to actually *save* admin API calls when the
// user toggles between tabs in quick succession.
const DEFAULT_DEDUPE_MS = 30_000;

// A failed fetch caches nothing, so without this the hook just sits there
// showing `initial` (usually `[]`) until the component remounts. Every admin
// tab renders that as "nothing here" rather than "we couldn't ask", so a
// backend restart looked exactly like the data had been deleted. Retry a few
// times with backoff so a deploy blip heals itself.
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

/** Retry transport failures and 5xx; never retry a verdict the server meant.
 *  401/403 won't fix themselves, and hammering them just burns rate limit. */
const isRetryable = (err) => {
  const status = err?.response?.status;
  if (status === undefined) return true; // network error / timeout / CORS
  return status >= 500;
};

const buildKey = (url, token) => `${url}|${(token || '').slice(-12)}`;

export function useApiSWR(url, token, { initial = null, dedupeMs = DEFAULT_DEDUPE_MS } = {}) {
  const key = buildKey(url, token);
  const cached = cache.get(key);
  const [data, setData] = useState(() => (cached ? cached.data : initial));
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  // Track current key so a stale request from a previous key can't overwrite.
  const keyRef = useRef(key);
  keyRef.current = key;
  // Pending retry timer, so unmount / key-change can cancel it.
  const retryTimerRef = useRef(null);
  const cancelRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const refresh = useCallback(async ({ force = false, attempt = 0 } = {}) => {
    if (!url || !token) return;
    // A newer request supersedes any retry we had queued.
    cancelRetry();
    const reqKey = buildKey(url, token);
    const entry = cache.get(reqKey);
    if (!force && entry && Date.now() - entry.fetchedAt < dedupeMs) {
      // Cache is fresh enough — short-circuit. UI already shows it.
      return;
    }
    setIsValidating(true);
    try {
      // Dedup: if there's already an in-flight request for this key, await it.
      let p = inFlight.get(reqKey);
      if (!p) {
        p = axios
          .get(url, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.data);
        inFlight.set(reqKey, p);
        p.finally(() => { if (inFlight.get(reqKey) === p) inFlight.delete(reqKey); });
      }
      const fresh = await p;
      cache.set(reqKey, { data: fresh, fetchedAt: Date.now() });
      // Only commit if the consumer still cares about this key.
      if (keyRef.current === reqKey) {
        setData(fresh);
        setError(null);
      }
    } catch (e) {
      if (keyRef.current !== reqKey) return;
      setError(e);
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined && isRetryable(e)) {
        // `force` so the retry isn't short-circuited by the dedupe window.
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          if (keyRef.current === reqKey) {
            refreshRef.current?.({ force: true, attempt: attempt + 1 });
          }
        }, delay);
      }
    } finally {
      if (keyRef.current === reqKey) setIsValidating(false);
    }
  }, [url, token, dedupeMs, cancelRetry]);

  // Self-reference for the retry timer without making `refresh` depend on
  // itself (which would rebuild it every render and re-fire the mount effect).
  const refreshRef = useRef(null);
  refreshRef.current = refresh;

  // Never leave a timer running past unmount or a key change.
  useEffect(() => cancelRetry, [key, cancelRetry]);

  useEffect(() => {
    // On mount / key-change: trigger a (possibly-deduped) revalidation.
    // Cached data is already shown via the lazy initialiser above, so the
    // UI is instant when warm.
    refresh();
  }, [refresh]);

  // Subscribe to live invalidations: when the SSE channel pushes an
  // `invalidate` for a URL prefix that matches this hook's url, force a
  // refresh so the currently-mounted tab updates immediately.
  useEffect(() => {
    if (!url) return undefined;
    const sub = { url, refresh: () => refresh({ force: true }) };
    refreshSubscribers.add(sub);
    return () => { refreshSubscribers.delete(sub); };
  }, [url, refresh]);

  // Optimistic / manual override (useful right after a mutation).
  const mutate = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(data) : updater;
    cache.set(keyRef.current, { data: next, fetchedAt: Date.now() });
    setData(next);
  }, [data]);

  // Force a fresh fetch (post-mutation).
  const reload = useCallback(() => refresh({ force: true }), [refresh]);

  return { data, error, isValidating, refresh: reload, mutate };
}

/**
 * Drop every cached entry whose key includes this URL substring AND
 * trigger an immediate refresh on every mounted hook whose url matches.
 *
 * Path prefixes (e.g. ``/api/admin/properties``) work even though cache
 * keys store full URLs (``https://host/api/admin/properties|token``) —
 * we match by substring rather than ``startsWith``.
 *
 * Called by the SSE live-events hook so other admin sessions update in
 * near-real-time after a write happens elsewhere.
 */
export function invalidateAdminCache(urlPrefix) {
  for (const k of Array.from(cache.keys())) {
    if (k.includes(urlPrefix)) cache.delete(k);
  }
  // Notify mounted hooks so the UI rerenders without waiting for a tab switch.
  for (const sub of refreshSubscribers) {
    if (sub.url.includes(urlPrefix)) sub.refresh();
  }
}

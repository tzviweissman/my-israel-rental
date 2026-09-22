import { useEffect, useRef } from 'react';
import { invalidateAdminCache } from './useApiSWR';
import { API } from '../App';

/**
 * Open a single SSE connection to /api/admin/events for the lifetime of the
 * admin dashboard. Each `invalidate` event evicts the matching prefixes
 * from the SWR cache so any tab the user is currently looking at — or
 * switches to next — pulls fresh data instead of returning stale results
 * for up to 30 s.
 *
 * Notes:
 *  - We pass the JWT in the query string because the browser's EventSource
 *    cannot set Authorization headers. The token has the same scope and
 *    expiry as the regular Bearer token used for fetch requests.
 *  - Built-in EventSource auto-reconnect is good enough for a dashboard.
 *    If the network blips, the next reconnect will catch up via the regular
 *    SWR revalidation cycle anyway.
 *  - One connection per browser tab. We don't share via SharedWorker —
 *    overkill for two or three concurrent admin tabs.
 */
export function useAdminLiveEvents(token) {
  // Keep a ref to the source so React 18 strict-mode double-mount doesn't
  // open two connections in dev.
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!token) return undefined;
    if (sourceRef.current) return undefined; // already connected
    let stopped = false;
    let retry = null;

    /* The session token no longer goes in the URL (URLs end up in access
       logs; security scan F16). A one-minute ticket is fetched with the
       normal header and used to open the stream. The browser's own
       reconnect would retry with the SAME, by then expired, ticket, so on
       an error the stream is closed and reopened with a fresh one. */
    const open = async () => {
      let ticket;
      try {
        const res = await fetch(`${API}/admin/events/ticket`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        ticket = (await res.json()).ticket;
      } catch {
        retry = setTimeout(open, 15000);
        return;
      }
      if (stopped || !ticket) return;
      const es = new EventSource(`${API}/admin/events?token=${encodeURIComponent(ticket)}`);
      sourceRef.current = es;
      attach(es);
    };

    const attach = (es) => {
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'invalidate') {
            const prefixes = msg.payload?.prefixes || [];
            for (const p of prefixes) invalidateAdminCache(p);
          }
        } catch {
          /* ignore malformed events */
        }
      };

      es.onerror = () => {
        // Reopen with a fresh ticket rather than let the browser retry the
        // expired one. No console noise, by design.
        es.close();
        sourceRef.current = null;
        if (!stopped) retry = setTimeout(open, 5000);
      };
    };

    open();
    return () => {
      stopped = true;
      clearTimeout(retry);
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [token]);
}

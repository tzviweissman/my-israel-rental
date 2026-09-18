/**
 * Counts one page opened, on every route change, for the site-wide
 * visitor numbers on the admin overview (backend/routes/site_visits.py).
 *
 * Sends NOTHING about the page: no path, no title, no query string.
 * Several routes carry a credential in the path (/sign/<token>,
 * /orders/track/<token>), and the safest way to never store one is to never
 * send one. The request carries only the anonymous browser id that listing
 * views already use, and the sign-in token when there is one - solely so
 * the server can skip counting admins.
 *
 * `keepalive` so a count fired as someone navigates away still lands.
 * Every failure is swallowed: a metric must never become a visible error.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { API } from '../lib/apiBase';
import { getVisitorId } from '../utils/visitorId';

// The last page counted, at module level so it survives a remount. React's
// development mode runs every effect twice on start-up, and a re-render or
// a redirect that lands on the same page is not a second page opened.
// Going Home -> Stays -> Home still counts Home twice: only CONSECUTIVE
// repeats are dropped.
let lastCounted = null;

export default function SiteVisitTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === lastCounted) return;
    lastCounted = pathname;
    let token = null;
    try { token = sessionStorage.getItem('token'); } catch { /* private mode */ }
    const headers = { 'X-Visitor-Id': getVisitorId() || '' };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      fetch(`${API}/site/visit`, { method: 'POST', headers, keepalive: true }).catch(() => {});
    } catch { /* not fatal */ }
  }, [pathname]);

  return null;
}

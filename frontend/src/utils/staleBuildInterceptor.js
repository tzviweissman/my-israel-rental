/**
 * Global axios response interceptor that detects two kinds of post-deploy
 * version skew and pops a single "please refresh" toast (per session):
 *
 *  1. FRONTEND ahead of BACKEND — frontend calls a fresh API route the
 *     backend rollout hasn't propagated yet → FastAPI returns 404 with
 *     `detail: "Not Found"`. Catches the "I clicked Deploy and the next
 *     click immediately said 'failed'" race.
 *
 *  2. BACKEND redeployed mid-session — every response carries an
 *     `X-Build-Id` header stamped at backend boot. The interceptor
 *     captures the first one it sees as the session's baseline and
 *     toasts if a later response carries a different value (worker
 *     swapped under the user, possibly serving response shapes the
 *     loaded bundle wasn't built against).
 *
 * Cached per session via `sessionStorage` so we don't spam either way.
 * Wired in once from App.js. Idempotent — re-registering is safe.
 */
import axios from 'axios';
import { toast } from 'sonner';
import i18n from '../i18n';
import recentChangelog from '../data/recentChangelog';

let installed = false;

const STALE_FLAG = '__stale_build_toast_shown';
const BUILD_ID_KEY = '__backend_build_id';

const showStaleBuildToast = (reason) => {
  try {
    if (sessionStorage.getItem(STALE_FLAG)) return;
    sessionStorage.setItem(STALE_FLAG, '1');
  } catch {
    /* private mode — fall through and just show the toast once per page */
  }
  console.warn('[stale-build-detector]', reason);
  // Include the two most recent user-visible updates so people don't
  // just see "refresh please" — they see *what they'll get*.
  const highlights = recentChangelog.slice(0, 2);
  const description = highlights.length
    ? `What's new:\n${highlights.map((c) => `• ${c.title}`).join('\n')}`
    : undefined;
  // Was hardcoded English, so a Hebrew reader got an English toast — the
  // exact silent-fallback this project keeps tripping over.
  toast(
    i18n.t('update.availableRefresh',
      'A newer version of the site is available. Refresh to pick up the latest.'),
    {
      duration: 15000,
      position: 'top-center',
      description,
      action: {
        label: i18n.t('update.refresh', 'Update now'),
        onClick: () => window.location.reload(),
      },
    },
  );
};

/** Compare the X-Build-Id header on the response against the first one
 *  we observed in this session. A change means the backend got
 *  redeployed (worker swapped under us) — the frontend bundle is now
 *  potentially talking to API shapes it wasn't built against. */
const checkBuildIdDrift = (response) => {
  // axios lowercases headers in v1+, but be defensive for older configs.
  const headers = response?.headers || {};
  const incoming = headers['x-build-id'] || headers['X-Build-Id'];
  if (!incoming) return;
  let baseline;
  try {
    baseline = sessionStorage.getItem(BUILD_ID_KEY);
  } catch {
    baseline = null;
  }
  if (!baseline) {
    try { sessionStorage.setItem(BUILD_ID_KEY, incoming); } catch { /* noop */ }
    return;
  }
  if (incoming !== baseline) {
    showStaleBuildToast(`build-id drift: ${baseline} → ${incoming}`);
  }
};

export const installStaleBuildInterceptor = () => {
  if (installed) return;
  installed = true;
  axios.interceptors.response.use(
    (resp) => {
      checkBuildIdDrift(resp);
      return resp;
    },
    (err) => {
      // Drift can also leak through on error responses (e.g. 500). The
      // interceptor inspects the X-Build-Id even on rejected calls.
      if (err?.response) checkBuildIdDrift(err.response);
      const status = err?.response?.status;
      const url = err?.config?.url || '';
      const detail = err?.response?.data?.detail;
      if (status === 404 && url.includes('/api/') && detail === 'Not Found') {
        showStaleBuildToast(`route missing: ${url}`);
      }
      return Promise.reject(err);
    },
  );
};

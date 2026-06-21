/**
 * Global axios response interceptor that detects "the backend doesn't yet
 * know about an endpoint this build of the frontend just called" — i.e.
 * the classic post-deploy race where the user clicks a freshly-shipped
 * button before the backend rollout has propagated to their edge.
 *
 * Behaviour:
 *  - 404 on a `/api/...` URL → pop a single one-time toast asking the
 *    user to refresh. Cached per session so we don't spam them.
 *  - Anything else: pass through untouched (existing handlers still see
 *    the same axios error object).
 *
 * Wired in once from App.js. Idempotent — re-registering is safe.
 */
import axios from 'axios';
import { toast } from 'sonner';

let installed = false;

const SESSION_FLAG = '__stale_build_toast_shown';

const showStaleBuildToast = () => {
  try {
    if (sessionStorage.getItem(SESSION_FLAG)) return;
    sessionStorage.setItem(SESSION_FLAG, '1');
  } catch {
    /* private mode — fall through and just show the toast once per page */
  }
  toast(
    'A newer version of the site is available. Please refresh to get the latest features.',
    {
      duration: 12000,
      position: 'top-center',
      action: {
        label: 'Refresh',
        onClick: () => window.location.reload(),
      },
    },
  );
};

export const installStaleBuildInterceptor = () => {
  if (installed) return;
  installed = true;
  axios.interceptors.response.use(
    (resp) => resp,
    (err) => {
      const status = err?.response?.status;
      const url = err?.config?.url || '';
      // Only fire on API calls — never on static asset 404s or third-party
      // requests. The detail-body of a real 404 from FastAPI is "Not Found"
      // (and "Property not found" / similar custom messages from valid
      // routes). Show the banner ONLY when the detail is literally
      // "Not Found" — that's what FastAPI returns when the *route itself*
      // is missing, vs the route running and returning a custom 404.
      const detail = err?.response?.data?.detail;
      if (status === 404 && url.includes('/api/') && detail === 'Not Found') {
        showStaleBuildToast();
      }
      return Promise.reject(err);
    },
  );
};

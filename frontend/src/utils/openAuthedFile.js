/**
 * Open or download a file from a backend endpoint the browser cannot reach
 * on its own.
 *
 * Contracts used to be plain `<a href="/api/uploads/…">` links, which worked
 * only because the whole uploads/ tree was served publicly - i.e. anyone with
 * the URL could read a signed agreement. They're now behind permission-checked
 * endpoints, and NEITHER a bare `<a href>` NOR `window.open()` can attach an
 * Authorization header. FastAPI's HTTPBearer answers a missing header with a
 * 403, so any button that opens such a URL directly fails for everybody,
 * including the person it belongs to. That is not a hypothetical: it is what
 * two contract Download buttons did until 6 Sep 2026.
 *
 * So we fetch the bytes ourselves and hand the browser a blob URL.
 *
 * WITHOUT A TOKEN THIS STILL WORKS, and that case is the point of the
 * `token` argument being optional. The external signer on /sign/:signToken
 * has no account and never will; their entitlement is the unguessable token
 * in the URL, checked by the endpoint. Sending `Bearer undefined` would turn
 * their perfectly valid request into a 401, so the header is omitted rather
 * than sent empty.
 */
import axios from 'axios';
import { toast } from 'sonner';

import i18n from '../i18n';

/**
 * @param {string} path    API path, e.g. `/bookings/<id>/signed-contract`
 * @param {string} apiBase The API root (the `API` constant from App.js)
 * @param {string} [token] Bearer token. Omit for an endpoint whose
 *                         credential is in the path, such as a sign link.
 * @param {object} [opts]  { download?: boolean, filename?: string }
 */
export default async function openAuthedFile(path, apiBase, token, opts = {}) {
  try {
    const res = await axios.get(`${apiBase}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      responseType: 'blob',
    });

    const blobUrl = URL.createObjectURL(res.data);

    if (opts.download) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = opts.filename || 'contract';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      // Open in a new tab for inline viewing (PDF/image).
      window.open(blobUrl, '_blank', 'noopener');
    }

    // Give the browser a moment to consume the blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return true;
  } catch (e) {
    /* Translated, because one of the callers is a page shown to somebody who
       does not have an account here and may well be reading in Hebrew. `t`
       off the shared instance rather than a hook: this is a util, and a
       caller that had to pass one in would eventually forget. */
    const status = e?.response?.status;
    const say = (key, fallback) => toast.error(i18n.t(key, fallback));
    if (status === 401 || status === 403) say('contracts.notAuthorized', 'You are not authorized to view this contract');
    else if (status === 404) say('contracts.notAvailable', 'Contract not available');
    else say('contracts.openFailed', 'Could not open contract');
    return false;
  }
}

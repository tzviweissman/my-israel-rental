/**
 * Open or download a file from an authenticated backend endpoint.
 *
 * Contracts used to be plain `<a href="/api/uploads/…">` links, which worked
 * only because the whole uploads/ tree was served publicly — i.e. anyone with
 * the URL could read a signed agreement. They're now behind permission-checked
 * endpoints, and a bare <a href> can't attach an Authorization header, so we
 * fetch the bytes with the token and hand the browser a blob URL instead.
 */
import axios from 'axios';
import { toast } from 'sonner';

/**
 * @param {string} path    API path, e.g. `/bookings/<id>/signed-contract`
 * @param {string} apiBase The API root (the `API` constant from App.js)
 * @param {string} token   Bearer token
 * @param {object} [opts]  { download?: boolean, filename?: string }
 */
export default async function openAuthedFile(path, apiBase, token, opts = {}) {
  try {
    const res = await axios.get(`${apiBase}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
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
    const status = e?.response?.status;
    if (status === 403) toast.error('You are not authorized to view this contract');
    else if (status === 404) toast.error('Contract not available');
    else toast.error('Could not open contract');
    return false;
  }
}

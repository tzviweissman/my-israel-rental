import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

/**
 * `/p/:slug` — where a scanned QR lands (spec Q1/Q2).
 *
 * Why this is a page and not a server 302: `myisraelrental.com` resolves to
 * the FRONTEND service, which is a static file server and cannot issue a
 * redirect to a computed target. Putting the short link on the backend's own
 * domain would give a true 302 but a sixty-character URL — which defeats the
 * entire point of a short link, since QR density is exactly what Q1 exists to
 * fix.
 *
 * So the browser performs the hop. What matters is preserved: the scan is
 * counted SERVER-SIDE by the resolve call, on the follow, before the
 * destination renders. A visitor who bounces is still counted.
 *
 * If a short domain is ever pointed at the backend, this page can stay as a
 * fallback or go away entirely — no printed code breaks either way, because
 * the slug is what is printed, not the host.
 */
import { BACKEND_URL as API } from '../lib/apiBase';

const ShortLinkRedirect = () => {
  const { slug } = useParams();
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/api/short-links/${slug}/resolve`);
        if (cancelled) return;
        // `replace`, not `assign`: pressing Back should return to whatever
        // the person was doing before scanning, not bounce them through
        // this page again and count a second scan.
        window.location.replace(data.target);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center">
      <div>
        <p style={{ color: 'var(--brand-muted)' }}>
          {failed
            ? t('shortLink.notFound', "This link doesn't exist or has been removed.")
            : t('shortLink.opening', 'Opening…')}
        </p>
        {failed && (
          <a
            href="/"
            className="inline-block mt-4 text-sm font-semibold"
            style={{ color: 'var(--brand-primary)' }}
          >
            {t('shortLink.goHome', 'Go to MyIsraelRental')}
          </a>
        )}
      </div>
    </div>
  );
};

export default ShortLinkRedirect;
